"""INSURER não se adiciona pelo cadastro genérico de pessoa; quem já tem o papel o mantém."""

import hashlib

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.persons.models import Person, PersonRole

MSG = "Seguradoras são cadastradas em Cadastros → Seguradoras."


class InsurerRoleTestCase(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "roles@insurer.com"
        self.user = GlobalUser.objects.create_user(
            email=email,
            password="pw",
            email_hash=hashlib.sha256(email.encode()).hexdigest(),
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})

    def test_post_com_insurer_recusa(self) -> None:
        resp = self.client.post(
            "/api/v1/persons/",
            {"person_kind": "PJ", "full_name": "Seguradora Nova", "roles": ["INSURER"]},
            format="json",
        )
        assert resp.status_code == 400, resp.data
        assert MSG in resp.data["roles"]
        assert not Person.objects.filter(full_name="Seguradora Nova").exists()

    def test_patch_adicionando_insurer_recusa(self) -> None:
        person = Person.objects.create(person_kind="PJ", full_name="Oficina X")
        PersonRole.objects.create(person=person, role="SUPPLIER")
        resp = self.client.patch(
            f"/api/v1/persons/{person.id}/", {"roles": ["SUPPLIER", "INSURER"]}, format="json"
        )
        assert resp.status_code == 400, resp.data
        assert MSG in resp.data["roles"]
        assert not person.roles.filter(role="INSURER").exists()

    def test_patch_de_pessoa_insurer_mantem_o_papel(self) -> None:
        person = Person.objects.create(person_kind="PJ", full_name="Seguradora Antiga")
        PersonRole.objects.create(person=person, role="INSURER")
        resp = self.client.patch(
            f"/api/v1/persons/{person.id}/", {"roles": ["INSURER"]}, format="json"
        )
        assert resp.status_code == 200, resp.data
        assert list(person.roles.values_list("role", flat=True)) == ["INSURER"]
