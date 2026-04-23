"""API tests for budgets endpoints."""
from __future__ import annotations

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.items.models import NumberSequence
from apps.persons.models import Person
from apps.budgets.models import Budget, BudgetVersion


def _setup_seq() -> None:
    NumberSequence.objects.get_or_create(
        sequence_type="BUDGET",
        defaults={"prefix": "ORC-2026-", "padding": 6, "next_number": 1},
    )


class BudgetViewsBase(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        _setup_seq()
        self.client = APIClient()
        self.client.defaults["HTTP_X_TENANT_DOMAIN"] = self.domain.domain

        self.manager = GlobalUser.objects.create_user(
            email="manager@test.com", password="pass"
        )
        self.consultant = GlobalUser.objects.create_user(
            email="consultant@test.com", password="pass"
        )
        self.customer = Person.objects.create(
            full_name="Cliente API", person_kind="PF"
        )

    def _auth(self, role: str = "MANAGER") -> None:
        user = self.manager if role in ("MANAGER", "ADMIN", "OWNER") else self.consultant
        self.client.force_authenticate(user=user, token={"role": role})

    def _create_budget(self) -> Budget:
        from apps.budgets.services import BudgetService
        return BudgetService.create(
            customer=self.customer,
            vehicle_plate="ABC1D23",
            vehicle_description="Toyota Corolla 2020",
            created_by="test",
        )


class TestBudgetListCreate(BudgetViewsBase):
    def test_list_as_consultant(self) -> None:
        self._auth("CONSULTANT")
        self._create_budget()
        response = self.client.get("/api/v1/budgets/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_create_as_consultant(self) -> None:
        self._auth("CONSULTANT")
        response = self.client.post("/api/v1/budgets/", {
            "customer_id": self.customer.pk,
            "vehicle_plate": "XYZ9876",
            "vehicle_description": "Honda Civic 2022",
        })
        self.assertEqual(response.status_code, 201)
        self.assertIn("ORC-2026-", response.data["number"])

    def test_create_requires_auth(self) -> None:
        response = self.client.post("/api/v1/budgets/", {
            "customer_id": self.customer.pk,
            "vehicle_plate": "XYZ9876",
            "vehicle_description": "Honda Civic",
        })
        self.assertEqual(response.status_code, 401)


class TestBudgetVersionActions(BudgetViewsBase):
    def setUp(self) -> None:
        super().setUp()
        self.budget = self._create_budget()
        self.version = self.budget.active_version

    def test_list_versions(self) -> None:
        self._auth("CONSULTANT")
        url = f"/api/v1/budgets/{self.budget.pk}/versions/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_send_as_consultant(self) -> None:
        self._auth("CONSULTANT")
        url = f"/api/v1/budgets/{self.budget.pk}/versions/{self.version.pk}/send/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "sent")

    def test_approve_as_manager(self) -> None:
        self._auth("CONSULTANT")
        send_url = f"/api/v1/budgets/{self.budget.pk}/versions/{self.version.pk}/send/"
        self.client.post(send_url)
        self._auth("MANAGER")
        approve_url = f"/api/v1/budgets/{self.budget.pk}/versions/{self.version.pk}/approve/"
        response = self.client.post(approve_url, {"approved_by": "gerente"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("service_order", response.data)

    def test_approve_as_consultant_denied(self) -> None:
        self._auth("CONSULTANT")
        send_url = f"/api/v1/budgets/{self.budget.pk}/versions/{self.version.pk}/send/"
        self.client.post(send_url)
        approve_url = f"/api/v1/budgets/{self.budget.pk}/versions/{self.version.pk}/approve/"
        response = self.client.post(approve_url, {"approved_by": "consultor"})
        self.assertEqual(response.status_code, 403)

    def test_reject_as_manager(self) -> None:
        self._auth("CONSULTANT")
        self.client.post(f"/api/v1/budgets/{self.budget.pk}/versions/{self.version.pk}/send/")
        self._auth("MANAGER")
        response = self.client.post(
            f"/api/v1/budgets/{self.budget.pk}/versions/{self.version.pk}/reject/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "rejected")


class TestBudgetVersionItems(BudgetViewsBase):
    def setUp(self) -> None:
        super().setUp()
        self.budget = self._create_budget()
        self.version = self.budget.active_version

    def _item_url(self) -> str:
        return (
            f"/api/v1/budgets/{self.budget.pk}"
            f"/versions/{self.version.pk}/items/"
        )

    def test_add_item_to_draft(self) -> None:
        self._auth("CONSULTANT")
        response = self.client.post(self._item_url(), {
            "description": "Parabrisa",
            "item_type": "PART",
            "quantity": "1.000",
            "unit_price": "500.00",
            "net_price": "500.00",
        })
        self.assertEqual(response.status_code, 201)

    def test_add_item_blocked_after_send(self) -> None:
        self._auth("CONSULTANT")
        self.client.post(
            f"/api/v1/budgets/{self.budget.pk}/versions/{self.version.pk}/send/"
        )
        response = self.client.post(self._item_url(), {
            "description": "Item extra",
            "item_type": "SERVICE",
            "quantity": "1.000",
            "unit_price": "100.00",
            "net_price": "100.00",
        })
        self.assertEqual(response.status_code, 400)
