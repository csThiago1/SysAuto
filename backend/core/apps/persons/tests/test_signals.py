"""Testes do signal auto_create_profile_for_role."""
from django_tenants.test.cases import TenantTestCase

from apps.persons.models import (
    Person, PersonRole, SupplierProfile, ExpertProfile, ClientProfile,
    RolePessoa, TipoPessoa,
)


class TestProfileAutoCreation(TenantTestCase):
    """Auto-creation de profiles ao adicionar roles via PersonRole.post_save signal."""

    def test_adding_supplier_role_creates_supplier_profile(self) -> None:
        """Ao criar PersonRole com role=FORNECEDOR, SupplierProfile deve ser criado."""
        person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="Auto Peças MAO")
        PersonRole.objects.create(person=person, role=RolePessoa.FORNECEDOR)
        assert SupplierProfile.objects.filter(person=person).exists()

    def test_adding_expert_role_creates_expert_profile(self) -> None:
        """Ao criar PersonRole com role=PERITO, ExpertProfile deve ser criado."""
        person = Person.objects.create(person_kind=TipoPessoa.FISICA, full_name="João Perito")
        PersonRole.objects.create(person=person, role=RolePessoa.PERITO)
        assert ExpertProfile.objects.filter(person=person).exists()

    def test_adding_client_role_creates_client_profile(self) -> None:
        """Ao criar PersonRole com role=CLIENTE, ClientProfile deve ser criado."""
        person = Person.objects.create(person_kind=TipoPessoa.FISICA, full_name="Maria Cliente")
        PersonRole.objects.create(person=person, role=RolePessoa.CLIENTE)
        assert ClientProfile.objects.filter(person=person).exists()

    def test_idempotent_signal_does_not_duplicate(self) -> None:
        """Signal é idempotente — salvar PersonRole existente não duplica profile."""
        person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="Fornecedor XYZ")
        role = PersonRole.objects.create(person=person, role=RolePessoa.FORNECEDOR)
        # Salvar PersonRole existente (não é `created=True`)
        role.save()
        # SupplierProfile deve existir exatamente uma vez
        assert SupplierProfile.objects.filter(person=person).count() == 1
