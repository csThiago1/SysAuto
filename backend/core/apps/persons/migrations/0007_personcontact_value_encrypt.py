"""
Migration 0007: PersonContact.value → EncryptedCharField + value_hash
Ciclo 06A — T03: Criptografar PersonContact.value + hash para filtro

Estratégia:
  1. Adicionar value_hash (varchar nullable)
  2. RunPython(atomic=False) — popula hash dos existentes em batches de 200
  3. SeparateDatabaseAndState — altera value para EncryptedCharField no estado Django
     (o DB já tem VARCHAR — encrypted_model_fields armazena no mesmo tipo)
"""
import hashlib

import encrypted_model_fields.fields
from django.db import migrations, models


def populate_value_hash(apps, schema_editor):
    """Popula value_hash para registros existentes (batch 200)."""
    PersonContact = apps.get_model("persons", "PersonContact")
    batch = []
    count = 0
    for contact in PersonContact.objects.all().only("id", "value").iterator(chunk_size=200):
        if contact.value:
            contact.value_hash = hashlib.sha256(str(contact.value).encode()).hexdigest()
        else:
            contact.value_hash = ""
        batch.append(contact)
        count += 1
        if len(batch) >= 200:
            PersonContact.objects.bulk_update(batch, ["value_hash"])
            batch = []
    if batch:
        PersonContact.objects.bulk_update(batch, ["value_hash"])


def noop(apps, schema_editor):
    """Reverse: não faz nada (hash pode ser recalculado)."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("persons", "0006_personaddress_municipio_ibge"),
    ]

    operations = [
        # Step 1: Adicionar value_hash (nullable inicialmente)
        migrations.AddField(
            model_name="personcontact",
            name="value_hash",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                max_length=64,
                verbose_name="Hash do valor",
            ),
        ),
        # Step 2: Popula hash dos registros existentes
        migrations.RunPython(populate_value_hash, noop, atomic=False),
        # Step 3: Altera value para EncryptedCharField no estado Django
        # SeparateDatabaseAndState: o DB já tem VARCHAR — encrypted_model_fields
        # usa o mesmo tipo de coluna, apenas criptografa/descriptografa em Python
        migrations.SeparateDatabaseAndState(
            database_operations=[],  # sem alteração de schema no banco
            state_operations=[
                migrations.AlterField(
                    model_name="personcontact",
                    name="value",
                    field=encrypted_model_fields.fields.EncryptedCharField(
                        max_length=200,
                        verbose_name="Valor",
                    ),
                ),
            ],
        ),
    ]
