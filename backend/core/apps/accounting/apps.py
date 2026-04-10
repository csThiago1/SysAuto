"""
Paddock Solutions — Accounting App Configuration
"""
from django.apps import AppConfig


class AccountingConfig(AppConfig):
    """Configuracao do app de contabilidade."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounting"
    verbose_name = "Contabilidade"
