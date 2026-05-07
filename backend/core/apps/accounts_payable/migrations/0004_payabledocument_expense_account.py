"""
Migration 0004: Adiciona expense_account FK ao PayableDocument.

Permite mapear cada título a pagar a uma conta de despesa específica (6.x)
para reconhecimento contábil automático no DRE.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_payable", "0003_supplier_cpf_encrypted"),
        ("accounting", "0003_fix_object_id_to_charfield"),
    ]

    operations = [
        migrations.AddField(
            model_name="payabledocument",
            name="expense_account",
            field=models.ForeignKey(
                blank=True,
                help_text="Conta contábil para reconhecimento da despesa (6.x). Se vazio, não gera lançamento de despesa.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="payables",
                to="accounting.chartofaccount",
                verbose_name="Conta de Despesa",
            ),
        ),
    ]
