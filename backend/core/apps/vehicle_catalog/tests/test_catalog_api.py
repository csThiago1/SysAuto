"""API de leitura do catálogo: makes, families, models e years."""

import hashlib

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.vehicle_catalog.fipe_sync import load_fipex
from apps.vehicle_catalog.models import VehicleFamily, VehicleMake, VehicleModel, VehicleYearVersion
from apps.vehicle_catalog.snapshot import catalog_path
from apps.vehicle_catalog.tests.factories import SAMPLE

BASE = "/api/v1/vehicle-catalog"


class CatalogApiTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        load_fipex(SAMPLE, ref="2026-10")
        email = "catalogo@dscar.com"
        self.user = GlobalUser.objects.create_user(
            email=email,
            password="pw",
            email_hash=hashlib.sha256(email.encode()).hexdigest(),
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self._auth("CONSULTANT")

    def _auth(self, role: str) -> None:
        self.client.force_authenticate(user=self.user, token={"role": role})

    def test_makes_filtra_tipo_e_pagina(self) -> None:
        r = self.client.get(f"{BASE}/makes/?tipo=moto")
        assert r.status_code == 200
        assert {m["label"] for m in r.data["results"]} == {"Honda"}
        assert set(r.data["results"][0]) == {"id", "label", "nome", "tipo", "logo_url", "is_active"}
        r = self.client.get(f"{BASE}/makes/?tipo=carro&page_size=1")
        assert len(r.data["results"]) == 1 and r.data["count"] > 1

    def test_makes_busca_e_ordena_por_display_name(self) -> None:
        r = self.client.get(f"{BASE}/makes/?tipo=carro&search=chev")
        assert [m["label"] for m in r.data["results"]] == ["Chevrolet"]
        labels = [m["label"] for m in self.client.get(f"{BASE}/makes/?tipo=carro").data["results"]]
        assert labels == sorted(labels)

    def test_families_por_marca(self) -> None:
        vw = VehicleMake.objects.get(tipo="carro", display_name="Volkswagen")
        r = self.client.get(f"{BASE}/families/?marca={vw.id}&search=gol")
        assert r.status_code == 200
        gol = VehicleFamily.objects.get(make=vw, nome="Gol")
        assert r.data["results"] == [{"id": gol.id, "label": "Gol", "marca": vw.id}]

    def test_busca_versao_por_palavras_soltas(self) -> None:
        fam = VehicleFamily.objects.get(nome="Onix Plus")
        r = self.client.get(f"{BASE}/models/?familia={fam.id}&ano=2025&search=prem tb")
        assert [m["codigo_fipe"] for m in r.data["results"]] == ["004504-7"]
        assert r.data["results"][0]["label"] == "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut"
        assert r.data["results"][0]["familia"] == fam.id

    def test_years_por_modelo_ordena_desc(self) -> None:
        modelo = VehicleModel.objects.get(codigo_fipe="004539-0")
        r = self.client.get(f"{BASE}/years/?modelo={modelo.id}")
        anos = [y["ano"] for y in r.data["results"]]
        assert anos == sorted(anos, reverse=True) and 2025 in anos
        y = next(y for y in r.data["results"] if y["ano"] == 2025)
        assert y["label"] == "2025 Flex" and y["combustivel_label"] == "Flex"
        assert y["zero_km"] is False and y["valor_referencia"] == "103494.00"

    def test_inativo_some_da_lista_mas_path_funciona(self) -> None:
        v = VehicleYearVersion.objects.get(modelo__codigo_fipe="005275-2", ano=2013)
        VehicleModel.objects.filter(pk=v.modelo_id).update(is_active=False)
        r = self.client.get(f"{BASE}/models/?familia={v.modelo.familia_id}&page_size=200")
        assert "005275-2" not in {m["codigo_fipe"] for m in r.data["results"]}
        assert catalog_path(version=v)["model"]["label"].startswith("Gol (novo)")

    def test_logo_exige_admin(self) -> None:
        self._auth("MANAGER")
        mk = VehicleMake.objects.first()
        url = f"{BASE}/makes/{mk.id}/logo/"
        assert self.client.patch(url, {"logo_url": "x"}).status_code == 403
        self._auth("ADMIN")
        assert self.client.patch(url, {"logo_url": "x"}).status_code == 200
        mk.refresh_from_db()
        assert mk.logo_url == "x"

    def test_put_na_make_bloqueado(self) -> None:
        mk = VehicleMake.objects.first()
        self._auth("MANAGER")
        assert self.client.put(f"{BASE}/makes/{mk.id}/", {"is_active": False}).status_code == 403
        self._auth("ADMIN")
        assert self.client.put(f"{BASE}/makes/{mk.id}/", {"is_active": False}).status_code == 405

    def test_patch_is_active_so_admin_e_reativa(self) -> None:
        mk = VehicleMake.objects.get(tipo="moto")
        self._auth("MANAGER")
        assert self.client.patch(f"{BASE}/makes/{mk.id}/", {"is_active": False}).status_code == 403
        self._auth("ADMIN")
        r = self.client.patch(f"{BASE}/makes/{mk.id}/", {"is_active": False, "nome": "X"})
        assert r.status_code == 200
        mk.refresh_from_db()
        assert mk.is_active is False and mk.nome == "HONDA"
        assert self.client.patch(f"{BASE}/makes/{mk.id}/", {"is_active": True}).status_code == 200
        mk.refresh_from_db()
        assert mk.is_active is True

    def test_include_inactive_so_admin(self) -> None:
        VehicleMake.objects.filter(tipo="moto").update(is_active=False)
        url = f"{BASE}/makes/?tipo=moto&include_inactive=true"
        assert self.client.get(url).data["results"] == []
        assert self.client.get(f"{BASE}/makes/?tipo=moto").data["results"] == []
        self._auth("ADMIN")
        results = self.client.get(url).data["results"]
        assert [(m["label"], m["is_active"]) for m in results] == [("Honda", False)]
