from django.apps import AppConfig


class PersonsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.persons"
    verbose_name = "Cadastros"

    def ready(self) -> None:
        from apps.persons import signals  # noqa: F401
