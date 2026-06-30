# MO-Sprint 08 — Benchmark de Mercado + Sugestão por IA

**Duração:** 2 semanas | **Equipe:** Solo + Claude Code | **Prioridade:** P1
**Pré-requisitos:** MO-6 (motor), MO-7 (orçamento) · **Desbloqueia:** MO-9

---

## Objetivo

Duas camadas complementares — **determinística** (benchmark) e **heurística** (IA):

1. **Benchmark de mercado**: ingestão de relatórios de seguradoras e cotações
   externas (PDF/CSV/JSON) → `BenchmarkAmostra` → p50/p90 por segmento × serviço.
   Alimenta `BenchmarkService.p90_*` (stub em MO-6).
2. **Alias engine avançado**: pipeline completo em produção (exato → fuzzy →
   embedding) com correção humana em circuito fechado.
3. **Sugestão por IA (Claude Sonnet 4.6)**: dado um texto livre de briefing
   do cliente/seguradora, propor uma **composição** de `ServicoCanonico` +
   `PecaCanonica`. **Nunca preço.**

Claude atua como assistente de composição. O motor continua calculando preço
determinístico por cima da composição sugerida.

---

## Referências obrigatórias

1. `docs/mo-roadmap.md` — **armadilhas A7 (benchmark teto), A10 (Claude nunca preço)**.
2. Spec v3.0 — §22 (benchmark), §23 (alias avançado), §24 (IA composição).
3. `AliasMatcher` (MO-2) — usar e estender, não substituir.
4. `BenchmarkService.p90_*` stubs em `apps.pricing_engine.services.benchmark`.
5. CLAUDE.md — "IA (Claude API)" + RAG pgvector + temperature 0.3 para fatos.

---

## Escopo

### 1. Novo app: `apps.pricing_benchmark` (TENANT_APP)

#### Models

```python
# apps/pricing_benchmark/models.py

class BenchmarkFonte(PaddockBaseModel):
    """Origem das amostras — seguradora, marketplace, consultoria."""

    TIPOS = [
        ("seguradora_pdf",   "Relatório PDF de seguradora"),
        ("seguradora_json",  "API JSON de seguradora"),
        ("cotacao_externa",  "Cotação manual / marketplace"),
        ("concorrente",      "Auditoria de concorrente"),
    ]

    empresa = models.ForeignKey("pricing_profile.Empresa", on_delete=models.CASCADE)
    nome = models.CharField(max_length=100)
    tipo = models.CharField(max_length=30, choices=TIPOS)
    fornecedor = models.ForeignKey(
        "persons.Pessoa", null=True, blank=True,
        on_delete=models.SET_NULL,
        help_text="Seguradora ou parceiro que forneceu o dado.",
    )
    confiabilidade = models.DecimalField(
        max_digits=3, decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1"))],
        default=Decimal("0.8"),
        help_text="Peso da fonte no cálculo de p90 (0-1).",
    )
    is_active = models.BooleanField(default=True)


class BenchmarkIngestao(PaddockBaseModel):
    """Registro de cada ingestão de arquivo/fonte."""

    STATUS = [
        ("recebido",     "Recebido"),
        ("processando",  "Processando"),
        ("concluido",    "Concluído"),
        ("erro",         "Erro"),
    ]

    fonte = models.ForeignKey(BenchmarkFonte, on_delete=models.PROTECT, related_name="ingestoes")
    arquivo = models.FileField(upload_to="benchmark/ingestoes/", null=True, blank=True)
    metadados = models.JSONField(default=dict)
    # Ex: {"pdf_paginas": 12, "periodo": "2026-Q1"}

    status = models.CharField(max_length=20, choices=STATUS, default="recebido")
    iniciado_em = models.DateTimeField(null=True, blank=True)
    concluido_em = models.DateTimeField(null=True, blank=True)
    amostras_importadas = models.PositiveIntegerField(default=0)
    amostras_descartadas = models.PositiveIntegerField(default=0)
    log_erro = models.TextField(blank=True)

    criado_por = models.ForeignKey(
        "authentication.GlobalUser", null=True, on_delete=models.SET_NULL,
    )
    criado_em = models.DateTimeField(auto_now_add=True)


class BenchmarkAmostra(PaddockBaseModel):
    """Uma linha de cotação/sinistro externa — unidade atômica do benchmark."""

    ingestao = models.ForeignKey(BenchmarkIngestao, on_delete=models.CASCADE, related_name="amostras")
    fonte = models.ForeignKey(BenchmarkFonte, on_delete=models.PROTECT)

    tipo_item = models.CharField(
        max_length=10,
        choices=[("servico", "Serviço"), ("peca", "Peça")],
    )
    servico_canonico = models.ForeignKey(
        "pricing_catalog.ServicoCanonico", null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica", null=True, blank=True,
        on_delete=models.SET_NULL,
    )

    # Se o match com canônico falhou, guarda texto bruto
    descricao_bruta = models.TextField()
    alias_match_confianca = models.DecimalField(
        max_digits=3, decimal_places=2, null=True, blank=True,
    )
    # null = não casou ou aguardando revisão

    segmento = models.ForeignKey("pricing_profile.SegmentoVeicular", null=True, blank=True, on_delete=models.SET_NULL)
    tamanho = models.ForeignKey("pricing_profile.CategoriaTamanho", null=True, blank=True, on_delete=models.SET_NULL)
    veiculo_marca = models.CharField(max_length=60, blank=True)
    veiculo_modelo = models.CharField(max_length=100, blank=True)
    veiculo_ano = models.PositiveIntegerField(null=True, blank=True)

    valor_praticado = models.DecimalField(max_digits=12, decimal_places=2)
    moeda = models.CharField(max_length=3, default="BRL")
    data_referencia = models.DateField()

    metadados = models.JSONField(default=dict)
    # Ex: {"pagina_pdf": 3, "numero_sinistro": "...", "oficina_referencia": "..."}

    revisado = models.BooleanField(default=False)
    revisado_por = models.ForeignKey(
        "authentication.GlobalUser", null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    descartada = models.BooleanField(default=False)
    motivo_descarte = models.CharField(max_length=200, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["servico_canonico", "segmento", "tamanho", "data_referencia"]),
            models.Index(fields=["peca_canonica", "data_referencia"]),
            models.Index(fields=["ingestao", "descartada"]),
        ]
```

