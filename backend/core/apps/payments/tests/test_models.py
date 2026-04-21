from decimal import Decimal

import pytest

from apps.payments.models import Payment
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Pagador", person_type="CLIENT")


@pytest.fixture
def os_instance(person):
    return ServiceOrder.objects.create(
        os_number="OS-PAY-1", customer=person,
        vehicle_plate="PAY1234", vehicle_description="Test",
    )


@pytest.mark.django_db
class TestPayment:

    def test_create_particular(self, os_instance):
        p = Payment.objects.create(
            service_order=os_instance,
            payer_block="PARTICULAR",
            amount=Decimal("1500.50"),
            method="PIX",
            reference="pix-ABC-123",
        )
        assert p.status == "pending"
        assert str(p) == f"PIX R$ 1500.50 — {os_instance.os_number}"

    def test_create_franquia(self, os_instance):
        p = Payment.objects.create(
            service_order=os_instance,
            payer_block="FRANQUIA",
            amount=Decimal("2000"),
            method="CARTAO",
        )
        assert p.payer_block == "FRANQUIA"
