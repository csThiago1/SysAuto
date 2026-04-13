"""Testes para garantir que parts/labor geram ActivityLog corretamente."""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, ServiceOrderActivityLog


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def make_open_os(user: GlobalUser) -> ServiceOrder:
    return ServiceOrder.objects.create(
        plate="ABC1D23",
        make="Honda",
        model="Civic",
        customer_type="private",
        customer_name="Cliente Teste",
        number=1,
        status="reception",
        created_by=user,
    )


class PartsHistoryLoggingTestCase(TenantTestCase):
    """Testes para logs de peças."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="tech@dscar.com",
            email_hash=_sha256("tech@dscar.com"),
            password="pass",
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.os = make_open_os(self.user)

    def test_add_part_logs_part_added(self) -> None:
        self.client.post(
            f"/api/service-orders/{self.os.id}/parts/",
            {"description": "Filtro de óleo", "quantity": "1", "unit_price": "45.00", "discount": "0"},
            format="json",
        )
        log = ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="part_added"
        ).first()
        assert log is not None
        assert "Filtro de óleo" in log.description
        assert log.metadata["unit_price"] == "45.00"

    def test_edit_part_logs_part_updated(self) -> None:
        resp = self.client.post(
            f"/api/service-orders/{self.os.id}/parts/",
            {"description": "Filtro", "quantity": "1", "unit_price": "45.00", "discount": "0"},
            format="json",
        )
        part_id = resp.data["id"]
        self.client.patch(
            f"/api/service-orders/{self.os.id}/parts/{part_id}/",
            {"unit_price": "52.00"},
            format="json",
        )
        log = ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="part_updated"
        ).first()
        assert log is not None
        changes = log.metadata.get("field_changes", [])
        assert any(c["field_label"] == "Valor Unit." for c in changes)

    def test_remove_part_logs_part_removed(self) -> None:
        resp = self.client.post(
            f"/api/service-orders/{self.os.id}/parts/",
            {"description": "Filtro", "quantity": "1", "unit_price": "45.00", "discount": "0"},
            format="json",
        )
        part_id = resp.data["id"]
        self.client.delete(f"/api/service-orders/{self.os.id}/parts/{part_id}/")
        assert ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="part_removed"
        ).exists()


class LaborHistoryLoggingTestCase(TenantTestCase):
    """Testes para logs de serviços."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="tech2@dscar.com",
            email_hash=_sha256("tech2@dscar.com"),
            password="pass",
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.os = make_open_os(self.user)

    def test_add_labor_logs_labor_added(self) -> None:
        self.client.post(
            f"/api/service-orders/{self.os.id}/labor/",
            {"description": "Troca de óleo", "quantity": "1", "unit_price": "80.00", "discount": "0"},
            format="json",
        )
        log = ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="labor_added"
        ).first()
        assert log is not None
        assert "Troca de óleo" in log.description
        assert log.metadata["unit_price"] == "80.00"

    def test_edit_labor_logs_labor_updated(self) -> None:
        resp = self.client.post(
            f"/api/service-orders/{self.os.id}/labor/",
            {"description": "Pintura", "quantity": "1", "unit_price": "800.00", "discount": "0"},
            format="json",
        )
        labor_id = resp.data["id"]
        self.client.patch(
            f"/api/service-orders/{self.os.id}/labor/{labor_id}/",
            {"unit_price": "900.00"},
            format="json",
        )
        log = ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="labor_updated"
        ).first()
        assert log is not None
        changes = log.metadata.get("field_changes", [])
        assert any(c["field_label"] == "Valor Unit." for c in changes)

    def test_remove_labor_logs_labor_removed(self) -> None:
        resp = self.client.post(
            f"/api/service-orders/{self.os.id}/labor/",
            {"description": "Pintura", "quantity": "1", "unit_price": "800.00", "discount": "0"},
            format="json",
        )
        labor_id = resp.data["id"]
        self.client.delete(f"/api/service-orders/{self.os.id}/labor/{labor_id}/")
        assert ServiceOrderActivityLog.objects.filter(
            service_order=self.os, activity_type="labor_removed"
        ).exists()
