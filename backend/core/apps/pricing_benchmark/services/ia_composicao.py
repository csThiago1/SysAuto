"""
Paddock Solutions — Pricing Benchmark — IA Composição Service
Motor de Orçamentos (MO) — Sprint MO-8

Sugestão de composição (ServiçosCanônicos + PeçasCanônicas) via Claude Sonnet 4.6.

REGRAS ABSOLUTAS (Armadilha A10):
1. Claude NUNCA sugere preço, margem, custo ou valor monetário.
2. Validação em 3 camadas: system prompt, _validar(), schema sem campo de preço.
3. Contexto truncado a 50 serviços + 50 peças (Armadilha P7).
4. JSON com fallback de extração de bloco ```json ... ``` (Armadilha P8).
"""
import json
import logging
import re
import time

from django.conf import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é um consultor técnico de oficina automotiva. Dado
um BRIEFING livre do cliente ou seguradora descrevendo o serviço pedido,
sua tarefa é propor uma COMPOSIÇÃO estruturada de serviços canônicos e
peças canônicas do catálogo da oficina.

REGRAS ABSOLUTAS:
1. NUNCA sugira preço, margem, custo ou valor monetário.
2. Use APENAS os códigos canônicos fornecidos no contexto — se não houver
   correspondência, retorne "indeterminado" com observação.
3. Estime quantidades conservadoras (arredondadas pra cima em dúvida).
4. Mencione peças opcionais em campo "opcional" separado.

FORMATO DE SAÍDA (JSON estrito):
{
  "servicos": [
    {"codigo": "...", "quantidade": 1, "confianca": 0.85, "motivo": "..."}
  ],
  "pecas": [
    {"codigo": "...", "quantidade": 1, "confianca": 0.75, "motivo": "..."}
  ],
  "opcional": [
    {"tipo": "peca", "codigo": "...", "motivo": "recomendado se dano > 2cm"}
  ],
  "avisos": ["..."]
}"""

TERMOS_PRECO = re.compile(
    r"\b(preço|preco|custo|valor|r\$|reais|margem|desconto|cobrar|cobrado)\b",
    re.IGNORECASE,
)


class IAComposicaoInvalida(Exception):
    """Resposta da IA inválida ou violou regras de segurança."""


class IAComposicaoService:
    """Chama Claude Sonnet 4.6 para sugerir composição de serviços e peças."""

    @staticmethod
    def sugerir(
        briefing: str,
        veiculo: dict,
        servicos_canonicos_contexto: list[dict],
        pecas_canonicas_contexto: list[dict],
    ) -> dict:
        """Chama Claude com contexto filtrado e retorna JSON estruturado.

        Args:
            briefing: Texto livre descrevendo o serviço pedido.
            veiculo: dict com marca, modelo, ano, segmento.
            servicos_canonicos_contexto: Lista de dicts com {codigo, nome} — max 50.
            pecas_canonicas_contexto: Lista de dicts com {codigo, nome} — max 50.

        Returns:
            dict com keys: servicos, pecas, opcional, avisos.

        Raises:
            IAComposicaoInvalida: se resposta inválida, contém preço ou schema errado.
        """
        try:
            from anthropic import Anthropic
        except ImportError:
            logger.error("anthropic SDK não instalado — pip install anthropic")
            raise IAComposicaoInvalida("anthropic SDK não disponível.")

        api_key = getattr(settings, "ANTHROPIC_API_KEY", None)
        if not api_key:
            raise IAComposicaoInvalida("ANTHROPIC_API_KEY não configurada.")

        client = Anthropic(api_key=api_key)

        user_msg = json.dumps(
            {
                "veiculo": veiculo,
                "briefing": briefing,
                "catalogo_servicos": servicos_canonicos_contexto[:50],
                "catalogo_pecas": pecas_canonicas_contexto[:50],
            },
            ensure_ascii=False,
        )

        t0 = time.perf_counter()
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            temperature=0.3,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.info(f"[ia_composicao] elapsed_ms={elapsed_ms}")

        raw = resp.content[0].text
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Fallback: extrai JSON de bloco ```json ... ```
            match = re.search(r"```json\s*(\{.*?\})\s*```", raw, re.DOTALL)
            if not match:
                raise IAComposicaoInvalida("Resposta IA não é JSON válido.")
            try:
                data = json.loads(match.group(1))
            except json.JSONDecodeError as exc:
                raise IAComposicaoInvalida(f"JSON em bloco markdown inválido: {exc}") from exc

        IAComposicaoService._validar(data)
        data["_meta"] = {"elapsed_ms": elapsed_ms, "modelo": "claude-sonnet-4-6"}
        return data

    @staticmethod
    def _validar(data: dict) -> None:
        """Valida schema e garante que nenhum campo contém preço.

        Raises:
            IAComposicaoInvalida: se schema inválido ou preço detectado.
        """
        if "servicos" not in data or "pecas" not in data:
            raise IAComposicaoInvalida("Schema inválido: faltam 'servicos' ou 'pecas'.")

        payload_str = json.dumps(data, ensure_ascii=False)
        if TERMOS_PRECO.search(payload_str):
            raise IAComposicaoInvalida(
                "IA violou regra A10 — resposta contém termo de preço/custo/valor."
            )

        # Schema mínimo por item de serviço
        for item in data.get("servicos", []):
            if "codigo" not in item:
                raise IAComposicaoInvalida("Item de serviço sem 'codigo'.")
        for item in data.get("pecas", []):
            if "codigo" not in item:
                raise IAComposicaoInvalida("Item de peça sem 'codigo'.")
