import json
import time
from pathlib import Path
from unittest.mock import patch

import httpx
import respx
from httpx import Response

from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.lookups.service import cache_key, lookup
from apps.persons.utils import sha256_hex

FIXTURES = Path(__file__).resolve().parent / "fixtures"
OPENCEP = json.loads((FIXTURES / "opencep_01310100.json").read_text(encoding="utf-8"))
VIACEP_URL = "https://viacep.com.br/ws/01310100/json/"
OPENCEP_URL = "https://opencep.com/v1/01310100"
AWESOME_URL = "https://cep.awesomeapi.com.br/json/01310100"
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@override_settings(CACHES=LOCMEM)
class LookupServiceTest(TestCase):
    def setUp(self) -> None:
        cache.clear()

    @respx.mock
    def test_primeiro_falha_segundo_acerta(self) -> None:
        respx.get(VIACEP_URL).mock(side_effect=httpx.ConnectTimeout)
        respx.get(OPENCEP_URL).mock(return_value=Response(200, json=OPENCEP))
        r = lookup("cep", "01310-100")
        assert r["found"] and r["source"] == "opencep"
        assert r["fields"]["municipio"]["id"] == "3550308"

    @respx.mock
    def test_viacep_erro_true_conta_como_miss(self) -> None:
        viacep = respx.get(VIACEP_URL).mock(return_value=Response(200, json={"erro": "true"}))
        respx.get(OPENCEP_URL).mock(return_value=Response(200, json=OPENCEP))
        r = lookup("cep", "01310100")
        assert viacep.called
        assert r["found"] is True and r["source"] == "opencep"

    @respx.mock
    def test_rede_fora_nao_cacheia_miss_e_nao_loga_chave(self) -> None:
        for url in (VIACEP_URL, OPENCEP_URL, AWESOME_URL):
            respx.get(url).mock(side_effect=httpx.ConnectTimeout)
        with self.assertLogs("apps.lookups", level="INFO") as logs:
            assert lookup("cep", "01310100")["found"] is False
        dumped = [str(rec.__dict__) for rec in logs.records]
        assert not any("01310100" in d or sha256_hex("01310100") in d for d in dumped)
        assert [rec.status for rec in logs.records if hasattr(rec, "status")] == ["error"] * 3
        assert cache.get(cache_key("cep", "01310100")) is None

    @respx.mock
    def test_nao_existe_cacheia_miss_1_dia(self) -> None:
        respx.get(VIACEP_URL).mock(return_value=Response(200, json={"erro": "true"}))
        respx.get(OPENCEP_URL).mock(return_value=Response(404, json={"error": True}))
        respx.get(AWESOME_URL).mock(return_value=Response(404, json={"code": "not_found"}))
        assert lookup("cep", "01310100")["found"] is False
        key = cache_key("cep", "01310100")
        now = time.time()
        with patch("django.core.cache.backends.locmem.time.time", return_value=now + 86400 - 60):
            assert cache.get(key)["found"] is False
        with patch("django.core.cache.backends.locmem.time.time", return_value=now + 86400 + 60):
            assert cache.get(key) is None

    def test_cache_hit_nao_chama_rede(self) -> None:
        with respx.mock:
            respx.get(VIACEP_URL).mock(return_value=Response(200, json=OPENCEP))
            first = lookup("cep", "01310100")
        assert first["found"] is True
        with respx.mock(assert_all_called=False) as router:
            second = lookup("cep", "01310-100")
            assert router.calls.call_count == 0
        assert second == first

    @respx.mock
    def test_orcamento_de_6s_interrompe_a_cadeia(self) -> None:
        clock = [0.0]

        def slow(request: httpx.Request) -> Response:
            clock[0] = 7.0
            raise httpx.ReadTimeout("lento", request=request)

        respx.get(VIACEP_URL).mock(side_effect=slow)
        opencep = respx.get(OPENCEP_URL).mock(return_value=Response(200, json=OPENCEP))
        with patch("apps.lookups.service.monotonic", side_effect=lambda: clock[0]):
            r = lookup("cep", "01310100")
        assert r["found"] is False
        assert not opencep.called
        assert cache.get(cache_key("cep", "01310100")) is None

    def test_chave_invalida(self) -> None:
        for key in ("123", "0131a0100", "", "013101000"):
            r = lookup("cep", key)
            assert r == {"found": False, "source": "invalid", "fields": {}, "unmatched": []}

    def test_cache_key_usa_hash(self) -> None:
        assert cache_key("cep", "01310100") == f"lookup:cep:{sha256_hex('01310100')}"
