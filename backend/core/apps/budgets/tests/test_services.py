"""Tests for PDFService.render_budget, ServiceOrderService.create_from_budget,
and BudgetService state machine.
"""
from __future__ import annotations

from django_tenants.test.cases import TenantTestCase

from apps.items.models import NumberSequence
from apps.persons.models import Person
from apps.budgets.models import Budget, BudgetVersion, BudgetVersionItem
from apps.pdf_engine.services import PDFService


# ── Task 3: PDFService + create_from_budget ───────────────────────────────────


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


# ── Task 4: BudgetService state machine ──────────────────────────────────────

from apps.budgets.services import BudgetService


def _make_customer(name: str = "Test Customer") -> Person:
    return Person.objects.create(full_name=name, person_kind="PF")


def _make_budget(customer: Person | None = None) -> Budget:
    NumberSequence.objects.get_or_create(
        sequence_type="BUDGET",
        defaults={"prefix": "ORC-2026-", "padding": 6, "next_number": 1},
    )
    if customer is None:
        customer = _make_customer()
    return BudgetService.create(
        customer=customer,
        vehicle_plate="ABC1D23",
        vehicle_description="Toyota Corolla 2020",
        created_by="test_user",
    )


class TestBudgetServiceCreate(TenantTestCase):
    def test_create_generates_number(self) -> None:
        budget = _make_budget()
        self.assertTrue(budget.number.startswith("ORC-2026-"))

    def test_create_generates_draft_version(self) -> None:
        budget = _make_budget()
        version = budget.active_version
        self.assertIsNotNone(version)
        self.assertEqual(version.status, "draft")
        self.assertEqual(version.version_number, 1)

    def test_create_normalizes_plate(self) -> None:
        budget = _make_budget()
        self.assertEqual(budget.vehicle_plate, "ABC1D23")


class TestBudgetServiceSendToCustomer(TenantTestCase):
    def test_send_freezes_version(self) -> None:
        budget = _make_budget()
        version = budget.active_version
        BudgetService.send_to_customer(version=version, sent_by="test_user")
        version.refresh_from_db()
        self.assertEqual(version.status, "sent")
        self.assertIsNotNone(version.sent_at)
        self.assertIsNotNone(version.valid_until)
        self.assertTrue(version.is_frozen())

    def test_send_draft_only(self) -> None:
        from rest_framework.exceptions import ValidationError
        budget = _make_budget()
        version = budget.active_version
        BudgetService.send_to_customer(version=version, sent_by="test_user")
        version.refresh_from_db()
        with self.assertRaises(ValidationError):
            BudgetService.send_to_customer(version=version, sent_by="test_user")

    def test_send_calculates_totals(self) -> None:
        budget = _make_budget()
        version = budget.active_version
        BudgetVersionItem.objects.create(
            version=version,
            description="Parabrisa",
            item_type="PART",
            quantity=1,
            unit_price="500.00",
            net_price="500.00",
        )
        BudgetService.send_to_customer(version=version, sent_by="test_user")
        version.refresh_from_db()
        self.assertEqual(version.parts_total, 500)


class TestBudgetServiceApprove(TenantTestCase):
    def test_approve_creates_service_order(self) -> None:
        budget = _make_budget()
        version = budget.active_version
        BudgetService.send_to_customer(version=version, sent_by="test_user")
        version.refresh_from_db()

        os = BudgetService.approve(version=version, approved_by="manager")

        self.assertEqual(os.plate, "ABC1D23")
        self.assertEqual(os.status, "reception")
        version.refresh_from_db()
        self.assertEqual(version.status, "approved")

    def test_approve_links_budget_to_os(self) -> None:
        budget = _make_budget()
        version = budget.active_version
        BudgetService.send_to_customer(version=version, sent_by="test_user")
        version.refresh_from_db()
        BudgetService.approve(version=version, approved_by="manager")
        budget.refresh_from_db()
        self.assertIsNotNone(budget.service_order)

    def test_approve_supersedes_sibling_versions(self) -> None:
        budget = _make_budget()
        v1 = budget.active_version
        BudgetService.send_to_customer(version=v1, sent_by="test_user")
        v1.refresh_from_db()
        v2_draft = BudgetService.request_revision(version=v1)

        BudgetService.send_to_customer(version=v2_draft, sent_by="test_user")
        v2_draft.refresh_from_db()

        BudgetService.approve(version=v2_draft, approved_by="manager")
        v1.refresh_from_db()
        self.assertEqual(v1.status, "superseded")

    def test_approve_sent_only(self) -> None:
        from rest_framework.exceptions import ValidationError
        budget = _make_budget()
        version = budget.active_version
        with self.assertRaises(ValidationError):
            BudgetService.approve(version=version, approved_by="manager")


class TestBudgetServiceReject(TenantTestCase):
    def test_reject_sent_version(self) -> None:
        budget = _make_budget()
        version = budget.active_version
        BudgetService.send_to_customer(version=version, sent_by="test_user")
        version.refresh_from_db()
        BudgetService.reject(version=version)
        version.refresh_from_db()
        self.assertEqual(version.status, "rejected")

    def test_reject_draft_raises(self) -> None:
        from rest_framework.exceptions import ValidationError
        budget = _make_budget()
        version = budget.active_version
        with self.assertRaises(ValidationError):
            BudgetService.reject(version=version)


class TestBudgetServiceRevision(TenantTestCase):
    def test_revision_creates_new_draft(self) -> None:
        budget = _make_budget()
        version = budget.active_version
        BudgetService.send_to_customer(version=version, sent_by="test_user")
        version.refresh_from_db()
        new_v = BudgetService.request_revision(version=version)
        self.assertEqual(new_v.status, "draft")
        self.assertEqual(new_v.version_number, 2)
        version.refresh_from_db()
        self.assertEqual(version.status, "revision")

    def test_revision_copies_items(self) -> None:
        budget = _make_budget()
        version = budget.active_version
        BudgetVersionItem.objects.create(
            version=version,
            description="Porta dianteira",
            item_type="PART",
            quantity=1,
            unit_price="300.00",
            net_price="300.00",
        )
        BudgetService.send_to_customer(version=version, sent_by="test_user")
        version.refresh_from_db()
        new_v = BudgetService.request_revision(version=version)
        self.assertEqual(new_v.items.count(), 1)
        self.assertEqual(new_v.items.first().description, "Porta dianteira")


class TestBudgetServiceClone(TenantTestCase):
    def test_clone_creates_new_budget(self) -> None:
        source = _make_budget()
        v1 = source.active_version
        BudgetService.send_to_customer(version=v1, sent_by="test_user")
        v1.refresh_from_db()
        BudgetService.reject(version=v1)

        new_b = BudgetService.clone(source_budget=source, created_by="user")

        self.assertNotEqual(new_b.number, source.number)
        self.assertEqual(new_b.cloned_from, source)
        self.assertEqual(new_b.active_version.status, "draft")


class TestBudgetServiceExpire(TenantTestCase):
    def test_expire_stale_versions(self) -> None:
        from django.utils import timezone
        from datetime import timedelta

        budget = _make_budget()
        version = budget.active_version
        BudgetService.send_to_customer(version=version, sent_by="test_user")
        version.refresh_from_db()
        version.valid_until = timezone.now() - timedelta(days=1)
        version.save(update_fields=["valid_until"])

        count = BudgetService.expire_stale_versions()

        self.assertEqual(count, 1)
        version.refresh_from_db()
        self.assertEqual(version.status, "expired")
