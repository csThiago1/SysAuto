"""
Paddock Solutions — Persons LGPD Serializer Tests — Ciclo 06A
TDD: serializers com mascaramento de PII.

Cobertura:
  - PersonDocumentMaskedSerializer: valor mascarado (padrão)
  - PersonDocumentPlainSerializer: valor plain (fiscal_admin)
  - PersonContactSerializer: contato mascarado
  - PersonDetailSerializer: inclui documents e contacts mascarados
  - Permissão fiscal_admin: view_document_plain
"""

import hashlib
from unittest.mock import MagicMock

from django.test import TestCase


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def make_person(full_name: str = "Teste LGPD") -> object:
    from apps.persons.models import Person, PersonRole

    p = Person.objects.create(full_name=full_name, person_kind="PF")
    PersonRole.objects.create(person=p, role="CLIENT")
    return p


# ── PersonDocumentMaskedSerializer ──────────────────────────────────────────


class TestPersonDocumentMaskedSerializer(TestCase):
    """Testa que PII é mascarada no serializer padrão."""

    def setUp(self) -> None:
        self.person = make_person("Ana Lima")  # type: ignore[assignment]

    def test_masked_serializer_hides_cpf(self) -> None:
        """CPF não é exposto em plain no serializer mascarado."""
        from apps.persons.models import PersonDocument
        from apps.persons.serializers import PersonDocumentMaskedSerializer

        cpf = "12345678901"
        doc = PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value=cpf,
            value_hash=sha256_hex(cpf),
            is_primary=True,
        )
        serializer = PersonDocumentMaskedSerializer(doc)
        data = serializer.data

        # value_masked deve estar presente
        self.assertIn("value_masked", data)
        # valor plain NÃO deve estar presente
        self.assertNotIn("value", data)
        # mascarado não pode revelar CPF completo
        self.assertNotEqual(data["value_masked"], cpf)
        # deve conter asteriscos
        self.assertIn("*", data["value_masked"])

    def test_masked_serializer_last_4_visible(self) -> None:
        """Últimos 4 chars do CPF ficam visíveis."""
        from apps.persons.models import PersonDocument
        from apps.persons.serializers import PersonDocumentMaskedSerializer

        cpf = "98765432100"
        doc = PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value=cpf,
            value_hash=sha256_hex(cpf),
        )
        serializer = PersonDocumentMaskedSerializer(doc)
        masked = serializer.data["value_masked"]
        # Últimos 4 chars devem aparecer
        self.assertTrue(masked.endswith(cpf[-4:]))

    def test_masked_no_value_hash_exposed(self) -> None:
        """value_hash não é exposto no serializer mascarado."""
        from apps.persons.models import PersonDocument
        from apps.persons.serializers import PersonDocumentMaskedSerializer

        cpf = "11122233344"
        doc = PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value=cpf,
            value_hash=sha256_hex(cpf),
        )
        serializer = PersonDocumentMaskedSerializer(doc)
        self.assertNotIn("value_hash", serializer.data)


# ── PersonDocumentPlainSerializer ────────────────────────────────────────────


class TestPersonDocumentPlainSerializer(TestCase):
    """Testa que PII é exposta para fiscal_admin."""

    def setUp(self) -> None:
        self.person = make_person("Carlos Plain")  # type: ignore[assignment]

    def test_plain_serializer_exposes_value(self) -> None:
        """Serializer plain expõe valor em clear text (fiscal_admin)."""
        from apps.persons.models import PersonDocument
        from apps.persons.serializers import PersonDocumentPlainSerializer

        cpf = "55566677788"
        doc = PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value=cpf,
            value_hash=sha256_hex(cpf),
        )
        serializer = PersonDocumentPlainSerializer(doc)
        data = serializer.data

        self.assertIn("value", data)
        self.assertEqual(data["value"], cpf)

    def test_plain_includes_value_hash(self) -> None:
        """Serializer plain inclui value_hash."""
        from apps.persons.models import PersonDocument
        from apps.persons.serializers import PersonDocumentPlainSerializer

        cnpj = "12345678000195"
        doc = PersonDocument.objects.create(
            person=self.person,
            doc_type="CNPJ",
            value=cnpj,
            value_hash=sha256_hex(cnpj),
        )
        serializer = PersonDocumentPlainSerializer(doc)
        self.assertIn("value_hash", serializer.data)
        self.assertEqual(serializer.data["value_hash"], sha256_hex(cnpj))


