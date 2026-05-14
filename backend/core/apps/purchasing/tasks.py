"""Purchasing — Celery tasks."""
import logging
from datetime import date

from celery import shared_task
from django_tenants.utils import schema_context

from apps.tenants.models import Company

logger = logging.getLogger(__name__)


@shared_task
def task_check_delivery_deadlines() -> dict:
    """Verifica prazos de entrega e marca itens atrasados."""
    from apps.purchasing.models import ItemOrdemCompra

    results: dict[str, int] = {}
    for tenant in Company.objects.exclude(schema_name="public"):
        with schema_context(tenant.schema_name):
            today = date.today()
            updated = (
                ItemOrdemCompra.objects
                .filter(
                    is_active=True,
                    status_entrega="aguardando",
                    data_prevista__lt=today,
                )
                .update(status_entrega="atrasado")
            )
            if updated:
                logger.info("[%s] %d itens OC marcados como atrasados", tenant.schema_name, updated)
                results[tenant.schema_name] = updated

    return results
