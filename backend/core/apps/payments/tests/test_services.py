"""Testes para PaymentService.record()."""
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.payments.models import Payment
from apps.payments.services import PaymentService
from apps.service_orders.models import ServiceOrder, ServiceOrderEvent


class PaymentServiceTest(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.os = ServiceOrder.objects.create(
            number=9001, customer_name="Cliente Teste", plate="PAY0001",
        )

    def test_record_creates_payment_with_status_received(self) -> None:
        payment = PaymentService.record(
            service_order=self.os,
            payer_block="SEGURADORA",
            amount=Decimal("1500.00"),
            method="PIX",
        )
        assert payment.status == "received"
        assert payment.received_at is not None
        assert payment.amount == Decimal("1500.00")

    def test_record_logs_payment_recorded_event(self) -> None:
        PaymentService.record(
            service_order=self.os,
            payer_block="PARTICULAR",
            amount=Decimal("500.00"),
            method="DINHEIRO",
            received_by="Thiago",
        )
        ev = ServiceOrderEvent.objects.get(service_order=self.os, event_type="PAYMENT_RECORDED")
        assert ev.payload["block"] == "PARTICULAR"
        assert ev.payload["method"] == "DINHEIRO"
        assert ev.actor == "Thiago"

    def test_record_reference_and_received_by_optional(self) -> None:
        payment = PaymentService.record(
            service_order=self.os,
            payer_block="FRANQUIA",
            amount=Decimal("300.00"),
            method="BOLETO",
        )
        assert payment.reference == ""
        assert payment.received_by == ""
        assert payment.status == "received"
