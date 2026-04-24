"""
Paddock Solutions — Persons LGPD Model Tests — Ciclo 06A
TDD: testes escritos ANTES da implementação.

Cobertura:
  - PersonDocument (T01): criptografia round-trip, filtro por hash, campos obrigatórios
  - PersonAddress.municipio_ibge (T02): campo IBGE
  - PersonContact.value criptografado (T03): encrypt + filtro por hash
  - Data migration backfill (T04): Person.document → PersonDocument
"""

import hashlib
from datetime import date

from django.test import TestCase


def sha256_hex(value: str) -> str:
    """Helper SHA-256 para testes."""
    return hashlib.sha256(value.encode()).hexdigest()


def make_person(full_name: str = "João Silva", document: str = "") -> object:
    """Helper para criar Person de teste."""
    from apps.persons.models import Person, PersonRole

    p = Person.objects.create(
        full_name=full_name,
        document=document,
        person_kind="PF",
    )
    PersonRole.objects.create(person=p, role="CLIENT")
    return p


# ── T01: PersonDocument ───────────────────────────────────────────────────────


class TestPersonDocumentEncryption(TestCase):
    """Testa criptografia e filtro por hash em PersonDocument."""

    def setUp(self) -> None:
        self.person = make_person("Maria Oliveira")  # type: ignore[assignment]

    def test_create_cpf_document(self) -> None:
        """Cria PersonDocument com CPF e verifica persistência."""
        from apps.persons.models import PersonDocument

        cpf = "12345678901"
        doc = PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value=cpf,
            value_hash=sha256_hex(cpf),
            is_primary=True,
        )
        self.assertEqual(doc.doc_type, "CPF")
        self.assertEqual(doc.is_primary, True)

    def test_encrypted_value_round_trip(self) -> None:
        """Value armazenado criptografado retorna plaintext ao ler."""
        from apps.persons.models import PersonDocument

        cpf = "98765432100"
        PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value=cpf,
            value_hash=sha256_hex(cpf),
        )
        doc = PersonDocument.objects.filter(value_hash=sha256_hex(cpf)).first()
        self.assertIsNotNone(doc)
        self.assertEqual(doc.value, cpf)

    def test_filter_by_hash(self) -> None:
        """Filtro por value_hash retorna registro correto."""
        from apps.persons.models import PersonDocument

        cpf = "11122233344"
        PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value=cpf,
            value_hash=sha256_hex(cpf),
        )
        # Filtrar diretamente pelo CPF seria incorreto (EncryptedCharField)
        doc = PersonDocument.objects.filter(value_hash=sha256_hex(cpf)).first()
        self.assertIsNotNone(doc)
        self.assertEqual(doc.doc_type, "CPF")

    def test_cnpj_document(self) -> None:
        """Cria PersonDocument com CNPJ."""
        from apps.persons.models import PersonDocument

        cnpj = "12345678000195"
        doc = PersonDocument.objects.create(
            person=self.person,
            doc_type="CNPJ",
            value=cnpj,
            value_hash=sha256_hex(cnpj),
        )
        self.assertEqual(doc.doc_type, "CNPJ")

    def test_rg_document(self) -> None:
        """Cria PersonDocument com RG."""
        from apps.persons.models import PersonDocument

        rg = "1234567"
        doc = PersonDocument.objects.create(
            person=self.person,
            doc_type="RG",
            value=rg,
            value_hash=sha256_hex(rg),
            issued_by="SSP/AM",
            issued_at=date(2015, 3, 10),
        )
        self.assertEqual(doc.doc_type, "RG")
        self.assertEqual(doc.issued_by, "SSP/AM")

    def test_unique_together_person_doctype_hash(self) -> None:
        """Não permite duplicata (person, doc_type, value_hash)."""
        from django.db import IntegrityError

        from apps.persons.models import PersonDocument

        cpf = "55566677788"
        PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value=cpf,
            value_hash=sha256_hex(cpf),
        )
        with self.assertRaises(IntegrityError):
            PersonDocument.objects.create(
                person=self.person,
                doc_type="CPF",
                value=cpf,
                value_hash=sha256_hex(cpf),
            )

    def test_expires_at_optional(self) -> None:
        """Campo expires_at é opcional."""
        from apps.persons.models import PersonDocument

        cnh = "12345678901"
        doc = PersonDocument.objects.create(
            person=self.person,
            doc_type="CNH",
            value=cnh,
            value_hash=sha256_hex(cnh),
            expires_at=date(2030, 12, 31),
        )
        self.assertEqual(doc.expires_at, date(2030, 12, 31))

    def test_person_documents_related_name(self) -> None:
        """Acesso via related_name person.documents funciona."""
        from apps.persons.models import PersonDocument

        cpf = "99988877766"
        PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value=cpf,
            value_hash=sha256_hex(cpf),
        )
        docs = self.person.documents.all()
        self.assertEqual(docs.count(), 1)

    def test_str_representation(self) -> None:
        """__str__ retorna representação legível."""
        from apps.persons.models import PersonDocument

        doc = PersonDocument(doc_type="CPF", person=self.person)
        self.assertIn("CPF", str(doc))

    def test_tipo_documento_choices(self) -> None:
        """TipoDocumento tem CPF, CNPJ, RG, IE, IM, CNH."""
        from apps.persons.models import TipoDocumento

        choices = [c[0] for c in TipoDocumento.choices]
        for expected in ["CPF", "CNPJ", "RG", "IE", "IM", "CNH"]:
            self.assertIn(expected, choices)


