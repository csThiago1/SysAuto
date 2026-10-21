import json
from pathlib import Path
from unittest.mock import patch

import respx
from httpx import Response

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from django_tenants.test.cases import TenantTestCase

from apps.lookups.providers import cnpja_open, cnpjws, minhareceita
from apps.lookups.service import QUOTAS, cache_key, lookup
from apps.persons.models import Person, PersonAddress, PersonDocument

FIXTURES = Path(__file__).resolve().parent / "fixtures"
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CNPJ = "33000167000101"
CNPJA_URL = f"https://open.cnpja.com/office/{CNPJ}"
MINHARECEITA_URL = f"https://minhareceita.org/{CNPJ}"
CNPJWS_URL = f"https://publica.cnpj.ws/cnpj/{CNPJ}"
ALFA = "12ABC34501DE35"  # CNPJ alfanumérico com DV válido

PETROBRAS = {
    "razao_social": "PETROLEO BRASILEIRO S A PETROBRAS",
    "nome_fantasia": "PETROBRAS - EDISE",
    "situacao": "ATIVA",
    "logradouro": "AVENIDA REPUBLICA DO CHILE",
    "numero": "65",
    "complemento": "",
    "bairro": "CENTRO",
    "cep": "20031170",
    "ibge": "3304557",
    "cidade": "Rio de Janeiro",
    "uf": "RJ",
    "cnae_codigo": "0600001",
    "cnae_descricao": "Extração de petróleo e gás natural",
    "simples": None,
    "mei": None,
    "email": "cc-rfisc@petrobras.com.br",
    "telefone": "2121660000",
}


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / f"{name}_{CNPJ}.json").read_text(encoding="utf-8"))


class CnpjProvidersTest(SimpleTestCase):
    @respx.mock
    def test_cnpja_open(self) -> None:
        respx.get(CNPJA_URL).mock(return_value=Response(200, json=fixture("cnpja")))
        assert cnpja_open(CNPJ) == {
            **PETROBRAS,
            "nome_fantasia": "Petrobras - Edise",
            "logradouro": "Avenida Republica do Chile",
            "bairro": "Centro",
            "simples": False,
            "mei": False,
        }

    @respx.mock
    def test_minhareceita(self) -> None:
        respx.get(MINHARECEITA_URL).mock(return_value=Response(200, json=fixture("minhareceita")))
        assert minhareceita(CNPJ) == {**PETROBRAS, "cidade": "RIO DE JANEIRO", "email": ""}

    @respx.mock
    def test_cnpjws(self) -> None:
        respx.get(CNPJWS_URL).mock(return_value=Response(200, json=fixture("cnpjws")))
        assert cnpjws(CNPJ) == PETROBRAS

    @respx.mock
    def test_cnpjws_simples_e_mei(self) -> None:
        body = {**fixture("cnpjws"), "simples": {"simples": "Sim", "mei": "Não"}}
        respx.get(CNPJWS_URL).mock(return_value=Response(200, json=body))
        r = cnpjws(CNPJ)
        assert r is not None and r["simples"] is True and r["mei"] is False

    def test_providers_nao_guardam_qsa(self) -> None:
        with respx.mock:
            respx.get(CNPJA_URL).mock(return_value=Response(200, json=fixture("cnpja")))
            respx.get(MINHARECEITA_URL).mock(
                return_value=Response(200, json=fixture("minhareceita"))
            )
            respx.get(CNPJWS_URL).mock(return_value=Response(200, json=fixture("cnpjws")))
            results = [cnpja_open(CNPJ), minhareceita(CNPJ), cnpjws(CNPJ)]
        assert all(r is not None and set(r) == set(PETROBRAS) for r in results)


