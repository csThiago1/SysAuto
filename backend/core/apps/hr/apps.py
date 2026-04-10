from django.apps import AppConfig


class HrConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.hr"
    verbose_name = "RH — Recursos Humanos"

    def ready(self) -> None:
        import apps.hr.signals  # noqa: F401
