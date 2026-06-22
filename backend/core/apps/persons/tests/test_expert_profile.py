import pytest
from django_tenants.utils import schema_context

from apps.persons.models import Person, ExpertProfile, RolePessoa, PersonRole, TipoPessoa


def test_create_expert_profile(tenant):
    """Criar ExpertProfile com pessoa e validar campos."""
    person = Person.objects.create(person_kind=TipoPessoa.FISICA, full_name="João Perito")
    PersonRole.objects.create(person=person, role=RolePessoa.PERITO)
    profile = ExpertProfile.objects.create(person=person, registration_number="CREA-12345")
    assert profile.registration_number == "CREA-12345"
    assert profile.person == person


def test_expert_choice_added():
    """EXPERT deve estar em RolePessoa.choices."""
    assert "EXPERT" in {choice[0] for choice in RolePessoa.choices}
