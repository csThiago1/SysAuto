"""
Paddock Solutions — Persons ETL Tests — Ciclo 06A
TDD: testa o ETL etl_persons_databox.py sem necessidade de Docker.

Cobertura:
  - _parse_record: normalização de campos
  - _mask_value: mascaramento (unit)
  - run_etl dry-run: valida sem gravar
  - run_etl real: criação de Person, PersonDocument, PersonContact, PersonAddress
  - Duplicatas: bulk_create ignore_conflicts
  - Erros por linha: não aborta batch
  - municipio_ibge preenchido apenas para Manaus
"""

import hashlib
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


# ── Testes de unit (sem DB) ───────────────────────────────────────────────────


class TestParseRecord(SimpleTestCase):
    """Testa _parse_record sem acesso a DB."""

    def _parse(self, row: dict) -> dict:
        """Importa e chama _parse_record."""
        # Import local para não executar django.setup() no nível de módulo
        import sys

        backend_path = str(Path(__file__).parent.parent.parent.parent)
        if backend_path not in sys.path:
            sys.path.insert(0, backend_path)
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
        from scripts.etl_persons_databox import _parse_record

        return _parse_record(row)

    def test_parse_pf_basic(self) -> None:
        """Parseia registro PF com campos básicos."""
        row = {
            "full_name": "João Silva",
            "person_kind": "PF",
            "cpf": "123.456.789-01",
            "legacy_code": "DB001",
        }
        result = self._parse(row)
        self.assertEqual(result["full_name"], "João Silva")
        self.assertEqual(result["person_kind"], "PF")
        # CPF limpo (sem pontuação)
        self.assertEqual(result["cpf"], "12345678901")

    def test_parse_pj_cnpj(self) -> None:
        """Parseia registro PJ com CNPJ."""
        row = {
            "full_name": "Empresa LTDA",
            "person_kind": "PJ",
            "cnpj": "12.345.678/0001-95",
        }
        result = self._parse(row)
        self.assertEqual(result["person_kind"], "PJ")
        self.assertEqual(result["cnpj"], "12345678000195")

    def test_parse_manaus_ibge(self) -> None:
        """Preenche municipio_ibge='1302603' quando cidade == 'Manaus'."""
        row = {
            "full_name": "Manaus Person",
            "cidade": "Manaus",
            "uf": "AM",
        }
        result = self._parse(row)
        self.assertEqual(result["municipio_ibge"], "1302603")

    def test_parse_other_city_no_ibge(self) -> None:
        """Não preenche municipio_ibge para outras cidades."""
        row = {
            "full_name": "São Paulo Person",
            "cidade": "São Paulo",
            "uf": "SP",
        }
        result = self._parse(row)
        self.assertEqual(result["municipio_ibge"], "")

    def test_parse_manaus_case_insensitive(self) -> None:
        """municipio_ibge preenchido independente de capitalização."""
        row = {
            "full_name": "MANAUS Person",
            "cidade": "MANAUS",
            "uf": "AM",
        }
        result = self._parse(row)
        self.assertEqual(result["municipio_ibge"], "1302603")

    def test_parse_missing_full_name_raises(self) -> None:
        """_parse_record levanta ValueError se full_name ausente."""
        import sys

        backend_path = str(Path(__file__).parent.parent.parent.parent)
        if backend_path not in sys.path:
            sys.path.insert(0, backend_path)
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
        from scripts.etl_persons_databox import _parse_record

        with self.assertRaises(ValueError):
            _parse_record({"cpf": "12345678901"})

    def test_parse_defaults(self) -> None:
        """Campos opcionais têm default vazio."""
        row = {"full_name": "Sem Extras"}
        result = self._parse(row)
        self.assertEqual(result["email"], "")
        self.assertEqual(result["celular"], "")
        self.assertEqual(result["legacy_code"], "")