@override_settings(CACHES=LOCMEM)
class CnpjLookupTest(TestCase):
    def setUp(self) -> None:
        cache.clear()

    @respx.mock
    def test_cnpja_acerta(self) -> None:
        respx.get(CNPJA_URL).mock(return_value=Response(200, json=fixture("cnpja")))
        r = lookup("cnpj", "33.000.167/0001-01")
        assert r["found"] is True and r["source"] == "cnpja_open"
        assert r["fields"]["razao_social"]
        assert r["fields"]["situacao"] == "ATIVA"
        assert r["fields"]["municipio"]["id"] == "3304557"
        assert r["fields"]["municipio"]["label"] == "Rio de Janeiro"
        assert "ibge" not in r["fields"] and "cidade" not in r["fields"]
        assert r["fields"]["uf"] == "RJ" and r["unmatched"] == []
        assert cache.get(cache_key("cnpj", CNPJ)) == r

    @respx.mock
    def test_cnpja_429_cai_no_minhareceita(self) -> None:
        cnpja = respx.get(CNPJA_URL).mock(return_value=Response(429))
        respx.get(MINHARECEITA_URL).mock(return_value=Response(200, json=fixture("minhareceita")))
        r = lookup("cnpj", CNPJ)
        assert cnpja.called
        assert r["found"] is True and r["source"] == "minhareceita"
        assert r["fields"]["municipio"] == {"id": "3304557", "label": "Rio de Janeiro"}

    @respx.mock
    def test_cota_do_cnpja_estourada_pula_sem_chamar(self) -> None:
        cnpja = respx.get(CNPJA_URL).mock(return_value=Response(200, json=fixture("cnpja")))
        respx.get(MINHARECEITA_URL).mock(return_value=Response(429))
        respx.get(CNPJWS_URL).mock(return_value=Response(200, json=fixture("cnpjws")))
        with patch.dict(QUOTAS, {"cnpja_open": 0}):
            r = lookup("cnpj", CNPJ)
        assert cnpja.called is False and cnpja.call_count == 0
        assert r["found"] is True and r["source"] == "cnpjws"

    @respx.mock
    def test_alfanumerico_so_cnpja(self) -> None:
        cnpja = respx.get(f"https://open.cnpja.com/office/{ALFA}").mock(return_value=Response(429))
        outros = [
            respx.get(f"https://minhareceita.org/{ALFA}").mock(return_value=Response(404)),
            respx.get(f"https://publica.cnpj.ws/cnpj/{ALFA}").mock(return_value=Response(404)),
        ]
        r = lookup("cnpj", "12.ABC.345/01DE-35")
        assert cnpja.called
        assert not any(route.called for route in outros)
        assert r["found"] is False

    @respx.mock
    def test_404_em_todos_found_false(self) -> None:
        routes = [
            respx.get(url).mock(return_value=Response(404))
            for url in (CNPJA_URL, MINHARECEITA_URL, CNPJWS_URL)
        ]
        r = lookup("cnpj", CNPJ)
        assert all(route.called for route in routes)
        assert r == {"found": False, "source": "none", "fields": {}, "unmatched": []}


class CnpjDbFirstTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_settings(CACHES=LOCMEM))
        cache.clear()
        person = Person.objects.create(
            person_kind="PJ", full_name="PETROLEO BRASILEIRO S A", fantasy_name="PETROBRAS"
        )
        PersonDocument.objects.create(person=person, doc_type="CNPJ", value="33.000.167/0001-01")
        PersonAddress.objects.create(
            person=person,
            is_primary=True,
            zip_code="20031-170",
            street="Av. República do Chile",
            number="65",
            neighborhood="Centro",
            city="Rio de Janeiro",
            state="RJ",
            municipio_ibge="3304557",
        )

    def test_db_first_nao_chama_rede(self) -> None:
        with respx.mock(assert_all_called=False) as router:
            for url in (CNPJA_URL, MINHARECEITA_URL, CNPJWS_URL):
                router.get(url).mock(return_value=Response(200, json=fixture("cnpja")))
            r = lookup("cnpj", CNPJ)
            assert router.calls.call_count == 0
        assert r["found"] is True and r["source"] == "db"
        assert r["fields"]["razao_social"] == "PETROLEO BRASILEIRO S A"
        assert r["fields"]["nome_fantasia"] == "PETROBRAS"
        assert r["fields"]["logradouro"] == "Av. República do Chile"
        assert r["fields"]["cep"] == "20031170"
        assert r["fields"]["municipio"] == {"id": "3304557", "label": "Rio de Janeiro"}
        assert r["fields"]["situacao"] == "" and r["fields"]["simples"] is None
        assert cache.get(cache_key("cnpj", CNPJ)) is None

    @respx.mock
    def test_pessoa_inativa_vai_para_a_rede(self) -> None:
        Person.objects.update(is_active=False)
        respx.get(CNPJA_URL).mock(return_value=Response(200, json=fixture("cnpja")))
        assert lookup("cnpj", CNPJ)["source"] == "cnpja_open"
