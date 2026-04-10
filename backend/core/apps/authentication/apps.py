from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    """App de autenticação — GlobalUser, JWT backends, RBAC."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.authentication"
    label = "authentication"

    def ready(self) -> None:
        """Registra signals ao iniciar o app."""
        import apps.authentication.signals  # noqa: F401
