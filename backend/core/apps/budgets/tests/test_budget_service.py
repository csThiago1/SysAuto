# apps/budgets/tests/test_budget_service.py
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.budgets.models import Budget, BudgetVersion, BudgetVersionItem
from apps.budgets.services import BudgetService
from apps.items.models import ItemOperation, ItemOperationType, LaborCategory
from apps.persons.models import Person


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Cliente Budget", person_type="CLIENT")


@pytest.mark.django_db
class TestBudgetServiceCreate:

    def test_create_allocates_number_and_v1(self, person):
        budget = BudgetService.create(
            customer=person,
            vehicle_plate="abc1d23",
            vehicle_description="Honda Fit 2019",
            created_by="alice",
        )
        assert budget.number.startswith("OR-")
        assert budget.vehicle_plate == "ABC1D23"  # uppercase
        assert budget.customer == person
        assert budget.active_version.version_number == 1
        assert budget.active_version.status == "draft"
        assert budget.active_version.created_by == "alice"

    def test_create_different_allocates_different_numbers(self, person):
        b1 = BudgetService.create(
            customer=person, vehicle_plate="A1", vehicle_description="x", created_by="a",
        )
        b2 = BudgetService.create(
            customer=person, vehicle_plate="A2", vehicle_description="y", created_by="a",
        )
        assert b1.number != b2.number


@pytest.mark.django_db
class TestBudgetServiceSend:

    def _create_budget_with_items(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="SND1", vehicle_description="Fit",
            created_by="alice",
        )
        v = budget.active_version
        item = BudgetVersionItem.objects.create(
            version=v, description="AMORTECEDOR",
            quantity=Decimal("2"), unit_price=Decimal("500"),
            discount_pct=Decimal("0"), net_price=Decimal("1000"),
            item_type="PART",
        )
        ItemOperation.objects.create(
            item_budget=item,
            operation_type=ItemOperationType.objects.get(code="TROCA"),
            labor_category=LaborCategory.objects.get(code="FUNILARIA"),
            hours=Decimal("2"), hourly_rate=Decimal("40"),
            labor_cost=Decimal("80"),
        )
        return budget, v, item

    def test_send_congela_version(self, person):
        budget, v, _ = self._create_budget_with_items(person)
        sent = BudgetService.send_to_customer(version=v, sent_by="alice")
        assert sent.status == "sent"
        assert sent.sent_at is not None
        assert sent.valid_until is not None
        delta = sent.valid_until - sent.sent_at
        assert 29 <= delta.days <= 31  # 30 dias

    def test_send_calculates_totals(self, person):
        budget, v, _ = self._create_budget_with_items(person)
        BudgetService.send_to_customer(version=v, sent_by="alice")
        v.refresh_from_db()
        # 1 item de 1000 em peça + 80 de MO = 1080
        assert v.parts_total == Decimal("1000")
        assert v.labor_total == Decimal("80")
        assert v.net_total == Decimal("1080")

    def test_send_generates_pdf_stub(self, person):
        _, v, _ = self._create_budget_with_items(person)
        sent = BudgetService.send_to_customer(version=v, sent_by="alice")
        assert sent.pdf_s3_key  # não vazio
        assert sent.pdf_s3_key.startswith("stub://")

    def test_send_computes_content_hash(self, person):
        _, v, _ = self._create_budget_with_items(person)
        sent = BudgetService.send_to_customer(version=v, sent_by="alice")
        assert len(sent.content_hash) == 64  # sha256 hex

    def test_send_only_draft(self, person):
        _, v, _ = self._create_budget_with_items(person)
        v.status = "sent"
        v.save()
        with pytest.raises(ValidationError):
            BudgetService.send_to_customer(version=v, sent_by="alice")


