"""Entrega da OS nao duplica o titulo a receber ja gerado no faturamento."""

import hashlib
from decimal import Decimal

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.accounts_receivable.models import ReceivableDocument, ReceivableOrigin
from apps.accounts_receivable.services import ReceivableDocumentService
from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus
from apps.service_orders.services import ServiceOrderDeliveryService


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class DeliveryReceivableTestCase(TenantTestCase):
    """Titulo criado na entrega e so rede de seguranca para OS sem faturamento."""

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="entrega-titulo@dscar.com",
            email_hash=_sha256("entrega-titulo@dscar.com"),
            password="x",
        )

    def _ready_order(self, number: int) -> ServiceOrder:
        return ServiceOrder.objects.create(
            number=number,
            plate=f"ENT{number}",
            customer_name="Cliente Entrega",
            customer_type="insurer",  # seguradora nao exige NF na entrega
            status=ServiceOrderStatus.READY,
            parts_total=Decimal("800.00"),
            services_total=Decimal("1200.00"),
            created_by=self.user,
        )

    def _deliver(self, order: ServiceOrder) -> None:
        ServiceOrderDeliveryService.deliver(order=order, data={}, delivered_by_id=str(self.user.id))

    def test_entrega_nao_duplica_titulo_do_faturamento(self) -> None:
        order = self._ready_order(9501)
        today = timezone.now().date()
        ReceivableDocumentService.create_receivable(
            customer_id=str(order.id),
            customer_name=order.customer_name,
            description="OS 9501 - Servicos",
            amount=Decimal("2000.00"),
            due_date=today,
            competence_date=today,
            origin=ReceivableOrigin.NFSE,
            service_order_id=str(order.id),
            user=self.user,
        )

        self._deliver(order)

        titulos = ReceivableDocument.objects.filter(service_order_id=order.id)
        assert titulos.count() == 1
        assert titulos.first().origin == ReceivableOrigin.NFSE

    def test_entrega_sem_faturamento_ainda_cria_o_titulo(self) -> None:
        order = self._ready_order(9502)

        self._deliver(order)

        titulos = ReceivableDocument.objects.filter(service_order_id=order.id)
        assert titulos.count() == 1
        assert titulos.first().origin == ReceivableOrigin.OS
        assert titulos.first().amount == Decimal("2000.00")
