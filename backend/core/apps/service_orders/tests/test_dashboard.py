"""Testes para DashboardStatsView role-based."""
import hashlib

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class DashboardStatsViewTestCase(TenantTestCase):
    """Testes para DashboardStatsView com roles."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="dashboard@dscar.com",
            email_hash=_sha256("dashboard@dscar.com"),
            password="testpass",
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.client.defaults["SERVER_NAME"] = "dscar.localhost"

    def test_unauthenticated_returns_401(self) -> None:
        anon = APIClient()
        anon.defaults["SERVER_NAME"] = "dscar.localhost"
        response = anon.get("/api/v1/service-orders/dashboard/stats/")
        self.assertEqual(response.status_code, 401)

    def test_consultant_role_returns_personal_data(self) -> None:
        response = self.client.get(
            "/api/v1/service-orders/dashboard/stats/?role=CONSULTANT"
        )
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertIn("role", data)
        self.assertIn("my_open", data)
        self.assertIn("my_deliveries_today", data)
        self.assertIn("my_overdue", data)
        self.assertIn("my_completed_week", data)

    def test_manager_role_returns_team_data(self) -> None:
        response = self.client.get(
            "/api/v1/service-orders/dashboard/stats/?role=MANAGER"
        )
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertIn("billing_month", data)
        self.assertIn("delivered_month", data)
        self.assertIn("avg_ticket", data)
        self.assertIn("overdue_count", data)
        self.assertIn("billing_by_type", data)
        self.assertIn("team_productivity", data)
        self.assertIn("overdue_os", data)

    def test_returns_legacy_data_by_default(self) -> None:
        """Sem role param → retorna dados legacy para compatibilidade."""
        response = self.client.get("/api/v1/service-orders/dashboard/stats/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("total_open", response.data)
