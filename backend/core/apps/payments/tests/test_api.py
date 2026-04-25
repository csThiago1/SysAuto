"""API tests para payments endpoints."""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.payments.models import Payment
from apps.service_orders.models import ServiceOrder


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class PaymentAPITest(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="pay@x.com",
            email_hash=_sha256("pay@x.com"),
            password="pw",
        )
        self.client = APIClient()
        self.client.defaults["HTTP_X_TENANT_DOMAIN"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "MANAGER"})
        self.os = ServiceOrder.objects.create(
            number=8001, customer_name="Cliente API", plate="PAY0001",
        )

    def test_list_payments_returns_only_os_payments(self) -> None:
        os2 = ServiceOrder.objects.create(number=8002, customer_name="Outro", plate="PAY0002")
        Payment.objects.create(
            service_order=self.os, payer_block="SEGURADORA",
            amount=Decimal("1000"), method="PIX", status="received",
        )
        Payment.objects.create(
            service_order=os2, payer_block="PARTICULAR",
            amount=Decimal("500"), method="DINHEIRO", status="received",
        )
        resp = self.client.get(f"/api/v1/service-orders/{self.os.pk}/payments/")
        assert resp.status_code == 200
        assert len(resp.data["results"]) == 1
        assert resp.data["results"][0]["payer_block"] == "SEGURADORA"

    def test_create_payment_returns_201(self) -> None:
        resp = self.client.post(
            f"/api/v1/service-orders/{self.os.pk}/payments/",
            {
                "payer_block": "PARTICULAR",
                "amount": "750.00",
                "method": "CARTAO",
                "reference": "txid-123",
                "received_by": "Thiago",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["status"] == "received"
        assert resp.data["received_at"] is not None

    def test_list_payments_as_consultant_allowed(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "CONSULTANT"})
        resp = self.client.get(f"/api/v1/service-orders/{self.os.pk}/payments/")
        assert resp.status_code == 200

    def test_create_payment_as_consultant_forbidden(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "CONSULTANT"})
        resp = self.client.post(
            f"/api/v1/service-orders/{self.os.pk}/payments/",
            {"payer_block": "PARTICULAR", "amount": "100", "method": "PIX"},
            format="json",
        )
        assert resp.status_code == 403
