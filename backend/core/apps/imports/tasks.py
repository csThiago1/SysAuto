"""Celery tasks do importador Cilia.

- `poll_cilia_budget(service_order_id)` — tenta buscar v+1 de uma OS
  específica. Chamado pelo beat via `sync_active_cilia_os`.
- `sync_active_cilia_os` — encontra OSes elegíveis e dispara polling.
  Agendado via Celery beat a cada `CILIA_POLLING_INTERVAL_MINUTES` minutos.
"""
from __future__ import annotations

import logging

from celery import shared_task

from apps.service_orders.models import ServiceOrder

from .services import ImportService


logger = logging.getLogger(__name__)


# Status Cilia terminais — indicam que não haverá mais versões
CILIA_TERMINAL_STATUSES: set[str] = {"refused", "finalized"}


@shared_task(name="apps.imports.tasks.poll_cilia_budget")
def poll_cilia_budget(service_order_id: int) -> dict:
    """Polling incremental — tenta buscar próxima versão (active + 1) na Cilia.

    Lógica:
      - Skip se OS não é seguradora / está delivered ou cancelled / sem identificadores
      - Skip se active_version.raw_payload.status em CILIA_TERMINAL_STATUSES
      - Busca v+1 via ImportService.fetch_cilia_budget
          - 200: cria nova version (via ImportService, que dedupa por hash)
          - 404: não há próxima ainda — aguarda próximo ciclo
          - outros: loga mas não levanta (task precisa continuar no beat)

    Returns:
        dict com {action, attempt_id?, version_created_id?, reason?, error?}
    """
    try:
        os_instance = ServiceOrder.objects.get(pk=service_order_id)
    except ServiceOrder.DoesNotExist:
        logger.warning("ServiceOrder %s não existe — skip polling", service_order_id)
        return {"action": "skipped", "reason": "os_not_found"}

    if os_instance.customer_type != "SEGURADORA":
        return {"action": "skipped", "reason": "not_insurance"}

    if os_instance.status in ("delivered", "cancelled"):
        return {"action": "skipped", "reason": "os_closed"}

    if not os_instance.casualty_number or not os_instance.external_budget_number:
        return {"action": "skipped", "reason": "missing_cilia_identifiers"}

    active = os_instance.active_version
    if active is None:
        return {"action": "skipped", "reason": "no_active_version"}

    # Checar status Cilia via raw_payload — se terminal, parar polling
    raw_status = (active.raw_payload or {}).get("status", "")
    if raw_status in CILIA_TERMINAL_STATUSES:
        return {
            "action": "skipped",
            "reason": f"cilia_terminal:{raw_status}",
            "active_version": active.version_number,
        }

    # Tentar próxima versão
    next_version = active.version_number + 1
    attempt = ImportService.fetch_cilia_budget(
        casualty_number=os_instance.casualty_number,
        budget_number=os_instance.external_budget_number,
        version_number=next_version,
        trigger="polling",
        created_by="Celery",
    )

    result: dict = {
        "action": "unknown",
        "attempt_id": attempt.pk,
        "version_number": next_version,
        "http_status": attempt.http_status,
    }

    if attempt.parsed_ok and attempt.version_created:
        result["action"] = "version_created"
        result["version_created_id"] = attempt.version_created.pk
    elif attempt.http_status == 404:
        result["action"] = "not_yet"
    elif attempt.error_type == "Duplicate":
        result["action"] = "duplicate_skipped"
    else:
        result["action"] = "error"
        result["error"] = attempt.error_message

    logger.info("poll_cilia_budget OS=%s result=%s", service_order_id, result)
    return result


@shared_task(name="apps.imports.tasks.sync_active_cilia_os")
def sync_active_cilia_os() -> dict:
    """Dispara poll_cilia_budget pra cada OS Cilia ativa.

    Critérios de elegibilidade:
      - customer_type = SEGURADORA
      - is_active = True
      - status != delivered/cancelled
      - casualty_number e external_budget_number não vazios

    Chamado via Celery beat a cada CILIA_POLLING_INTERVAL_MINUTES minutos.
    """
    qs = (
        ServiceOrder.objects.filter(
            is_active=True,
            customer_type="SEGURADORA",
        )
        .exclude(status__in=["delivered", "cancelled"])
        .exclude(casualty_number="")
        .exclude(external_budget_number="")
    )

    total = 0
    for os_instance in qs.iterator():
        poll_cilia_budget.delay(os_instance.pk)
        total += 1

    logger.info("sync_active_cilia_os: %d OSes agendadas", total)
    return {"scheduled": total}
