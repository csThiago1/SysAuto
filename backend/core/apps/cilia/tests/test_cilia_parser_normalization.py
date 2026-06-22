"""Testa normalização dos dados do veículo no CiliaParser.

A Cilia retorna brand/model/color em formatos irregulares (CAPS, prefixo "-",
range de anos entre parênteses). O parser normaliza pra exibição na OS e PDF.
"""
from __future__ import annotations

from django.test import SimpleTestCase

from apps.cilia.sources.cilia_parser import CiliaParser


class NormalizeColorTest(SimpleTestCase):
    def test_strips_dash_prefix(self) -> None:
        self.assertEqual(CiliaParser._normalize_color("-PRETA"), "Preta")
        self.assertEqual(CiliaParser._normalize_color("- BRANCA"), "Branca")

    def test_title_case_multi_word(self) -> None:
        self.assertEqual(CiliaParser._normalize_color("BRANCA PEROLA"), "Branca Perola")
        self.assertEqual(CiliaParser._normalize_color("AZUL ESCURO"), "Azul Escuro")

    def test_empty(self) -> None:
        self.assertEqual(CiliaParser._normalize_color(""), "")
        self.assertEqual(CiliaParser._normalize_color("-"), "")

    def test_trim(self) -> None:
        self.assertEqual(CiliaParser._normalize_color("  PRATA  "), "Prata")


class NormalizeBrandTest(SimpleTestCase):
    def test_title_case_long_brand(self) -> None:
        self.assertEqual(CiliaParser._normalize_brand("CHEVROLET"), "Chevrolet")
        self.assertEqual(CiliaParser._normalize_brand("VOLKSWAGEN"), "Volkswagen")
        self.assertEqual(CiliaParser._normalize_brand("MERCEDES"), "Mercedes")

    def test_short_acronym_stays_caps(self) -> None:
        self.assertEqual(CiliaParser._normalize_brand("BMW"), "BMW")
        self.assertEqual(CiliaParser._normalize_brand("VW"), "VW")
        self.assertEqual(CiliaParser._normalize_brand("GM"), "GM")

    def test_empty(self) -> None:
        self.assertEqual(CiliaParser._normalize_brand(""), "")


class NormalizeModelTest(SimpleTestCase):
    def test_strips_year_range_parens(self) -> None:
        raw = "ONIX PLUS (2020 A 2025) PREMIER 1.0 12V TURBO FLEX 2025"
        self.assertEqual(
            CiliaParser._normalize_model(raw),
            "ONIX PLUS PREMIER 1.0 12V TURBO FLEX 2025",
        )

    def test_no_parens_passthrough(self) -> None:
        self.assertEqual(
            CiliaParser._normalize_model("COROLLA XEI 2.0 16V"),
            "COROLLA XEI 2.0 16V",
        )

    def test_multiple_parens(self) -> None:
        raw = "GOL (2008 A 2014) TRENDLINE (modelo X) 1.6"
        out = CiliaParser._normalize_model(raw)
        # Pelo menos deve remover o range com 4 dígitos
        self.assertNotIn("2008", out)
        self.assertNotIn("2014", out)

    def test_compacts_double_spaces(self) -> None:
        raw = "ONIX (2020 A 2025) PREMIER"
        self.assertEqual(CiliaParser._normalize_model(raw), "ONIX PREMIER")

    def test_empty(self) -> None:
        self.assertEqual(CiliaParser._normalize_model(""), "")
