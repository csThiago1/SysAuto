"""Testes do `CiliaParser` usando fixtures reais capturadas de produção.

Fixtures:
    - cilia_1446508_v1.json — versão inicial, status Cilia "analyzed",
      conclusion "not_authorized" (flow=1), 3 items (2 peças + 1 serviço)
    - cilia_1446508_v2.json — complemento, mesmo status "analyzed",
      conclusion "authorized" (flow=2), mesmos 3 items
"""
from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest

from apps.imports.sources.cilia_parser import CiliaParser


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


@pytest.fixture
def v1_payload():
    return _load("cilia_1446508_v1.json")


@pytest.fixture
def v2_payload():
    return _load("cilia_1446508_v2.json")


class TestCiliaParserIdentification:

    def test_basic_identifiers_v1(self, v1_payload):
        pb = CiliaParser.parse(v1_payload)
        assert pb.source == "cilia"
        assert pb.external_budget_id == 17732641
        # v1 tem budget_version_id diferente de v2
        assert pb.external_version_id is not None
        assert pb.external_budget_number == "1446508"
        assert pb.external_version == "1446508.1"
        assert pb.casualty_number == "406571903"
        assert pb.external_flow_number == 1

    def test_basic_identifiers_v2(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.external_version == "1446508.2"
        assert pb.external_version_id == 30629056
        assert pb.external_flow_number == 2

    def test_status_mapping(self, v1_payload):
        # Cilia "analyzed" → nosso "analisado"
        pb = CiliaParser.parse(v1_payload)
        assert pb.external_status == "analisado"


class TestCiliaParserCustomer:

    def test_client_data(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert "FLEXCABLES" in pb.segurado_name.upper()
        assert pb.segurado_cpf == "04497844000140"

    def test_vehicle_data(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.vehicle_plate == "TAF8E63"
        assert pb.vehicle_chassis == "8AC907655SE254082"
        assert pb.vehicle_color == "BRANCA"
        assert pb.vehicle_year == 2025
        assert pb.vehicle_brand == "MERCEDES-BENZ"
        assert "SPRINTER" in pb.vehicle_description
        assert "BRANCA" in pb.vehicle_description

    def test_insurer_code_mapped(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.insurer_code == "tokio"  # Tokio Marine → "tokio"


class TestCiliaParserItems:

    def test_items_count(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert len(pb.items) == 3  # 2 peças + 1 serviço manual

    def test_piece_item(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        parachoque = next(i for i in pb.items if "PARACHOQUE" in i.description)
        assert parachoque.item_type == "PART"
        assert parachoque.bucket == "IMPACTO"
        assert parachoque.external_code == "A90788512009K83"
        assert parachoque.part_type == "GENUINA"
        assert parachoque.supplier == "OFICINA"
        assert parachoque.unit_price == Decimal("5586.93")
        assert parachoque.net_price == Decimal("5586.93")
        assert parachoque.flag_inclusao_manual is True

    def test_item_with_remove_install(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        parachoque = next(i for i in pb.items if "PARACHOQUE" in i.description)
        ri_op = next((op for op in parachoque.operations if op["op_type"] == "R_I"), None)
        assert ri_op is not None
        assert Decimal(ri_op["hours"]) == Decimal("1.0")
        # remove_install_type="tapestry" → TAPECARIA
        assert ri_op["labor_cat"] == "TAPECARIA"

    def test_impact_area_preserved(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        # Todas as peças têm impact_area=1 no payload de teste
        peças = [i for i in pb.items if i.item_type == "PART"]
        assert len(peças) >= 2
        for item in peças:
            assert item.impact_area == 1


class TestCiliaParserConclusion:

    def test_conclusion_v1_not_authorized(self, v1_payload):
        pb = CiliaParser.parse(v1_payload)
        assert len(pb.pareceres) == 1
        parecer = pb.pareceres[0]
        assert parecer.parecer_type == "NEGADO"  # not_authorized → NEGADO
        assert parecer.flow_number == 1
        assert parecer.source == "cilia"

    def test_conclusion_v2_authorized(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        parecer = pb.pareceres[0]
        assert parecer.parecer_type == "AUTORIZADO"
        assert parecer.flow_number == 2
        assert "REPARO AUTORIZADO" in parecer.body.upper()


class TestCiliaParserFinanceiro:

    def test_franchise(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        # Este sinistro tem franchise = 0
        assert pb.franchise_amount == Decimal("0")

    def test_hourly_rates(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        # standard_labor real: paint_cost=65, workforce_cost=48, repair_cost=53
        assert pb.hourly_rates["PINTURA"] == "65.0"
        assert pb.hourly_rates["FUNILARIA"] == "48.0"
        assert pb.hourly_rates["REPARACAO"] == "53.0"


class TestCiliaParserSnapshot:

    def test_raw_payload_preserved(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.raw_payload is v2_payload or pb.raw_payload == v2_payload
        assert "budget_version_id" in pb.raw_payload

    def test_hash_computed(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert len(pb.raw_hash) == 64  # SHA256 hex

    def test_hash_excludes_report_fields(self, v2_payload):
        """Hash deve ser IDÊNTICO mesmo se report_html/pdf mudarem.

        Esse comportamento garante idempotência quando a Cilia regenera PDF
        com timestamp ou campos cosméticos diferentes sem mudança semântica.
        """
        pb1 = CiliaParser.parse(v2_payload)

        altered = dict(v2_payload)
        altered["report_html"] = "OTHER_HTML_BASE64"
        altered["report_pdf"] = "OTHER_PDF_BASE64"
        pb2 = CiliaParser.parse(altered)

        assert pb1.raw_hash == pb2.raw_hash

    def test_hash_detects_item_changes(self, v2_payload):
        """Mudança semântica (ex: total_liquid) muda o hash."""
        pb1 = CiliaParser.parse(v2_payload)

        altered = json.loads(json.dumps(v2_payload))  # deep copy
        altered["totals"]["total_liquid"] = 9999.99
        pb2 = CiliaParser.parse(altered)

        assert pb1.raw_hash != pb2.raw_hash

    def test_report_pdf_preserved(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.report_pdf_base64 != ""
        assert len(pb.report_pdf_base64) > 1000  # PDF em base64 tem muitos KB

    def test_report_html_preserved(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.report_html_base64 != ""
        assert len(pb.report_html_base64) > 10_000  # HTML completo é bem maior


class TestCiliaParserEdgeCases:

    def test_empty_payload_does_not_crash(self):
        pb = CiliaParser.parse({})
        assert pb.source == "cilia"
        assert pb.external_budget_id is None
        assert pb.items == []
        assert pb.pareceres == []

    def test_missing_conclusion_omits_parecer(self):
        payload = {"budget_id": 1, "budget_number": 1, "version_number": 1}
        pb = CiliaParser.parse(payload)
        assert pb.pareceres == []

    def test_missing_insurer_leaves_code_empty(self):
        payload = {"budget_number": 1, "version_number": 1, "insurer": {"trade": "Desconhecida"}}
        pb = CiliaParser.parse(payload)
        assert pb.insurer_code == ""

    def test_dec_handles_none_and_empty_string(self):
        """Smoke test direto do helper de conversão Decimal."""
        assert CiliaParser._dec(None) == Decimal("0")
        assert CiliaParser._dec("") == Decimal("0")
        assert CiliaParser._dec("abc") == Decimal("0")
        assert CiliaParser._dec("123.45") == Decimal("123.45")
        assert CiliaParser._dec(123.45) == Decimal("123.45")
