from django.apps import AppConfig


class AuthzConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.authz"
    verbose_name = "Autorização (Roles & Permissions)"
