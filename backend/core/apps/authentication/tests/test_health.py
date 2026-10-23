import respx
from httpx import Response

from django.core.cache import cache
from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
TOKEN = "tok-placas-7f3e9a"


class HealthApiDesligadaTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        # APIPLACAS_ENABLED fica no padrão (False), com token presente
        self.enterContext(
            override_settings(APIPLACAS_TOKEN=TOKEN, RESEND_API_KEY="r", CACHES=LOCMEM)
        )
        cache.clear()
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.client.defaults["HTTP_HOST"] = self.domain.domain

    @respx.mock
    def test_health_api_desligada_200_sem_saldo(self) -> None:
        route = respx.get(f"https://wdapi2.com.br/saldo/{TOKEN}").mock(
            return_value=Response(200, json={"qtdConsultas": 5})
        )
        r = self.client.get("/healthz/")
        assert r.status_code == 200
        assert r.data["status"] == "healthy"
        assert r.data["checks"]["api_placas"] == "disabled"
        assert "api_placas_saldo" not in r.data["checks"]
        assert route.call_count == 0
