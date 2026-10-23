"""Veículo a confirmar bloqueia a entrada em produção, sem override de gerente."""

import hashlib
from typing import Any

import pytest

from django_tenants.test.cases import TenantTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, TransitionOverrideRequest
from apps.service_orders.services import ServiceOrderService
from apps.vehicle_catalog.tests.factories import make_catalog

URL = "/api/v1/service-orders/"


class VehicleReviewTransitionTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "revisao@dscar.com"
        self.user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.version = make_catalog()

    def post_os(self, plate: str, **data: Any) -> ServiceOrder:
        payload = {"plate": plate, "customer_name": "Cliente Revisão", **data}
        r = self.client.post(URL, payload, format="json")
        assert r.status_code == 201, r.data
        return ServiceOrder.objects.get(pk=r.data["id"])

    def set_status(self, order: ServiceOrder, status: str) -> None:
        ServiceOrder.objects.filter(pk=order.pk).update(status=status)

    def test_override_de_gerente_nao_fura(self) -> None:
        pend = self.post_os("PND1A23", catalog_family=self.version.modelo.familia_id)
        assert pend.vehicle_needs_review is True
        self.set_status(pend, "budget")

        with pytest.raises(ValidationError) as e:
            ServiceOrderService.transition(
                order_id=pend.pk,
                new_status="repair",
                changed_by_id=self.user.pk,
                force=True,
                manager_verified=True,
            )

        tb = e.value.detail["transition_blocks"]
        assert str(tb["can_override"]) == "False"
        assert "VEHICLE_NEEDS_REVIEW" in {b["code"] for b in tb["blocks"]}
        assert not TransitionOverrideRequest.objects.filter(service_order=pend).exists()
        pend.refresh_from_db()
        assert pend.status == "budget"

    def test_os_em_producao_que_perde_versao_volta_a_bloquear(self) -> None:
        order = self.post_os("PRD1A23", catalog_version=self.version.id)
        assert order.vehicle_needs_review is False
        self.set_status(order, "bodywork")

        r = self.client.patch(f"{URL}{order.pk}/", {"catalog_version": None}, format="json")
        assert r.status_code == 200, r.data
        order.refresh_from_db()
        assert order.vehicle_needs_review is True
        assert order.status == "bodywork"

        with pytest.raises(ValidationError) as e:
            ServiceOrderService.transition(
                order_id=order.pk, new_status="painting", changed_by_id=self.user.pk
            )
        tb = e.value.detail["transition_blocks"]
        assert "VEHICLE_NEEDS_REVIEW" in {b["code"] for b in tb["blocks"]}

    def test_filtro_lista(self) -> None:
        self.post_os("OKV1A23", catalog_version=self.version.id)
        pend = self.post_os("PND2A23", catalog_family=self.version.modelo.familia_id)

        r = self.client.get(f"{URL}?vehicle_needs_review=true")
        assert r.status_code == 200, r.data
        assert [o["id"] for o in r.data["results"]] == [str(pend.pk)]
        assert r.data["results"][0]["vehicle_needs_review"] is True
