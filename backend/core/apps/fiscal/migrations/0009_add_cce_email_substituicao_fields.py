"""
Migration 0009: FiscalDocument — CCe, email_sent_at, substituida_por.

Sprint S3-T2: Carta de Correção Eletrônica (CCe) + campos de email e substituição.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fiscal", "0008_encrypt_focus_token"),
    ]

    operations = [
        migrations.AddField(
            model_name="fiscaldocument",
            name="cce_count",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Contador de Cartas de Correção emitidas (máx 20).",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="email_sent_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Data/hora do último envio por email.",
            ),
        ),
        migrations.AddField(
            model_name="fiscaldocument",
            name="substituida_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="substitui",
                to="fiscal.fiscaldocument",
                help_text="Documento que substituiu este (NFS-e).",
            ),
        ),
    ]
