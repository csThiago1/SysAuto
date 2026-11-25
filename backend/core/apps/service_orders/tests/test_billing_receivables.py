"""Titulos a receber gerados pelo faturamento da OS: origem valida e sem duplicar."""

import hashlib
from decimal import Decimal

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.accounts_receivable.models import ReceivableDocument, ReceivableOrigin
from apps.authentication.models import GlobalUser
from apps.insurers.models import Insurer
from apps.service_orders.billing import BillingResult, BillingService
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class BillingReceivablesTestCase(TenantTestCase):
    """Faturamento da OS cria titulos validos e nao repete na nova tentativa."""

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="billing-titulos@dscar.com",
            email_hash=_sha256("billing-titulos@dscar.com"),
            password="x",
        )

    def test_titulo_de_franquia_usa_origem_valida(self) -> None:
        """C2: franquia nao gera NF, mas a origem precisa estar nas choices."""
        order = ServiceOrder.objects.create(
            number=9411,
            plate="FRQ1D23",
            customer_name="Cliente Franquia",
            customer_type="insurer",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        result = BillingResult()
        items = [{"recipient_type": "customer", "category": "deductible", "amount": "300.00"}]

        BillingService._create_receivables_and_emit_fiscal(
            order, items, self.user, timezone.now().date(), result
        )

        assert len(result.receivables) == 1
        assert result.receivables[0].origin in ReceivableOrigin.values

    def test_refaturar_apos_falha_fiscal_nao_duplica_titulo(self) -> None:
        """C1b: sem tomador a nota nao sai e a OS segue faturavel; o retry reaproveita o titulo."""
        insurer = Insurer.objects.create(
            name="Retry Seguros S.A.",
            cnpj="11.222.333/0001-81",
            cnpjs=["11222333000181"],
        )
        order = ServiceOrder.objects.create(
            number=9412,
            plate="RTY1D23",
            customer_type="insurer",
            insurer=insurer,
            insurer_cnpj="11222333000181",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        # 2a tentativa com valor corrigido: o mesmo titulo passa a valer 750, sem sobrar o de 700
        for valor in ("700.00", "750.00"):
            items = [{"recipient_type": "insurer", "category": "services", "amount": valor}]
            BillingService._create_receivables_and_emit_fiscal(
                order, items, self.user, timezone.now().date(), BillingResult()
            )

        titulos = ReceivableDocument.objects.filter(service_order_id=order.pk)
        assert [t.amount for t in titulos] == [Decimal("750.00")]
