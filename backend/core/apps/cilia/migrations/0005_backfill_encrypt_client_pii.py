"""
Migration 0005: Backfill — re-criptografa client_document/client_phone existentes.

A migration 0004 trocou o tipo do campo pra EncryptedCharField, mas isso não
transforma os bytes já gravados: linhas antigas continuam em texto claro no
banco. EncryptedMixin.to_python engole InvalidToken silenciosamente ao ler
valor não cifrado, então basta reler (retorna o texto claro como está) e
salvar de novo — get_prep_value cifra o que estiver em memória no momento do
save. Idempotente: rodar de novo em linha já cifrada só troca o token Fernet.
"""
import logging

from django.db import migrations

logger = logging.getLogger(__name__)


def encrypt_existing(apps, schema_editor):
    # Nota: não dá pra pré-filtrar com .exclude(client_document="") — em campo
    # cifrado (Fernet, não-determinístico) a comparação nunca bate com o valor
    # já gravado. Itera tudo; re-salvar linha vazia é barato e inofensivo.
    OrcamentoCilia = apps.get_model("cilia", "OrcamentoCilia")

    updated = 0
    batch = []
    for obj in OrcamentoCilia.objects.all().iterator(chunk_size=500):
        batch.append(obj)
        if len(batch) >= 500:
            OrcamentoCilia.objects.bulk_update(batch, ["client_document", "client_phone"])
            updated += len(batch)
            batch = []

    if batch:
        OrcamentoCilia.objects.bulk_update(batch, ["client_document", "client_phone"])
        updated += len(batch)

    logger.info("Backfill cilia client_document/client_phone: %d linhas recifradas", updated)


def noop(apps, schema_editor):
    """Reverse: não desfaz — dado já cifrado permanece cifrado (rollback seguro)."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("cilia", "0004_alter_orcamentocilia_client_document_and_more"),
    ]

    operations = [
        migrations.RunPython(encrypt_existing, noop, atomic=False),
    ]
