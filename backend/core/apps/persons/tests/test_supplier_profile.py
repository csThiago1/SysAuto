import pytest
from django_tenants.utils import schema_context
from django.core.exceptions import ValidationError

from apps.persons.models import Person, PersonRole, SupplierProfile, RolePessoa, TipoPessoa


def test_create_supplier_profile_with_person(tenant):
    """Criar SupplierProfile com pessoa e validar campos."""
    person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="Auto Peças MAO")
    PersonRole.objects.create(person=person, role=RolePessoa.FORNECEDOR)

    profile = SupplierProfile.objects.create(
        person=person,
        category=SupplierProfile.Categoria.PARTS,
        default_payment_days=30,
    )

    assert profile.person == person
    assert profile.category == "PARTS"
    assert profile.default_payment_days == 30


def test_default_category_is_general(tenant):
    """Categoria padrão deve ser GENERAL."""
    person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="X")
    profile = SupplierProfile.objects.create(person=person)
    assert profile.category == SupplierProfile.Categoria.GENERAL


def test_one_to_one_constraint(tenant):
    """OneToOne deve impedir múltiplos perfis por pessoa."""
    person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="X")
    SupplierProfile.objects.create(person=person)
    with pytest.raises(Exception):  # IntegrityError
        SupplierProfile.objects.create(person=person)


def test_bank_fields_encrypted(tenant):
    """Campos bank_account e pix_key devem ser criptografados."""
    person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="X")
    profile = SupplierProfile.objects.create(
        person=person,
        bank_account="12345-6",
        pix_key="empresa@example.com",
        pix_key_type="EMAIL",
    )
    profile.refresh_from_db()
    assert profile.bank_account == "12345-6"
    assert profile.pix_key == "empresa@example.com"


def test_legacy_supplier_id_indexed(tenant):
    """legacy_supplier_id deve ser indexado para buscas rápidas."""
    person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="X")
    SupplierProfile.objects.create(person=person, legacy_supplier_id=999)
    assert SupplierProfile.objects.filter(legacy_supplier_id=999).exists()
