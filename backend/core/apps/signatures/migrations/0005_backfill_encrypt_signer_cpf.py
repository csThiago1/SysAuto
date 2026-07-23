"""
Migration 0005: Backfill — re-criptografa signer_cpf existentes.

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
    Signature = apps.get_model("signatures", "Signature")

    updated = 0
    batch = []
    for obj in Signature.objects.all().iterator(chunk_size=500):
        batch.append(obj)
        if len(batch) >= 500:
            Signature.objects.bulk_update(batch, ["signer_cpf"])
            updated += len(batch)
            batch = []

    if batch:
        Signature.objects.bulk_update(batch, ["signer_cpf"])
        updated += len(batch)

    logger.info("Backfill signatures.signer_cpf: %d linhas recifradas", updated)


def noop(apps, schema_editor):
    """Reverse: não desfaz — dado já cifrado permanece cifrado (rollback seguro)."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("signatures", "0004_alter_signature_signer_cpf"),
    ]

    operations = [
        migrations.RunPython(encrypt_existing, noop, atomic=False),
    ]
