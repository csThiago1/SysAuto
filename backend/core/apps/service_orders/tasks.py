"""
Paddock Solutions — Service Orders Celery Tasks
"""
import logging

import httpx
from celery import shared_task
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