---

### 2. Pipeline de ingestão de PDF

#### Fluxo

```
Upload PDF → BenchmarkIngestao(status=recebido)
  ↓ Celery task: task_processar_pdf_seguradora
  ↓ pdfplumber extrai tabelas + texto
  ↓ regex + heurística: detecta linhas de "serviço | valor | veículo | data"
  ↓ Para cada linha: AliasMatcher.match() para resolver canônico
  ↓ Cria BenchmarkAmostra (descricao_bruta + tentativa de match)
  ↓ Linhas sem match confiança alta → aguardam revisão humana
  ↓ BenchmarkIngestao.status=concluido
```

#### Service

```python
# apps/pricing_benchmark/services/pdf_ingestion.py

import pdfplumber
import re
from decimal import Decimal

class PDFIngestionService:
    """Extrai amostras de relatórios PDF de seguradoras.

    Heurística robusta: ignora headers repetidos, detecta seções por título,
    tolera diferenças de formatação entre seguradoras.
    """

    REGEX_VALOR = re.compile(r"R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})")
    REGEX_ANO = re.compile(r"\b(19|20)\d{2}\b")

    @classmethod
    def processar(cls, ingestao_id: int) -> dict:
        ing = BenchmarkIngestao.objects.get(id=ingestao_id)
        ing.status = "processando"
        ing.iniciado_em = timezone.now()
        ing.save(update_fields=["status", "iniciado_em"])

        amostras = 0
        descartadas = 0
        try:
            with pdfplumber.open(ing.arquivo.path) as pdf:
                for page_num, page in enumerate(pdf.pages, start=1):
                    tables = page.extract_tables() or []
                    for table in tables:
                        for row in table:
                            resultado = cls._processar_linha(
                                row, page_num, ing,
                            )
                            if resultado == "amostra":
                                amostras += 1
                            elif resultado == "descartada":
                                descartadas += 1

            ing.status = "concluido"
            ing.amostras_importadas = amostras
            ing.amostras_descartadas = descartadas
            ing.concluido_em = timezone.now()
            ing.save(update_fields=[
                "status", "amostras_importadas", "amostras_descartadas", "concluido_em",
            ])
            return {"amostras": amostras, "descartadas": descartadas}
        except Exception as e:
            ing.status = "erro"
            ing.log_erro = str(e)[:5000]
            ing.save(update_fields=["status", "log_erro"])
            raise

    @classmethod
    def _processar_linha(cls, row: list, page_num: int, ing) -> str:
        # Row é lista de células. Implementação precisa ser adaptada
        # por template de seguradora — começamos com uma por vez.
        texto_completo = " ".join(c or "" for c in row)
        valor_match = cls.REGEX_VALOR.search(texto_completo)
        if not valor_match:
            return "ignorada"

        valor = Decimal(valor_match.group(1).replace(".", "").replace(",", "."))
        ano_match = cls.REGEX_ANO.search(texto_completo)

        # Remove o valor do texto para ajudar o matcher
        descricao = texto_completo.replace(valor_match.group(0), "").strip()

        # AliasMatcher
        res = AliasMatcher.match_servico(descricao)
        # res = {"canonical_id": int|None, "confianca": float, "via": "exato|fuzzy|emb"}

        BenchmarkAmostra.objects.create(
            ingestao=ing,
            fonte=ing.fonte,
            tipo_item="servico",
            servico_canonico_id=(res["canonical_id"] if res["confianca"] >= 0.85 else None),
            descricao_bruta=descricao,
            alias_match_confianca=Decimal(str(res["confianca"])) if res["confianca"] else None,
            valor_praticado=valor,
            data_referencia=ing.metadados.get("periodo_ref", date.today()),
            veiculo_ano=int(ano_match.group(0)) if ano_match else None,
            metadados={"pagina_pdf": page_num, "match_via": res.get("via")},
        )
        return "amostra"
```

