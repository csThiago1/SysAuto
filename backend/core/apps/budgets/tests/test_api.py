from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.budgets.models import Budget, BudgetVersionItem
from apps.budgets.services import BudgetService
from apps.persons.models import Person


User = get_user_model()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="budget-api", password="secret")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="API Cliente", person_type="CLIENT")


@pytest.mark.django_db
class TestBudgetAPI:

    def test_create_budget(self, auth_client, person):
        resp = auth_client.post(
            "/api/v1/budgets/",
            data={
                "customer_id": person.pk,
                "vehicle_plate": "abc1d23",
                "vehicle_description": "Honda Fit",
            },
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["number"].startswith("OR-")
        assert data["vehicle_plate"] == "ABC1D23"
        assert data["active_version"]["version_number"] == 1
        assert data["active_version"]["status"] == "draft"

    def test_list_budgets(self, auth_client, person):
        BudgetService.create(
            customer=person, vehicle_plate="A1", vehicle_description="x", created_by="u",
        )
        resp = auth_client.get("/api/v1/budgets/")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 1

    def test_retrieve_budget(self, auth_client, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="A2", vehicle_description="x", created_by="u",
        )
        resp = auth_client.get(f"/api/v1/budgets/{budget.pk}/")
        assert resp.status_code == 200
        assert resp.json()["number"] == budget.number


@pytest.mark.django_db
class TestBudgetVersionActions:

    def _create_budget_with_item(self, person: Person) -> tuple[Budget, object]:
        budget = BudgetService.create(
            customer=person, vehicle_plate="X1", vehicle_description="x", created_by="u",
        )
        v = budget.active_version
        BudgetVersionItem.objects.create(
            version=v, description="Peça",
            quantity=Decimal("1"), unit_price=Decimal("100"),
            net_price=Decimal("100"), item_type="PART",
        )
        return budget, v

    def test_send_version(self, auth_client, person):
        budget, v = self._create_budget_with_item(person)
        resp = auth_client.post(
            f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/", format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "sent"

    def test_send_twice_fails(self, auth_client, person):
        budget, v = self._create_budget_with_item(person)
        auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")
        resp = auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")
        assert resp.status_code == 400

    def test_approve_creates_os(self, auth_client, person):
        budget, v = self._create_budget_with_item(person)
        auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")
        resp = auth_client.post(
            f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/approve/",
            data={"approved_by": "cliente", "evidence_s3_key": "whatsapp://ok"},
            format="json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"]["status"] == "approved"
        assert data["service_order"]["customer_type"] == "PARTICULAR"

    def test_reject(self, auth_client, person):
        budget, v = self._create_budget_with_item(person)
        auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")
        resp = auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/reject/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

    def test_revision_creates_v2(self, auth_client, person):
        budget, v = self._create_budget_with_item(person)
        auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")
        resp = auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/revision/")
        assert resp.status_code == 201
        assert resp.json()["version_number"] == 2

    def test_clone_budget(self, auth_client, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="CLN", vehicle_description="x", created_by="u",
        )
        v = budget.active_version
        v.status = "rejected"
        v.save()
        resp = auth_client.post(f"/api/v1/budgets/{budget.pk}/clone/")
        assert resp.status_code == 201
        data = resp.json()
        assert data["number"] != budget.number


@pytest.mark.django_db
class TestBudgetItemAPI:

    def test_create_item_in_draft(self, auth_client, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="I1", vehicle_description="x", created_by="u",
        )
        v = budget.active_version

        resp = auth_client.post(
            f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/items/",
            data={
                "description": "Amortecedor",
                "quantity": "2",
                "unit_price": "500",
                "net_price": "1000",
                "item_type": "PART",
                "operations": [
                    {
                        "operation_type_code": "TROCA",
                        "labor_category_code": "FUNILARIA",
                        "hours": "2.00",
                        "hourly_rate": "40",
                    }
                ],
            },
            format="json",
        )
        assert resp.status_code == 201
        assert v.items.count() == 1
        assert v.items.first().operations.count() == 1

    def test_cannot_add_item_to_sent(self, auth_client, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="I2", vehicle_description="x", created_by="u",
        )
        v = budget.active_version
        BudgetVersionItem.objects.create(
            version=v, description="x",
            quantity=Decimal("1"), unit_price=Decimal("1"), net_price=Decimal("1"),
        )
        auth_client.post(f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/send/")

        resp = auth_client.post(
            f"/api/v1/budgets/{budget.pk}/versions/{v.pk}/items/",
            data={"description": "Y", "quantity": "1", "unit_price": "1", "net_price": "1"},
            format="json",
        )
        assert resp.status_code == 400
