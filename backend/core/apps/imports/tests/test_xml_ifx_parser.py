"""Tests do `XmlIfxParser` usando XMLs reais (Porto)."""
from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from apps.imports.sources.xml_ifx_parser import XmlIfxParser


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load_xml(name: str) -> bytes:
    return (FIXTURES_DIR / name).read_bytes()


@pytest.fixture
def honda_fit_xml():
    return _load_xml("xml_ifx_honda_fit.xml")


@pytest.fixture
def chevrolet_montana_xml():
    return _load_xml("xml_ifx_chevrolet_montana.xml")


class TestXmlIfxParserHondaFit:

    def test_basic_identifiers(self, honda_fit_xml):
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        assert pb.source == "xml_ifx"
        assert pb.insurer_code == "porto"
        assert pb.casualty_number == "5312026226472"
        assert pb.external_numero_vistoria == "531|2026|226472|0|12290418"
        assert pb.external_status == "autorizado"  # XML só chega finalizado

    def test_client_data(self, honda_fit_xml):
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        assert "IARA MARIA" in pb.segurado_name
        assert pb.segurado_phone  # concatenou ddd+numero

    def test_vehicle_data(self, honda_fit_xml):
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        assert pb.vehicle_plate == "QZP8B26"
        assert pb.vehicle_chassis == "93HGK5880MZ205724"
        assert pb.vehicle_year == 2021
        assert "HONDA" in pb.vehicle_description.upper()

    def test_items_counts(self, honda_fit_xml):
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        # 1 trocada + 3 recuperadas + 1 overlap + 4 serviços terceiros = 9 items
        assert len(pb.items) == 9

    def test_pecas_trocadas_has_trocar_operation(self, honda_fit_xml):
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        trocadas = [
            i for i in pb.items
            if any(op["op_type"] == "TROCA" for op in i.operations)
        ]
        assert len(trocadas) == 1
        para_choque = trocadas[0]
        assert "PARA-CHOQUE" in para_choque.description.upper()
        assert para_choque.external_code == "71101T5NM50ZZ"
        assert para_choque.unit_price == Decimal("590.08")
        assert para_choque.net_price == Decimal("590.08")

    def test_pecas_recuperadas_has_recuperacao_operation(self, honda_fit_xml):
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        recuperadas = [
            i for i in pb.items
            if any(op["op_type"] == "RECUPERACAO" for op in i.operations)
        ]
        assert len(recuperadas) == 3

    def test_pecas_overlap_has_overlap_operation(self, honda_fit_xml):
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        overlap = [
            i for i in pb.items
            if any(op["op_type"] == "OVERLAP" for op in i.operations)
        ]
        assert len(overlap) == 1

    def test_servicos_terceiros_are_external_service(self, honda_fit_xml):
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        svcs = [i for i in pb.items if i.item_type == "EXTERNAL_SERVICE"]
        assert len(svcs) == 4
        for svc in svcs:
            assert svc.flag_servico_manual is True

    def test_pintura_operation_from_tempo_pintura(self, honda_fit_xml):
        """Se peça tem tempoPintura > 0, gera operation PINTURA separada."""
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        # para-choque da pecasTrocadas tem tempoMaoDeObra=0.5 + tempoPintura=4.0
        para_choque = next(
            i for i in pb.items if "PARA-CHOQUE" in i.description.upper()
            and any(op["op_type"] == "TROCA" for op in i.operations)
        )
        pintura_op = next(
            (op for op in para_choque.operations if op["op_type"] == "PINTURA"), None,
        )
        assert pintura_op is not None
        assert Decimal(pintura_op["hours"]) == Decimal("4.0")

    def test_hourly_rates(self, honda_fit_xml):
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        # valoresMOPadrao real do XML Honda Fit: funilaria=57, pintura=72
        assert Decimal(pb.hourly_rates["FUNILARIA"]) == Decimal("57.00")
        assert Decimal(pb.hourly_rates["PINTURA"]) == Decimal("72.00")

    def test_snapshot(self, honda_fit_xml):
        pb = XmlIfxParser.parse(honda_fit_xml, insurer_code="porto")
        assert len(pb.raw_hash) == 64  # sha256
        assert isinstance(pb.raw_payload, dict)
        assert "dadosOrcamento" in pb.raw_payload


class TestXmlIfxParserChevroletMontana:

    def test_items_and_prices(self, chevrolet_montana_xml):
        pb = XmlIfxParser.parse(chevrolet_montana_xml, insurer_code="porto")
        assert pb.vehicle_plate == "TAF7C72"
        assert "CHEVROLET" in pb.vehicle_description.upper()
        # Montana tem 7 trocadas + 4 recuperadas + 2 overlap + 1 servico = 14 items
        assert len(pb.items) == 14

    def test_brazilian_decimal_with_thousands_separator(self, chevrolet_montana_xml):
        """XML Montana tem preços com milhar (ex: '5.330,45') — precisa parsing correto."""
        pb = XmlIfxParser.parse(chevrolet_montana_xml, insurer_code="porto")
        # FAROL tem precoBruto=5.330,45
        farol = next(
            (i for i in pb.items if "FAROL" in i.description.upper()), None,
        )
        assert farol is not None
        assert farol.unit_price == Decimal("5330.45")


class TestXmlIfxParserEdgeCases:

    def test_raises_on_non_ifx_root(self):
        xml = b"<?xml version='1.0'?><NotIFX/>"
        with pytest.raises(ValueError, match="IFX"):
            XmlIfxParser.parse(xml, insurer_code="porto")

    def test_raises_on_malformed_xml(self):
        import xml.etree.ElementTree as ET
        with pytest.raises(ET.ParseError):
            XmlIfxParser.parse(b"not xml", insurer_code="porto")

    def test_dec_br_handles_formats(self):
        assert XmlIfxParser._dec_br("590,08") == Decimal("590.08")
        assert XmlIfxParser._dec_br("2.548,69") == Decimal("2548.69")
        assert XmlIfxParser._dec_br("0,00") == Decimal("0")
        assert XmlIfxParser._dec_br("") == Decimal("0")
        assert XmlIfxParser._dec_br(None) == Decimal("0")
        assert XmlIfxParser._dec_br("bad") == Decimal("0")
