"""
Paddock Solutions — ETL Persons Databox
Importa pessoas do sistema legado Databox para o novo modelo Person (LGPD compliant).

Uso:
    python etl_persons_databox.py \\
        --input data/exports/databox_persons.json \\
        --tenant dscar \\
        --batch 500 \\
        --dry-run          # valida sem gravar

Formatos aceitos: JSON (lista de objetos) e CSV.
Fixture de teste: data/fixtures/persons_databox_sample.json (20 registros sintéticos)

LGPD:
  - CPF/CNPJ armazenados via EncryptedCharField + SHA-256 hash
  - Email e celular criptografados em PersonContact
  - Nunca logar CPF, CNPJ, email ou telefone em texto claro
"""

import argparse
import csv
import hashlib
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

# Configurar Django antes dos imports de models
# O script é chamado com o PATH já configurado para include o projeto Django.
_BACKEND_PATH = str(Path(__file__).parent.parent)
if _BACKEND_PATH not in sys.path:
    sys.path.insert(0, _BACKEND_PATH)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

import django  # noqa: E402

django.setup()

from django.db import transaction  # noqa: E402
from django_tenants.utils import schema_context  # noqa: E402

logger = logging.getLogger(__name__)

# Código IBGE de Manaus — preenchido automaticamente quando cidade.lower() == "manaus"
MANAUS_IBGE = "1302603"


def sha256_hex(value: str) -> str:
    """Hash SHA-256 para armazenamento seguro de PII."""
    return hashlib.sha256(value.encode()).hexdigest()


def _parse_record(row: dict[str, Any]) -> dict[str, Any]:
    """Normaliza um registro do Databox para o formato interno.

    Args:
        row: Registro bruto do CSV/JSON Databox.

    Returns:
        Dicionário normalizado com campos do modelo Person/PersonDocument/PersonContact/PersonAddress.

    Raises:
        ValueError: Se campos obrigatórios (full_name) estiverem ausentes.
    """
    full_name = str(row.get("full_name", row.get("nome", ""))).strip()
    if not full_name:
        raise ValueError("full_name obrigatório")

    person_kind = str(row.get("person_kind", "PF")).upper()
    if person_kind not in ("PF", "PJ"):
        person_kind = "PF"

    # Documento principal
    cpf = str(row.get("cpf", "")).strip().replace(".", "").replace("-", "")
    cnpj = str(row.get("cnpj", "")).strip().replace(".", "").replace("-", "").replace("/", "")
    document = cpf if cpf else cnpj

    # Contatos
    email = str(row.get("email", "")).strip()
    celular = (
        str(row.get("celular", ""))
        .strip()
        .replace(" ", "")
        .replace("(", "")
        .replace(")", "")
        .replace("-", "")
    )
    comercial = (
        str(row.get("comercial", ""))
        .strip()
        .replace(" ", "")
        .replace("(", "")
        .replace(")", "")
        .replace("-", "")
    )

    # Endereço
    cidade = str(row.get("cidade", row.get("city", ""))).strip()
    uf = str(row.get("uf", row.get("state", ""))).strip().upper()
    municipio_ibge = MANAUS_IBGE if cidade.lower() == "manaus" else ""

    return {
        "full_name": full_name,
        "person_kind": person_kind,
        "document": document,
        "cpf": cpf,
        "cnpj": cnpj,
        "rg": str(row.get("rg", "")).strip(),
        "email": email,
        "celular": celular,
        "comercial": comercial,
        "legacy_code": str(row.get("legacy_code", row.get("codigo_legado", ""))).strip(),
        "legacy_category": str(row.get("legacy_category", row.get("categoria", ""))).strip(),
        # Endereço
        "cep": str(row.get("cep", "")).strip().replace("-", ""),
        "logradouro": str(row.get("logradouro", row.get("street", ""))).strip(),
        "numero": str(row.get("numero", row.get("number", ""))).strip(),
        "complemento": str(row.get("complemento", row.get("complement", ""))).strip(),
        "bairro": str(row.get("bairro", row.get("neighborhood", ""))).strip(),
        "cidade": cidade,
        "uf": uf,
        "municipio_ibge": municipio_ibge,
    }