# ── T02: PersonAddress.municipio_ibge ────────────────────────────────────────


class TestPersonAddressMunicipioIbge(TestCase):
    """Testa campo municipio_ibge em PersonAddress."""

    def setUp(self) -> None:
        self.person = make_person("Carlos Lima")  # type: ignore[assignment]

    def test_create_address_with_municipio_ibge(self) -> None:
        """PersonAddress com municipio_ibge='1302603' (Manaus)."""
        from apps.persons.models import PersonAddress

        addr = PersonAddress.objects.create(
            person=self.person,
            city="Manaus",
            state="AM",
            municipio_ibge="1302603",
        )
        self.assertEqual(addr.municipio_ibge, "1302603")

    def test_municipio_ibge_blank_default(self) -> None:
        """municipio_ibge aceita blank/default para retrocompatibilidade."""
        from apps.persons.models import PersonAddress

        addr = PersonAddress.objects.create(
            person=self.person,
            city="São Paulo",
            state="SP",
        )
        self.assertEqual(addr.municipio_ibge, "")

    def test_municipio_ibge_7_digits(self) -> None:
        """Código IBGE tem exatamente 7 dígitos."""
        from apps.persons.models import PersonAddress

        addr = PersonAddress.objects.create(
            person=self.person,
            municipio_ibge="3550308",  # São Paulo
            city="São Paulo",
            state="SP",
        )
        self.assertEqual(len(addr.municipio_ibge), 7)


# ── T03: PersonContact.value criptografado ────────────────────────────────────


class TestPersonContactEncryption(TestCase):
    """Testa criptografia em PersonContact.value."""

    def setUp(self) -> None:
        self.person = make_person("Ana Costa")  # type: ignore[assignment]

    def test_create_contact_phone(self) -> None:
        """Cria PersonContact com telefone e verifica persistência."""
        from apps.persons.models import PersonContact

        phone = "92991234567"
        contact = PersonContact.objects.create(
            person=self.person,
            contact_type="CELULAR",
            value=phone,
            value_hash=sha256_hex(phone),
        )
        self.assertEqual(contact.contact_type, "CELULAR")

    def test_contact_encrypted_round_trip(self) -> None:
        """value armazenado criptografado retorna plaintext ao ler."""
        from apps.persons.models import PersonContact

        email = "ana@example.com"
        PersonContact.objects.create(
            person=self.person,
            contact_type="EMAIL",
            value=email,
            value_hash=sha256_hex(email),
        )
        contact = PersonContact.objects.filter(value_hash=sha256_hex(email)).first()
        self.assertIsNotNone(contact)
        self.assertEqual(contact.value, email)

    def test_filter_by_hash(self) -> None:
        """Filtro por value_hash retorna registro correto."""
        from apps.persons.models import PersonContact

        phone = "92998765432"
        PersonContact.objects.create(
            person=self.person,
            contact_type="WHATSAPP",
            value=phone,
            value_hash=sha256_hex(phone),
        )
        contact = PersonContact.objects.filter(value_hash=sha256_hex(phone)).first()
        self.assertIsNotNone(contact)
        self.assertEqual(contact.contact_type, "WHATSAPP")

    def test_value_hash_default_empty(self) -> None:
        """value_hash tem default='' para registros existentes sem hash."""
        from apps.persons.models import PersonContact

        contact = PersonContact.objects.create(
            person=self.person,
            contact_type="COMERCIAL",
            value="3234-5678",
        )
        # Registros antigos sem hash ficam com default ""
        self.assertIsNotNone(contact.value_hash)


