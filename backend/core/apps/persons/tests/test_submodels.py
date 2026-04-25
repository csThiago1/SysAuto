from django_tenants.test.cases import TenantTestCase
from apps.persons.models import Person, ClientProfile, BrokerOffice, BrokerPerson


class TestClientProfile(TenantTestCase):
    def setUp(self) -> None:
        self.person = Person.objects.create(person_kind="PF", full_name="João Silva")

    def test_create_client_profile(self) -> None:
        profile = ClientProfile.objects.create(
            person=self.person,
            lgpd_consent_version="1.0",
        )
        assert profile.pk is not None
        assert profile.group_sharing_consent is False

    def test_person_has_client_profile_accessor(self) -> None:
        ClientProfile.objects.create(person=self.person)
        assert self.person.client_profile is not None


class TestBrokerModels(TenantTestCase):
    def test_create_broker_office(self) -> None:
        person_pj = Person.objects.create(person_kind="PJ", full_name="Corretora ABC")
        office = BrokerOffice.objects.create(person=person_pj)
        assert office.pk is not None

    def test_create_broker_person_linked_to_office(self) -> None:
        person_pj = Person.objects.create(person_kind="PJ", full_name="Corretora ABC")
        office = BrokerOffice.objects.create(person=person_pj)
        person_pf = Person.objects.create(person_kind="PF", full_name="Carlos Corretor")
        broker = BrokerPerson.objects.create(person=person_pf, office=office)
        assert broker.office == office

    def test_create_broker_person_without_office(self) -> None:
        person_pf = Person.objects.create(person_kind="PF", full_name="Maria Corretora")
        broker = BrokerPerson.objects.create(person=person_pf)
        assert broker.office is None
