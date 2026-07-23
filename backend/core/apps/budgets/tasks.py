# backend/core/apps/budgets/tasks.py
"""Celery tasks do módulo de orçamentos."""
from __future__ import annotations

import logging

from celery import shared_task
from django_tenants.utils import schema_context

from apps.tenants.models import Company

from .services import BudgetService

logger = logging.getLogger(__name__)


@shared_task(name="apps.budgets.tasks.expire_stale_budgets")
def expire_stale_budgets() -> dict:
    """Marca versões 'sent' expiradas como 'expired', em todos os tenants.

    Agendada via Celery beat 1x por dia. Retorna quantidade afetada por schema.
    """
    results: dict[str, int] = {}
    for tenant in Company.objects.exclude(schema_name="public"):
        with schema_context(tenant.schema_name):
            count = BudgetService.expire_stale_versions()
            if count:
                results[tenant.schema_name] = count
                logger.info("[%s] Expired %d stale budget versions", tenant.schema_name, count)
    return results
