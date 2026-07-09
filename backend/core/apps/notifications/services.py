"""Envio de Web Push via pywebpush (VAPID).

Uso pelos outros apps SEMPRE via este service (regra de isolamento):
    from apps.notifications.services import send_push
    send_push(user_id, title="OS #123", body="Status: Pronto", url="/os/123")
"""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def send_push(user_id: int, title: str, body: str = "", url: str = "") -> dict:
    """Envia push pra todas as subscriptions ativas do usuário.

    Returns:
        {"success": n, "failure": n} — subscriptions 404/410 são desativadas.
    """
    from pywebpush import WebPushException, webpush

    from apps.notifications.models import NotificationLog, PushSubscription

    subs = PushSubscription.objects.filter(user_id=user_id, is_active=True)
    payload = json.dumps({"title": title, "body": body, "url": url})
    success = failure = 0

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{settings.VAPID_CONTACT_EMAIL}"},
            )
            success += 1
        except WebPushException as exc:
            failure += 1
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                # Subscription morta — browser desinstalou/expirou
                sub.is_active = False
                sub.save(update_fields=["is_active"])
            else:
                logger.warning("Push falhou para user %s: %s", user_id, exc)

    NotificationLog.objects.create(
        user_id=user_id, title=title, body=body, url=url,
        success_count=success, failure_count=failure,
    )
    return {"success": success, "failure": failure}