def _load_input(input_path: str, fmt: str = "auto") -> list[dict[str, Any]]:
    """Carrega o arquivo de entrada (JSON ou CSV).

    Args:
        input_path: Caminho para o arquivo.
        fmt: Formato: 'json', 'csv', 'auto' (detecta pela extensão).

    Returns:
        Lista de registros brutos.
    """
    path = Path(input_path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    if fmt == "auto":
        fmt = "json" if path.suffix.lower() == ".json" else "csv"

    if fmt == "json":
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            # Suporte a envelopes {"records": [...]} ou {"data": [...]}
            data = data.get("records", data.get("data", data.get("persons", [])))
        return list(data)

    # CSV
    records = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(dict(row))
    return records


def _process_person(
    parsed: dict[str, Any],
    dry_run: bool = False,
) -> tuple[str, str]:
    """Importa um registro Person com seus documentos, contatos e endereço.

    Args:
        parsed: Registro normalizado por _parse_record().
        dry_run: Se True, valida sem gravar.

    Returns:
        Tuple (action, full_name): action = 'created' | 'updated' | 'skipped'.
    """
    from apps.persons.models import Person, PersonAddress, PersonContact, PersonDocument, PersonRole

    full_name = parsed["full_name"]

    if dry_run:
        return "dry_run", full_name

    with transaction.atomic():
        # get_or_create por legacy_code (idempotente)
        legacy_code = parsed.get("legacy_code", "")
        if legacy_code:
            person, created = Person.objects.get_or_create(
                legacy_code=legacy_code,
                defaults={
                    "full_name": full_name,
                    "person_kind": parsed["person_kind"],
                    "legacy_category": parsed.get("legacy_category", ""),
                },
            )
            if not created:
                # Atualiza campos se necessário
                person.full_name = full_name
                person.person_kind = parsed["person_kind"]
                person.save(update_fields=["full_name", "person_kind"])
                action = "updated"
            else:
                action = "created"
        else:
            person = Person.objects.create(
                full_name=full_name,
                person_kind=parsed["person_kind"],
                legacy_category=parsed.get("legacy_category", ""),
            )
            action = "created"

        # Role padrão: CLIENT
        PersonRole.objects.get_or_create(person=person, role="CLIENT")

        # PersonDocument: CPF ou CNPJ
        _create_document_if_needed(
            person=person,
            parsed=parsed,
        )

        # PersonContact: email
        email = parsed.get("email", "")
        if email:
            PersonContact.objects.get_or_create(
                person=person,
                value_hash=sha256_hex(email),
                defaults={
                    "contact_type": "EMAIL",
                    "value": email,
                },
            )

        # PersonContact: celular
        celular = parsed.get("celular", "")
        if celular:
            PersonContact.objects.get_or_create(
                person=person,
                value_hash=sha256_hex(celular),
                defaults={
                    "contact_type": "CELULAR",
                    "value": celular,
                    "is_primary": True,
                },
            )

        # PersonContact: comercial
        comercial = parsed.get("comercial", "")
        if comercial:
            PersonContact.objects.get_or_create(
                person=person,
                value_hash=sha256_hex(comercial),
                defaults={
                    "contact_type": "COMERCIAL",
                    "value": comercial,
                },
            )

        # PersonAddress
        _create_address_if_needed(person=person, parsed=parsed)

    return action, full_name


def _create_document_if_needed(person: object, parsed: dict[str, Any]) -> None:
    """Cria PersonDocument para CPF ou CNPJ se ainda não existir."""
    from apps.persons.models import PersonDocument

    cpf = parsed.get("cpf", "")
    cnpj = parsed.get("cnpj", "")
    rg = parsed.get("rg", "")

    if cpf:
        PersonDocument.objects.bulk_create(
            [
                PersonDocument(
                    person=person,  # type: ignore[arg-type]
                    doc_type="CPF",
                    value=cpf,
                    value_hash=sha256_hex(cpf),
                    is_primary=True,
                )
            ],
            ignore_conflicts=True,
        )

    if cnpj:
        PersonDocument.objects.bulk_create(
            [
                PersonDocument(
                    person=person,  # type: ignore[arg-type]
                    doc_type="CNPJ",
                    value=cnpj,
                    value_hash=sha256_hex(cnpj),
                    is_primary=True,
                )
            ],
            ignore_conflicts=True,
        )

    if rg:
        PersonDocument.objects.bulk_create(
            [
                PersonDocument(
                    person=person,  # type: ignore[arg-type]
                    doc_type="RG",
                    value=rg,
                    value_hash=sha256_hex(rg),
                )
            ],
            ignore_conflicts=True,
        )


def _create_address_if_needed(person: object, parsed: dict[str, Any]) -> None:
    """Cria PersonAddress se ainda não existir um principal."""
    from apps.persons.models import PersonAddress

    # Só cria se não há endereço principal
    if PersonAddress.objects.filter(person=person, is_primary=True).exists():  # type: ignore[arg-type]
        return

    cep = parsed.get("cep", "")
    logradouro = parsed.get("logradouro", "")
    cidade = parsed.get("cidade", "")

    if cep or logradouro or cidade:
        PersonAddress.objects.create(
            person=person,  # type: ignore[arg-type]
            address_type="PRINCIPAL",
            zip_code=cep,
            street=logradouro,
            number=parsed.get("numero", ""),
            complement=parsed.get("complemento", ""),
            neighborhood=parsed.get("bairro", ""),
            city=cidade,
            state=parsed.get("uf", ""),
            municipio_ibge=parsed.get("municipio_ibge", ""),
            is_primary=True,
        )


def run_etl(
    input_path: str,
    tenant: str,
    batch_size: int = 500,
    dry_run: bool = False,
    fmt: str = "auto",
) -> dict[str, int]:
    """Executa o ETL de importação de pessoas.

    Args:
        input_path: Caminho para o arquivo de entrada.
        tenant: Schema do tenant (ex: 'dscar', 'tenant_dscar').
        batch_size: Tamanho do batch para log de progresso.
        dry_run: Se True, valida sem gravar.
        fmt: Formato do arquivo ('json', 'csv', 'auto').

    Returns:
        Dicionário com contadores: {created, updated, errors, dry_run_total}.
    """
    logger.info(
        "ETL Databox iniciado | tenant=%s | dry_run=%s | input=%s", tenant, dry_run, input_path
    )

    records = _load_input(input_path, fmt=fmt)
    total = len(records)
    logger.info("Total de registros carregados: %d", total)

    counters: dict[str, int] = {"created": 0, "updated": 0, "errors": 0, "dry_run_total": 0}

    # Normaliza schema para formato tenant_XXX
    schema = tenant if tenant.startswith("tenant_") else f"tenant_{tenant}"

    with schema_context(schema):
        for i, row in enumerate(records, start=1):
            try:
                parsed = _parse_record(row)
                action, _ = _process_person(parsed, dry_run=dry_run)

                if dry_run:
                    counters["dry_run_total"] += 1
                elif action == "created":
                    counters["created"] += 1
                elif action == "updated":
                    counters["updated"] += 1

                if i % batch_size == 0:
                    logger.info(
                        "Progresso: %d/%d | criados=%d | atualizados=%d | erros=%d",
                        i,
                        total,
                        counters["created"],
                        counters["updated"],
                        counters["errors"],
                    )

            except Exception as exc:
                counters["errors"] += 1
                # LGPD: nunca logar dados pessoais (CPF, email, etc.)
                logger.error(
                    "Erro no registro #%d (legacy_code=%s): %s",
                    i,
                    row.get("legacy_code", "?"),
                    exc,
                )

    if dry_run:
        logger.info(
            "ETL DRY-RUN concluído: %d validados, %d erros",
            counters["dry_run_total"],
            counters["errors"],
        )
    else:
        logger.info(
            "ETL concluído: %d criados, %d atualizados, %d erros",
            counters["created"],
            counters["updated"],
            counters["errors"],
        )

    return counters


def main() -> None:
    """Entry point do script."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="ETL Databox → Persons LGPD compliant",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--input", required=True, help="Arquivo JSON ou CSV de entrada")
    parser.add_argument("--tenant", required=True, help="Schema do tenant (ex: dscar)")
    parser.add_argument(
        "--batch", type=int, default=500, help="Tamanho do batch para log (default: 500)"
    )
    parser.add_argument("--dry-run", action="store_true", help="Valida sem gravar no banco")
    parser.add_argument(
        "--format", choices=["json", "csv", "auto"], default="auto", help="Formato do arquivo"
    )

    args = parser.parse_args()

    counters = run_etl(
        input_path=args.input,
        tenant=args.tenant,
        batch_size=args.batch,
        dry_run=args.dry_run,
        fmt=args.format,
    )

    if args.dry_run:
        print(f"\nDRY-RUN: {counters['dry_run_total']} validados, {counters['errors']} erros")
    else:
        print(
            f"\nConcluído: {counters['created']} criados, "
            f"{counters['updated']} atualizados, "
            f"{counters['errors']} erros"
        )

    # Exit code 1 se houver erros
    if counters["errors"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
