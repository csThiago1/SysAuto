"""POST /insurers/{id}/trade-names/ vincula o texto de uma importação a uma seguradora."""

import hashlib

from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.insurers.models import Insurer

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


class TradeNamesEndpointTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_settings(CACHES=LOCMEM))
        self.yelum = Insurer.objects.get(code="yelum")
        self.url = f"/api/v1/insurers/{self.yelum.pk}/trade-names/"

    def client_as(self, role: str) -> APIClient:
        email = f"{role.lower()}@dscar.com"
        user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        client = APIClient()
        client.defaults["SERVER_NAME"] = client.defaults["HTTP_HOST"] = self.domain.domain
        client.force_authenticate(user=user, token={"role": role})
        return client

    def test_consultant_vincula_nome(self) -> None:
        client = self.client_as("CONSULTANT")
        r = client.post(self.url, {"name": "Yelum Seg."}, format="json")
        assert r.status_code == 200, r.data
        assert "Yelum Seg." in r.data["trade_names"]
        self.yelum.refresh_from_db()
        assert self.yelum.trade_names == r.data["trade_names"]

        # mesmo nome sem caixa nem acento não duplica
        again = client.post(self.url, {"name": "YELUM SEG."}, format="json")
        assert again.status_code == 200 and again.data["trade_names"] == r.data["trade_names"]

    def test_nome_vazio_400(self) -> None:
        r = self.client_as("CONSULTANT").post(self.url, {"name": ""}, format="json")
        assert r.status_code == 400

    def test_storekeeper_403(self) -> None:
        r = self.client_as("STOREKEEPER").post(self.url, {"name": "Yelum Seg."}, format="json")
        assert r.status_code == 403
        self.yelum.refresh_from_db()
        assert "Yelum Seg." not in self.yelum.trade_names
