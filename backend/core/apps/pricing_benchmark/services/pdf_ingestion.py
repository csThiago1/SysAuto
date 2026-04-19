"""
Paddock Solutions — Pricing Benchmark — PDF Ingestion Service
Motor de Orçamentos (MO) — Sprint MO-8

Extrai amostras de relatórios PDF de seguradoras.

Armadilhas:
- P3: formato de PDF varia por seguradora — parser específico, expansão gradual.
- P10: task Celery sempre usa schema_context(tenant_schema).
"""
import logging
import re
from datetime import date
from decimal import Decimal

from django.utils import timezone

logger = logging.getLogger(__name__)

REGEX_VALOR = re.compile(r"R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})")
REGEX_ANO = re.compile(r"\b(19|20)\d{2}\b")


class PDFIngestionService:
    """Extrai amostras de relatórios PDF de seguradoras.

    Heurística robusta: ignora headers repetidos, detecta seções por título,
    tolera diferenças de formatação entre seguradoras.
    """

    @classmethod
    def processar(cls, ingestao_id: int) -> dict:
        """Processa o PDF de uma BenchmarkIngestao."""
        from apps.pricing_benchmark.models import BenchmarkIngestao

        ing = BenchmarkIngestao.objects.get(id=ingestao_id)
        ing.status = "processando"
        ing.iniciado_em = timezone.now()
        ing.save(update_fields=["status", "iniciado_em"])

        amostras = 0
        descartadas = 0
        try:
            try:
                import pdfplumber  # type: ignore[import]
            except ImportError:
                logger.error("pdfplumber não instalado — pip install pdfplumber")
                raise RuntimeError("pdfplumber não instalado.")

            with pdfplumber.open(ing.arquivo.path) as pdf:
                for page_num, page in enumerate(pdf.pages, start=1):
                    tables = page.extract_tables() or []
                    for table in tables:
                        for row in (table or []):
                            resultado = cls._processar_linha(row, page_num, ing)
                            if resultado == "amostra":
                                amostras += 1
                            elif resultado == "descartada":
                                descartadas += 1

            ing.status = "concluido"
            ing.amostras_importadas = amostras
            ing.amostras_descartadas = descartadas
            ing.concluido_em = timezone.now()
            ing.save(
                update_fields=[
                    "status",
                    "amostras_importadas",
                    "amostras_descartadas",
                    "concluido_em",
                ]
            )
            logger.info(
                f"[benchmark] ingestao={ingestao_id} amostras={amostras} descartadas={descartadas}"
            )
            return {"amostras": amostras, "descartadas": descartadas}
        except Exception as e:
            ing.status = "erro"
            ing.log_erro = str(e)[:5000]
            ing.save(update_fields=["status", "log_erro"])
            logger.error(f"[benchmark] erro ingestao={ingestao_id}: {e}")
            raise

    @classmethod
    def _processar_linha(cls, row: list, page_num: int, ing) -> str:
        """Tenta extrair amostra de uma linha de tabela de PDF.

        Returns:
            "amostra" se criou BenchmarkAmostra.
            "descartada" se descartou por valor inválido.
            "ignorada" se não havia valor monetário.
        """
        from apps.pricing_benchmark.models import BenchmarkAmostra
        from apps.pricing_catalog.services.matcher import AliasMatcher

        texto_completo = " ".join(str(c) if c else "" for c in row)
        valor_match = REGEX_VALOR.search(texto_completo)
        if not valor_match:
            return "ignorada"

        raw_valor = valor_match.group(1).replace(".", "").replace(",", ".")
        try:
            valor = Decimal(raw_valor)
        except Exception:
            return "descartada"

        if valor <= 0:
            return "descartada"

        ano_match = REGEX_ANO.search(texto_completo)
        descricao = texto_completo.replace(valor_match.group(0), "").strip()
        descricao = descricao[:500]

        # AliasMatcher — instancia e usa o método de instância
        try:
            matcher = AliasMatcher()
            resultados = matcher.match_servico(descricao, top_k=1)
            if resultados:
                top = resultados[0]
                confianca = top.score / 100.0  # score 0-100 → 0-1
                canonical_id = top.canonico_id if confianca >= 0.85 else None
                via = top.metodo
            else:
                confianca = 0.0
                canonical_id = None
                via = None
        except Exception:
            confianca = 0.0
            canonical_id = None
            via = None

        periodo_ref = ing.metadados.get("periodo_ref")
        if periodo_ref:
            try:
                from datetime import datetime
                data_ref = datetime.strptime(periodo_ref, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                data_ref = date.today()
        else:
            data_ref = date.today()

        BenchmarkAmostra.objects.create(
            ingestao=ing,
            fonte=ing.fonte,
            tipo_item="servico",
            servico_canonico_id=canonical_id,
            descricao_bruta=descricao,
            alias_match_confianca=Decimal(str(confianca)) if confianca else None,
            valor_praticado=valor,
            data_referencia=data_ref,
            veiculo_ano=int(ano_match.group(0)) if ano_match else None,
            metadados={
                "pagina_pdf": page_num,
                "match_via": via,
                "pdf_layout": ing.metadados.get("pdf_layout", "generico"),
            },
        )
        return "amostra"
