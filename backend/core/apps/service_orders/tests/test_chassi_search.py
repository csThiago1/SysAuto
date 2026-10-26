"""Busca de OS e de orçamento pelo chassi (inclusive pelo final dele)."""

import hashlib

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.budgets.models import Budget
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder
from apps.vehicle_catalog.tests.factories import make_catalog

CHASSI = "8AC907655SE254082"


class ChassiSearchTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "busca-chassi@dscar.com"
        user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=user, token={"role": "ADMIN"})
        self.family = make_catalog().modelo.familia

    def test_busca_os_por_final_do_chassi(self) -> None:
        alvo = ServiceOrder.objects.create(
            number=9801, plate="ABC1D23", customer_name="Com Chassi", chassis=CHASSI
        )
        ServiceOrder.objects.create(
            number=9802, plate="XYZ9A88", customer_name="Outra", chassis="9BWZZZ377VT004251"
        )
        r = self.client.get("/api/v1/service-orders/", {"search": "254082"})
        assert r.status_code == 200, r.data
        assert [o["id"] for o in r.data["results"]] == [str(alvo.id)]

    def test_busca_orcamento_por_chassi(self) -> None:
        customer = Person.objects.create(full_name="Cliente Orçamento", person_kind="PF")
        alvo = Budget.objects.create(
            number="ORC-2026-000901",
            customer=customer,
            vehicle_plate="ABC1D23",
            vehicle_chassis=CHASSI,
            catalog_family=self.family,
        )
        Budget.objects.create(
            number="ORC-2026-000902",
            customer=customer,
            vehicle_plate="XYZ9A88",
            vehicle_chassis="9BWZZZ377VT004251",
            catalog_family=self.family,
        )
        r = self.client.get("/api/v1/budgets/", {"search": "se254082"})
        assert r.status_code == 200, r.data
        assert [b["id"] for b in r.data["results"]] == [alvo.id]