Cada template de seguradora pode precisar de adaptação — começar com **uma
seguradora ativa** em produção (Porto Seguro, Azul Seguros) e expandir.

#### Task Celery

```python
@shared_task
def task_processar_pdf_seguradora(ingestao_id: int, tenant_schema: str) -> dict:
    with schema_context(tenant_schema):
        return PDFIngestionService.processar(ingestao_id)
```

---

### 3. BenchmarkService — implementação real

```python
# apps/pricing_engine/services/benchmark.py (substitui stub)

from django.db.models import Q
from statistics import quantiles
from datetime import date, timedelta

class BenchmarkService:
    JANELA_DIAS = 90
    MINIMO_AMOSTRAS = 8

    @staticmethod
    def p90_servico(
        empresa_id: int,
        servico_id: int,
        segmento_id: int,
        tamanho_id: int,
    ) -> Decimal | None:
        """Retorna p90 de valor_praticado nas amostras válidas, ou None."""
        desde = date.today() - timedelta(days=BenchmarkService.JANELA_DIAS)

        qs = BenchmarkAmostra.objects.filter(
            tipo_item="servico",
            servico_canonico_id=servico_id,
            descartada=False,
            data_referencia__gte=desde,
        ).filter(
            Q(segmento_id=segmento_id) | Q(segmento__isnull=True)
        ).filter(
            Q(tamanho_id=tamanho_id) | Q(tamanho__isnull=True)
        )

        valores = list(qs.values_list("valor_praticado", flat=True))
        if len(valores) < BenchmarkService.MINIMO_AMOSTRAS:
            return None

        valores_float = [float(v) for v in valores]
        p90 = quantiles(valores_float, n=10)[8]  # 9º decil = p90
        return Decimal(f"{p90:.2f}")

    @staticmethod
    def p90_peca(empresa_id: int, peca_id: int) -> Decimal | None:
        desde = date.today() - timedelta(days=BenchmarkService.JANELA_DIAS)
        valores = list(
            BenchmarkAmostra.objects.filter(
                tipo_item="peca",
                peca_canonica_id=peca_id,
                descartada=False,
                data_referencia__gte=desde,
            ).values_list("valor_praticado", flat=True)
        )
        if len(valores) < BenchmarkService.MINIMO_AMOSTRAS:
            return None
        valores_float = [float(v) for v in valores]
        p90 = quantiles(valores_float, n=10)[8]
        return Decimal(f"{p90:.2f}")

    @staticmethod
    def estatisticas_servico(servico_id: int, segmento_id: int, tamanho_id: int) -> dict:
        """Para UI de visualização: p50, p90, min, max, count."""
        ...
```

---

### 4. Alias pipeline avançado + correção humana

A sprint MO-2 entregou o matcher básico. Aqui adicionamos:

#### Interface de revisão

