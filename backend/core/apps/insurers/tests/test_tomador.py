"""Tomador fiscal da seguradora: uma Person INSURER por CNPJ, criada pela página da seguradora."""

import hashlib

import respx
from httpx import Response

from django.core.cache import cache
from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.insurers.models import Insurer
from apps.lookups.tests.test_cnpj import CNPJ, CNPJA_URL, CNPJWS_URL, MINHARECEITA_URL, fixture
from apps.persons.models import Person, PersonDocument

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


class TomadorEndpointTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_settings(CACHES=LOCMEM))
        cache.clear()
        self.insurer = Insurer.objects.create(
            name="Tomador Teste Seguros S.A.", cnpj="33.000.167/0001-01"
        )
        self.base = f"/api/v1/insurers/{self.insurer.pk}/"

    def client_as(self, role: str) -> APIClient:
        email = f"{role.lower()}@dscar.com"
        user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        client = APIClient()
        client.defaults["SERVER_NAME"] = client.defaults["HTTP_HOST"] = self.domain.domain
        client.force_authenticate(user=user, token={"role": role})
        return client

    @respx.mock
    def test_cria_tomador_com_endereco_e_e_idempotente(self) -> None:
        cnpja = respx.get(CNPJA_URL).mock(return_value=Response(200, json=fixture("cnpja")))
        admin = self.client_as("ADMIN")

        antes = admin.get(f"{self.base}tomadores/")
        assert antes.status_code == 200, antes.data
        assert antes.data == [
            {"cnpj": CNPJ, "person_id": None, "person_name": "", "has_address": False}
        ]

        r = admin.post(f"{self.base}tomador/", {"cnpj": "33.000.167/0001-01"}, format="json")
        assert r.status_code == 201, r.data
        person = Person.objects.get(pk=r.data["person_id"])
        assert person.person_kind == "PJ"
        assert person.full_name == "Tomador Teste Seguros S.A."
        assert list(person.roles.values_list("role", flat=True)) == ["INSURER"]
        doc = person.documents.get()
        assert (doc.doc_type, doc.value, doc.is_primary) == ("CNPJ", CNPJ, True)
        addr = person.addresses.get()
        assert addr.is_primary is True
        assert (addr.street, addr.number, addr.neighborhood) == (
            "Avenida Republica do Chile",
            "65",
            "Centro",
        )
        assert (addr.zip_code, addr.city, addr.state, addr.municipio_ibge) == (
            "20031170",
            "Rio de Janeiro",
            "RJ",
            "3304557",
        )

        again = admin.post(f"{self.base}tomador/", {"cnpj": CNPJ}, format="json")
        assert again.status_code == 200
        assert again.data == {"person_id": person.pk}
        assert PersonDocument.objects.filter(doc_type="CNPJ").count() == 1
        assert cnpja.call_count == 1

        depois = admin.get(f"{self.base}tomadores/")
        assert depois.data == [
            {
                "cnpj": CNPJ,
                "person_id": person.pk,
                "person_name": "Tomador Teste Seguros S.A.",
                "has_address": True,
            }
        ]

    @respx.mock
    def test_receita_sem_resposta_cria_sem_endereco(self) -> None:
        for url in (CNPJA_URL, MINHARECEITA_URL, CNPJWS_URL):
            respx.get(url).mock(return_value=Response(404))
        admin = self.client_as("ADMIN")
        r = admin.post(f"{self.base}tomador/", {"cnpj": CNPJ}, format="json")
        assert r.status_code == 201, r.data
        assert not Person.objects.get(pk=r.data["person_id"]).addresses.exists()
        assert admin.get(f"{self.base}tomadores/").data[0]["has_address"] is False

    def test_cnpj_fora_da_seguradora_400(self) -> None:
        r = self.client_as("ADMIN").post(
            f"{self.base}tomador/", {"cnpj": "61198164000160"}, format="json"
        )
        assert r.status_code == 400
        assert not Person.objects.exists()

    def test_manager_nao_ve_nem_cria(self) -> None:
        manager = self.client_as("MANAGER")
        assert manager.get(f"{self.base}tomadores/").status_code == 403
        r = manager.post(f"{self.base}tomador/", {"cnpj": CNPJ}, format="json")
        assert r.status_code == 403
        assert not Person.objects.exists()
