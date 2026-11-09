"""
Paddock Solutions — Service Orders Celery Tasks
"""
import logging

import httpx
from celery import shared_task
from django.utils import timezone
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def task_send_push_notification(
    self,  # type: ignore[misc]
    tenant_schema: str,
    token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """
    Envia push notification via Expo Push API.

    Sempre recebe tenant_schema — padrão Paddock para tasks Celery.
    """
    if not token or not token.startswith("ExponentPushToken"):
        logger.debug("Push token inválido ou ausente: %s", token[:20] if token else "vazio")
        return

    payload: dict = {"to": token, "title": title, "body": body}
    if data:
        payload["data"] = data

    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(_EXPO_PUSH_URL, json=payload)
            response.raise_for_status()
            result = response.json()
            ticket = result.get("data", {})
            if ticket.get("status") == "error":
                logger.warning(
                    "Expo push error para token=%s: %s",
                    token[:30],
                    ticket.get("message"),
                )
            else:
                logger.info(
                    "Push notification enviada: title=%r tenant=%s",
                    title,
                    tenant_schema,
                )
    except httpx.HTTPError as exc:
        logger.error("Erro HTTP ao enviar push: %s", exc)
        raise self.retry(exc=exc)


@shared_task
def task_notify_status_change(
    tenant_schema: str,
    user_id: str,
    os_number: int,
    plate: str,
    new_status_label: str,
) -> None:
    """
    Envia push notification ao consultor quando o status de uma OS muda.

    Busca o push_token do GlobalUser (schema public) e chama
    task_send_push_notification.
    """
    from apps.authentication.models import GlobalUser

    try:
        user = GlobalUser.objects.get(pk=user_id, is_active=True)
    except GlobalUser.DoesNotExist:
        logger.debug("GlobalUser %s não encontrado para push notification", user_id)
        return

    token: str = user.push_token
    if not token:
        return

    task_send_push_notification.delay(
        tenant_schema=tenant_schema,
        token=token,
        title=f"OS #{os_number} — {plate}",
        body=f"Status atualizado: {new_status_label}",
        data={"os_number": os_number, "plate": plate, "status": new_status_label},
    )


@shared_task
def task_notify_override_request(
    tenant_schema: str,
    override_id: str,
    os_number: int,
    plate: str,
    requester_name: str,
    target_status: str,
) -> None:
    """Notifica todos os MANAGER+ sobre nova solicitação de override.

    Args:
        tenant_schema: Schema do tenant para contexto.
        override_id: UUID do TransitionOverrideRequest criado.
        os_number: Número da OS.
        plate: Placa do veículo.
        requester_name: Nome ou email do consultor solicitante.
        target_status: Status de destino desejado.
    """
    from apps.authentication.models import GlobalUser

    # GlobalUser não tem campo role (vem do JWT). Enviamos para todos os
    # is_staff=True (gerentes/admins) que tenham push_token registrado.
    # Em oficinas pequenas como DS Car, isso é seguro e eficiente.
    staff_with_token = GlobalUser.objects.filter(
        is_active=True,
        is_staff=True,
    ).exclude(push_token="")

    for user in staff_with_token:
        task_send_push_notification.delay(
            tenant_schema=tenant_schema,
            token=user.push_token,
            title=f"Liberação solicitada — OS #{os_number}",
            body=f"{requester_name} solicita avançar OS {plate} para '{target_status}'",
            data={
                "type": "override_request",
                "override_id": override_id,
                "os_number": os_number,
            },
        )


@shared_task
def task_notify_override_resolved(
    tenant_schema: str,
    override_id: str,
    requester_user_id: str,
    os_number: int,
    plate: str,
    action: str,
    justification: str,
) -> None:
    """Notifica o consultor sobre resolução (aprovação ou rejeição) do override.

    Args:
        tenant_schema: Schema do tenant para contexto.
        override_id: UUID do TransitionOverrideRequest resolvido.
        requester_user_id: UUID do GlobalUser solicitante.
        os_number: Número da OS.
        plate: Placa do veículo.
        action: "approved" ou "rejected".
        justification: Justificativa do gerente.
    """
    from apps.authentication.models import GlobalUser

    try:
        user = GlobalUser.objects.get(pk=requester_user_id, is_active=True)
    except GlobalUser.DoesNotExist:
        logger.debug("GlobalUser %s não encontrado para notificação de override", requester_user_id)
        return

    if not user.push_token:
        return

    approved = action == "approved"
    title = (
        f"Liberação aprovada — OS #{os_number}"
        if approved
        else f"Liberação recusada — OS #{os_number}"
    )
    body = justification[:100] if justification else f"OS {plate}"

    task_send_push_notification.delay(
        tenant_schema=tenant_schema,
        token=user.push_token,
        title=title,
        body=body,
        data={
            "type": "override_resolved",
            "override_id": override_id,
            "os_number": os_number,
            "action": action,
        },
    )


@shared_task
def task_expire_overrides(tenant_schema: str = "") -> None:
    """Marca como expirados overrides pendentes que passaram de 24h.

    Deve ser configurado no Celery Beat para executar a cada hora.
    Itera sobre todos os schemas de tenant ativos.

    Args:
        tenant_schema: Ignorado — a task itera todos os tenants automaticamente.
    """
    from django_tenants.utils import get_tenant_model

    TenantModel = get_tenant_model()
    schemas = [t.schema_name for t in TenantModel.objects.exclude(schema_name="public")]

    for schema in schemas:
        with schema_context(schema):
            from apps.service_orders.models import TransitionOverrideRequest

            expired_count = TransitionOverrideRequest.objects.filter(
                status="pending",
                expires_at__lt=timezone.now(),
            ).update(status="expired", resolved_at=timezone.now())

            if expired_count:
                logger.info(
                    "Schema %s: %d override(s) expirado(s)",
                    schema,
                    expired_count,
                )


@shared_task(bind=True, max_retries=3, retry_backoff=True, soft_time_limit=60, time_limit=90)
def task_run_budget_match(
    self: object,
    service_order_id: str,
    tenant_schema: str,
) -> dict:  # type: ignore[type-arg]
    """Refaz o cruzamento do checklist de entrada com o orçamento ativo da OS.

    Disparada pelo import/aplicação de versão do orçamento (on_commit).

    Args:
        service_order_id: PK da ServiceOrder.
        tenant_schema: Schema do tenant (ex.: 'tenant_dscar').

    Returns:
        Dict com 'status' e, quando rodou, os totais do cruzamento.
    """
    with schema_context(tenant_schema):
        from apps.service_orders.models import ServiceOrder
        from apps.service_orders.services.budget_match import run_budget_match

        order = ServiceOrder.objects.filter(pk=service_order_id, is_active=True).first()
        if order is None:
            logger.warning("task_run_budget_match: OS %s não encontrada", service_order_id)
            return {"status": "skipped", "reason": "order_not_found"}

        summary = run_budget_match(order)
        return {
            "status": "ok",
            "inside": summary.inside,
            "outside": len(summary.outside),
            "unmapped": len(summary.unmapped),
        }