- Tela `/cadastros/alias/revisao`: lista amostras com `alias_match_confianca < 0.85`.
- Por linha: descrição bruta + sugestão atual + dropdown de canônicos alternativos.
- Ações: **Aceitar sugestão**, **Escolher outro canônico**, **Criar novo canônico**, **Descartar**.

#### Fluxo de aprendizado

Ao aceitar um match manualmente:
- Criar registro em `AliasServico` / `AliasPeca` (do MO-2) com a descrição bruta como alias oficial.
- Disparar re-embedding para pgvector.
- Futuras amostras idênticas entram pelo caminho **exato** (mais rápido, sem embedding).

```python
# apps/pricing_benchmark/services/alias_feedback.py

class AliasFeedbackService:
    @staticmethod
    @transaction.atomic
    def aceitar_match(amostra_id: str, canonical_id: int, user_id: str) -> dict:
        amostra = BenchmarkAmostra.objects.get(id=amostra_id)
        if amostra.tipo_item == "servico":
            AliasServico.objects.get_or_create(
                texto_normalizado=normalizar_texto(amostra.descricao_bruta),
                defaults={
                    "texto_original": amostra.descricao_bruta,
                    "servico_canonico_id": canonical_id,
                    "fonte": "benchmark_revisao",
                    "criado_por_id": user_id,
                },
            )
            amostra.servico_canonico_id = canonical_id
        else:
            AliasPeca.objects.get_or_create(
                texto_normalizado=normalizar_texto(amostra.descricao_bruta),
                defaults={
                    "texto_original": amostra.descricao_bruta,
                    "peca_canonica_id": canonical_id,
                    "fonte": "benchmark_revisao",
                    "criado_por_id": user_id,
                },
            )
            amostra.peca_canonica_id = canonical_id

        amostra.alias_match_confianca = Decimal("1.00")
        amostra.revisado = True
        amostra.revisado_por_id = user_id
        amostra.save(update_fields=[
            "servico_canonico", "peca_canonica",
            "alias_match_confianca", "revisado", "revisado_por",
        ])
        # Celery reindex
        task_reembed_alias.delay(canonical_id, amostra.tipo_item)
        return {"alias_criado": True}
```

---

### 5. Sugestão por IA (Claude Sonnet 4.6)

#### Service

```python
# apps/pricing_engine/services/ia_composicao.py

from anthropic import Anthropic
import json

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
}
"""


class IAComposicaoService:
    @staticmethod
    def sugerir(
        briefing: str,
        veiculo: dict,
        servicos_canonicos_contexto: list[dict],
        pecas_canonicas_contexto: list[dict],
    ) -> dict:
        """Chama Claude com contexto filtrado e retorna JSON estruturado.

        Contexto deve ser pré-filtrado por:
        - Categoria do serviço inferida (pintura, funilaria, elétrica...)
        - Modelo do veículo (peças compatíveis)
        Mantém o prompt abaixo de 4k tokens.
        """
        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        user_msg = json.dumps({
            "veiculo": veiculo,
            "briefing": briefing,
            "catalogo_servicos": servicos_canonicos_contexto[:50],
            "catalogo_pecas": pecas_canonicos_contexto[:50],
        }, ensure_ascii=False)

        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            temperature=0.3,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = resp.content[0].text
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Extrai JSON de bloco ```json ... ```
            match = re.search(r"```json\s*(\{.*?\})\s*```", raw, re.DOTALL)
            if not match:
                raise IAComposicaoInvalida("Resposta não é JSON.")
            data = json.loads(match.group(1))

        IAComposicaoService._validar(data)
        return data

    @staticmethod
    def _validar(data: dict) -> None:
        if "servicos" not in data or "pecas" not in data:
            raise IAComposicaoInvalida("Schema inválido.")
        for item in data.get("servicos", []):
            if any(k in str(item).lower() for k in ["preço", "preco", "r$", "valor"]):
                # ARMADILHA A10 — se a IA tentou sugerir preço, rejeita
                raise IAComposicaoInvalida("IA violou regra — preço sugerido.")
```

#### Integração com orçamento

No frontend, na tela `/orcamentos/novo` step 4 (itens), botão "Sugerir composição via IA":
- Abre modal com textarea grande para briefing.
- Chama `POST /pricing/ia/sugerir-composicao/` com briefing + veículo.
- Exibe resultado: lista de serviços+peças sugeridos, cada um com checkbox.
- Usuário revisa e marca quais aceita → adiciona ao orçamento como linhas.
- Motor calcula preço por cima dessas linhas (normalmente, sem IA tocar em preço).

