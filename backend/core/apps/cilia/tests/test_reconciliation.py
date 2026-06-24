"""Testa o módulo de reconciliação (compute_reconciliation_state)."""
from __future__ import annotations

from decimal import Decimal

from django.test import SimpleTestCase

from apps.cilia.dtos import ParsedBudget, ParsedItemDTO
from apps.cilia.reconciliation import (
    TOLERANCE,
    compute_reconciliation_state,
    serialize_items_for_reconciliation,
)


def _make_part(net: str = "100.00") -> ParsedItemDTO:
    return ParsedItemDTO(
        item_type="PART",
        description="PEÇA TESTE",
        external_code="P001",
        supplier="OFICINA",
        quantity=Decimal("1"),
        unit_price=Decimal(net),
        net_price=Decimal(net),
    )


def _make_service(net: str = "50.00") -> ParsedItemDTO:
    return ParsedItemDTO(
        item_type="SERVICE",
        description="SERVIÇO TESTE",
        external_code="S001",
        supplier="OFICINA",
        quantity=Decimal("1"),
        unit_price=Decimal(net),
        net_price=Decimal(net),
    )


class ReconciliationPerfectMatchTest(SimpleTestCase):
    """Quando soma de items == source totals, needs_reconciliation = False."""

    def test_no_diff_no_reconciliation(self) -> None:
        pb = ParsedBudget(source="cilia")
        pb.items = [_make_part("100.00"), _make_service("50.00")]
        pb.source_parts_total = Decimal("100.00")
        pb.source_services_total = Decimal("50.00")
        pb.source_grand_total = Decimal("150.00")
        state = compute_reconciliation_state(pb)
        self.assertFalse(state.needs_reconciliation)
        self.assertEqual(state.parts_diff, Decimal("0.00"))
        self.assertEqual(state.services_diff, Decimal("0.00"))

    def test_one_cent_diff_triggers(self) -> None:
        """Tolerância zero: até R$ 0,01 dispara conciliação."""
        pb = ParsedBudget(source="cilia")
        pb.items = [_make_part("100.01")]
        pb.source_parts_total = Decimal("100.00")
        pb.source_services_total = Decimal("0")
        pb.source_grand_total = Decimal("100.00")
        state = compute_reconciliation_state(pb)
        self.assertTrue(state.needs_reconciliation)
        self.assertEqual(state.parts_diff, Decimal("0.01"))


class ReconciliationDivergenceTest(SimpleTestCase):
    """Quando diff > tolerância, needs_reconciliation = True."""

    def test_parts_diff_above_tolerance_triggers(self) -> None:
        pb = ParsedBudget(source="cilia")
        pb.items = [_make_part("200.00")]
        pb.source_parts_total = Decimal("100.00")
        pb.source_services_total = Decimal("0")
        pb.source_grand_total = Decimal("100.00")
        state = compute_reconciliation_state(pb)
        self.assertTrue(state.needs_reconciliation)
        self.assertEqual(state.parts_diff, Decimal("100.00"))

    def test_services_diff_triggers(self) -> None:
        pb = ParsedBudget(source="cilia")
        pb.items = [_make_service("50.00")]
        pb.source_parts_total = Decimal("0")
        pb.source_services_total = Decimal("100.00")
        pb.source_grand_total = Decimal("100.00")
        state = compute_reconciliation_state(pb)
        self.assertTrue(state.needs_reconciliation)
        self.assertEqual(state.services_diff, Decimal("-50.00"))

    def test_negative_diff_triggers(self) -> None:
        """Parser sub-conta — também precisa reconciliação (cobrança a menos)."""
        pb = ParsedBudget(source="cilia")
        pb.items = [_make_service("50.00")]
        pb.source_parts_total = Decimal("0")
        pb.source_services_total = Decimal("100.00")
        pb.source_grand_total = Decimal("100.00")
        state = compute_reconciliation_state(pb)
        self.assertTrue(state.needs_reconciliation)
        # Diff é negativo (parser < source)
        self.assertLess(state.services_diff, Decimal("0"))


class ReconciliationSerializationTest(SimpleTestCase):
    def test_serialize_items_has_required_fields(self) -> None:
        items = [_make_part("100.00"), _make_service("50.00")]
        serialized = serialize_items_for_reconciliation(items)
        self.assertEqual(len(serialized), 2)
        for item in serialized:
            for field in ("index", "item_type", "description",
                          "quantity", "unit_price", "net_price", "supplier"):
                self.assertIn(field, item)

    def test_to_dict_converts_decimal_to_string(self) -> None:
        pb = ParsedBudget(source="cilia")
        pb.items = [_make_part("100.00")]
        pb.source_parts_total = Decimal("100.00")
        pb.source_services_total = Decimal("0")
        pb.source_grand_total = Decimal("100.00")
        state = compute_reconciliation_state(pb)
        d = state.to_dict()
        # Decimais viraram strings com 2 casas
        self.assertEqual(d["parser_parts"], "100.00")
        self.assertEqual(d["source_parts"], "100.00")
        self.assertEqual(d["parts_diff"], "0.00")
        self.assertIsInstance(d["needs_reconciliation"], bool)


class ToleranceTest(SimpleTestCase):
    def test_tolerance_is_zero(self) -> None:
        """Regra de negócio: cobrança seguradora exige 100% exatidão."""
        self.assertEqual(TOLERANCE, Decimal("0"))
