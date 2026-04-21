from decimal import Decimal

import pytest

from apps.payments.models import Payment
from apps.payments.services import PaymentService
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder, ServiceOrderEvent


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Cliente Pay", person_type="CLIENT")


@pytest.fixture
def os_instance(person):
    return ServiceOrder.objects.create(
        os_number="OS-PAYSVC-1", customer=person,
        vehicle_plate="PSV1234", vehicle_description="Test",
    )


@pytest.mark.django_db
class TestPaymentService:

    def test_record_creates_payment(self, os_instance):
        p = PaymentService.record(
            service_order=os_instance,
            payer_block="PARTICULAR",
            amount=Decimal("500"),
            method="PIX",
            reference="ref123",
            received_by="alice",
        )
        assert p.status == "received"
        assert p.received_by == "alice"
        assert p.received_at is not None

    def test_record_emits_event(self, os_instance):
        PaymentService.record(
            service_order=os_instance,
            payer_block="PARTICULAR",
            amount=Decimal("100"),
            method="DINHEIRO",
            reference="",
            received_by="bob",
        )
        events = os_instance.events.filter(event_type="PAYMENT_RECORDED")
        assert events.count() == 1
        ev = events.first()
        assert ev.actor == "bob"
        assert ev.payload["amount"] == "100"
        assert ev.payload["method"] == "DINHEIRO"
        assert ev.payload["block"] == "PARTICULAR"

    def test_record_atomic_on_failure(self, os_instance, monkeypatch):
        """Se log_event falhar, o payment não deve persistir."""
        from apps.service_orders.events import OSEventLogger

        def boom(*args, **kwargs):
            raise RuntimeError("boom")

        monkeypatch.setattr(OSEventLogger, "log_event", boom)

        with pytest.raises(RuntimeError):
            PaymentService.record(
                service_order=os_instance,
                payer_block="PARTICULAR",
                amount=Decimal("200"),
                method="PIX",
                reference="",
                received_by="carol",
            )
        assert Payment.objects.count() == 0