# ── PersonContactSerializer (mascarado) ─────────────────────────────────────


class TestPersonContactSerializerMasked(TestCase):
    """Testa mascaramento em PersonContactSerializer."""

    def setUp(self) -> None:
        self.person = make_person("Roberto Contato")  # type: ignore[assignment]

    def test_email_masked_in_serializer(self) -> None:
        """Email não é exposto em plain no serializer de contato."""
        from apps.persons.models import PersonContact
        from apps.persons.serializers import PersonContactSerializer

        email = "roberto@example.com"
        contact = PersonContact.objects.create(
            person=self.person,
            contact_type="EMAIL",
            value=email,
            value_hash=sha256_hex(email),
        )
        serializer = PersonContactSerializer(contact)
        data = serializer.data

        self.assertIn("value_masked", data)
        self.assertNotIn("value", data)
        self.assertIn("*", data["value_masked"])

    def test_phone_masked_in_serializer(self) -> None:
        """Telefone não é exposto em plain no serializer de contato."""
        from apps.persons.models import PersonContact
        from apps.persons.serializers import PersonContactSerializer

        phone = "92991234567"
        contact = PersonContact.objects.create(
            person=self.person,
            contact_type="CELULAR",
            value=phone,
            value_hash=sha256_hex(phone),
        )
        serializer = PersonContactSerializer(contact)
        data = serializer.data

        self.assertIn("value_masked", data)
        self.assertNotIn("value", data)
        self.assertTrue(data["value_masked"].endswith(phone[-4:]))


# ── PersonDetailSerializer ──────────────────────────────────────────────────


class TestPersonDetailSerializerLGPD(TestCase):
    """Testa que PersonDetailSerializer inclui documents mascarados."""

    def setUp(self) -> None:
        self.person = make_person("Detalhe LGPD")  # type: ignore[assignment]

    def test_documents_included_in_detail(self) -> None:
        """PersonDetailSerializer inclui campo 'documents'."""
        from apps.persons.models import PersonDocument
        from apps.persons.serializers import PersonDetailSerializer

        cpf = "99988877766"
        PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value=cpf,
            value_hash=sha256_hex(cpf),
        )
        serializer = PersonDetailSerializer(self.person)
        data = serializer.data

        self.assertIn("documents", data)
        self.assertEqual(len(data["documents"]), 1)
        doc_data = data["documents"][0]
        self.assertIn("value_masked", doc_data)
        self.assertNotIn("value", doc_data)

    def test_document_not_exposed_raw(self) -> None:
        """Campo legacy 'document' não está em PersonDetailSerializer."""
        from apps.persons.serializers import PersonDetailSerializer

        serializer = PersonDetailSerializer(self.person)
        # Campo 'document' removido do DetailSerializer (LGPD)
        self.assertNotIn("document", serializer.data)

    def test_contacts_masked_in_detail(self) -> None:
        """Contatos no detalhe estão mascarados."""
        from apps.persons.models import PersonContact
        from apps.persons.serializers import PersonDetailSerializer

        email = "detalhe@example.com"
        PersonContact.objects.create(
            person=self.person,
            contact_type="EMAIL",
            value=email,
            value_hash=sha256_hex(email),
        )
        serializer = PersonDetailSerializer(self.person)
        contacts = serializer.data["contacts"]
        self.assertEqual(len(contacts), 1)
        self.assertIn("value_masked", contacts[0])
        self.assertNotIn("value", contacts[0])

    def test_municipio_ibge_in_address(self) -> None:
        """PersonDetailSerializer inclui municipio_ibge no endereço."""
        from apps.persons.models import PersonAddress
        from apps.persons.serializers import PersonDetailSerializer

        PersonAddress.objects.create(
            person=self.person,
            city="Manaus",
            state="AM",
            municipio_ibge="1302603",
            is_primary=True,
        )
        serializer = PersonDetailSerializer(self.person)
        addresses = serializer.data["addresses"]
        self.assertEqual(len(addresses), 1)
        self.assertEqual(addresses[0]["municipio_ibge"], "1302603")
