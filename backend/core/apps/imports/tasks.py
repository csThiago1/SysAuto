"""Celery tasks para polling automático Cília."""
from __future__ import annotations

import logging

from celery import shared_task
from django_tenants.utils import schema_context

from apps.imports.services import ImportService
from apps.tenants.models import Company

logger = logging.getLogger(__name__)


@shared_task
def poll_cilia_budget(service_order_id: int, tenant_schema: str) -> None:
    """Busca próxima versão disponível da OS no Cília.

    Pula se:
    - OS não tem casualty_number
    - OS está fechada (delivered/cancelled)
    - Versão ativa em status terminal (autorizado/negado)
    """
    from apps.service_orders.models import ServiceOrder

    with schema_context(tenant_schema):
        try:
            os_instance = ServiceOrder.objects.get(pk=service_order_id, is_active=True)
        except ServiceOrder.DoesNotExist:
            logger.warning("poll_cilia_budget: OS %s não encontrada", service_order_id)
            return

        if not os_instance.casualty_number:
            logger.debug(
                "poll_cilia_budget: OS %s sem casualty_number — pulando",
                service_order_id,
            )
            return

        if os_instance.status in ("delivered", "cancelled"):
            logger.debug(
                "poll_cilia_budget: OS %s fechada (%s) — pulando",
                service_order_id,
                os_instance.status,
            )
            return

        active_version = os_instance.versions.order_by("-version_number").first()
        if active_version and active_version.status in ("autorizado", "negado"):
            logger.debug(
                "poll_cilia_budget: OS %s versão em status terminal — pulando",
                service_order_id,
            )
            return

        next_version = (active_version.version_number + 1) if active_version else 1

        ImportService.fetch_cilia_budget(
            casualty_number=os_instance.casualty_number,
            budget_number="",
            version_number=next_version,
            trigger="polling",
        )


@shared_task
def sync_active_cilia_os() -> None:
    """Encontra, em cada tenant, todas OS elegíveis e dispara poll_cilia_budget.

    Elegível: customer_type=insurer, com casualty_number, não fechada,
    insurer com uses_cilia=True.
    """
    from apps.service_orders.models import ServiceOrder

    for tenant in Company.objects.exclude(schema_name="public"):
        with schema_context(tenant.schema_name):
            qs = (
                ServiceOrder.objects.filter(
                    is_active=True,
                    customer_type="insurer",
                    insurer__uses_cilia=True,
                )
                .exclude(casualty_number="")
                .exclude(status__in=["delivered", "cancelled"])
                .values_list("pk", flat=True)
            )

            os_ids = list(qs)
            for os_id in os_ids:
                poll_cilia_budget.delay(os_id, tenant.schema_name)

            if os_ids:
                logger.info(
                    "sync_active_cilia_os: [%s] disparou poll para %d OS",
                    tenant.schema_name,
                    len(os_ids),
                )
