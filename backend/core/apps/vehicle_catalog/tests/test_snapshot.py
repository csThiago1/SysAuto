"""Snapshot de texto e caminho do catálogo a partir de família/versão."""

from django.test import TestCase
from django.utils import timezone

from apps.vehicle_catalog.fipe_sync import load_fipex
from apps.vehicle_catalog.models import VehicleFamily, VehicleYearVersion
from apps.vehicle_catalog.snapshot import build_snapshot, catalog_path, resolve_family
from apps.vehicle_catalog.tests.factories import SAMPLE


class SnapshotTest(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        load_fipex(SAMPLE, ref="2026-10")
        cls.v = VehicleYearVersion.objects.get(modelo__codigo_fipe="004504-7", ano=2025)
        cls.fam = cls.v.modelo.familia

    def test_snapshot_com_versao(self) -> None:
        s = build_snapshot(self.fam, self.v)
        assert s.make == "Chevrolet" and s.model == "Onix Plus"
        assert s.version == "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut"
        assert s.year == 2025 and s.zero_km is False and s.fuel_type == "Flex"
        assert s.fipe_value == self.v.valor_referencia
        assert s.description == "Chevrolet Onix Plus ONIX SED. Plus PREM. 1.0 12V TB Flex Aut"

    def test_zero_km_usa_ano_corrente(self) -> None:
        v = VehicleYearVersion.objects.get(modelo__codigo_fipe="004519-5", zero_km=True)
        s = build_snapshot(None, v)
        assert s.year == timezone.localdate().year and s.zero_km is True

    def test_so_familia(self) -> None:
        s = build_snapshot(self.fam, None)
        assert s.version == "" and s.year is None and s.fuel_type == "" and s.fipe_value is None
        assert s.description == "Chevrolet Onix Plus"

    def test_resolve_family_vale_a_da_versao(self) -> None:
        outra = VehicleFamily.objects.get(nome="Montana")
        assert resolve_family(outra, self.v) == self.fam
        assert resolve_family(outra, None) == outra

    def test_catalog_path(self) -> None:
        mk = self.fam.make
        assert catalog_path(version=self.v) == {
            "tipo": "carro",
            "make": {"id": mk.id, "label": "Chevrolet", "logo_url": ""},
            "family": {"id": self.fam.id, "label": "Onix Plus"},
            "model": {"id": self.v.modelo_id, "label": "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut"},
            "version": {"id": self.v.id, "label": "2025 Flex"},
        }
        path = catalog_path(family=self.fam)
        assert path["family"]["label"] == "Onix Plus" and path["model"] is None
        assert path["version"] is None
        assert catalog_path(make=mk)["family"] is None
        assert catalog_path() is None
