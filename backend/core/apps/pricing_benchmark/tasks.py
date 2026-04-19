"""
Paddock Solutions — Pricing Benchmark — Celery Tasks
Motor de Orçamentos (MO) — Sprint MO-8

Armadilhas:
- P10: todos os tasks recebem tenant_schema e usam schema_context.
- P6: re-embedding é custoso — batchar 500 aliases/request.
"""
import logging

from celery import shared_task
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)


@shared_task
def task_processar_pdf_seguradora(ingestao_id: int, tenant_schema: str) -> dict:
    """Processa PDF de seguradora via PDFIngestionService.

    Args:
        ingestao_id: PK da BenchmarkIngestao.
        tenant_schema: Schema do tenant (obrigatório para multitenancy).

    Returns:
        dict com amostras e descartadas.
    """
    with schema_context(tenant_schema):
        from apps.pricing_benchmark.services import PDFIngestionService
        return PDFIngestionService.processar(ingestao_id)


@shared_task
def task_reembed_alias(canonical_id: str, tipo_item: str) -> dict:
    """Re-embeda o canônico após aceite manual de alias (circuito de aprendizado).

    Dispara embed_canonicos_pendentes no schema atual para reaproveitar o
    pipeline batch já existente (Armadilha P6 — batching 128 por request).

    Args:
        canonical_id: UUID do ServicoCanonico ou PecaCanonica.
        tipo_item: "servico" ou "peca".

    Returns:
        dict com status.
    """
    from django.db import connection

    try:
        from apps.pricing_catalog.tasks import embed_canonicos_pendentes
        tenant_schema = connection.schema_name
        embed_canonicos_pendentes.delay(tenant_schema)
        logger.info(
            f"[benchmark] reembed dispachado canonical={canonical_id} tipo={tipo_item} "
            f"schema={tenant_schema}"
        )
        return {"canonical_id": canonical_id, "tipo": tipo_item, "status": "dispatched"}
    except Exception as exc:
        logger.error(f"[benchmark] erro reembed canonical={canonical_id}: {exc}")
        return {"error": str(exc)}
