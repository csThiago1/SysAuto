"""DV de CPF/CNPJ no PersonDocumentWriteSerializer."""

import hashlib

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.persons.models import Person, PersonDocument, PersonRole
from apps.persons.serializers import PersonDocumentWriteSerializer
from apps.persons.utils import sha256_hex


class DocumentDVTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.person = Person.objects.create(person_kind="PF", full_name="Ana Lima")
        PersonRole.objects.create(person=self.person, role="CLIENT")

    def test_patch_so_value_em_cpf_existente_com_dv_errado(self) -> None:
        doc = PersonDocument.objects.create(
            person=self.person,
            doc_type="CPF",
            value="52998224725",
            value_hash=sha256_hex("52998224725"),
        )
        s = PersonDocumentWriteSerializer(doc, data={"value": "52998224724"}, partial=True)
        assert not s.is_valid()
        assert s.errors == {"value": ["CPF inválido."]}

    def test_api_patch_com_cnpj_invalido_da_400(self) -> None:
        email = "dv@t.com"
        user = GlobalUser.objects.create_user(
            email=email, password="pw", email_hash=hashlib.sha256(email.encode()).hexdigest()
        )
        client = APIClient()
        client.defaults["SERVER_NAME"] = client.defaults["HTTP_HOST"] = self.domain.domain
        client.force_authenticate(user=user, token={"role": "ADMIN"})
        resp = client.patch(
            f"/api/v1/persons/{self.person.pk}/",
            {"documents": [{"doc_type": "CNPJ", "value": "12ABC34501DE36"}]},
            format="json",
        )
        assert resp.status_code == 400
        assert resp.data["documents"][0]["value"] == ["CNPJ inválido."]

    def test_cpf_e_cnpj_validos_passam(self) -> None:
        for doc_type, value in (("CPF", "529.982.247-25"), ("CNPJ", "12.ABC.345/01DE-35")):
            s = PersonDocumentWriteSerializer(data={"doc_type": doc_type, "value": value})
            assert s.is_valid(), s.errors
            assert s.validated_data["value_hash"] == sha256_hex(value)
