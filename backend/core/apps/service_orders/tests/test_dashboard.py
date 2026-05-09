"""Testes para DashboardStatsView role-based."""
import hashlib
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


URL = "/api/v1/service-orders/dashboard/stats/"


class DashboardStatsViewTestCase(TenantTestCase):
    """Testes para DashboardStatsView com roles."""

    def setUp(self) -> None:
        super().setUp()
        self.user, _ = GlobalUser.objects.get_or_create(
            email="dashboard@dscar.com",
            defaults={
                "email_hash": _sha256("dashboard@dscar.com"),
                "password": "testpass",
            },
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        # TenantTestCase cria tenant com domínio acessível via self.tenant
        domain = self.tenant.get_primary_domain().domain
        self.client.defaults["SERVER_NAME"] = domain

    def _make_os(self, number: int, **kwargs) -> ServiceOrder:
        """Helper para criar OS de teste."""
        defaults = {
            "number": number,
            "plate": f"TST{number:04d}",
            "make": "Fiat",
            "model": "Uno",
            "customer_name": "Teste",
            "customer_type": "private",
            "os_type": "bodywork",
            "created_by": self.user,
        }
        defaults.update(kwargs)
        return ServiceOrder.objects.create(**defaults)

    # ── Auth ──────────────────────────────────────────────────────────────────

    def test_unauthenticated_returns_401(self) -> None:
        anon = APIClient()
        domain = self.tenant.get_primary_domain().domain
        anon.defaults["SERVER_NAME"] = domain
        response = anon.get(URL)
        self.assertEqual(response.status_code, 401)

    # ── Technician (fallback, sem role no JWT) ────────────────────────────────

    def test_technician_returns_personal_queue(self) -> None:
        """Sem role no JWT → retorna visão de técnico."""
        self._make_os(1001, status=ServiceOrderStatus.PAINTING)
        self._make_os(1002, status=ServiceOrderStatus.BODYWORK)

        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data["role"], "technician")
        self.assertIn("my_open", data)
        self.assertIn("my_by_status", data)
        self.assertIn("my_os", data)
        self.assertIn("my_next_os", data)
        self.assertIn("my_completed_month", data)
        self.assertIn("my_avg_days", data)
        self.assertEqual(data["my_open"], 2)

    def test_technician_my_os_is_ordered_list(self) -> None:
        """my_os retorna fila com campos id, number, plate, vehicle, status."""
        today = timezone.localdate()
        self._make_os(
            2001,
            status=ServiceOrderStatus.PAINTING,
            estimated_delivery_date=today + timedelta(days=1),
        )
        self._make_os(
            2002,
            status=ServiceOrderStatus.BODYWORK,
            estimated_delivery_date=today,
        )
        response = self.client.get(URL)
        data = response.data
        self.assertIsInstance(data["my_os"], list)
        self.assertGreater(len(data["my_os"]), 0)
        first = data["my_os"][0]
        self.assertIn("id", first)
        self.assertIn("number", first)
        self.assertIn("plate", first)
        self.assertIn("vehicle", first)
        self.assertIn("status", first)
        # OS 2002 deve vir primeiro (estimated_delivery_date mais próxima)
        self.assertEqual(first["number"], 2002)

    # ── Consultant ────────────────────────────────────────────────────────────

    @patch("apps.service_orders.views.dashboard._get_role", return_value="CONSULTANT")
    def test_consultant_returns_personal_data(self, mock_role) -> None:
        self._make_os(3001, status=ServiceOrderStatus.RECEPTION)
        self._make_os(3002, status=ServiceOrderStatus.WAITING_AUTH)
        self._make_os(3003, status=ServiceOrderStatus.WAITING_PARTS)

        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data["role"], "consultant")
        # Campos originais
        self.assertIn("my_open", data)
        self.assertIn("my_deliveries_today", data)
        self.assertIn("my_overdue", data)
        self.assertIn("my_completed_week", data)
        self.assertIn("my_recent_os", data)
        # Novos campos
        self.assertIn("my_by_status", data)
        self.assertIn("my_waiting_auth", data)
        self.assertIn("my_waiting_parts", data)
        self.assertIn("my_scheduled_today", data)
        self.assertIn("my_next_deliveries", data)
        # Valores
        self.assertEqual(data["my_open"], 3)
        self.assertEqual(data["my_waiting_auth"], 1)
        self.assertEqual(data["my_waiting_parts"], 1)

    @patch("apps.service_orders.views.dashboard._get_role", return_value="CONSULTANT")
    def test_consultant_by_status_matches_open_os(self, mock_role) -> None:
        self._make_os(3010, status=ServiceOrderStatus.PAINTING)
        self._make_os(3011, status=ServiceOrderStatus.PAINTING)
        self._make_os(3012, status=ServiceOrderStatus.BODYWORK)

        response = self.client.get(URL)
        by_status = response.data["my_by_status"]
        self.assertEqual(by_status.get("painting", 0), 2)
        self.assertEqual(by_status.get("bodywork", 0), 1)

    # ── Manager ───────────────────────────────────────────────────────────────

    @patch("apps.service_orders.views.dashboard._get_role", return_value="MANAGER")
    def test_manager_returns_financial_and_pipeline(self, mock_role) -> None:
        self._make_os(4001, status=ServiceOrderStatus.RECEPTION)
        self._make_os(4002, status=ServiceOrderStatus.PAINTING)

        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data["role"], "manager")
        # Campos originais
        self.assertIn("billing_month", data)
        self.assertIn("delivered_month", data)
        self.assertIn("avg_ticket", data)
        self.assertIn("overdue_count", data)
        self.assertIn("billing_by_type", data)
        self.assertIn("billing_last_6_months", data)
        self.assertIn("team_productivity", data)
        self.assertIn("overdue_os", data)
        # Novos campos
        self.assertIn("total_open", data)
        self.assertIn("by_status", data)
        self.assertIn("scheduled_today", data)
        # Pipeline tem as OS criadas
        self.assertEqual(data["total_open"], 2)
        self.assertEqual(data["by_status"].get("reception", 0), 1)
        self.assertEqual(data["by_status"].get("painting", 0), 1)

    @patch("apps.service_orders.views.dashboard._get_role", return_value="MANAGER")
    def test_manager_overdue_os_format(self, mock_role) -> None:
        yesterday = timezone.localdate() - timedelta(days=1)
        self._make_os(
            4010,
            status=ServiceOrderStatus.BODYWORK,
            estimated_delivery_date=yesterday,
        )
        response = self.client.get(URL)
        data = response.data
        self.assertEqual(data["overdue_count"], 1)
        self.assertEqual(len(data["overdue_os"]), 1)
        overdue = data["overdue_os"][0]
        self.assertIn("days_overdue", overdue)
        self.assertEqual(overdue["days_overdue"], 1)
