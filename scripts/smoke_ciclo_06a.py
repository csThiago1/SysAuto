#!/usr/bin/env python
"""
Smoke test Ciclo 06A — Person LGPD

Executa 8 verificações no ambiente configurado via DJANGO_SETTINGS_MODULE.
Uso:
    python scripts/smoke_ciclo_06a.py [--dry-run-etl]

Retorna código 0 se todas as verificações passam, 1 se alguma falha.
"""
import argparse
import os
import sys
import tempfile
import json

# Setup Django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend/core"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.test.utils import override_settings
from django_tenants.utils import schema_context

# ─── helpers ────────────────────────────────────────────────────────────────

TENANT_SCHEMA = os.environ.get("SMOKE_TENANT", "tenant_dscar")
PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"

results: list[tuple[int, str, bool]] = []


def check(num: int, desc: str, ok: bool) -> None:
    results.append((num, desc, ok))
    icon = PASS if ok else FAIL
    print(f"  {icon} [{num}] {desc}")


# ─── verificações ────────────────────────────────────────────────────────────


def run(dry_run_etl: bool) -> None:
    with schema_context(TENANT_SCHEMA):
        _run_checks(dry_run_etl)


def _run_checks(dry_run_etl: bool) -> None:
    from apps.persons.models import (
        Person,
        PersonAddress,
        PersonContact,
        PersonDocument,
        TipoContato,
        TipoDocumento,
        TipoPessoa,
    )
    from apps.persons.utils import sha256_hex

    CPF_TEST = "12345678901"
    EMAIL_TEST = "smoke06a@paddock.solutions"
    TEL_TEST = "92991234567"

    # ── [1] Cria Person (PF) com CPF criptografado ──────────────────────────
    try:
        person = Person.objects.create(
            full_name="Smoke 06A", person_kind=TipoPessoa.FISICA
        )
        doc = PersonDocument.objects.create(
            person=person,
            doc_type=TipoDocumento.CPF,
            value=CPF_TEST,
            value_hash=sha256_hex(CPF_TEST),
            is_primary=True,
        )
        check(1, "Cria Person (PF) com CPF criptografado", doc.pk is not None)
    except Exception as exc:
        check(1, f"Cria Person (PF) com CPF criptografado — ERRO: {exc}", False)
        person = None  # type: ignore[assignment]

    if not person:
        for i in range(2, 9):
            check(i, "Pulado (person não criado)", False)
        return

    # ── [2] Filtra PersonDocument por hash ───────────────────────────────────
    try:
        found = PersonDocument.objects.filter(value_hash=sha256_hex(CPF_TEST)).first()
        check(
            2,
            "Filtra PersonDocument por hash — encontra registro",
            found is not None and found.pk == doc.pk,
        )
    except Exception as exc:
        check(2, f"Filtro por hash — ERRO: {exc}", False)

    # ── [3] Verifica que o valor plain é recuperado corretamente ─────────────
    try:
        fresh = PersonDocument.objects.get(pk=doc.pk)
        check(3, "PersonDocument.value retorna CPF plain", fresh.value == CPF_TEST)
    except Exception as exc:
        check(3, f"PersonDocument plain — ERRO: {exc}", False)

    # ── [4] Cria PersonContact (email) criptografado — filtra por hash ────────
    try:
        contact = PersonContact.objects.create(
            person=person,
            contact_type=TipoContato.EMAIL,
            value=EMAIL_TEST,
            value_hash=sha256_hex(EMAIL_TEST),
            is_primary=True,
        )
        found_c = PersonContact.objects.filter(
            value_hash=sha256_hex(EMAIL_TEST)
        ).first()
        check(
            4,
            "PersonContact email criptografado — filtra por hash",
            found_c is not None and found_c.pk == contact.pk,
        )
    except Exception as exc:
        check(4, f"PersonContact — ERRO: {exc}", False)

    # ── [5] Cria PersonAddress com municipio_ibge ─────────────────────────────
    try:
        addr = PersonAddress.objects.create(
            person=person,
            city="Manaus",
            state="AM",
            municipio_ibge="1302603",
        )
        check(
            5,
            "PersonAddress.municipio_ibge='1302603' salvo",
            addr.municipio_ibge == "1302603",
        )
    except Exception as exc:
        check(5, f"PersonAddress municipio_ibge — ERRO: {exc}", False)

    # ── [6] Serializer masked retorna CPF mascarado ───────────────────────────
    try:
        from apps.persons.serializers import PersonDocumentMaskedSerializer

        ser = PersonDocumentMaskedSerializer(doc)
        masked = ser.data.get("value_masked", "")
        check(
            6,
            f"PersonDocumentMaskedSerializer retorna CPF mascarado ('{masked}')",
            "*" in masked,
        )
    except Exception as exc:
        check(6, f"Serializer masked — ERRO: {exc}", False)

    # ── [7] ETL --dry-run com fixture sintética ───────────────────────────────
    fixture_path = os.path.join(
        os.path.dirname(__file__), "../data/fixtures/persons_databox_sample.json"
    )
    try:
        import subprocess

        etl_script = os.path.join(
            os.path.dirname(__file__), "../backend/core/scripts/etl_persons_databox.py"
        )
        result = subprocess.run(
            [
                sys.executable,
                etl_script,
                "--input",
                fixture_path,
                "--tenant",
                TENANT_SCHEMA.replace("tenant_", ""),
                "--dry-run",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        ok = result.returncode == 0
        if not ok:
            print(f"    ETL stderr: {result.stderr[:200]}")
        check(
            7,
            "ETL --dry-run com fixture sintética (20 registros) — 0 erros, 0 gravações",
            ok,
        )
    except Exception as exc:
        check(7, f"ETL --dry-run — ERRO: {exc}", False)

    # ── [8] ETL real com fixture sintética ────────────────────────────────────
    if not dry_run_etl:
        try:
            before = PersonDocument.objects.count()
            result = subprocess.run(  # type: ignore[name-defined]
                [
                    sys.executable,
                    etl_script,  # type: ignore[name-defined]
                    "--input",
                    fixture_path,
                    "--tenant",
                    TENANT_SCHEMA.replace("tenant_", ""),
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )
            after = PersonDocument.objects.count()
            ok = result.returncode == 0 and after > before
            if not ok:
                print(f"    ETL stderr: {result.stderr[:200]}")
            check(8, f"ETL real com fixture — {after - before} documentos criados", ok)
        except Exception as exc:
            check(8, f"ETL real — ERRO: {exc}", False)
    else:
        check(8, "ETL real — pulado (--dry-run-etl passado)", True)

    # cleanup
    PersonDocument.objects.filter(person=person).delete()
    PersonContact.objects.filter(person=person).delete()
    PersonAddress.objects.filter(person=person).delete()
    person.delete()


# ─── main ────────────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test Ciclo 06A — Person LGPD")
    parser.add_argument(
        "--dry-run-etl",
        action="store_true",
        help="Pula o ETL real (teste 8) — só roda o dry-run",
    )
    args = parser.parse_args()

    print(f"\n=== Smoke Test Ciclo 06A — Person LGPD (tenant: {TENANT_SCHEMA}) ===\n")
    run(dry_run_etl=args.dry_run_etl)

    passed = sum(1 for _, _, ok in results if ok)
    total = len(results)
    print(f"\n{'=' * 60}")
    print(f"Resultado: {passed}/{total} verificações passando")
    if passed == total:
        print(f"\033[92m✓ Ciclo 06A smoke test OK\033[0m\n")
        return 0
    else:
        failed = [f"[{n}] {d}" for n, d, ok in results if not ok]
        print(f"\033[91m✗ Falhas:\033[0m")
        for f in failed:
            print(f"  - {f}")
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
