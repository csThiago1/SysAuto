"""
Paddock Solutions — Followups Celery Tasks

task_dispatch_due_followups — dispara retornos vencidos, de hora em hora.
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def task_dispatch_due_followups(self: object, tenant_schema: str) -> None:  # type: ignore[type-arg]
    """
    Dispara os retornos vencidos de um tenant.

    Args:
        tenant_schema: Schema do tenant a processar (ex: 'tenant_dscar').
    """
    try:
        from django_tenants.utils import schema_context

        from .services import dispatch_due

        with schema_context(tenant_schema):
            count = dispatch_due()
            logger.info(
                "[Followups] %d retornos disparados (tenant: %s)", count, tenant_schema
            )
    except Exception as exc:
        logger.error(
            "[Followups] task_dispatch_due_followups failed (tenant: %s): %s",
            tenant_schema,
            exc,
        )
        raise self.retry(exc=exc, countdown=60)  # type: ignore[attr-defined]


@shared_task(bind=True, max_retries=1)
def task_dispatch_due_followups_all_tenants(self: object) -> None:  # type: ignore[type-arg]
    """
    Ponto de entrada do beat: enfileira uma task por tenant ativo.
    """
    try:
        from apps.tenants.models import Company

        schemas = list(
            Company.objects.filter(schema_name__startswith="tenant_").values_list(
                "schema_name", flat=True
            )
        )
        for schema in schemas:
            task_dispatch_due_followups.delay(schema)
    except Exception as exc:
        logger.error("[Followups] task_dispatch_due_followups_all_tenants failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)  # type: ignore[attr-defined]
