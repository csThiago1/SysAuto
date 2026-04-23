"""Tests for NumberAllocator with NumberSequence model."""
from __future__ import annotations

from django_tenants.test.cases import TenantTestCase

from apps.items.models import NumberSequence
from apps.items.services import NumberAllocator


class TestNumberAllocator(TenantTestCase):
    """NumberAllocator.allocate() with full NumberSequence implementation."""

    def setUp(self) -> None:
        seq, _ = NumberSequence.objects.get_or_create(
            sequence_type="BUDGET",
            defaults={"prefix": "ORC-2026-", "padding": 6, "next_number": 1},
        )
        # Reset to known state for test isolation
        seq.prefix = "ORC-2026-"
        seq.padding = 6
        seq.next_number = 1
        seq.save()

    def test_allocate_budget_first(self) -> None:
        result = NumberAllocator.allocate("BUDGET")
        self.assertEqual(result, "ORC-2026-000001")

    def test_allocate_increments(self) -> None:
        NumberAllocator.allocate("BUDGET")
        result = NumberAllocator.allocate("BUDGET")
        self.assertEqual(result, "ORC-2026-000002")

    def test_allocate_unknown_type_raises(self) -> None:
        with self.assertRaises(NumberSequence.DoesNotExist):
            NumberAllocator.allocate("UNKNOWN")
