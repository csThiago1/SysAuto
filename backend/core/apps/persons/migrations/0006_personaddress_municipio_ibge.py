"""
Migration 0006: PersonAddress.municipio_ibge
Ciclo 06A — T02: Código IBGE 7 dígitos (obrigatório para NFS-e Manaus)
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("persons", "0005_person_document"),
    ]

    operations = [
        migrations.AddField(
            model_name="personaddress",
            name="municipio_ibge",
            field=models.CharField(
                blank=True,
                default="",
                help_text="7 dígitos IBGE. Obrigatório para NFS-e Manaus (1302603).",
                max_length=7,
                verbose_name="Código IBGE do município",
            ),
        ),
    ]
