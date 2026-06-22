"""Testa o tratamento de peças por supplier_type no CiliaParser.

Regra de negócio (issue #11 — Bug #3):
- Peça com supplier_type=workshop → DS Car compra/cobra (unit_price/net_price cheios)
- Peça com supplier_type=insurer  → fornecida pela seguradora; mantém rastreio
  mas com valores zerados, pra não inflar os totais da OS.

Esses testes não tocam DB (são unit puros sobre o parser).
"""
from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from django.test import SimpleTestCase

from apps.cilia.sources.cilia_parser import CiliaParser


FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict:
    with open(FIXTURES / name, encoding="utf-8") as fp:
        return json.load(fp)


class InsurerSuppliedPartsTest(SimpleTestCase):
    """Yelum payload tem 5 peças supplier=insurer — devem virar PART zeradas."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.payload = _load("cilia_yelum_insurer_supplied.json")
        cls.parsed = CiliaParser.parse(cls.payload)

    def test_parses_without_error(self) -> None:
        self.assertGreater(len(self.parsed.items), 0)

    def test_insurer_supplied_parts_have_zero_values(self) -> None:
        """Peças com supplier_type != workshop chegam como PART supplier=SEGURADORA
        com unit_price e net_price = 0."""
        insurer_parts = [
            it for it in self.parsed.items
            if it.item_type == "PART" and it.supplier == "SEGURADORA"
        ]
        self.assertGreater(
            len(insurer_parts), 0,
            "Yelum tem peças supplier=insurer; nenhuma chegou como PART SEGURADORA.",
        )
        for part in insurer_parts:
            self.assertEqual(
                part.unit_price, Decimal("0"),
                f"Peça insurer-supplied {part.description!r} tem unit_price={part.unit_price} (deveria ser 0)",
            )
            self.assertEqual(
                part.net_price, Decimal("0"),
                f"Peça insurer-supplied {part.description!r} tem net_price={part.net_price} (deveria ser 0)",
            )

    def test_workshop_parts_keep_real_values(self) -> None:
        """Peças supplier=workshop continuam com os valores do orçamento."""
        workshop_parts = [
            it for it in self.parsed.items
            if it.item_type == "PART" and it.supplier == "OFICINA"
        ]
        self.assertGreater(len(workshop_parts), 0)
        # Pelo menos uma peça workshop deve ter net_price > 0
        nonzero = [p for p in workshop_parts if p.net_price > 0]
        self.assertGreater(
            len(nonzero), 0,
            "Todas as peças workshop ficaram com net_price=0 — algo zerou demais.",
        )

    def test_parts_total_matches_only_workshop_pieces(self) -> None:
        """Soma dos net_price das PART do parser ≈ soma só das peças workshop
        (não infla com peças do insurer).

        Yelum: workshop=R$ 2.131,80; insurer=R$ 9.053,50. Parser deve dar 2.131,80.
        """
        parser_parts_total = sum(
            (it.net_price for it in self.parsed.items if it.item_type == "PART"),
            Decimal("0"),
        )
        workshop_raw = Decimal("0")
        for b in self.payload["budgetings"]:
            if b.get("exchange_used") and b.get("supplier_type") == "workshop":
                final = Decimal(str(b.get("piece_selling_cost_final", 0) or 0))
                gross = Decimal(str(b.get("piece_selling_cost", 0) or 0))
                qty = Decimal(str(b.get("quantity", 1) or 1))
                workshop_raw += (final if final else gross) * qty

        self.assertEqual(parser_parts_total, workshop_raw)
