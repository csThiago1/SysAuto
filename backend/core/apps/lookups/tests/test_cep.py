import hashlib
import json
import logging
from pathlib import Path

import httpx
import pytest
import respx
from httpx import Response

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.lookups.providers import awesomeapi, opencep, viacep
from apps.lookups.service import lookup

FIXTURES = Path(__file__).resolve().parent / "fixtures"
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
VIACEP_URL = "https://viacep.com.br/ws/01310100/json/"
OPENCEP_URL = "https://opencep.com/v1/01310100"
AWESOME_URL = "https://cep.awesomeapi.com.br/json/01310100"
PAULISTA = {
    "cep": "01310-100",
    "logradouro": "Avenida Paulista",
    "complemento": "de 612 a 1510 - lado par",
    "bairro": "Bela Vista",
    "cidade": "São Paulo",
    "uf": "SP",
    "ibge": "3550308",
}


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / f"{name}_01310100.json").read_text(encoding="utf-8"))


class CepProvidersTest(SimpleTestCase):
    @respx.mock
    def test_viacep(self) -> None:
        respx.get(VIACEP_URL).mock(return_value=Response(200, json=fixture("viacep")))
        assert viacep("01310100") == PAULISTA

    @respx.mock
    def test_viacep_erro_true_e_none(self) -> None:
        respx.get(VIACEP_URL).mock(return_value=Response(200, json={"erro": "true"}))
        assert viacep("01310100") is None

    @respx.mock
    def test_opencep(self) -> None:
        respx.get(OPENCEP_URL).mock(return_value=Response(200, json=fixture("opencep")))
        assert opencep("01310100") == PAULISTA

    @respx.mock
    def test_opencep_404_e_none(self) -> None:
        respx.get(OPENCEP_URL).mock(return_value=Response(404, json={"error": True}))
        assert opencep("01310100") is None

    @respx.mock
    def test_awesomeapi(self) -> None:
        respx.get(AWESOME_URL).mock(return_value=Response(200, json=fixture("awesomeapi")))
        assert awesomeapi("01310100") == {
            **PAULISTA,
            "cep": "01310100",
            "complemento": "",
        }

    @override_settings(AWESOMEAPI_TOKEN="tok")
    @respx.mock
    def test_awesomeapi_manda_token(self) -> None:
        route = respx.get(AWESOME_URL, params={"token": "tok"}).mock(
            return_value=Response(200, json=fixture("awesomeapi"))
        )
        assert awesomeapi("01310100") is not None
        assert route.called

    @respx.mock
    def test_awesomeapi_404_e_none(self) -> None:
        respx.get(AWESOME_URL).mock(return_value=Response(404, json={"code": "not_found"}))
        assert awesomeapi("01310100") is None

    @respx.mock
    def test_5xx_levanta(self) -> None:
        respx.get(VIACEP_URL).mock(return_value=Response(503))
        with pytest.raises(httpx.HTTPStatusError):
            viacep("01310100")


@override_settings(CACHES=LOCMEM)
class CepNormalizeTest(TestCase):
    def setUp(self) -> None:
        cache.clear()

    @respx.mock
    def test_resposta_com_municipio_do_ibge(self) -> None:
        respx.get(VIACEP_URL).mock(return_value=Response(200, json=fixture("viacep")))
        assert lookup("cep", "01310-100") == {
            "found": True,
            "source": "viacep",
            "fields": {
                "cep": "01310100",
                "logradouro": "Avenida Paulista",
                "complemento": "de 612 a 1510 - lado par",
                "bairro": "Bela Vista",
                "municipio": {"id": "3550308", "label": "São Paulo"},
                "uf": "SP",
            },
            "unmatched": [],
        }

    @respx.mock
    def test_ibge_fora_da_tabela_vai_para_unmatched(self) -> None:
        body = {**fixture("viacep"), "ibge": "9999999"}
        respx.get(VIACEP_URL).mock(return_value=Response(200, json=body))
        r = lookup("cep", "01310100")
        assert r["found"] is True
        assert r["fields"]["municipio"] is None and r["fields"]["uf"] == "SP"
        assert r["unmatched"] == ["municipio"]

    def test_httpx_nao_loga_a_url_com_a_chave(self) -> None:
        # O httpx loga "HTTP Request: GET <url>" em INFO; a URL traz o CEP.
        assert not logging.getLogger("httpx").isEnabledFor(logging.INFO)


class LookupAPITest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_settings(CACHES=LOCMEM))
        cache.clear()
        email = "lookup-cep@t.com"
        self.user = GlobalUser.objects.create_user(
            email=email, password="pw", email_hash=hashlib.sha256(email.encode()).hexdigest()
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "CONSULTANT"})

    def test_endpoint_chave_invalida_200(self) -> None:
        r = self.client.post("/api/v1/lookups/cep/", {"key": "123"}, format="json")
        assert r.status_code == 200 and r.data["found"] is False
        assert r.data["source"] == "invalid"

    def test_endpoint_sem_key_200(self) -> None:
        r = self.client.post("/api/v1/lookups/cep/", {}, format="json")
        assert r.status_code == 200 and r.data["source"] == "invalid"

    @respx.mock
    def test_endpoint_acerta(self) -> None:
        respx.get(VIACEP_URL).mock(return_value=Response(200, json=fixture("viacep")))
        r = self.client.post("/api/v1/lookups/cep/", {"key": "01310-100"}, format="json")
        assert r.status_code == 200
        assert r.data["found"] is True and r.data["source"] == "viacep"
        assert r.data["fields"]["municipio"] == {"id": "3550308", "label": "São Paulo"}

    def test_endpoint_storekeeper_403(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "STOREKEEPER"})
        r = self.client.post("/api/v1/lookups/cep/", {"key": "01310100"}, format="json")
        assert r.status_code == 403

    def test_endpoint_kind_desconhecido_404(self) -> None:
        r = self.client.post("/api/v1/lookups/vin/", {"key": "01310100"}, format="json")
        assert r.status_code == 404

    def test_municipios_continua_get(self) -> None:
        r = self.client.get("/api/v1/lookups/municipios/?uf=AM&search=manaus")
        assert r.status_code == 200