#### Armazenar sugestões para aprendizado

```python
class SugestaoIA(PaddockBaseModel):
    orcamento = models.ForeignKey("quotes.Orcamento", null=True, on_delete=models.SET_NULL)
    briefing = models.TextField()
    veiculo_info = models.JSONField()
    resposta_raw = models.JSONField()
    servicos_aceitos = models.ManyToManyField("pricing_catalog.ServicoCanonico", blank=True)
    pecas_aceitas = models.ManyToManyField("pricing_catalog.PecaCanonica", blank=True)
    avaliacao = models.CharField(
        max_length=20,
        choices=[("util", "Útil"), ("parcial", "Parcial"), ("ruim", "Ruim")],
        blank=True,
    )
    modelo_usado = models.CharField(max_length=50, default="claude-sonnet-4-6")
    tempo_resposta_ms = models.PositiveIntegerField(null=True)
    criado_por = models.ForeignKey("authentication.GlobalUser", null=True, on_delete=models.SET_NULL)
    criado_em = models.DateTimeField(auto_now_add=True)
```

Isso vira dataset para fine-tuning / prompt engineering futuro (MO-9).

---

### 6. Endpoints

```
# Benchmark
POST   /api/v1/pricing/benchmark/fontes/                       (ADMIN+)
GET    /api/v1/pricing/benchmark/fontes/                       (MANAGER+)
POST   /api/v1/pricing/benchmark/ingestoes/                    upload PDF/CSV (MANAGER+)
GET    /api/v1/pricing/benchmark/ingestoes/                    paginado
GET    /api/v1/pricing/benchmark/ingestoes/{id}/               status + contadores
GET    /api/v1/pricing/benchmark/amostras/?revisao_pendente=1  (MANAGER+)
POST   /api/v1/pricing/benchmark/amostras/{id}/aceitar-match/  body: {canonical_id}
POST   /api/v1/pricing/benchmark/amostras/{id}/descartar/      body: {motivo}
GET    /api/v1/pricing/benchmark/estatisticas/servico/{id}/    segmento+tamanho query params

# IA composição
POST   /api/v1/pricing/ia/sugerir-composicao/                  body: {briefing, veiculo}
POST   /api/v1/pricing/ia/avaliar-sugestao/{id}/               body: {avaliacao}
GET    /api/v1/pricing/ia/sugestoes/                           histórico (MANAGER+)
```

---

### 7. Frontend

#### Página: `/benchmark/fontes`

CRUD de `BenchmarkFonte`. Campos: nome, tipo (select), fornecedor (autocomplete Pessoa), confiabilidade (slider 0-1).

#### Página: `/benchmark/ingestoes`

Lista + botão "Nova ingestão":
- Fonte (select).
- Arquivo (file input, PDF/CSV).
- Período de referência.
- Submit → dispara Celery task, mostra progresso.

Lista mostra: data · fonte · status · amostras_importadas · amostras_descartadas. Clique abre drill-down das amostras dessa ingestão.

#### Página: `/benchmark/revisao`

Interface tipo "inbox" para amostras com confiança < 0.85:
- Esquerda: lista paginada.
- Direita: painel de detalhe com descrição bruta + contexto + sugestão atual.
- Botões: Aceitar · Outro canônico (abre autocomplete) · Criar novo (redireciona) · Descartar.
- Contador de pendentes no sidebar para lembrar.

#### Página: `/benchmark/estatisticas`

Dashboard com gráficos:
- Histograma de valor_praticado por serviço (seleciona serviço + segmento + tamanho).
- Linha do p50/p90 no tempo (últimos 90/180/365 dias).
- Comparativo: preço calculado pelo motor × p90 benchmark × p50 benchmark.

#### Página: `/orcamentos/novo` (extensão step 4)

Botão "Sugerir composição por IA":
- Modal com textarea para briefing (500 chars mín).
- Ao submeter, mostra loading + spinner.
- Resposta: lista de itens sugeridos com confiança visual (bar).
- Checkbox por item → adiciona ao orçamento como linha nova.
- Campo "Avaliar sugestão" (ok/parcial/ruim) no final — grava em `SugestaoIA`.

---

### 8. Admin Django