@pytest.mark.django_db
class TestBudgetServiceApprove:

    def _prepare_sent_version(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="A1", vehicle_description="x",
            created_by="alice",
        )
        v = budget.active_version
        BudgetVersionItem.objects.create(
            version=v, description="PEÇA",
            quantity=Decimal("1"), unit_price=Decimal("500"),
            net_price=Decimal("500"), item_type="PART",
        )
        BudgetService.send_to_customer(version=v, sent_by="alice")
        v.refresh_from_db()
        return budget, v

    def test_approve_creates_os(self, person):
        budget, v = self._prepare_sent_version(person)
        from apps.service_orders.models import ServiceOrder
        os = BudgetService.approve(
            version=v, approved_by="cliente-whatsapp",
            evidence_s3_key="whatsapp://ok-print.jpg",
        )
        assert isinstance(os, ServiceOrder)
        assert os.customer_type == "PARTICULAR"
        assert os.source_budget == budget
        assert os.active_version.items.count() == 1

    def test_approve_marks_version_approved(self, person):
        budget, v = self._prepare_sent_version(person)
        BudgetService.approve(
            version=v, approved_by="alice", evidence_s3_key="s3://ev.pdf",
        )
        v.refresh_from_db()
        assert v.status == "approved"
        assert v.approved_by == "alice"
        assert v.approved_at is not None
        assert v.approval_evidence_s3_key == "s3://ev.pdf"

    def test_approve_supersedes_other_versions(self, person):
        budget, v1 = self._prepare_sent_version(person)
        # Cria v2 também em sent
        v2 = BudgetVersion.objects.create(
            budget=budget, version_number=2, status="sent",
        )
        BudgetService.approve(version=v1, approved_by="alice", evidence_s3_key="")
        v2.refresh_from_db()
        assert v2.status == "superseded"

    def test_approve_links_budget_to_os(self, person):
        budget, v = self._prepare_sent_version(person)
        os = BudgetService.approve(version=v, approved_by="alice", evidence_s3_key="")
        budget.refresh_from_db()
        assert budget.service_order == os

    def test_approve_rejects_non_sent(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="X", vehicle_description="y",
            created_by="alice",
        )
        v = budget.active_version  # draft
        with pytest.raises(ValidationError):
            BudgetService.approve(version=v, approved_by="alice", evidence_s3_key="")

    def test_approve_rejects_expired(self, person):
        budget, v = self._prepare_sent_version(person)
        # Forçar expirado
        v.valid_until = timezone.now() - timedelta(days=1)
        v.save()
        with pytest.raises(ValidationError):
            BudgetService.approve(version=v, approved_by="alice", evidence_s3_key="")


@pytest.mark.django_db
class TestBudgetServiceReject:

    def test_reject_marks_version(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="Z", vehicle_description="w", created_by="a",
        )
        v = budget.active_version
        v.status = "sent"
        v.save()
        BudgetService.reject(version=v)
        v.refresh_from_db()
        assert v.status == "rejected"

    def test_reject_only_sent(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="Z2", vehicle_description="w", created_by="a",
        )
        v = budget.active_version  # draft
        with pytest.raises(ValidationError):
            BudgetService.reject(version=v)


@pytest.mark.django_db
class TestBudgetServiceRevision:

    def test_revision_creates_v2_draft(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="R", vehicle_description="w", created_by="a",
        )
        v = budget.active_version
        v.status = "sent"
        v.save()
        new_v = BudgetService.request_revision(version=v)
        assert new_v.version_number == 2
        assert new_v.status == "draft"
        v.refresh_from_db()
        assert v.status == "revision"

    def test_revision_copies_items(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="R2", vehicle_description="w", created_by="a",
        )
        v = budget.active_version
        BudgetVersionItem.objects.create(
            version=v, description="X",
            quantity=Decimal("1"), unit_price=Decimal("100"),
            net_price=Decimal("100"),
        )
        v.status = "sent"
        v.save()
        new_v = BudgetService.request_revision(version=v)
        assert new_v.items.count() == 1
