"""CNPJ da nota da OS: precisa ser um dos CNPJs da seguradora; vazio vira o principal."""

import hashlib
from typing import Any

from django_tenants.test.cases import TenantTestCase
from rest_framework.response import Response
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.insurers.models import Insurer
from apps.lookups.validators import clean_cnpj
from apps.service_orders.models import ServiceOrder
from apps.vehicle_catalog.tests.factories import make_catalog

URL = "/api/v1/service-orders/"


class InsurerCnpjTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "cnpj-nota@dscar.com"
        user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=user, token={"role": "ADMIN"})
        self.family_id = make_catalog().modelo.familia_id
        self.porto = Insurer.objects.get(code="porto")
        self.yelum = Insurer.objects.get(code="yelum")

    def post_os(self, **data: Any) -> Response:
        payload = {
            "plate": "SEG1D23",
            "customer_name": "Segurado",
            "catalog_family": self.family_id,
            "customer_type": "insurer",
            "insured_type": "insured",
            **data,
        }
        return self.client.post(URL, payload, format="json")

    def test_cnpj_fora_da_seguradora_400(self) -> None:
        r = self.post_os(insurer=str(self.porto.pk), insurer_cnpj="61550141009129")
        assert r.status_code == 400 and "insurer_cnpj" in r.data
        assert not ServiceOrder.objects.exists()

    def test_sem_cnpj_usa_o_principal(self) -> None:
        r = self.post_os(insurer=str(self.porto.pk))
        assert r.status_code == 201, r.data
        assert ServiceOrder.objects.get(pk=r.data["id"]).insurer_cnpj == "61198164000160"

    def test_cnpj_de_filial_da_lista(self) -> None:
        r = self.post_os(insurer=str(self.yelum.pk), insurer_cnpj="61550141009129")
        assert r.status_code == 201, r.data
        assert ServiceOrder.objects.get(pk=r.data["id"]).insurer_cnpj == "61550141009129"

    def test_patch_so_cnpj_fora_da_lista_400(self) -> None:
        r = self.post_os(insurer=str(self.porto.pk))
        p = self.client.patch(
            f"{URL}{r.data['id']}/", {"insurer_cnpj": "61550141009129"}, format="json"
        )
        assert p.status_code == 400 and "insurer_cnpj" in p.data
        assert ServiceOrder.objects.get(pk=r.data["id"]).insurer_cnpj == "61198164000160"

    def test_patch_troca_seguradora_sem_cnpj_volta_ao_principal(self) -> None:
        r = self.post_os(insurer=str(self.porto.pk))
        p = self.client.patch(
            f"{URL}{r.data['id']}/", {"insurer": str(self.yelum.pk)}, format="json"
        )
        assert p.status_code == 200, p.data
        assert ServiceOrder.objects.get(pk=r.data["id"]).insurer_cnpj == clean_cnpj(self.yelum.cnpj)
