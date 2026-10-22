"""Consulta gratuita por chassi: OS do tenant → regra aprendida → decodificação local."""

import hashlib
import logging
from typing import Any

import pytest

from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.response import Response
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.lookups.service import lookup
from apps.vehicle_catalog.fipe_sync import load_fipex
from apps.vehicle_catalog.matching import vin_rule_key
from apps.vehicle_catalog.models import VehicleAlias, VehicleYearVersion
from apps.vehicle_catalog.tests.factories import SAMPLE

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CHASSI = "8AC907655SE254082"  # Sprinter 2025 (S = 2025)
OUTRO = "8AC90765XSE999999"  # outro carro, mesmo prefixo de fábrica e mesmo ano
TERCEIRO = "8AC907651SE111111"
MOTO = "9C2JC4110KR000001"  # Honda moto, K = 2019
OS_URL = "/api/v1/service-orders/"


class ChassiLookupTest(TenantTestCase):
    @pytest.fixture(autouse=True)
    def _caplog(self, caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch) -> None:
        # O logger "apps" tem propagate=False em base.py; o caplog fica na raiz.
        monkeypatch.setattr(logging.getLogger("apps"), "propagate", True)
        self.caplog = caplog

    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_settings(CACHES=LOCMEM))
        load_fipex(SAMPLE, ref="2026-10")
        self.sprinter = VehicleYearVersion.objects.get(modelo__codigo_fipe="021506-6", ano=2025)
        email = "chassi@dscar.com"
        user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=user, token={"role": "ADMIN"})

    def post_os(self, **data: Any) -> Response:
        payload = {"plate": "ABC1D23", "customer_name": "Cliente Chassi", **data}
        r = self.client.post(OS_URL, payload, format="json")
        assert r.status_code == 201, r.data
        return r

    def regra(self) -> VehicleAlias:
        return VehicleAlias.objects.get(source="chassi", raw_key=vin_rule_key(CHASSI))

    def test_chassi_da_os_anterior(self) -> None:
        self.post_os(catalog_version=self.sprinter.id, chassis=CHASSI, color="BRANCA")
        r = lookup("chassi", CHASSI.lower())
        assert (r["found"], r["source"]) == (True, "os")
        vehicle = r["fields"]["vehicle"]
        assert vehicle["make"]["label"] == "Mercedes-Benz"
        assert vehicle["family"]["label"] == "Sprinter"
        assert vehicle["model"]["label"] == "Sprinter 517 VAN E.L.T.A. 18L Die (E6)"
        assert vehicle["version"]["id"] == self.sprinter.id
        assert r["fields"]["color"] == {"value": "BRANCA", "label": "Branca"}
        assert r["fields"]["ano_modelo"] == 2025

    def test_regra_aprendida(self) -> None:
        self.post_os(catalog_version=self.sprinter.id, chassis=CHASSI)
        assert self.regra().raw_key == "8AC90765|2025"  # só o prefixo de fábrica, nunca o VIN

        r = lookup("chassi", OUTRO)
        assert (r["found"], r["source"]) == (True, "regra")
        assert r["fields"]["confianca"] == "alta"
        assert r["fields"]["vehicle"]["version"]["id"] == self.sprinter.id
        assert r["fields"]["ano_modelo"] == 2025

        self.post_os(plate="XYZ9A88", catalog_version=self.sprinter.id, chassis=TERCEIRO)
        r = lookup("chassi", OUTRO)
        assert (r["source"], r["fields"]["confianca"]) == ("regra", "exata")

    def test_patch_sem_veiculo_nao_conta_confirmacao(self) -> None:
        pk = self.post_os(catalog_version=self.sprinter.id, chassis=CHASSI).data["id"]
        assert self.regra().confirmacoes == 1

        for data in (
            {"notes": "cliente ligou"},
            {"catalog_version": self.sprinter.id},
            {"chassis": CHASSI.lower()},  # só a caixa mudou: mesmo chassi
        ):
            p = self.client.patch(f"{OS_URL}{pk}/", data, format="json")
            assert p.status_code == 200, p.data
            assert self.regra().confirmacoes == 1

        p = self.client.patch(f"{OS_URL}{pk}/", {"chassis": TERCEIRO}, format="json")
        assert p.status_code == 200, p.data
        assert self.regra().confirmacoes == 2  # chassi novo com a versão confirmada conta

    def test_mesmo_carro_voltando_nao_vira_exata(self) -> None:
        self.post_os(catalog_version=self.sprinter.id, chassis=CHASSI)
        self.post_os(catalog_version=self.sprinter.id, chassis=CHASSI)  # mesmo carro volta
        assert self.regra().confirmacoes == 1 and not self.regra().is_exact

        r = self.client.post("/api/v1/lookups/chassi/", {"key": OUTRO}, format="json")
        assert (r.data["source"], r.data["fields"]["confianca"]) == ("regra", "alta")

    def test_ano_da_versao_diferente_do_vin_nao_ensina(self) -> None:
        v2023 = VehicleYearVersion.objects.get(modelo__codigo_fipe="021506-6", ano=2023)
        self.post_os(catalog_version=v2023.id, chassis=CHASSI)  # VIN diz 2025
        assert not VehicleAlias.objects.filter(source="chassi").exists()

    def test_os_so_com_familia_nao_ensina(self) -> None:
        self.post_os(catalog_family=self.sprinter.modelo.familia_id, chassis=CHASSI)
        assert not VehicleAlias.objects.filter(source="chassi").exists()

    def test_decodificacao_local(self) -> None:
        r = lookup("chassi", OUTRO)
        assert (r["found"], r["source"]) == (True, "vin")
        vehicle = r["fields"]["vehicle"]
        assert (vehicle["tipo"], vehicle["make"]["label"]) == ("carro", "Mercedes-Benz")
        assert vehicle["family"] is None and vehicle["version"] is None
        assert r["fields"]["ano_modelo"] == 2025 and r["fields"]["confianca"] is None

    def test_wmi_de_moto_escolhe_make_moto(self) -> None:
        r = lookup("chassi", MOTO)
        vehicle = r["fields"]["vehicle"]
        assert r["source"] == "vin"
        assert (vehicle["tipo"], vehicle["make"]["label"]) == ("moto", "Honda")
        assert r["fields"]["ano_modelo"] == 2019

    def test_wmi_desconhecido_none(self) -> None:
        assert lookup("chassi", "ZZZ907655SE254082") == {
            "found": False,
            "source": "none",
            "fields": {},
            "unmatched": [],
        }

    def test_vin_invalido_200(self) -> None:
        for key in ("8AC907655SE25408", "8AC907655SE25408O", ""):
            r = self.client.post("/api/v1/lookups/chassi/", {"key": key}, format="json")
            assert r.status_code == 200
            assert (r.data["found"], r.data["source"]) == (False, "invalid")
        assert vin_rule_key("8AC907655SE25408") is None
        assert vin_rule_key("8AC907655ZE254082") is None  # 10º caractere sem ano

    def test_chassi_fora_do_log(self) -> None:
        self.caplog.set_level(logging.DEBUG)
        self.post_os(catalog_version=self.sprinter.id, chassis=CHASSI)
        for vin in (CHASSI, OUTRO, MOTO):
            r = self.client.post("/api/v1/lookups/chassi/", {"key": vin}, format="json")
            assert r.status_code == 200 and r.data["found"] is True
        assert any("criada" in rec.getMessage() for rec in self.caplog.records)  # captura ativa
        dumped = self.caplog.text + " ".join(str(rec.__dict__) for rec in self.caplog.records)
        for vin in (CHASSI, OUTRO, MOTO):
            assert vin not in dumped