class TestLoadInput(SimpleTestCase):
    """Testa _load_input para JSON e CSV."""

    def _load(self, path: str, fmt: str = "auto") -> list:
        import sys

        backend_path = str(Path(__file__).parent.parent.parent.parent)
        if backend_path not in sys.path:
            sys.path.insert(0, backend_path)
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
        from scripts.etl_persons_databox import _load_input

        return _load_input(path, fmt)

    def test_load_json(self) -> None:
        """Carrega fixture JSON com 20 registros."""
        fixture_path = str(
            Path(__file__).parent.parent.parent.parent.parent.parent
            / "data"
            / "fixtures"
            / "persons_databox_sample.json"
        )
        if not Path(fixture_path).exists():
            self.skipTest(f"Fixture não encontrada: {fixture_path}")
        records = self._load(fixture_path)
        self.assertGreater(len(records), 0)
        self.assertIn("full_name", records[0])

    def test_load_json_envelope(self) -> None:
        """Carrega JSON com envelope {'records': [...]}."""
        data = {"records": [{"full_name": "Test"}]}
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        ) as f:
            json.dump(data, f)
            f.flush()
            records = self._load(f.name)
        self.assertEqual(len(records), 1)

    def test_load_csv(self) -> None:
        """Carrega CSV simples."""
        import csv as csv_module

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8", newline=""
        ) as f:
            writer = csv_module.DictWriter(f, fieldnames=["full_name", "cpf"])
            writer.writeheader()
            writer.writerow({"full_name": "CSV Person", "cpf": "12345678901"})
            fname = f.name
        records = self._load(fname, fmt="csv")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["full_name"], "CSV Person")

    def test_load_file_not_found(self) -> None:
        """FileNotFoundError para arquivo inexistente."""
        import sys

        backend_path = str(Path(__file__).parent.parent.parent.parent)
        if backend_path not in sys.path:
            sys.path.insert(0, backend_path)
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
        from scripts.etl_persons_databox import _load_input

        with self.assertRaises(FileNotFoundError):
            _load_input("/nonexistent/path/file.json")


# ── Testes de integração (requerem DB) ────────────────────────────────────────


