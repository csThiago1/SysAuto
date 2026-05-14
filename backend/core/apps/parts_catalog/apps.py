from django.apps import AppConfig


class PartsCatalogConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.parts_catalog"
    label = "parts_catalog"
    verbose_name = "Catálogo de Peças"

    def ready(self) -> None:
        import apps.parts_catalog.signals  # noqa: F401
