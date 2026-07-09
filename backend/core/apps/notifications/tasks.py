"""Celery — envio assíncrono de push (nunca bloquear o request)."""
from celery import shared_task
from django_tenants.utils import schema_context


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_push_async(
    self, user_id: int, title: str, body: str, url: str, tenant_schema: str
) -> None:
    from apps.notifications.services import send_push

    try:
        with schema_context(tenant_schema):
            send_push(user_id, title=title, body=body, url=url)
    except Exception as exc:  # retry com backoff
        raise self.retry(exc=exc)