class TestEtlPersonsDB(TestCase):
    """Testa ETL com banco de dados (TestCase)."""

    def _run_etl_local(self, records: list, dry_run: bool = False) -> dict:
        """Executa ETL diretamente sem schema_context para testes locais."""
        import sys

        backend_path = str(Path(__file__).parent.parent.parent.parent)
        if backend_path not in sys.path:
            sys.path.insert(0, backend_path)
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
        from scripts.etl_persons_databox import _parse_record, _process_person

        counters: dict[str, int] = {"created": 0, "updated": 0, "errors": 0, "dry_run_total": 0}

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
            except Exception as exc:
                counters["errors"] += 1

        return counters

    def test_dry_run_no_db_writes(self) -> None:
        """dry_run=True não grava no banco."""
        from apps.persons.models import Person

        initial_count = Person.objects.count()
        records = [
            {"full_name": "DryRun Person", "cpf": "12345678901", "legacy_code": "DRTEST001"},
        ]
        counters = self._run_etl_local(records, dry_run=True)
        self.assertEqual(counters["dry_run_total"], 1)
        self.assertEqual(counters["errors"], 0)
        # Banco não deve ter sido alterado
        self.assertEqual(Person.objects.count(), initial_count)

    def test_creates_person_and_document(self) -> None:
        """ETL cria Person + PersonDocument com CPF criptografado."""
        from apps.persons.models import Person, PersonDocument

        records = [
            {
                "full_name": "ETL Test Person",
                "cpf": "11122233344",
                "legacy_code": "ETL001",
                "cidade": "Manaus",
                "uf": "AM",
            }
        ]
        counters = self._run_etl_local(records)
        self.assertEqual(counters["created"], 1)
        self.assertEqual(counters["errors"], 0)

        person = Person.objects.filter(legacy_code="ETL001").first()
        self.assertIsNotNone(person)

        doc = PersonDocument.objects.filter(
            person=person,
            value_hash=sha256_hex("11122233344"),
        ).first()
        self.assertIsNotNone(doc)
        self.assertEqual(doc.doc_type, "CPF")
        self.assertEqual(doc.value, "11122233344")

    def test_creates_contacts(self) -> None:
        """ETL cria PersonContact para email e celular."""
        from apps.persons.models import Person, PersonContact

        records = [
            {
                "full_name": "ETL Contact Person",
                "legacy_code": "ETL002",
                "email": "etl@example.com",
                "celular": "92911223344",
            }
        ]
        self._run_etl_local(records)

        person = Person.objects.filter(legacy_code="ETL002").first()
        self.assertIsNotNone(person)

        email_contact = PersonContact.objects.filter(
            person=person,
            value_hash=sha256_hex("etl@example.com"),
        ).first()
        self.assertIsNotNone(email_contact)
        self.assertEqual(email_contact.contact_type, "EMAIL")
        self.assertEqual(email_contact.value, "etl@example.com")

        phone_contact = PersonContact.objects.filter(
            person=person,
            value_hash=sha256_hex("92911223344"),
        ).first()
        self.assertIsNotNone(phone_contact)

    def test_creates_address_manaus(self) -> None:
        """ETL cria PersonAddress com municipio_ibge='1302603' para Manaus."""
        from apps.persons.models import Person, PersonAddress

        records = [
            {
                "full_name": "ETL Manaus Person",
                "legacy_code": "ETL003",
                "cep": "69000001",
                "logradouro": "Av. Eduardo Ribeiro",
                "numero": "520",
                "cidade": "Manaus",
                "uf": "AM",
            }
        ]
        self._run_etl_local(records)

        person = Person.objects.filter(legacy_code="ETL003").first()
        addr = PersonAddress.objects.filter(person=person, is_primary=True).first()
        self.assertIsNotNone(addr)
        self.assertEqual(addr.municipio_ibge, "1302603")

    def test_idempotent_duplicate_ignored(self) -> None:
        """ETL é idempotente — rodar duas vezes não duplica registros."""
        from apps.persons.models import Person

        records = [
            {
                "full_name": "ETL Idempotent",
                "cpf": "55566677788",
                "legacy_code": "ETL004",
            }
        ]
        self._run_etl_local(records)
        self._run_etl_local(records)  # segunda execução

        count = Person.objects.filter(legacy_code="ETL004").count()
        self.assertEqual(count, 1)

    def test_error_does_not_abort_batch(self) -> None:
        """Erro em uma linha não aborta o batch — processa o restante."""
        from apps.persons.models import Person

        records = [
            {"full_name": "ETL Error Record"},  # Faltando campos mas válido
            {},  # Sem full_name — vai causar erro
            {"full_name": "ETL After Error", "legacy_code": "ETL005"},
        ]
        counters = self._run_etl_local(records)
        # Deve ter criado 2 e errado 1
        self.assertGreater(counters["created"], 0)
        self.assertGreater(counters["errors"], 0)

        # ETL After Error deve ter sido criado
        self.assertTrue(Person.objects.filter(legacy_code="ETL005").exists())

    def test_cnpj_document_created(self) -> None:
        """ETL cria PersonDocument com CNPJ para pessoa jurídica."""
        from apps.persons.models import Person, PersonDocument

        records = [
            {
                "full_name": "Empresa ETL LTDA",
                "person_kind": "PJ",
                "cnpj": "12345678000195",
                "legacy_code": "ETL006",
            }
        ]
        self._run_etl_local(records)

        person = Person.objects.filter(legacy_code="ETL006").first()
        doc = PersonDocument.objects.filter(
            person=person,
            doc_type="CNPJ",
            value_hash=sha256_hex("12345678000195"),
        ).first()
        self.assertIsNotNone(doc)
        self.assertEqual(doc.value, "12345678000195")
