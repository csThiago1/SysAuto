"""Tarefas Celery do catálogo de veículos."""

import logging
from typing import Any

import httpx
from celery import shared_task

from django_tenants.utils import schema_context

from apps.vehicle_catalog.fipe_sync import fetch_and_load

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="vehicle_catalog.sync_fipe_catalog",
    max_retries=3,
    default_retry_delay=600,
)
def task_sync_fipe_catalog(self: Any, tenant_schema: str = "public") -> dict[str, int]:
    """Carga mensal do catálogo FIPE (fipeX). Erro de rede tenta de novo em 10 min."""
    try:
        with schema_context(tenant_schema):
            rep = fetch_and_load()
    except httpx.HTTPError as exc:
        logger.warning("sync_fipe_catalog: falha de rede (%s), nova tentativa", type(exc).__name__)
        raise self.retry(exc=exc)
    return {
        f"{table}_{k}": v
        for table in ("makes", "families", "models", "versions")
        for k, v in getattr(rep, table).items()
    }
