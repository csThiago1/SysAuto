"""Celery tasks para polling automático Cília.

sync_active_cilia_os  — fan-out: uma task por OS elegível, em cada tenant.
poll_cilia_budget     — sonda a próxima versão de UMA OS e importa se existir.

A varredura só enfileira; quem fala com a Cilia é a task por OS. Um orçamento
pesa ~1,1 MB e leva ~6s para responder, então sondar em série dentro da
varredura viraria uma task de minutos onde uma falha no fim refaz tudo.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django_tenants.utils import schema_context

from apps.tenants.models import Company

logger = logging.getLogger(__name__)

# Versão já decidida pela seguradora — não adianta procurar revisão nova.
TERMINAL_VERSION_STATUSES = ("autorizado", "negado")
CLOSED_ORDER_STATUSES = ("delivered", "cancelled")


@shared_task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    soft_time_limit=120,
    time_limit=180,
)
def poll_cilia_budget(
    self: object, service_order_id: int, tenant_schema: str,
) -> dict:  # type: ignore[type-arg]
    """Busca a próxima versão do orçamento da OS na Cília e importa se houver.

    A Cilia não libera listagem para o token da oficina (403 em
    `list_budgets`), então sondar versão+1 é a única descoberta possível para
    uma OS conhecida — e cobre o caso comum, que é a seguradora revisar o
    mesmo orçamento várias vezes (`.2` → `.3` → `.4`).

    Pula se: OS inexistente, fechada, sem sinistro, sem orçamento conhecido,
    ou com a versão corrente em status terminal.

    Args:
        service_order_id: PK da ServiceOrder.
        tenant_schema: Schema do tenant (ex.: 'tenant_dscar').

    Returns:
        Dict com 'status' e, quando importou, 'action' e 'version_id'.
    """
    with schema_context(tenant_schema):
        from apps.cilia.services import (
            CiliaImportError,
            CiliaVersionNotFound,
            import_from_cilia,
        )
        from apps.service_orders.models import ServiceOrder

        order = ServiceOrder.objects.filter(
            pk=service_order_id, is_active=True,
        ).first()
        if order is None:
            logger.warning("poll_cilia_budget: OS %s não encontrada", service_order_id)
            return {"status": "skipped", "reason": "order_not_found"}

        if not order.casualty_number:
            logger.debug("poll_cilia_budget: OS %s sem sinistro", service_order_id)
            return {"status": "skipped", "reason": "no_casualty_number"}

        if order.status in CLOSED_ORDER_STATUSES:
            logger.debug(
                "poll_cilia_budget: OS %s fechada (%s)", service_order_id, order.status,
            )
            return {"status": "skipped", "reason": "order_closed"}

        target = _next_cilia_target(order)
        if target is None:
            logger.debug(
                "poll_cilia_budget: OS %s sem orçamento Cilia conhecido",
                service_order_id,
            )
            return {"status": "skipped", "reason": "no_budget_number"}

        budget_number, next_version = target

        try:
            result = import_from_cilia(
                order=order,
                casualty_number=order.casualty_number,
                budget_number=budget_number,
                version_number=next_version,
                trigger="polling",
                created_by="Sistema",
            )
        except CiliaVersionNotFound:
            # Caso normal: a seguradora ainda não publicou a próxima versão.
            return {"status": "no_new_version"}
        except CiliaImportError as exc:
            # Token ou permissão não melhoram com retry.
            if exc.http_status in (401, 403):
                logger.error(
                    "poll_cilia_budget: %s na OS %s — sem retry.",
                    exc.error_type, service_order_id,
                )
                return {"status": "error", "error_type": exc.error_type}
            logger.warning(
                "poll_cilia_budget: OS %s falhou (%s) — reagendando.",
                service_order_id, exc.detail,
            )
            raise self.retry(exc=exc)  # type: ignore[attr-defined]

        logger.info(
            "poll_cilia_budget: OS %s — orçamento %s v%s importado (%s).",
            service_order_id, budget_number, next_version, result.action,
        )
        return {
            "status": "ok",
            "action": result.action,
            "version_id": str(result.version.pk) if result.version else None,
        }


@shared_task(soft_time_limit=60, time_limit=90)
def sync_active_cilia_os() -> None:
    """Encontra, em cada tenant, todas OS elegíveis e dispara poll_cilia_budget.

    Elegível: OS aberta, com sinistro, que JÁ tem orçamento vindo do Cilia —
    seja pelo campo da OS, seja por uma versão importada com source='cilia'.

    A elegibilidade vem do fato de existir orçamento Cilia nesta OS, não do
    cadastro da seguradora. Seguradora grande fatura por vários CNPJs e é a
    oficina quem escolhe o vínculo na OS; deduzir "usa Cilia" do cadastro
    deixaria de fora OS legítimas sempre que esse cadastro estivesse
    incompleto — que é o normal.
    """
    from django.db.models import Q

    from apps.service_orders.models import ServiceOrder

    for tenant in Company.objects.exclude(schema_name="public"):
        with schema_context(tenant.schema_name):
            os_ids = list(
                ServiceOrder.objects.filter(is_active=True)
                .filter(
                    Q(versions__source="cilia") | ~Q(cilia_budget_number=""),
                )
                .exclude(casualty_number="")
                .exclude(status__in=CLOSED_ORDER_STATUSES)
                .distinct()
                .values_list("pk", flat=True)
            )

            for os_id in os_ids:
                poll_cilia_budget.delay(os_id, tenant.schema_name)

            if os_ids:
                logger.info(
                    "sync_active_cilia_os: [%s] disparou poll para %d OS",
                    tenant.schema_name,
                    len(os_ids),
                )


def _next_cilia_target(order: object) -> tuple[str, int] | None:
    """Descobre qual (orçamento, versão) sondar para esta OS.

    A fonte preferida é o `external_version` da última versão importada da
    Cilia — ele guarda "905433.2", ou seja, orçamento e versão juntos e
    coerentes entre si. O `version_number` da ServiceOrderVersion NÃO serve:
    é o contador interno da OS, que diverge do número da Cilia assim que
    entra uma versão manual ou de outra fonte.

    Cai para os campos da OS quando ainda não há versão Cilia importada.

    Args:
        order: ServiceOrder com `versions` acessível.

    Returns:
        Tupla (budget_number, próxima versão), ou None se não há orçamento
        conhecido nem versão a sondar.
    """
    last = (
        order.versions.filter(source="cilia")  # type: ignore[attr-defined]
        .exclude(external_version="")
        .order_by("-version_number")
        .first()
    )

    if last is not None:
        if last.status in TERMINAL_VERSION_STATUSES:
            return None
        budget_number, _, version = last.external_version.partition(".")
        if budget_number:
            try:
                return budget_number, int(version) + 1
            except ValueError:
                # external_version sem sufixo numérico ("905433" ou "905433.a")
                return budget_number, 1

    budget_number = (getattr(order, "cilia_budget_number", "") or "").strip()
    if not budget_number:
        return None

    try:
        return budget_number, int(str(order.cilia_budget_version).strip()) + 1
    except (TypeError, ValueError):
        return budget_number, 1
