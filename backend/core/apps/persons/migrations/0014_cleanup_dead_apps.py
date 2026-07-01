"""Cleanup de artefatos das apps deletadas em 2026-06-30: ai, crm, store.

Estas apps foram removidas de INSTALLED_APPS mas suas tabelas e registros em
django_migrations continuavam órfãos nos schemas tenant. Verificado antes de
deletar: todas as 5 tabelas estavam vazias (0 rows) no ambiente dev.

Roda no contexto de cada tenant (persons é TENANT_APP). Idempotente.
"""
from django.db import migrations


DEAD_TABLES = (
    "ai_knowledge_chunk",
    "ai_recommendation",
    "crm_whatsapp_message",
    "store_cart_item",
    "store_sale",
)

DEAD_APPS = ("ai", "crm", "store", "pdf_engine")


def forwards(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        for table in DEAD_TABLES:
            cursor.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE;')
        placeholders = ",".join(["%s"] * len(DEAD_APPS))
        cursor.execute(
            f"DELETE FROM django_migrations WHERE app IN ({placeholders});",
            DEAD_APPS,
        )


def reverse(apps, schema_editor):
    """Não reversível — dados já eram órfãos, migração é one-way."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("persons", "0013_backfill_persons_from_legacy"),
    ]

    operations = [
        migrations.RunPython(forwards, reverse),
    ]
