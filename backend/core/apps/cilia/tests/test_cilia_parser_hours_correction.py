"""Testa correção de paint/repair hours redundantes (issue #11 — Bug 2).

Cilia retorna paint_hours/repair_hours por item considerando trabalho
independente, mas em totals.{total_paint_hours, total_repair_hours} desconta
double-counting entre peças relacionadas. O parser aplica fator de correção
global pra que a soma bata com o agregado oficial.
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


class PaintHoursCorrectionTest(SimpleTestCase):
    """Bradesco #1 (Onix): raw paint_hours soma 42h, mas Cilia diz 38h."""

    def test_total_corrected_paint_hours_matches_cilia(self) -> None:
        payload = _load("cilia_bradesco_discount_10pct.json")
        parsed = CiliaParser.parse(payload)
        cilia_paint = Decimal(str(payload["totals"]["total_paint_hours"]))

        services = [
            it for it in parsed.items
            if it.item_type == "SERVICE" and it.part_type == "Pintura"
        ]
        total_qty = sum((s.quantity for s in services), Decimal("0"))
        self.assertAlmostEqual(
            float(total_qty), float(cilia_paint), places=1,
            msg=f"Sum paint qty {total_qty} != Cilia {cilia_paint}",
        )


class RepairHoursCorrectionTest(SimpleTestCase):
    """Yelum: raw repair_hours soma 11h, mas Cilia diz 5h."""

    def test_total_corrected_repair_hours_matches_cilia(self) -> None:
        payload = _load("cilia_yelum_insurer_supplied.json")
        parsed = CiliaParser.parse(payload)
        cilia_repair = Decimal(str(payload["totals"]["total_repair_hours"]))

        services = [
            it for it in parsed.items
            if it.item_type == "SERVICE" and it.part_type == "Reparação"
        ]
        total_qty = sum((s.quantity for s in services), Decimal("0"))
        self.assertAlmostEqual(
            float(total_qty), float(cilia_repair), places=1,
            msg=f"Sum repair qty {total_qty} != Cilia {cilia_repair}",
        )


class HoursFactorEdgeCasesTest(SimpleTestCase):
    """Quando raw_sum == 0, fator deve ser 1 (não dividir por zero)."""

    def test_zero_raw_returns_one(self) -> None:
        empty_payload = {"budgetings": [], "totals": {"total_paint_hours": 0}}
        factor = CiliaParser._compute_hours_factor(
            empty_payload["budgetings"],
            empty_payload["totals"],
            "paint_hours",
            "total_paint_hours",
        )
        self.assertEqual(factor, Decimal("1"))
