# Generated manually — Ciclo 07: reverte emergency_contact_phone para EncryptedCharField
# LGPD: telefone SEMPRE deve ser EncryptedField (CLAUDE.md)

import encrypted_model_fields.fields
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0005_employee_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="employee",
            name="emergency_contact_phone",
            field=encrypted_model_fields.fields.EncryptedCharField(
                blank=True,
                default="",
                max_length=20,
                verbose_name="Contato emergência — telefone",
            ),
        ),
    ]
