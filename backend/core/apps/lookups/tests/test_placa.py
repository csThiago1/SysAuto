import json
from datetime import timedelta
from pathlib import Path
from typing import Any

import httpx
import respx
from httpx import Response

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.lookups.providers import apiplacas
from apps.lookups.service import TTL, cache_key, lookup
from apps.service_orders.models import ServiceOrder
from apps.vehicle_catalog.fipe_sync import load_fipex
from apps.vehicle_catalog.models import VehicleYearVersion
from apps.vehicle_catalog.tests.factories import SAMPLE

FIXTURES = Path(__file__).resolve().parent / "fixtures"
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
PLACA = "ABC1D23"
URL = f"https://wdapi2.com.br/consulta/{PLACA}/t"
SALDO_URL = "https://wdapi2.com.br/saldo/t"
CHASSI = "9C2JC4110LR000001"


def fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / f"apiplacas_{name}.json").read_text(encoding="utf-8"))


def sem_fipe() -> dict[str, Any]:
    return {**fixture("ok"), "fipe": {"dados": []}}


def seed_restricao(days_ago: int) -> str:
    """Resultado de placa no cache com a restrição consultada há `days_ago` dias."""
    consultado_em = (timezone.now() - timedelta(days=days_ago)).isoformat()
    restricao = {"situacao": "Roubo/Furto", "tem_restricao": True, "consultado_em": consultado_em}
    fields = {"vehicle": None, "color": None, "year_manufacture": 2020, "restricao": restricao}
    result = {"found": True, "source": "apiplacas", "fields": fields, "unmatched": []}
    cache.set(cache_key("placa", PLACA), result, TTL["placa"])
    return consultado_em


class PlacaLookupTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_settings(APIPLACAS_TOKEN="t", CACHES=LOCMEM))
        cache.clear()
        load_fipex(SAMPLE, ref="2026-10")

    def os_com_placa(self) -> ServiceOrder:
        version = VehicleYearVersion.objects.get(modelo__codigo_fipe="002112-1", ano=2021)
        return ServiceOrder.objects.create(
            number=9701,
            plate=PLACA,
            customer_name="Cliente Placa",
            catalog_family=version.modelo.familia,
            catalog_version=version,
            color="PRATA",
            year_manufacture=2020,
        )

    @respx.mock
    def test_codigo_fipe_vira_versao_exata(self) -> None:
        respx.get(URL).mock(return_value=Response(200, json=fixture("ok")))
        raw = apiplacas(PLACA)
        assert raw is not None and raw["codigos_fipe"] == [("002111-3", 90)]
        assert raw["ano_modelo"] == 2023 and raw["codigo_situacao"] == 0

        r = lookup("placa", "abc-1d23")
        vehicle = r["fields"]["vehicle"]
        assert r["found"] is True and r["source"] == "apiplacas"
        assert vehicle["make"]["label"] == "Toyota" and vehicle["family"]["label"] == "Corolla"
        assert vehicle["model"]["label"] == "Corolla XEi 2.0 Flex 16V Aut."
        assert vehicle["version"]["label"] == "2023 Flex"
        assert r["fields"]["color"] == {"value": "BRANCA", "label": "Branca"}
        assert r["fields"]["year_manufacture"] == 2023
        restricao = r["fields"]["restricao"]
        assert restricao["situacao"] == "Sem restrição" and restricao["tem_restricao"] is False
        assert r["unmatched"] == []
        assert cache.get(cache_key("placa", PLACA)) == r

    @respx.mock
    def test_sem_codigo_casa_por_texto_ate_onde_der(self) -> None:
        respx.get(URL).mock(return_value=Response(200, json={**sem_fipe(), "cor": "Furta-cor"}))
        r = lookup("placa", PLACA)
        vehicle = r["fields"]["vehicle"]
        assert r["found"] is True
        assert vehicle["make"]["label"] == "Honda" and vehicle["family"]["label"] == "Pop"
        assert vehicle["version"] is None
        assert r["fields"]["color"] is None
        assert r["unmatched"] == ["HONDA POP 110I", "Furta-cor"]

    @respx.mock
    def test_marca_desconhecida_volta_vazio(self) -> None:
        body = {**sem_fipe(), "MARCA": "ZZZ", "marca": "ZZZ"}
        respx.get(URL).mock(return_value=Response(200, json=body))
        r = lookup("placa", PLACA)
        assert r["found"] is True and r["fields"]["vehicle"] is None
        assert r["unmatched"] == ["ZZZ POP 110I"]

    @respx.mock
    def test_os_no_banco_dispensa_api_mas_restricao_velha_reconsulta(self) -> None:
        order = self.os_com_placa()
        old = seed_restricao(days_ago=31)
        route = respx.get(URL).mock(return_value=Response(200, json=fixture("ok")))
        r = lookup("placa", PLACA)
        assert route.call_count == 1
        assert r["found"] is True and r["source"] == "os"
        assert r["fields"]["vehicle"]["version"]["id"] == order.catalog_version_id
        assert r["fields"]["color"] == {"value": "PRATA", "label": "Prata"}
        assert r["fields"]["year_manufacture"] == 2020
        restricao = r["fields"]["restricao"]
        assert restricao["situacao"] == "Sem restrição" and restricao["tem_restricao"] is False
        assert restricao["consultado_em"] > old
        assert cache.get(cache_key("placa", PLACA))["fields"]["restricao"] == restricao

    @respx.mock
    def test_restricao_recente_nao_reconsulta(self) -> None:
        self.os_com_placa()
        consultado_em = seed_restricao(days_ago=29)
        route = respx.get(URL).mock(return_value=Response(200, json=fixture("ok")))
        r = lookup("placa", PLACA)
        assert route.call_count == 0
        assert r["source"] == "os"
        assert r["fields"]["restricao"] == {
            "situacao": "Roubo/Furto",
            "tem_restricao": True,
            "consultado_em": consultado_em,
        }

    @respx.mock
    def test_api_fora_devolve_restricao_antiga(self) -> None:
        consultado_em = seed_restricao(days_ago=31)
        respx.get(URL).mock(return_value=Response(402))
        r = lookup("placa", PLACA)
        assert r["found"] is True and r["fields"]["restricao"]["tem_restricao"] is True
        assert r["fields"]["restricao"]["consultado_em"] == consultado_em
        assert cache.get(cache_key("placa", PLACA)) == r  # o miss do 402 não apaga a antiga

    @respx.mock
    def test_402_found_false_sem_logar_placa(self) -> None:
        respx.get(URL).mock(return_value=Response(402))
        with self.assertLogs("apps.lookups", level="DEBUG") as logs:
            r = lookup("placa", PLACA)
        assert r == {"found": False, "source": "none", "fields": {}, "unmatched": []}
        assert any("token API Placas inválido" in m for m in logs.output)
        assert all(PLACA not in str(rec.__dict__) for rec in logs.records)
        assert all("/t" not in str(rec.__dict__) for rec in logs.records)

    @respx.mock
    def test_resposta_nao_tem_chassi(self) -> None:
        body = fixture("ok")
        body["chassi"] = body["extra"]["chassi"] = CHASSI
        body["extra"]["renavam"] = "01234567890"
        respx.get(URL).mock(return_value=Response(200, json=body))
        dumped = json.dumps(lookup("placa", PLACA))
        assert CHASSI not in dumped and "01234567890" not in dumped
        assert "chassi" not in dumped and "renavam" not in dumped

    @respx.mock
    def test_rede_fora_sem_cache_found_false(self) -> None:
        respx.get(URL).mock(side_effect=httpx.ConnectTimeout)
        assert lookup("placa", PLACA)["found"] is False
        assert cache.get(cache_key("placa", PLACA)) is None


class HealthSaldoTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_settings(APIPLACAS_TOKEN="t", RESEND_API_KEY="r", CACHES=LOCMEM))
        cache.clear()
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.client.defaults["HTTP_HOST"] = self.domain.domain

    @respx.mock
    def test_health_saldo_cacheado(self) -> None:
        route = respx.get(SALDO_URL).mock(
            return_value=Response(200, json={**fixture("saldo"), "qtdConsultas": 42})
        )
        first = self.client.get("/healthz/")
        second = self.client.get("/healthz/")
        assert route.call_count == 1
        assert first.status_code == second.status_code == 200
        assert first.data["checks"]["api_placas_saldo"] == {"saldo": 42, "baixo": True}
        assert second.data["checks"]["api_placas_saldo"] == {"saldo": 42, "baixo": True}

    @respx.mock
    def test_health_saldo_fora_nao_derruba(self) -> None:
        respx.get(SALDO_URL).mock(return_value=Response(500))
        r = self.client.get("/healthz/")
        assert r.status_code == 200 and "api_placas_saldo" not in r.data["checks"]