- `BenchmarkFonte` — editable.
- `BenchmarkIngestao` — read-only + ação "Reprocessar" (re-dispara Celery).
- `BenchmarkAmostra` — list filter por ingestao, segmento, revisado, descartada.
- `SugestaoIA` — read-only + search por briefing.

---

## Testes

### Backend (pytest) — 35+ testes

```
tests/pricing_benchmark/
├── test_pdf_ingestion.py
│   ├── test_extrai_amostras_formato_porto_seguro      # fixture PDF
│   ├── test_extrai_amostras_formato_azul              # fixture PDF
│   ├── test_valor_formatado_brasileiro_parseado
│   ├── test_descarta_linha_sem_valor
│   ├── test_atualiza_contadores_na_ingestao
│   └── test_erro_parsing_marca_status_erro
├── test_benchmark_service.py
│   ├── test_p90_retorna_none_abaixo_minimo_amostras
│   ├── test_p90_calculo_correto_conhecido             # valores fixos
│   ├── test_p90_ignora_descartadas
│   ├── test_p90_respeita_janela_dias
│   └── test_fallback_sem_segmento_usa_amostras_gerais
├── test_alias_feedback.py
│   ├── test_aceitar_match_cria_alias_servico
│   ├── test_aceitar_match_dispara_reembed
│   └── test_amostra_marca_revisado
├── test_ia_composicao.py
│   ├── test_resposta_json_estrito_parseado
│   ├── test_resposta_com_bloco_markdown_extraido     # ```json ... ```
│   ├── test_resposta_com_preco_rejeitada             # A10
│   ├── test_schema_invalido_raise
│   ├── test_catalogo_contexto_truncado_50
│   └── test_timeout_cliente_api_tratado

tests/pricing_engine/
├── test_benchmark_integra_motor.py
│   ├── test_motor_aplica_teto_quando_p90_menor
│   └── test_motor_ignora_teto_quando_p90_maior
```

### Playwright

```
e2e/benchmark-flow.spec.ts
  ├── Admin cria BenchmarkFonte "Porto Seguro Q1"
  ├── Upload de PDF de teste (fixture real)
  ├── Aguarda processamento
  ├── Abre /benchmark/revisao
  ├── Aceita 3 matches manualmente
  ├── Verifica p90 calculado em /benchmark/estatisticas
  └── Cria orçamento → vê teto aplicado no simulador

e2e/ia-composicao.spec.ts
  ├── Abre /orcamentos/novo
  ├── Preenche cliente + veículo
  ├── Step 4: clica "Sugerir por IA"
  ├── Digita "Batida leve no para-choque traseiro, precisa pintar e substituir"
  ├── Aguarda resposta IA
  ├── Verifica serviços/peças sugeridos
  ├── Seleciona 3 itens
  └── Verifica que viraram linhas do orçamento
```

---

## Critérios de aceite

- [ ] Ingestão de PDF fixture gera ≥ 20 amostras no primeiro teste.
- [ ] Amostras com confiança < 0.85 aparecem em `/benchmark/revisao`.
- [ ] Aceitar match manual cria `AliasServico`/`AliasPeca` + re-embedding disparado.
- [ ] `BenchmarkService.p90_servico()` retorna valor determinístico com ≥ 8 amostras.
- [ ] Motor aplica teto p90 no orçamento quando preço calculado > teto.
- [ ] IA composição nunca devolve campo com valor monetário (regex no teste).
- [ ] Tempo de resposta da IA < 8s p95.
- [ ] `SugestaoIA` persiste briefing + resposta + itens aceitos + avaliação.
- [ ] Dashboard `/benchmark/estatisticas` renderiza gráfico p50/p90 em < 2s.
- [ ] Aceitação parcial de sugestão IA: só itens marcados viram linha.

---

## Armadilhas específicas

### P1 — Claude NUNCA sugere preço (A10)
Defesa em 3 camadas:
1. SYSTEM_PROMPT proíbe explicitamente.
2. `_validar()` regex bloqueia qualquer resposta contendo "R$", "preço", "valor".
3. Schema JSON não tem campo de preço — mesmo se colasse, não seria renderizado.
Teste explícito mockando resposta com preço → deve raise.

### P2 — Benchmark é teto, não alvo (A7 reforçado)
O cálculo de `preco_final = min(preco_calculado, teto)` foi feito em MO-6,
mas aqui tiramos o stub. Testes de regressão em motor + benchmark devem
confirmar que preço < custo nunca acontece por causa de teto baixo.

