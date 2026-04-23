"""Tests for PDFService.render_budget and ServiceOrderService.create_from_budget."""
from __future__ import annotations

from django_tenants.test.cases import TenantTestCase

from apps.items.models import NumberSequence
from apps.persons.models import Person
from apps.budgets.models import Budget, BudgetVersion
from apps.pdf_engine.services import PDFService


class TestRenderBudget(TenantTestCase):
    """PDFService.render_budget returns non-empty bytes."""

    def _make_version(self) -> BudgetVersion:
        NumberSequence.objects.get_or_create(
            sequence_type="BUDGET",
            defaults={"prefix": "ORC-2026-", "padding": 6, "next_number": 1},
        )
        customer = Person.objects.create(full_name="Cliente Teste", person_kind="PF")
        budget = Budget.objects.create(
            number="ORC-2026-000001",
            customer=customer,
            vehicle_plate="ABC1D23",
            vehicle_description="Toyota Corolla 2020",
        )
        return BudgetVersion.objects.create(
            budget=budget, version_number=1, status="draft", created_by="test",
        )

    def test_render_budget_returns_bytes(self) -> None:
        version = self._make_version()
        result = PDFService.render_budget(version)
        self.assertIsInstance(result, bytes)
        self.assertGreater(len(result), 0)

    def test_budget_pdf_key_format(self) -> None:
        key = PDFService.budget_pdf_key("ORC-2026-000001", 1)
        self.assertTrue(key.startswith("budgets/ORC-2026-000001/v1-"))
        self.assertTrue(key.endswith(".pdf"))


class TestCreateFromBudget(TenantTestCase):
    """ServiceOrderService.create_from_budget creates a ServiceOrder."""

    def test_creates_service_order(self) -> None:
        from apps.service_orders.services import ServiceOrderService

        customer = Person.objects.create(full_name="João Silva", person_kind="PF")
        budget = Budget.objects.create(
            number="ORC-2026-000001",
            customer=customer,
            vehicle_plate="XYZ9876",
            vehicle_description="Honda Civic 2022",
        )
        version = BudgetVersion.objects.create(
            budget=budget, version_number=1, status="sent", created_by="test",
        )

        os = ServiceOrderService.create_from_budget(version=version)

        self.assertEqual(os.plate, "XYZ9876")
        self.assertEqual(os.customer_type, "private")
        self.assertEqual(os.status, "reception")
        self.assertIsNotNone(os.number)
