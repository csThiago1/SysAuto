from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.budgets.models import BudgetVersionItem
from apps.budgets.services import BudgetService
from apps.persons.models import Person
from apps.service_orders.models import (
    Insurer,
    ServiceOrder,
    ServiceOrderVersion,
    ServiceOrderVersionItem,
)


User = get_user_model()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="so-api", password="s")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="SO API Test", person_type="CLIENT")


@pytest.fixture
def os_particular(person):
    budget = BudgetService.create(
        customer=person, vehicle_plate="API1", vehicle_description="x", created_by="u",
    )
    v = budget.active_version
    BudgetVersionItem.objects.create(
        version=v, description="Peca",
        quantity=Decimal("1"), unit_price=Decimal("100"),
        net_price=Decimal("100"), item_type="PART",
    )
    BudgetService.send_to_customer(version=v, sent_by="u")
    return BudgetService.approve(
        version=v, approved_by="cliente", evidence_s3_key="",
    )


@pytest.fixture
def os_seguradora(person):
    yelum = Insurer.objects.get(code="yelum")
    os = ServiceOrder.objects.create(
        os_number="OS-API-SEG-1", customer=person, customer_type="SEGURADORA",
        insurer=yelum, casualty_number="SIN-API-1",
        vehicle_plate="SEG2", vehicle_description="y", status="repair",
    )
    ServiceOrderVersion.objects.create(
        service_order=os, version_number=1, source="cilia",
        external_version="100.1", status="autorizado",
        net_total=Decimal("1000"),
    )
    return os


@pytest.mark.django_db
class TestServiceOrderAPI:

    def test_list(self, auth_client, os_particular):
        resp = auth_client.get("/api/v1/service-orders/")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 1

    def test_retrieve(self, auth_client, os_particular):
        resp = auth_client.get(f"/api/v1/service-orders/{os_particular.pk}/")
        assert resp.status_code == 200
        assert resp.json()["os_number"] == os_particular.os_number

    def test_filter_by_customer_type(self, auth_client, os_particular, os_seguradora):
        resp = auth_client.get("/api/v1/service-orders/?customer_type=SEGURADORA")
        assert resp.status_code == 200
        for item in resp.json()["results"]:
            assert item["customer_type"] == "SEGURADORA"


@pytest.mark.django_db
class TestChangeStatusAPI:

    def test_valid_transition(self, auth_client, os_particular):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_particular.pk}/change-status/",
            data={"new_status": "initial_survey", "notes": "iniciando"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "initial_survey"

    def test_invalid_transition(self, auth_client, os_particular):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_particular.pk}/change-status/",
            data={"new_status": "painting"},
            format="json",
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestComplementAPI:

    def test_add_complement_seguradora(self, auth_client, os_seguradora):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_seguradora.pk}/complement/",
            data={
                "items": [{
                    "description": "Pintura extra",
                    "quantity": "1",
                    "unit_price": "300",
                    "net_price": "300",
                    "item_type": "SERVICE",
                }],
                "approved_by": "cliente",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["version_number"] == 2

    def test_complement_particular_fails(self, auth_client, os_particular):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_particular.pk}/complement/",
            data={"items": [{
                "description": "x", "quantity": "1",
                "unit_price": "1", "net_price": "1",
            }]},
            format="json",
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestEventsAPI:

    def test_list_events(self, auth_client, os_particular):
        resp = auth_client.get(f"/api/v1/service-orders/{os_particular.pk}/events/")
        assert resp.status_code == 200
        data = resp.json()
        # OS recem-criada via budget tem eventos BUDGET_LINKED + VERSION_CREATED
        assert data["count"] >= 2

    def test_filter_events_by_type(self, auth_client, os_particular):
        resp = auth_client.get(
            f"/api/v1/service-orders/{os_particular.pk}/events/?event_type=VERSION_CREATED",
        )
        assert resp.status_code == 200
        for ev in resp.json()["results"]:
            assert ev["event_type"] == "VERSION_CREATED"


@pytest.mark.django_db
class TestParecerAPI:

    def test_add_internal_parecer(self, auth_client, os_particular):
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_particular.pk}/pareceres/",
            data={"body": "Cliente confirmou entrega amanha",
                  "parecer_type": "COMENTARIO_INTERNO"},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["source"] == "internal"

    def test_list_pareceres(self, auth_client, os_particular):
        # Adiciona 1 parecer primeiro
        auth_client.post(
            f"/api/v1/service-orders/{os_particular.pk}/pareceres/",
            data={"body": "x"},
            format="json",
        )
        resp = auth_client.get(f"/api/v1/service-orders/{os_particular.pk}/pareceres/")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


@pytest.mark.django_db
class TestVersionApproveAPI:

    def test_approve_version_returns_os_to_previous(self, auth_client, os_seguradora):
        # Setar OS em budget pra teste de retorno
        os_seguradora.status = "budget"
        os_seguradora.previous_status = "repair"
        os_seguradora.save()
        # Nova versao pendente
        v = ServiceOrderVersion.objects.create(
            service_order=os_seguradora, version_number=2,
            source="cilia", external_version="100.2", status="em_analise",
        )
        resp = auth_client.post(
            f"/api/v1/service-orders/{os_seguradora.pk}/versions/{v.pk}/approve/",
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "autorizado"
        os_seguradora.refresh_from_db()
        assert os_seguradora.status == "repair"
