"""Testa o parser HDI HTML contra 3 HTMLs reais (sanitizados)."""
from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from django.test import SimpleTestCase

from apps.cilia.sources.hdi_html_parser import HdiHtmlParser


FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> bytes:
    with open(FIXTURES / name, "rb") as fp:
        return fp.read()


class HdiParserBasicTest(SimpleTestCase):
    """Sanity check no parser HDI: campos básicos extraídos corretamente."""

    def test_hdi_1_basics(self) -> None:
        pb = HdiHtmlParser.parse(_load("hdi_1.html"))
        self.assertEqual(pb.casualty_number, "011425351516272")
        self.assertEqual(pb.vehicle_plate, "OAO2325")
        self.assertEqual(pb.vehicle_brand, "VOLKSWAGEN")
        self.assertEqual(pb.vehicle_year, 2013)
        self.assertEqual(pb.vehicle_color, "Preta")
        self.assertEqual(pb.insurer_code, "hdi")

    def test_hdi_2_basics(self) -> None:
        pb = HdiHtmlParser.parse(_load("hdi_2.html"))
        self.assertEqual(pb.casualty_number, "010335351531426")
        self.assertEqual(pb.vehicle_plate, "PHO1C15")
        self.assertEqual(pb.vehicle_brand, "HYUNDAI")
        self.assertEqual(pb.insurer_code, "hdi")

    def test_hdi_3_basics(self) -> None:
        pb = HdiHtmlParser.parse(_load("hdi_3.html"))
        self.assertEqual(pb.casualty_number, "010335351533973")
        self.assertEqual(pb.vehicle_plate, "PHL3744")
        self.assertEqual(pb.vehicle_brand, "VOLKSWAGEN")


class HdiParserItemsTest(SimpleTestCase):
    """Validação dos items gerados: peças + serviços."""

    def test_hdi_1_total_matches_resumo(self) -> None:
        """Total do parser bate com 'Total Orçamento 5.000,00' do resumo."""
        pb = HdiHtmlParser.parse(_load("hdi_1.html"))
        total = sum((it.net_price for it in pb.items), Decimal("0"))
        # Resumo HDI: Total Orçamento R$ 5.000,00; tolera arredondamento de R$ 0,10
        self.assertAlmostEqual(float(total), 5000.00, places=0,
            msg=f"Total parser R$ {total} != esperado R$ 5.000,00")

    def test_hdi_1_has_parts_and_services(self) -> None:
        pb = HdiHtmlParser.parse(_load("hdi_1.html"))
        parts = [it for it in pb.items if it.item_type == "PART"]
        services = [it for it in pb.items if it.item_type == "SERVICE"]
        self.assertGreater(len(parts), 0)
        self.assertGreater(len(services), 0)

    def test_workshop_parts_have_net_price(self) -> None:
        pb = HdiHtmlParser.parse(_load("hdi_1.html"))
        workshop = [it for it in pb.items if it.item_type == "PART" and it.supplier == "OFICINA"]
        self.assertTrue(any(p.net_price > 0 for p in workshop))


class HdiParserMinimalTest(SimpleTestCase):
    """Edge cases."""

    def test_invalid_html_raises(self) -> None:
        with self.assertRaises(ValueError):
            HdiHtmlParser.parse(b"<html><body>oops</body></html>")
