from django.apps import AppConfig


class ServiceOrdersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.service_orders"
    label = "service_orders"

    def ready(self) -> None:
        from apps.service_orders import signals  # noqa: F401
