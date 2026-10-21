"""normalize_parsed_budget casa veículo, cor e seguradora das fixtures reais com as listas."""

import json
from pathlib import Path

from django_tenants.test.cases import TenantTestCase

from apps.cilia.normalization import normalize_parsed_budget
from apps.cilia.sources.cilia_parser import CiliaParser
from apps.cilia.sources.xml_ifx_parser import XmlIfxParser
from apps.insurers.models import Insurer
from apps.vehicle_catalog.fipe_sync import load_fipex
from apps.vehicle_catalog.models import VehicleYearVersion
from apps.vehicle_catalog.tests.factories import SAMPLE

FIXTURES = Path(__file__).parent / "fixtures"


class NormalizeParsedBudgetTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        load_fipex(SAMPLE, ref="2026-10")

    def test_cilia_onix_bradesco(self) -> None:
        pb = CiliaParser().parse(
            json.loads((FIXTURES / "cilia_bradesco_discount_10pct.json").read_text())
        )
        normalize_parsed_budget(pb)
        version = VehicleYearVersion.objects.get(pk=pb.catalog_version_id)
        assert version.modelo.codigo_fipe == "004504-7"
        assert pb.catalog_family_id == version.modelo.familia_id and pb.vehicle_review is False
        assert (pb.color, pb.insurer_code, pb.insurer_cnpj) == (
            "PRETA",
            "bradesco",
            "33055146000193",
        )
        assert pb.insurer_id == Insurer.objects.get(code="bradesco").pk and pb.normalized

    def test_xml_montana_insurer_escolhido(self) -> None:
        pb = XmlIfxParser.parse(
            (FIXTURES / "xml_ifx_chevrolet_montana.xml").read_bytes(), insurer_code="porto"
        )
        normalize_parsed_budget(pb)
        assert pb.insurer_id == Insurer.objects.get(code="porto").pk
        version = VehicleYearVersion.objects.get(pk=pb.catalog_version_id)
        assert version.modelo.codigo_fipe == "004546-2"

    def test_idempotente(self) -> None:
        pb = XmlIfxParser.parse(
            (FIXTURES / "xml_ifx_chevrolet_montana.xml").read_bytes(), insurer_code="porto"
        )
        normalize_parsed_budget(pb)
        pb.catalog_version_id = None  # uma 2ª chamada não refaz o casamento
        normalize_parsed_budget(pb)
        assert pb.catalog_version_id is None
