from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.budgets.models import BudgetVersionItem
from apps.budgets.services import BudgetService
from apps.payments.models import Payment
from apps.persons.models import Person


User = get_user_model()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="pay-api", password="s")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def os_instance(db):
    person = Person.objects.create(full_name="Pay API", person_type="CLIENT")
    budget = BudgetService.create(
        customer=person, vehicle_plate="P1", vehicle_description="x", created_by="u",
    )
    v = budget.active_version
    BudgetVersionItem.objects.create(
        version=v, description="Item", quantity=Decimal("1"),
        unit_price=Decimal("100"), net_price=Decimal("100"),
    )
    BudgetService.send_to_customer(version=v, sent_by="u")
    return BudgetService.approve(version=v, approved_by="u", evidence_s3_key="")


@pytest.mark.django_db
class TestPaymentAPI:

    def test_record_payment(self, auth_client, os_instance):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_instance.pk}/payments/",
            data={
                "payer_block": "PARTICULAR",
                "amount": "500.50",
                "method": "PIX",
                "reference": "pix-abc-123",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["status"] == "received"

    def test_list_payments_of_os(self, auth_client, os_instance):
        # Cria 2 payments
        for _ in range(2):
            auth_client.post(
                f"/api/v1/service-orders/{os_instance.pk}/payments/",
                data={"payer_block": "PARTICULAR", "amount": "100", "method": "PIX"},
                format="json",
            )
        resp = auth_client.get(f"/api/v1/service-orders/{os_instance.pk}/payments/")
        assert resp.status_code == 200
        assert resp.json()["count"] == 2