# ── T04: Data migration backfill ─────────────────────────────────────────────


class TestDataMigrationBackfill(TestCase):
    """Testa a lógica da data migration que cria PersonDocument a partir de Person.document."""

    def test_backfill_cpf(self) -> None:
        """Person com CPF de 11 dígitos gera PersonDocument tipo CPF."""
        from apps.persons.models import Person, PersonDocument

        # Simular a lógica do backfill diretamente
        cpf = "12345678901"
        p = make_person(document=cpf)
        # Lógica do backfill: detectar tipo
        digits = cpf.replace(".", "").replace("-", "").replace("/", "")
        doc_type = "CPF" if len(digits) == 11 else "CNPJ"
        PersonDocument.objects.create(
            person=p,
            doc_type=doc_type,
            value=cpf,
            value_hash=sha256_hex(cpf),
            is_primary=True,
        )
        doc = p.documents.filter(doc_type="CPF").first()
        self.assertIsNotNone(doc)
        self.assertEqual(doc.is_primary, True)

    def test_backfill_cnpj(self) -> None:
        """Person com CNPJ de 14 dígitos gera PersonDocument tipo CNPJ."""
        from apps.persons.models import Person, PersonDocument

        cnpj = "12345678000195"
        p = make_person(document=cnpj)
        digits = cnpj.replace(".", "").replace("-", "").replace("/", "")
        doc_type = "CPF" if len(digits) == 11 else "CNPJ"
        PersonDocument.objects.create(
            person=p,
            doc_type=doc_type,
            value=cnpj,
            value_hash=sha256_hex(cnpj),
            is_primary=True,
        )
        doc = p.documents.filter(doc_type="CNPJ").first()
        self.assertIsNotNone(doc)

    def test_backfill_empty_document_skipped(self) -> None:
        """Person com document='' não gera PersonDocument."""
        from apps.persons.models import PersonDocument

        p = make_person(document="")
        # Simula a condição do backfill: exclude(document="")
        created_count = 0
        for person in [p]:
            if person.document:  # type: ignore[union-attr]
                created_count += 1
        self.assertEqual(created_count, 0)
        self.assertEqual(PersonDocument.objects.filter(person=p).count(), 0)

    def test_backfill_bulk_create_ignore_conflicts(self) -> None:
        """bulk_create com ignore_conflicts não duplica registros."""
        from apps.persons.models import PersonDocument

        cpf = "55566677788"
        p = make_person(document=cpf)
        hash_val = sha256_hex(cpf)

        # Primeiro create
        PersonDocument.objects.create(
            person=p,
            doc_type="CPF",
            value=cpf,
            value_hash=hash_val,
            is_primary=True,
        )
        # bulk_create com ignore_conflicts não deve falhar
        PersonDocument.objects.bulk_create(
            [
                PersonDocument(
                    person=p,
                    doc_type="CPF",
                    value=cpf,
                    value_hash=hash_val,
                    is_primary=True,
                )
            ],
            ignore_conflicts=True,
        )
        self.assertEqual(PersonDocument.objects.filter(person=p).count(), 1)
