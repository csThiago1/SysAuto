"""Testes do SupplierProfile — TenantTestCase pra rodar no schema tenant_test."""
import pytest
from django.db import IntegrityError
from django_tenants.test.cases import TenantTestCase

from apps.persons.models import (
    Person, PersonRole, SupplierProfile, RolePessoa, TipoPessoa,
)


class TestSupplierProfile(TenantTestCase):
    def test_create_supplier_profile_with_person(self) -> None:
        person = Person.objects.create(
            person_kind=TipoPessoa.JURIDICA, full_name="Auto Peças MAO"
        )
        # Adicionar role dispara signal que cria SupplierProfile vazio.
        PersonRole.objects.create(person=person, role=RolePessoa.FORNECEDOR)

        # Atualizar o profile já criado pelo signal.
        profile = SupplierProfile.objects.get(person=person)
        profile.category = SupplierProfile.Categoria.PARTS
        profile.default_payment_days = 30
        profile.save()

        assert profile.person == person
        assert profile.category == "PARTS"
        assert profile.default_payment_days == 30

    def test_default_category_is_general(self) -> None:
        person = Person.objects.create(
            person_kind=TipoPessoa.JURIDICA, full_name="X"
        )
        profile = SupplierProfile.objects.create(person=person)
        assert profile.category == SupplierProfile.Categoria.GENERAL

    def test_one_to_one_constraint(self) -> None:
        person = Person.objects.create(
            person_kind=TipoPessoa.JURIDICA, full_name="X"
        )
        SupplierProfile.objects.create(person=person)
        with pytest.raises(IntegrityError):
            SupplierProfile.objects.create(person=person)

    def test_bank_fields_encrypted_round_trip(self) -> None:
        person = Person.objects.create(
            person_kind=TipoPessoa.JURIDICA, full_name="X"
        )
        profile = SupplierProfile.objects.create(
            person=person,
            bank_account="12345-6",
            pix_key="empresa@example.com",
            pix_key_type="EMAIL",
        )
        profile.refresh_from_db()
        assert profile.bank_account == "12345-6"
        assert profile.pix_key == "empresa@example.com"

    def test_legacy_supplier_id_indexed(self) -> None:
        person = Person.objects.create(
            person_kind=TipoPessoa.JURIDICA, full_name="X"
        )
        SupplierProfile.objects.create(person=person, legacy_supplier_id=999)
        assert SupplierProfile.objects.filter(legacy_supplier_id=999).exists()
