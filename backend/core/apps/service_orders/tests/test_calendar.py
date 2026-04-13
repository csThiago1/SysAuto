"""Testes para o endpoint de calendário de OS."""
import hashlib
from datetime import date, datetime, timezone

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class CalendarViewTestCase(TenantTestCase):
    """Testes para CalendarView."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="calendar@dscar.com",
            email_hash=_sha256("calendar@dscar.com"),
            password="x",
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.client.defaults["SERVER_NAME"] = "dscar.localhost"

    def _make_os(
        self,
        number: int,
        scheduling_date: datetime | None = None,
        estimated_delivery_date: date | None = None,
    ) -> ServiceOrder:
        return ServiceOrder.objects.create(
            number=number,
            plate="CAL0001",
            customer_name="Cliente Agenda",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
            scheduling_date=scheduling_date,
            estimated_delivery_date=estimated_delivery_date,
        )

    def test_requires_date_range(self) -> None:
        response = self.client.get("/api/v1/service-orders/calendar/")
        self.assertEqual(response.status_code, 400)

    def test_returns_os_with_scheduling_date_in_range(self) -> None:
        self._make_os(
            number=9001,
            scheduling_date=datetime(2026, 4, 15, 9, 0, tzinfo=timezone.utc),
        )
        response = self.client.get(
            "/api/v1/service-orders/calendar/?date_start=2026-04-14&date_end=2026-04-16"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertIsNotNone(response.data[0]["scheduling_date"])

    def test_returns_os_with_delivery_date_in_range(self) -> None:
        self._make_os(
            number=9002,
            estimated_delivery_date=date(2026, 4, 20),
        )
        response = self.client.get(
            "/api/v1/service-orders/calendar/?date_start=2026-04-19&date_end=2026-04-21"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["estimated_delivery_date"], "2026-04-20")

    def test_excludes_os_outside_range(self) -> None:
        self._make_os(
            number=9003,
            scheduling_date=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
        )
        response = self.client.get(
            "/api/v1/service-orders/calendar/?date_start=2026-04-01&date_end=2026-04-30"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)
