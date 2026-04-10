"""
Migration 0002 — Adiciona global_user FK ao UnifiedCustomer.
Vincula cliente ao GlobalUser (conta de acesso) quando o mesmo e-mail
é usado para login e para cadastro de cliente.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Adiciona OneToOneField global_user ao UnifiedCustomer."""

    dependencies = [
        ("authentication", "0002_globaluser_job_title"),
        ("customers", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="unifiedcustomer",
            name="global_user",
            field=models.OneToOneField(
                blank=True,
                help_text="GlobalUser vinculado a este cliente. Preenchido automaticamente no 1º login.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="customer_profile",
                to="authentication.globaluser",
                verbose_name="Conta de acesso",
            ),
        ),
    ]
