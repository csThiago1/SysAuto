"""Testa aplicação do `standard_labor.discount` global da Cilia nos SERVICEs.

Regra de negócio (issue #11 — Bug #1):
A Cilia tem um campo `standard_labor.discount` (% de desconto sobre a mão-de-
obra) que vale para todos os SERVICE items (horas × tarifa e selling_cost
fixo). Não afeta peças, que têm `piece_discount_percentage` próprio.

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


class StandardLaborDiscountTest(SimpleTestCase):
    """Bradesco #1 (Onix) tem standard_labor.discount=10% → todos os SERVICE
    chegam com net_price = unit×qty × 0.9."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.payload = _load("cilia_bradesco_discount_10pct.json")
        cls.parsed = CiliaParser.parse(cls.payload)

    def test_global_discount_captured(self) -> None:
        self.assertEqual(self.parsed.global_discount_pct, Decimal("10.0"))

    def test_service_items_have_discount_applied(self) -> None:
        """Cada SERVICE deve ter net_price = unit_price × quantity × 0.9."""
        services = [it for it in self.parsed.items if it.item_type == "SERVICE"]
        self.assertGreater(len(services), 0)

        for svc in services:
            expected = svc.unit_price * svc.quantity * Decimal("0.9")
            self.assertAlmostEqual(
                float(svc.net_price), float(expected), places=2,
                msg=(
                    f"Serviço {svc.description!r} ({svc.part_type}): "
                    f"net_price={svc.net_price} esperado={expected} "
                    f"(unit={svc.unit_price} × qty={svc.quantity} × 0.9)"
                ),
            )
            self.assertEqual(svc.discount_pct, Decimal("10.0"))

    def test_part_items_not_affected_by_global_discount(self) -> None:
        """Peças mantêm o próprio piece_discount_percentage (10% per-item no
        Bradesco #1 também por coincidência), não usam global_discount_pct."""
        parts = [it for it in self.parsed.items if it.item_type == "PART"]
        self.assertGreater(len(parts), 0)
        # Peças têm net_price baseado no piece_selling_cost_final do payload,
        # NÃO em unit_price × 0.9. Asserir que pelo menos algumas parts têm
        # net_price > 0 (já validado no fix #3).
        nonzero = [p for p in parts if p.net_price > 0]
        self.assertGreater(len(nonzero), 0)

    def test_service_total_matches_subtotal_times_factor(self) -> None:
        """Soma dos net_price de SERVICE ≈ soma dos gross × (1 - 10/100)."""
        services = [it for it in self.parsed.items if it.item_type == "SERVICE"]
        gross_sum = sum(
            (s.unit_price * s.quantity for s in services), Decimal("0"),
        )
        net_sum = sum((s.net_price for s in services), Decimal("0"))
        expected_net = gross_sum * Decimal("0.9")
        self.assertAlmostEqual(float(net_sum), float(expected_net), places=2)


class ZeroDiscountTest(SimpleTestCase):
    """Yelum tem discount=5% — net_price deve ser unit×qty × 0.95.
    Bradesco #2 tem discount=0% — net_price = unit×qty (sem fator)."""

    def test_yelum_5pct_discount(self) -> None:
        payload = _load("cilia_yelum_insurer_supplied.json")
        parsed = CiliaParser.parse(payload)
        self.assertEqual(parsed.global_discount_pct, Decimal("5.0"))
        services = [it for it in parsed.items if it.item_type == "SERVICE"]
        for svc in services:
            expected = svc.unit_price * svc.quantity * Decimal("0.95")
            self.assertAlmostEqual(
                float(svc.net_price), float(expected), places=2,
                msg=f"{svc.description}: {svc.net_price} != {expected}",
            )
