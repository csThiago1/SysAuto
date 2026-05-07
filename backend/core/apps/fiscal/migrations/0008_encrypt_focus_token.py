"""
Migration 0008: FiscalConfigModel.focus_token → EncryptedCharField.

Segurança: token da API Focus NF-e deve ser cifrado em repouso (LGPD + boas práticas).
EncryptedCharField usa Fernet/AES via django-encrypted-model-fields.
"""

import encrypted_model_fields.fields
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("fiscal", "0007_wms_movimentacao_estoque"),
    ]

    operations = [
        migrations.AlterField(
            model_name="fiscalconfigmodel",
            name="focus_token",
            field=encrypted_model_fields.fields.EncryptedCharField(
                blank=True, default="", max_length=255,
            ),
        ),
    ]
