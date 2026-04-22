"""Celery tasks do módulo de orçamentos."""
from __future__ import annotations

import logging

from celery import shared_task

from .services import BudgetService


logger = logging.getLogger(__name__)


@shared_task(name="apps.budgets.tasks.expire_stale_budgets")
def expire_stale_budgets() -> int:
    """Marca budgets 'sent' expirados como 'expired'.

    Agendada via Celery beat 1x por dia. Retorna quantidade afetada.
    """
    count = BudgetService.expire_stale_versions()
    logger.info("Expired %d stale budget versions", count)
    return count
