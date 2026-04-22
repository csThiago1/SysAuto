"""
Paddock Solutions — Items App Tests
Sprint: OS Versioning Model

Tests for ItemOperationType, LaborCategory, and ItemOperation models.
"""
from __future__ import annotations

from django.db import IntegrityError
from django_tenants.test.cases import TenantTestCase

from apps.items.models import ItemOperation, ItemOperationType, LaborCategory


class TestItemOperationTypeSeed(TenantTestCase):
    """Seeds created by migration 0002 are present."""

    def test_operation_type_seeds_count(self) -> None:
        """At least 7 operation types must exist (seeded by migration)."""
        count = ItemOperationType.objects.count()
        self.assertGreaterEqual(count, 7, f"Expected >= 7 ItemOperationType, got {count}")

    def test_expected_operation_type_codes(self) -> None:
        """Expected operation type codes are present."""
        expected_codes = [
            "TROCA",
            "RECUPERACAO",
            "OVERLAP",
            "PINTURA",
            "R_I",
            "MONTAGEM_DESMONTAGEM",
            "DNC",
        ]
        existing_codes = list(
            ItemOperationType.objects.filter(code__in=expected_codes).values_list("code", flat=True)
        )
        for code in expected_codes:
            self.assertIn(code, existing_codes, f"Missing ItemOperationType code: {code}")

    def test_operation_type_unique_code(self) -> None:
        """ItemOperationType.code must be unique."""
        ItemOperationType.objects.create(code="UNIQUE_TEST_OP", label="Unique Test Op", sort_order=99)
        with self.assertRaises(IntegrityError):
            ItemOperationType.objects.create(
                code="UNIQUE_TEST_OP", label="Duplicate Op", sort_order=100
            )

    def test_operation_type_ordering(self) -> None:
        """ItemOperationType default ordering is by sort_order then code."""
        types = list(ItemOperationType.objects.values_list("code", flat=True))
        self.assertGreater(len(types), 0)
        # TROCA has sort_order=0, DNC has sort_order=6 — TROCA must come first
        troca_idx = types.index("TROCA") if "TROCA" in types else -1
        dnc_idx = types.index("DNC") if "DNC" in types else -1
        if troca_idx >= 0 and dnc_idx >= 0:
            self.assertLess(troca_idx, dnc_idx)


class TestLaborCategorySeed(TenantTestCase):
    """Seeds created by migration 0002 for LaborCategory."""

    def test_labor_category_seeds_count(self) -> None:
        """At least 9 labor categories must exist (seeded by migration)."""
        count = LaborCategory.objects.count()
        self.assertGreaterEqual(count, 9, f"Expected >= 9 LaborCategory, got {count}")

    def test_expected_labor_category_codes(self) -> None:
        """Expected labor category codes are present."""
        expected_codes = [
            "FUNILARIA",
            "PINTURA",
            "MECANICA",
            "ELETRICA",
            "TAPECARIA",
            "ACABAMENTO",
            "VIDRACARIA",
            "REPARACAO",
            "SERVICOS",
        ]
        existing_codes = list(
            LaborCategory.objects.filter(code__in=expected_codes).values_list("code", flat=True)
        )
        for code in expected_codes:
            self.assertIn(code, existing_codes, f"Missing LaborCategory code: {code}")

    def test_labor_category_unique_code(self) -> None:
        """LaborCategory.code must be unique."""
        LaborCategory.objects.create(code="UNIQUE_TEST_CAT", label="Unique Test Cat", sort_order=99)
        with self.assertRaises(IntegrityError):
            LaborCategory.objects.create(
                code="UNIQUE_TEST_CAT", label="Duplicate Cat", sort_order=100
            )

    def test_labor_category_ordering(self) -> None:
        """LaborCategory default ordering is by sort_order then code."""
        categories = list(LaborCategory.objects.values_list("code", flat=True))
        self.assertGreater(len(categories), 0)
        # FUNILARIA has sort_order=0, SERVICOS has sort_order=8
        funilaria_idx = categories.index("FUNILARIA") if "FUNILARIA" in categories else -1
        servicos_idx = categories.index("SERVICOS") if "SERVICOS" in categories else -1
        if funilaria_idx >= 0 and servicos_idx >= 0:
            self.assertLess(funilaria_idx, servicos_idx)


class TestItemOperation(TenantTestCase):
    """Tests for ItemOperation model."""

    def setUp(self) -> None:
        self.operation_type = ItemOperationType.objects.get(code="TROCA")
        self.labor_category = LaborCategory.objects.get(code="FUNILARIA")

    def test_create_item_operation_with_any_item_so_id(self) -> None:
        """
        ItemOperation can be created with any integer for item_so_id
        because the DB column has no FK constraint — the reference to
        ServiceOrderVersionItem is logical only at this stage.
        """
        fake_id = 999999
        op = ItemOperation.objects.create(
            item_so_id=fake_id,
            operation_type=self.operation_type,
            labor_category=self.labor_category,
            hours="2.50",
            hourly_rate="150.00",
            labor_cost="375.00",
        )
        self.assertEqual(op.item_so_id, fake_id)
        self.assertEqual(op.operation_type, self.operation_type)
        self.assertEqual(op.labor_category, self.labor_category)

    def test_item_operation_ordering(self) -> None:
        """ItemOperation ordering is by id (ascending)."""
        op1 = ItemOperation.objects.create(
            item_so_id=1,
            operation_type=self.operation_type,
            labor_category=self.labor_category,
            hours="1.00",
            hourly_rate="100.00",
            labor_cost="100.00",
        )
        op2 = ItemOperation.objects.create(
            item_so_id=1,
            operation_type=self.operation_type,
            labor_category=self.labor_category,
            hours="2.00",
            hourly_rate="100.00",
            labor_cost="200.00",
        )
        ops = list(ItemOperation.objects.all())
        self.assertLess(ops.index(op1), ops.index(op2))

    def test_item_operation_str(self) -> None:
        """ItemOperation __str__ includes operation type code and hours."""
        op = ItemOperation.objects.create(
            item_so_id=42,
            operation_type=self.operation_type,
            labor_category=self.labor_category,
            hours="3.00",
            hourly_rate="120.00",
            labor_cost="360.00",
        )
        result = str(op)
        self.assertIn("TROCA", result)
        self.assertIn("3.00", result)

    def test_operation_type_protect_on_delete(self) -> None:
        """Deleting an ItemOperationType used by an ItemOperation raises ProtectedError."""
        from django.db.models import ProtectedError

        new_type = ItemOperationType.objects.create(
            code="TEMP_DEL_TEST", label="Temp Delete Test", sort_order=98
        )
        ItemOperation.objects.create(
            item_so_id=100,
            operation_type=new_type,
            labor_category=self.labor_category,
            hours="1.00",
            hourly_rate="50.00",
            labor_cost="50.00",
        )
        with self.assertRaises(ProtectedError):
            new_type.delete()

    def test_labor_category_protect_on_delete(self) -> None:
        """Deleting a LaborCategory used by an ItemOperation raises ProtectedError."""
        from django.db.models import ProtectedError

        new_cat = LaborCategory.objects.create(
            code="TEMP_DEL_CAT", label="Temp Delete Cat", sort_order=97
        )
        ItemOperation.objects.create(
            item_so_id=200,
            operation_type=self.operation_type,
            labor_category=new_cat,
            hours="1.00",
            hourly_rate="80.00",
            labor_cost="80.00",
        )
        with self.assertRaises(ProtectedError):
            new_cat.delete()
