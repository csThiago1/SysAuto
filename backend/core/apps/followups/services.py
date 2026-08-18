"""
Paddock Solutions — Followups: agendamento e disparo de retornos.

Consumido por outros apps SEMPRE por estas funções (regra de isolamento):
    from apps.followups.services import schedule_for_delivery
"""

import logging
from datetime import timedelta

from django.utils import timezone

from apps.followups.models import (
    FollowUp,
    FollowUpChannel,
    FollowUpRule,
    FollowUpStatus,
    FollowUpTrigger,
)

logger = logging.getLogger(__name__)


def schedule_for_delivery(order_id: str, delivered_at: object | None = None) -> int:
    """
    Agenda os retornos das regras ativas para uma OS entregue.

    Idempotente: a constraint (rule, service_order) impede duplicata quando a
    transição para "entregue" é reexecutada.

    Args:
        order_id: PK da ServiceOrder entregue.
        delivered_at: Momento da entrega. Default: agora.

    Returns:
        Quantidade de retornos criados.
    """
    from apps.service_orders.models import ServiceOrder

    order = (
        ServiceOrder.objects.filter(pk=order_id).select_related("customer", "consultant").first()
    )
    if order is None:
        return 0

    if _opted_out(order):
        logger.info("OS %s: cliente optou por não receber retornos.", order_id)
        return 0

    reference = delivered_at or timezone.now()
    created = 0

    for rule in FollowUpRule.objects.filter(
        is_active=True, trigger_event=FollowUpTrigger.OS_DELIVERED
    ):
        if rule.os_types and order.os_type not in rule.os_types:
            continue

        _, was_created = FollowUp.objects.get_or_create(
            rule=rule,
            service_order=order,
            defaults={
                "due_at": reference + timedelta(hours=rule.delay_hours),
                "channel": rule.channel,
                "assigned_to": order.consultant,
            },
        )
        created += int(was_created)

    return created


def dispatch(followup: FollowUp) -> bool:
    """
    Executa um retorno vencido pelo canal configurado.

    Args:
        followup: Retorno em SCHEDULED cujo due_at já passou.

    Returns:
        True se o retorno foi efetivamente disparado.
    """
    if _opted_out(followup.service_order):
        followup.status = FollowUpStatus.SKIPPED
        followup.notes = "Cliente optou por não receber retornos."
        followup.completed_at = timezone.now()
        followup.save(update_fields=["status", "notes", "completed_at", "updated_at"])
        return False

    if followup.channel != FollowUpChannel.TASK:
        # Fase 2 (WhatsApp) entra aqui como um elif. Até lá, o retorno fica
        # agendado em vez de ser silenciosamente perdido.
        logger.warning("Canal %s ainda não implementado — retorno mantido.", followup.channel)
        return False

    _dispatch_task(followup)

    followup.status = FollowUpStatus.PENDING
    followup.dispatched_at = timezone.now()
    followup.save(update_fields=["status", "dispatched_at", "updated_at"])
    return True


def dispatch_due() -> int:
    """
    Dispara todos os retornos vencidos do tenant corrente.

    Returns:
        Quantidade efetivamente disparada.
    """
    due = (
        FollowUp.objects.filter(
            status=FollowUpStatus.SCHEDULED,
            due_at__lte=timezone.now(),
            is_active=True,
        )
        .select_related("rule", "service_order", "service_order__customer")
        .order_by("due_at")
    )

    dispatched = 0
    for followup in due:
        try:
            dispatched += int(dispatch(followup))
        except Exception as exc:
            # Um retorno problemático não pode travar a fila inteira.
            logger.warning("Falha ao disparar retorno %s: %s", followup.pk, type(exc).__name__)

    return dispatched


# ── Internos ─────────────────────────────────────────────────────────────────


def _opted_out(order: object) -> bool:
    """True se o cliente da OS pediu para não receber retornos."""
    customer = getattr(order, "customer", None)
    return bool(customer is not None and getattr(customer, "followup_opt_out", False))


def _dispatch_task(followup: FollowUp) -> None:
    """Põe o retorno na fila interna e avisa o responsável por push."""
    if followup.assigned_to_id is None:
        return

    from apps.notifications.services import send_push

    order = followup.service_order
    try:
        send_push(
            followup.assigned_to_id,
            title=f"Retorno: {followup.rule.name}",
            body=f"OS #{order.number} — {order.plate}",
            url="/crm/retornos",
        )
    except Exception as exc:
        # Push é aviso, não o retorno em si. A tarefa entra na fila de qualquer forma.
        logger.warning("Push de retorno falhou: %s", type(exc).__name__)
