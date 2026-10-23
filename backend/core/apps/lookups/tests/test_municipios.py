import hashlib

import httpx
import respx

from django.core.management import call_command
from django.test import TestCase
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.lookups.models import Municipio
from apps.lookups.municipios import IBGE_URL, match_municipio


class MunicipioTest(TestCase):
    def test_seed_tem_manaus(self) -> None:
        assert Municipio.objects.get(codigo_ibge="1302603").nome == "Manaus"

    def test_match_sem_acento(self) -> None:
        assert match_municipio("sao paulo", "SP").codigo_ibge == "3550308"

    def test_match_uf_errada(self) -> None:
        assert match_municipio("Manaus", "PA") is None


def _uf(sigla: str) -> dict:
    return {"id": 1, "sigla": sigla, "nome": sigla}


IBGE_PAYLOAD = [
    {
        "id": 9900001,
        "nome": "Vila Antiga",
        "microrregiao": {
            "id": 1,
            "nome": "x",
            "mesorregiao": {"id": 1, "nome": "x", "UF": _uf("AM")},
        },
        "regiao-imediata": {
            "id": 1,
            "nome": "x",
            "regiao-intermediaria": {"id": 1, "nome": "x", "UF": _uf("AM")},
        },
    },
    {
        "id": 9900002,
        "nome": "Vila Nova do Norte",
        "microrregiao": None,
        "regiao-imediata": {
            "id": 1,
            "nome": "x",
            "regiao-intermediaria": {"id": 1, "nome": "x", "UF": _uf("MT")},
        },
    },
]


class LoadMunicipiosCommandTest(TestCase):
    @respx.mock
    def test_from_ibge_le_uf_com_fallback_na_regiao_imediata(self) -> None:
        route = respx.get(IBGE_URL).mock(return_value=httpx.Response(200, json=IBGE_PAYLOAD))
        call_command("load_municipios", "--from-ibge")
        assert route.called
        antiga = Municipio.objects.get(codigo_ibge="9900001")
        nova = Municipio.objects.get(codigo_ibge="9900002")
        assert (antiga.nome, antiga.uf) == ("Vila Antiga", "AM")
        assert (nova.nome, nova.uf, nova.nome_normalizado) == (
            "Vila Nova do Norte",
            "MT",
            "VILA NOVA DO NORTE",
        )


class MunicipioAPITest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "lookups@t.com"
        user = GlobalUser.objects.create_user(
            email=email, password="pw", email_hash=hashlib.sha256(email.encode()).hexdigest()
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=user, token={"role": "ADMIN"})

    def test_lista_por_uf_e_busca(self) -> None:
        resp = self.client.get("/api/v1/lookups/municipios/?uf=AM&search=manaus")
        assert resp.status_code == 200
        assert [r["codigo_ibge"] for r in resp.data["results"]] == ["1302603"]
        assert resp.data["results"][0] == {"codigo_ibge": "1302603", "nome": "Manaus", "uf": "AM"}

    def test_exige_autenticacao(self) -> None:
        self.client.force_authenticate(user=None)
        resp = self.client.get("/api/v1/lookups/municipios/?uf=AM")
        assert resp.status_code == 401