### P3 — Ingestão PDF é por fornecedor
Seguradoras têm formatos diferentes. Primeiro PDF processado define
template. Tentar processar PDF de outra seguradora com mesmo regex =
amostras descartadas. Sempre iniciar com parser específico e generalizar
gradativamente. Mantenha `metadados.pdf_layout` para debug.

### P4 — Amostras sem segmento/tamanho são fallback, não prioridade
```python
# CORRETO
qs.filter(segmento_id=segmento_id) | Q(segmento__isnull=True)

# ARMADILHA — amostras sem segmento podem dominar se forem muitas.
# Solução: quando há ≥ 8 amostras específicas, IGNORAR as genéricas.
```
Implementar como two-pass: primeiro filtra específicas; se < MINIMO, incorpora genéricas.

### P5 — Janela de 90 dias, não all-time
Preços de mercado mudam. `JANELA_DIAS=90` parametrizável via settings mas
fixado em 90 por padrão. Orçamentos antigos mantêm seu snapshot — só
cálculos novos usam benchmark atual.

### P6 — Re-embedding é caro
Ao aceitar um match manual, disparamos `task_reembed_alias.delay()`.
Essa task itera todos os aliases do canônico e re-embed via Voyage.
Custa dinheiro (API). Batchar em 500 aliases/request quando possível.

### P7 — Contexto de IA truncado a 50
Se mandarmos TODO o catálogo, prompt explode 50k+ tokens. Filtrar:
- Primeiro por categoria inferida via keyword match no briefing.
- Depois por compatibilidade de veículo.
- Limite 50 serviços + 50 peças.
Se ainda for grande, pedir IA para "pedir mais contexto" via flag.

### P8 — JSON strict parsing com fallback
Claude às vezes envolve JSON em ```json ... ```. Nunca mostrar erro
bruto ao usuário. Regex de fallback primeiro, só depois raise.

### P9 — Avaliação da sugestão é opcional, mas valiosa
Não bloquear fluxo se usuário não avaliar. Mostrar prompt sutil após
salvar orçamento: "Como foi a sugestão da IA?" — ignorável. Dados
alimentam dashboard de precisão da IA em MO-9.

### P10 — `tenant_schema` nos Celery tasks sempre
```python
# ERRADO
@shared_task
def task_processar_pdf_seguradora(ingestao_id):
    # roda no schema public por padrão — quebra
```
Todos os tasks de benchmark recebem `tenant_schema` e usam `schema_context`.

### P11 — Fonte de benchmark tem confiabilidade
Relatório interno da oficina (100% confiança) vs. cotação de concorrente
(50%). Futuro: ponderar p90 por `fonte.confiabilidade`. Nesta sprint
deixamos o campo pronto; ponderação em MO-9.

---

## Handoff para MO-9 (Feedback + hardening)

Entregar:

1. `BenchmarkService.p90_*` funcionando em produção com ≥ 3 fontes ativas.
2. Dataset `SugestaoIA` com ≥ 100 entradas reais para analisar taxa de
   aceitação e precisão.
3. Interface de revisão de alias consolidada (≥ 90% amostras revisadas após 2 semanas).
4. Dashboard `/benchmark/estatisticas` — base para KPI de mercado em MO-9.
5. Documentação `docs/mo-contrato-benchmark-ia.md`:
   - Como adicionar novo template de seguradora.
   - Como ajustar SYSTEM_PROMPT.
   - Como trocar modelo Claude (Sonnet ↔ Opus).

---

## Checklist pós-sprint

- [ ] `make migrate` aplicou migrations de pricing_benchmark.
- [ ] `make test-backend` verde — 35+ testes (incluindo IA mockada).
- [ ] Ingestão de PDF real da Porto Seguro no ambiente de homolog.
- [ ] Dashboard de estatísticas renderiza em dev.
- [ ] `ANTHROPIC_API_KEY` configurada em Coolify (env Coolify).
- [ ] CLAUDE.md atualizado: seção "Motor Benchmark + IA" + armadilhas A7/A10.
- [ ] `docs/mo-contrato-benchmark-ia.md` escrito.
- [ ] `make sprint-close SPRINT=MO-08` executado.
- [ ] Rito retrospectiva: taxa de aceitação de sugestão IA no período.
