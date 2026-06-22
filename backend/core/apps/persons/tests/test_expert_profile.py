"""Testes do ExpertProfile + role EXPERT."""
from django_tenants.test.cases import TenantTestCase

from apps.persons.models import (
    Person, PersonRole, ExpertProfile, RolePessoa, TipoPessoa,
)


class TestExpertProfile(TenantTestCase):
    def test_create_expert_profile(self) -> None:
        person = Person.objects.create(
            person_kind=TipoPessoa.FISICA, full_name="João Perito"
        )
        # Signal cria ExpertProfile vazio ao adicionar role EXPERT.
        PersonRole.objects.create(person=person, role=RolePessoa.PERITO)
        profile = ExpertProfile.objects.get(person=person)
        profile.registration_number = "CREA-12345"
        profile.save()
        assert profile.registration_number == "CREA-12345"
        assert profile.person == person


def test_expert_choice_added() -> None:
    """Validação pura — não precisa de tenant."""
    assert "EXPERT" in {choice[0] for choice in RolePessoa.choices}
