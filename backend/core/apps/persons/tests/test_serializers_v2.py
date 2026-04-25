from django_tenants.test.cases import TenantTestCase
from apps.persons.models import Person, PersonRole, ClientProfile
from apps.persons.serializers import PersonDetailSerializer, PersonCreateUpdateSerializer


class TestPersonSerializerV2(TenantTestCase):
    def test_detail_serializer_nao_tem_campo_document(self):
        person = Person.objects.create(person_kind="PF", full_name="Ana Lima")
        PersonRole.objects.create(person=person, role="CLIENT")
        data = PersonDetailSerializer(person).data
        assert "document" not in data

    def test_detail_serializer_tem_documents_array(self):
        person = Person.objects.create(person_kind="PF", full_name="Ana Lima")
        PersonRole.objects.create(person=person, role="CLIENT")
        data = PersonDetailSerializer(person).data
        assert "documents" in data
        assert isinstance(data["documents"], list)

    def test_detail_serializer_tem_client_profile(self):
        person = Person.objects.create(person_kind="PF", full_name="Ana Lima")
        PersonRole.objects.create(person=person, role="CLIENT")
        ClientProfile.objects.create(person=person)
        data = PersonDetailSerializer(person).data
        assert "client_profile" in data
        assert data["client_profile"] is not None

    def test_create_serializer_nao_aceita_campo_document(self):
        payload = {
            "person_kind": "PF",
            "full_name": "Pedro",
            "roles": ["CLIENT"],
            "document": "123.456.789-00",  # campo deprecated
            "contacts": [],
            "addresses": [],
        }
        s = PersonCreateUpdateSerializer(data=payload)
        s.is_valid()
        # document não deve aparecer nos dados validados
        assert "document" not in s.validated_data
