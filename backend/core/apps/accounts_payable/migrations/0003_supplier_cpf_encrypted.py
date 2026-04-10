"""
Migration: converte Supplier.cpf de CharField para EncryptedCharField.

LGPD — CPF de pessoa fisica (fornecedor PF) nao pode ser armazenado em texto claro.
EncryptedCharField cifra o valor em repouso usando django-encrypted-model-fields (Fernet/AES).

ATENCAO: apos aplicar esta migration, CPFs existentes em texto claro serao relidos como
strings cifradas invalidas. Para produção, executar script de re-encriptacao antes de
aplicar em dados existentes.
"""
import encrypted_model_fields.fields
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        (
            "accounts_payable",
            "0002_rename_ap_doc_status_due_idx_accounts_pa_status_61c987_idx_and_more",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="supplier",
            name="cpf",
            field=encrypted_model_fields.fields.EncryptedCharField(
                blank=True,
                default="",
                max_length=11,
                verbose_name="CPF",
            ),
        ),
    ]
