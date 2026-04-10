"""
Testes para o endpoint GET /api/v1/service-orders/overdue/ — Sprint 10.
"""
import hashlib
from datetime import date, timedelta

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class OverdueEndpointTestCase(TenantTestCase):
    """Testes para o endpoint de OS vencidas/com entrega hoje."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="overdue@dscar.com",
            email_hash=_sha256("overdue@dscar.com"),
            password="x",
        )
        today = date.today()
        cls.os_overdue = ServiceOrder.objects.create(
            number=8001, plate="OVR0001", customer_name="Vencida",
            status=ServiceOrderStatus.REPAIR, created_by=cls.user,
            estimated_delivery_date=today - timedelta(days=2),
        )
        cls.os_due_today = ServiceOrder.objects.create(
            number=8002, plate="DUE0001", customer_name="Hoje",
            status=ServiceOrderStatus.REPAIR, created_by=cls.user,
            estimated_delivery_date=today,
        )
        cls.os_delivered = ServiceOrder.objects.create(
            number=8003, plate="DEL0001", customer_name="Entregue",
            status=ServiceOrderStatus.DELIVERED, created_by=cls.user,
            estimated_delivery_date=today - timedelta(days=1),
        )
        cls.os_cancelled = ServiceOrder.objects.create(
            number=8004, plate="CAN0001", customer_name="Cancelada",
            status=ServiceOrderStatus.CANCELLED, created_by=cls.user,
            estimated_delivery_date=today - timedelta(days=1),
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.client.defaults["SERVER_NAME"] = "dscar.localhost"

    def test_overdue_excludes_delivered_and_cancelled(self) -> None:
        resp = self.client.get("/api/v1/service-orders/overdue/")
        self.assertEqual(resp.status_code, 200)
        ids = [item["id"] for item in resp.data]
        self.assertIn(str(self.os_overdue.id), ids)
        self.assertIn(str(self.os_due_today.id), ids)
        self.assertNotIn(str(self.os_delivered.id), ids)
        self.assertNotIn(str(self.os_cancelled.id), ids)

    def test_overdue_urgency_fields(self) -> None:
        resp = self.client.get("/api/v1/service-orders/overdue/")
        self.assertEqual(resp.status_code, 200)
        items = {item["id"]: item for item in resp.data}
        overdue_item = items.get(str(self.os_overdue.id))
        due_today_item = items.get(str(self.os_due_today.id))
        self.assertIsNotNone(overdue_item)
        self.assertIsNotNone(due_today_item)
        self.assertEqual(overdue_item["urgency"], "overdue")
        self.assertEqual(due_today_item["urgency"], "due_today")
        self.assertGreater(overdue_item["days_overdue"], 0)
        self.assertEqual(due_today_item["days_overdue"], 0)

    def test_overdue_days_ahead_includes_upcoming(self) -> None:
        today = date.today()
        future_os = ServiceOrder.objects.create(
            number=8005, plate="FUT0001", customer_name="Futuro",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
            estimated_delivery_date=today + timedelta(days=3),
        )
        try:
            resp = self.client.get("/api/v1/service-orders/overdue/?days_ahead=5")
            self.assertEqual(resp.status_code, 200)
            ids = [item["id"] for item in resp.data]
            self.assertIn(str(future_os.id), ids)
        finally:
            future_os.delete()
