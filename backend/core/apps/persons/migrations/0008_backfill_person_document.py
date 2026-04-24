"""
Migration 0008: Data migration — Person.document → PersonDocument
Ciclo 06A — T04: Backfill de documentos a partir de Person.document (plain text)

Lógica:
  - Detecta CPF (11 dígitos) vs CNPJ (14 dígitos)
  - Cria PersonDocument para cada Person com document != ""
  - bulk_create com ignore_conflicts=True (idempotente)
  - Batch de 500 registros

Reversibilidade: is_reversible=False documentado aqui.
  Person.document persiste — rollback não perde dados originais.
  PersonDocument criados devem ser removidos manualmente se necessário.
"""
import hashlib
import logging

from django.db import migrations

logger = logging.getLogger(__name__)


def sha256_hex(value: str) -> str:
    """Helper local para evitar import circular."""
    return hashlib.sha256(value.encode()).hexdigest()


def backfill_documents(apps, schema_editor):
    """Cria PersonDocument para toda Person com document preenchido."""
    Person = apps.get_model("persons", "Person")
    PersonDocument = apps.get_model("persons", "PersonDocument")

    batch = []
    created_count = 0
    skipped_count = 0

    for p in Person.objects.exclude(document="").iterator(chunk_size=500):
        try:
            doc_value = p.document.strip()
            if not doc_value:
                continue
            # Detecta CPF (11 dígitos) ou CNPJ (14 dígitos)
            digits = doc_value.replace(".", "").replace("-", "").replace("/", "").strip()
            if len(digits) == 11:
                doc_type = "CPF"
            elif len(digits) == 14:
                doc_type = "CNPJ"
            else:
                # Formato desconhecido — tratar como CPF por segurança
                doc_type = "CPF"

            batch.append(
                PersonDocument(
                    person=p,
                    doc_type=doc_type,
                    value=doc_value,
                    value_hash=sha256_hex(doc_value),
                    is_primary=True,
                )
            )

            if len(batch) >= 500:
                result = PersonDocument.objects.bulk_create(batch, ignore_conflicts=True)
                created_count += len(result)
                skipped_count += len(batch) - len(result)
                batch = []

        except Exception as exc:
            logger.error("Backfill erro na person_id=%s: %s", getattr(p, "id", "?"), exc)

    if batch:
        result = PersonDocument.objects.bulk_create(batch, ignore_conflicts=True)
        created_count += len(result)
        skipped_count += len(batch) - len(result)

    logger.info(
        "Backfill Person.document → PersonDocument: %d criados, %d ignorados (conflito)",
        created_count,
        skipped_count,
    )


def noop(apps, schema_editor):
    """Reverse: não desfaz (Person.document permanece com dado original)."""
    pass


class Migration(migrations.Migration):
    """
    is_reversible = False — PersonDocument criados não são removidos no rollback.
    Person.document permanece inalterado — rollback seguro.
    """

    dependencies = [
        ("persons", "0007_personcontact_value_encrypt"),
    ]

    operations = [
        migrations.RunPython(backfill_documents, noop, atomic=False),
    ]
