"""Testes para helpers de backfill (Supplier/Expert → Person + Profiles).

DEPRECATED: accounts_payable.Supplier e experts.Expert foram removidos em
2026-06-22. Os helpers ainda funcionam em migrations históricas (modelos
historical via apps_registry), mas em runtime pós-drop retornam dict vazio.
Testes que dependiam desses models estão marcados como skip — comportamento
de runtime é coberto por test_backfill_skipped_when_no_model.
"""
import pytest
from django.apps import apps as django_apps
from django_tenants.test.cases import TenantTestCase

from apps.persons.migrations._backfill_helpers import (
    backfill_suppliers_to_persons,
    backfill_experts_to_persons,
    find_or_create_person_from_supplier,
    find_or_create_person_from_expert,
)


def test_backfill_suppliers_returns_empty_when_no_model() -> None:
    """Pós-drop, backfill retorna dict vazio em vez de levantar."""
    # accounts_payable.Supplier foi removido — helper deve tolerar.
    assert backfill_suppliers_to_persons(django_apps) == {}


def test_backfill_experts_returns_empty_when_no_model() -> None:
    """Pós-drop, backfill retorna dict vazio em vez de levantar."""
    assert backfill_experts_to_persons(django_apps) == {}


@pytest.mark.skip(
    reason="accounts_payable.Supplier removido em 2026-06-22; backfill "
    "validado por testes em context de migration (modelos históricos)."
)
class TestBackfillSuppliers(TenantTestCase):
    """Testes para backfill de accounts_payable.Supplier → persons.Person + SupplierProfile."""

    def test_supplier_with_cnpj_creates_pj_person(self) -> None:
        """Supplier com CNPJ cria Person(kind=PJ) com PersonDocument, PersonContact e SupplierProfile."""
        Supplier = django_apps.get_model("accounts_payable", "Supplier")
        Person = django_apps.get_model("persons", "Person")
        SupplierProfile = django_apps.get_model("persons", "SupplierProfile")
        PersonContact = django_apps.get_model("persons", "PersonContact")

        # Criar Supplier com CNPJ
        sup = Supplier.objects.create(
            name="Auto Peças MAO LTDA",
            cnpj="12345678000190",
            email="contato@autopecasmao.com.br",
            phone="92999999999",
        )

        # Executar backfill
        mapping = backfill_suppliers_to_persons(django_apps)

        # Verificar que Supplier foi migrado
        assert sup.id in mapping
        person = Person.objects.get(pk=mapping[sup.id])

        # Verificar dados básicos da Person
        assert person.person_kind == "PJ"
        assert person.full_name == "Auto Peças MAO LTDA"

        # Verificar SupplierProfile
        supplier_profile = SupplierProfile.objects.get(person=person)
        assert supplier_profile.legacy_supplier_id == str(sup.id)

        # Verificar PersonContact (email + phone)
        assert PersonContact.objects.filter(
            person=person,
            contact_type="EMAIL",
        ).exists()
        assert PersonContact.objects.filter(
            person=person,
            contact_type="CELULAR",
        ).exists()

    def test_supplier_with_cpf_creates_pf_person(self) -> None:
        """Supplier com CPF (sem CNPJ) cria Person(kind=PF)."""
        Supplier = django_apps.get_model("accounts_payable", "Supplier")
        Person = django_apps.get_model("persons", "Person")

        sup = Supplier.objects.create(
            name="João Autônomo",
            cpf="12345678901",
        )

        mapping = backfill_suppliers_to_persons(django_apps)
        person = Person.objects.get(pk=mapping[sup.id])

        assert person.person_kind == "PF"
        assert person.full_name == "João Autônomo"

    def test_idempotent_no_duplicate_person(self) -> None:
        """Backfill é idempotente — segunda execução não cria duplicatas."""
        Supplier = django_apps.get_model("accounts_payable", "Supplier")
        Person = django_apps.get_model("persons", "Person")

        sup = Supplier.objects.create(name="X", cnpj="11111111000111")

        # Primeira execução
        backfill_suppliers_to_persons(django_apps)
        count1 = Person.objects.count()

        # Segunda execução
        backfill_suppliers_to_persons(django_apps)
        count2 = Person.objects.count()

        # Deve ser igual
        assert count1 == count2

    def test_supplier_email_creates_person_contact(self) -> None:
        """Supplier com email/phone cria PersonContact para cada."""
        Supplier = django_apps.get_model("accounts_payable", "Supplier")
        PersonContact = django_apps.get_model("persons", "PersonContact")

        sup = Supplier.objects.create(
            name="X",
            cnpj="22222222000122",
            email="x@example.com",
            phone="92988887777",
        )

        backfill_suppliers_to_persons(django_apps)

        # Buscar contacts via supplier profile
        contacts = PersonContact.objects.filter(
            person__supplier_profile__legacy_supplier_id=sup.id
        )
        assert contacts.filter(contact_type="EMAIL").exists()
        assert contacts.filter(contact_type="CELULAR").exists()


import pytest


@pytest.mark.skip(
    reason="experts.Expert foi removido. Backfill seguro contra Expert "
    "inexistente é coberto por test_backfill_experts_skipped_when_no_app."
)
class TestBackfillExperts(TenantTestCase):
    """DEPRECATED: experts.Expert removido em 2026-06-22."""

    def test_expert_creates_pf_person(self) -> None:
        """Expert cria Person(kind=PF) com PersonContact e ExpertProfile."""
        Expert = django_apps.get_model("experts", "Expert")
        Person = django_apps.get_model("persons", "Person")
        ExpertProfile = django_apps.get_model("persons", "ExpertProfile")

        exp = Expert.objects.create(
            name="João Perito",
            registration_number="CREA 12345",
            email="joao@perito.com.br",
            phone="92999999888",
        )

        mapping = backfill_experts_to_persons(django_apps)

        assert exp.id in mapping
        person = Person.objects.get(pk=mapping[exp.id])

        assert person.person_kind == "PF"
        assert person.full_name == "João Perito"

        # Verificar ExpertProfile
        expert_profile = ExpertProfile.objects.get(person=person)
        assert expert_profile.legacy_expert_id == str(exp.id)
        assert expert_profile.registration_number == "CREA 12345"

    def test_expert_idempotent_no_duplicate(self) -> None:
        """Backfill de Expert é idempotente."""
        Expert = django_apps.get_model("experts", "Expert")
        Person = django_apps.get_model("persons", "Person")

        exp = Expert.objects.create(name="Jane Perito")

        # Primeira execução
        backfill_experts_to_persons(django_apps)
        count1 = Person.objects.count()

        # Segunda execução
        backfill_experts_to_persons(django_apps)
        count2 = Person.objects.count()

        assert count1 == count2
