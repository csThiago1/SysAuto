"""Lista de OS: total com complemento particular vem anotado (sem N+1)."""

import hashlib
from decimal import Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import (
    ServiceOrder,
    ServiceOrderLabor,
    ServiceOrderPart,
    ServiceOrderStatus,
)

LIST = "/api/v1/service-orders/?page_size=50"


class ListTotalTestCase(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="lista@dscar.com",
            email_hash=hashlib.sha256(b"lista@dscar.com").hexdigest(),
            password="x",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain

    def _os_seguradora(self, number: int) -> ServiceOrder:
        os = ServiceOrder.objects.create(
            number=number,
            plate=f"LST{number}",
            customer_name="Seguradora",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
            total_seguradora_oficial=Decimal("1000.00"),
        )
        item = dict(
            service_order=os, created_by=self.user, quantity=Decimal("2"), discount=Decimal("10")
        )
        ServiceOrderPart.objects.create(
            description="paga a seguradora", payer="insurer", unit_price=Decimal("500"), **item
        )
        ServiceOrderPart.objects.create(
            description="paga o cliente", payer="customer", unit_price=Decimal("100"), **item
        )
        ServiceOrderLabor.objects.create(
            description="serviço do cliente", payer="customer", unit_price=Decimal("50"), **item
        )
        return os

    def _consultas_da_lista(self) -> tuple[int, list[dict]]:
        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get(LIST)
        self.assertEqual(res.status_code, 200, res.content)
        return len(ctx.captured_queries), res.json()["results"]

    def test_total_da_lista_igual_a_property(self) -> None:
        os = self._os_seguradora(7001)
        _, rows = self._consultas_da_lista()
        row = next(r for r in rows if r["id"] == str(os.id))
        # 1000 oficial + (2×100−10) peça do cliente + (2×50−10) serviço do cliente
        self.assertAlmostEqual(row["total"], 1280.0)
        self.assertAlmostEqual(row["total"], ServiceOrder.objects.get(pk=os.pk).total)

    def test_consultas_nao_crescem_com_o_numero_de_os(self) -> None:
        self._os_seguradora(7101)
        self._consultas_da_lista()  # aquecimento: 1ª request carrega caches (tenant etc.)
        uma, _ = self._consultas_da_lista()
        for n in range(7102, 7106):
            self._os_seguradora(n)
        cinco, rows = self._consultas_da_lista()
        self.assertEqual(len(rows), 5)
        self.assertEqual(cinco, uma)
