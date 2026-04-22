from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from freezegun import freeze_time

from apps.budgets.models import Budget, BudgetVersion
from apps.budgets.services import BudgetService
from apps.budgets.tasks import expire_stale_budgets
from apps.persons.models import Person


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Expire Test", person_type="CLIENT")


@pytest.mark.django_db
class TestExpireStaleBudgets:

    @freeze_time("2026-04-01 10:00:00")
    def test_expires_budget_past_30_days(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="E1", vehicle_description="x",
            created_by="alice",
        )
        v = budget.active_version
        BudgetService.send_to_customer(version=v, sent_by="alice")

        with freeze_time("2026-05-05 10:00:00"):  # +34 dias
            count = expire_stale_budgets()

        v.refresh_from_db()
        assert count == 1
        assert v.status == "expired"

    @freeze_time("2026-04-01 10:00:00")
    def test_doesnt_expire_recent_sent(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="E2", vehicle_description="x",
            created_by="alice",
        )
        v = budget.active_version
        BudgetService.send_to_customer(version=v, sent_by="alice")

        with freeze_time("2026-04-10 10:00:00"):  # +9 dias
            count = expire_stale_budgets()

        v.refresh_from_db()
        assert count == 0
        assert v.status == "sent"

    @freeze_time("2026-04-01 10:00:00")
    def test_doesnt_expire_approved(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="E3", vehicle_description="x",
            created_by="alice",
        )
        v = budget.active_version
        BudgetService.send_to_customer(version=v, sent_by="alice")
        v.status = "approved"
        v.save()

        with freeze_time("2026-05-05 10:00:00"):
            expire_stale_budgets()

        v.refresh_from_db()
        assert v.status == "approved"  # não muda


@pytest.mark.django_db
class TestClone:

    def test_clone_preserves_cloned_from(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="CL", vehicle_description="x", created_by="a",
        )
        v = budget.active_version
        v.status = "rejected"
        v.save()

        new_budget = BudgetService.clone(source_budget=budget, created_by="bob")
        assert new_budget.cloned_from == budget
        assert new_budget.number != budget.number
        assert new_budget.customer == budget.customer
        assert new_budget.active_version.version_number == 1
        assert new_budget.active_version.status == "draft"

    def test_clone_copies_items_from_latest_non_draft(self, person):
        from apps.budgets.models import BudgetVersionItem

        budget = BudgetService.create(
            customer=person, vehicle_plate="CL2", vehicle_description="x", created_by="a",
        )
        v = budget.active_version
        BudgetVersionItem.objects.create(
            version=v, description="PEÇA CLONE",
            quantity=Decimal("1"), unit_price=Decimal("500"),
            net_price=Decimal("500"), item_type="PART",
        )
        v.status = "expired"
        v.save()

        new_budget = BudgetService.clone(source_budget=budget, created_by="bob")
        assert new_budget.active_version.items.count() == 1
        new_item = new_budget.active_version.items.first()
        assert new_item.description == "PEÇA CLONE"

    def test_clone_empty_source_still_works(self, person):
        """Source sem items ainda assim cria clone válido."""
        budget = BudgetService.create(
            customer=person, vehicle_plate="CL3", vehicle_description="x", created_by="a",
        )
        new_budget = BudgetService.clone(source_budget=budget, created_by="bob")
        assert new_budget.active_version.items.count() == 0
