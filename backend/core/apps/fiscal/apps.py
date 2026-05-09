from django.apps import AppConfig


class FiscalAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.fiscal"
    label = "fiscal"

    def ready(self) -> None:
        from django.db.models.signals import post_migrate

        post_migrate.connect(self._schedule_webhook_check, sender=self)

    @staticmethod
    def _schedule_webhook_check(sender: object, **kwargs: object) -> None:
        """Schedule webhook verification after migrations complete."""
        try:
            from apps.fiscal.tasks import ensure_webhooks_all_tenants

            # Delay by 30 seconds to let services fully start
            ensure_webhooks_all_tenants.apply_async(countdown=30)
        except Exception:
            pass  # Celery not available (e.g., during testing)
