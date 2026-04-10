"""
Paddock Solutions — Accounts Receivable Celery Tasks

task_refresh_overdue_receivables — atualiza titulos vencidos diariamente as 06:15.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def task_refresh_overdue_receivables(self: object, tenant_schema: str) -> None:  # type: ignore[type-arg]
    """
    Atualiza status de ReceivableDocument de 'open'/'partial' para 'overdue'
    quando due_date < hoje. Deve ser chamada diariamente as 06:15 para cada
    tenant ativo via beat schedule.

    Args:
        tenant_schema: Schema do tenant a processar (ex: 'tenant_dscar').
    """
    try:
        from django_tenants.utils import schema_context

        from .services import ReceivableDocumentService

        with schema_context(tenant_schema):
            count = ReceivableDocumentService.refresh_overdue_status()
            logger.info(
                "[AR] task_refresh_overdue_receivables: %d titulos atualizados para OVERDUE "
                "(tenant: %s)",
                count,
                tenant_schema,
            )
    except Exception as exc:
        logger.error(
            "[AR] task_refresh_overdue_receivables failed (tenant: %s): %s",
            tenant_schema,
            exc,
        )
        raise self.retry(exc=exc, countdown=60 * 5)  # type: ignore[attr-defined]


@shared_task(bind=True, max_retries=1)
def task_refresh_overdue_receivables_all_tenants(self: object) -> None:  # type: ignore[type-arg]
    """
    Dispara task_refresh_overdue_receivables para cada tenant ativo.
    Esta task e o ponto de entrada do beat schedule (06:15 diario).
    Itera sobre todos os tenants e enfileira uma task por schema.
    """
    try:
        from apps.tenants.models import Company

        tenants = Company.objects.filter(schema_name__startswith="tenant_")
        schemas = list(tenants.values_list("schema_name", flat=True))
        for schema in schemas:
            task_refresh_overdue_receivables.delay(schema)
            logger.info("[AR] Enfileirada refresh_overdue para tenant: %s", schema)
    except Exception as exc:
        logger.error("[AR] task_refresh_overdue_receivables_all_tenants failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)  # type: ignore[attr-defined]
