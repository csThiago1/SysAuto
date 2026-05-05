"""
Testes do resumo financeiro consolidado (seguradora + complemento).
Herda de TenantTestCase para isolamento de schema.
"""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import (
    ServiceOrder,
    ServiceOrderLabor,
    ServiceOrderPart,
    ServiceOrderStatus,
)
from apps.service_orders.services import ServiceOrderService


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class FinancialSummaryServiceTestCase(TenantTestCase):
    """Testes unitários para ServiceOrderService.financial_summary."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="finsummary@dscar.com",
            email_hash=_sha256("finsummary@dscar.com"),
            password="x",
        )

    def _make_os(self, number: int, plate: str, **kwargs) -> ServiceOrder:
        return ServiceOrder.objects.create(
            number=number,
            plate=plate,
            customer_name="Teste Financeiro",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
            **kwargs,
        )

    # ── Casos básicos ─────────────────────────────────────────────────────────

    def test_empty_os_summary_all_zeros(self) -> None:
        """OS sem itens deve retornar todos os totais zerados."""
        os = self._make_os(7001, "FIN1001")
        summary = ServiceOrderService.financial_summary(os)

        self.assertEqual(summary["insurer_parts"], Decimal("0"))
        self.assertEqual(summary["insurer_labor"], Decimal("0"))
        self.assertEqual(summary["insurer_subtotal"], Decimal("0"))
        self.assertEqual(summary["deductible"], Decimal("0"))
        self.assertEqual(summary["insurer_net"], Decimal("0"))
        self.assertEqual(summary["complement_parts"], Decimal("0"))
        self.assertEqual(summary["complement_labor"], Decimal("0"))
        self.assertEqual(summary["complement_subtotal"], Decimal("0"))
        self.assertEqual(summary["complement_billed"], Decimal("0"))
        self.assertEqual(summary["complement_pending"], Decimal("0"))
        self.assertEqual(summary["customer_owes"], Decimal("0"))
        self.assertEqual(summary["grand_total"], Decimal("0"))

    def test_summary_insurer_only(self) -> None:
        """OS somente com itens de seguradora, sem franquia."""
        os = self._make_os(7002, "FIN1002")
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Para-choque",
            quantity=Decimal("1"),
            unit_price=Decimal("800"),
            discount=Decimal("0"),
            payer="insurer",
            source_type="import",
        )
        ServiceOrderLabor.objects.create(
            service_order=os,
            created_by=self.user,
            description="Funilaria",
            quantity=Decimal("1"),
            unit_price=Decimal("400"),
            discount=Decimal("0"),
            payer="insurer",
            source_type="import",
        )
        summary = ServiceOrderService.financial_summary(os)

        self.assertEqual(summary["insurer_parts"], Decimal("800"))
        self.assertEqual(summary["insurer_labor"], Decimal("400"))
        self.assertEqual(summary["insurer_subtotal"], Decimal("1200"))
        self.assertEqual(summary["deductible"], Decimal("0"))
        self.assertEqual(summary["insurer_net"], Decimal("1200"))
        self.assertEqual(summary["complement_subtotal"], Decimal("0"))
        self.assertEqual(summary["customer_owes"], Decimal("0"))
        self.assertEqual(summary["grand_total"], Decimal("1200"))

    def test_summary_insurer_with_deductible(self) -> None:
        """Franquia deve ser descontada do total seguradora."""
        os = self._make_os(7003, "FIN1003", deductible_amount=Decimal("500"))
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Capô",
            quantity=Decimal("1"),
            unit_price=Decimal("1500"),
            discount=Decimal("0"),
            payer="insurer",
            source_type="import",
        )
        summary = ServiceOrderService.financial_summary(os)

        self.assertEqual(summary["insurer_subtotal"], Decimal("1500"))
        self.assertEqual(summary["deductible"], Decimal("500"))
        self.assertEqual(summary["insurer_net"], Decimal("1000"))
        self.assertEqual(summary["customer_owes"], Decimal("500"))

    def test_deductible_capped_at_insurer_subtotal(self) -> None:
        """Franquia maior que subtotal segurado não pode resultar em insurer_net negativo."""
        os = self._make_os(7004, "FIN1004", deductible_amount=Decimal("2000"))
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Peça pequena",
            quantity=Decimal("1"),
            unit_price=Decimal("500"),
            discount=Decimal("0"),
            payer="insurer",
            source_type="import",
        )
        summary = ServiceOrderService.financial_summary(os)

        # Franquia limitada ao subtotal — não pode ser maior que 500
        self.assertEqual(summary["deductible"], Decimal("500"))
        self.assertEqual(summary["insurer_net"], Decimal("0"))
        self.assertEqual(summary["customer_owes"], Decimal("500"))

    def test_summary_complement_only(self) -> None:
        """OS com apenas itens de complemento particular (sem seguradora)."""
        os = self._make_os(7005, "FIN1005")
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Kit LED",
            quantity=Decimal("2"),
            unit_price=Decimal("90"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        ServiceOrderLabor.objects.create(
            service_order=os,
            created_by=self.user,
            description="Instalação LED",
            quantity=Decimal("1"),
            unit_price=Decimal("150"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        summary = ServiceOrderService.financial_summary(os)

        self.assertEqual(summary["complement_parts"], Decimal("180"))
        self.assertEqual(summary["complement_labor"], Decimal("150"))
        self.assertEqual(summary["complement_subtotal"], Decimal("330"))
        self.assertEqual(summary["complement_billed"], Decimal("0"))
        self.assertEqual(summary["complement_pending"], Decimal("330"))
        self.assertEqual(summary["insurer_subtotal"], Decimal("0"))
        self.assertEqual(summary["customer_owes"], Decimal("330"))
        self.assertEqual(summary["grand_total"], Decimal("330"))

    def test_summary_insurer_with_complement(self) -> None:
        """Caso completo: seguradora + complemento (parte faturada, parte pendente)."""
        os = self._make_os(7006, "FIN1006", deductible_amount=Decimal("1000"))

        # Item seguradora
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Para-choque",
            quantity=Decimal("1"),
            unit_price=Decimal("1200"),
            discount=Decimal("0"),
            payer="insurer",
            source_type="import",
        )
        # Complement pendente
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Kit LED",
            quantity=Decimal("1"),
            unit_price=Decimal("190"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        # Complement já faturado
        ServiceOrderLabor.objects.create(
            service_order=os,
            created_by=self.user,
            description="Polimento",
            quantity=Decimal("1"),
            unit_price=Decimal("350"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
            billing_status="billed",
        )

        summary = ServiceOrderService.financial_summary(os)

        self.assertEqual(summary["insurer_parts"], Decimal("1200"))
        self.assertEqual(summary["deductible"], Decimal("1000"))
        self.assertEqual(summary["insurer_net"], Decimal("200"))
        self.assertEqual(summary["complement_subtotal"], Decimal("540"))
        self.assertEqual(summary["complement_billed"], Decimal("350"))
        self.assertEqual(summary["complement_pending"], Decimal("190"))
        # cliente deve: franquia (1000) + pendente (190) = 1190
        self.assertEqual(summary["customer_owes"], Decimal("1190"))
        self.assertEqual(summary["grand_total"], Decimal("1740"))

    def test_discount_reduces_item_amount(self) -> None:
        """Desconto deve ser subtraído corretamente no cálculo."""
        os = self._make_os(7007, "FIN1007")
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Peça com desconto",
            quantity=Decimal("2"),
            unit_price=Decimal("200"),
            discount=Decimal("50"),
            payer="customer",
            source_type="complement",
        )
        summary = ServiceOrderService.financial_summary(os)

        # 2 × 200 - 50 = 350
        self.assertEqual(summary["complement_parts"], Decimal("350"))
        self.assertEqual(summary["complement_pending"], Decimal("350"))

    def test_inactive_items_excluded_from_summary(self) -> None:
        """Itens com is_active=False não devem entrar no resumo."""
        os = self._make_os(7008, "FIN1008")
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Peça ativa",
            quantity=Decimal("1"),
            unit_price=Decimal("300"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Peça inativa",
            quantity=Decimal("1"),
            unit_price=Decimal("999"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
            is_active=False,
        )
        summary = ServiceOrderService.financial_summary(os)

        # Somente a peça ativa (300) deve ser contabilizada
        self.assertEqual(summary["complement_parts"], Decimal("300"))

    def test_summary_keys_present(self) -> None:
        """O dicionário de retorno deve conter todas as chaves esperadas."""
        os = self._make_os(7009, "FIN1009")
        summary = ServiceOrderService.financial_summary(os)

        expected_keys = {
            "insurer_parts", "insurer_labor", "insurer_subtotal",
            "deductible", "insurer_net",
            "complement_parts", "complement_labor", "complement_subtotal",
            "complement_billed", "complement_pending",
            "customer_owes", "insurer_owes", "grand_total",
            "active_version",
        }
        self.assertEqual(expected_keys, set(summary.keys()))


class FinancialSummaryEndpointTestCase(TenantTestCase):
    """Testes de integração para o endpoint GET /financial-summary/."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="finsummaryapi@dscar.com",
            email_hash=_sha256("finsummaryapi@dscar.com"),
            password="x",
        )
        cls.os = ServiceOrder.objects.create(
            number=7020,
            plate="FIN2001",
            customer_name="API Summary Test",
            status=ServiceOrderStatus.REPAIR,
            created_by=cls.user,
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.client.defaults["SERVER_NAME"] = "dscar.localhost"

    def _summary_url(self, os_id=None) -> str:
        oid = os_id or str(self.os.id)
        return f"/api/v1/service-orders/{oid}/financial-summary/"

    def test_financial_summary_endpoint_returns_200(self) -> None:
        resp = self.client.get(self._summary_url())
        self.assertEqual(resp.status_code, 200)

    def test_financial_summary_response_contains_expected_fields(self) -> None:
        resp = self.client.get(self._summary_url())
        self.assertEqual(resp.status_code, 200)
        for field in ("insurer_subtotal", "complement_subtotal", "customer_owes", "grand_total"):
            self.assertIn(field, resp.data)

    def test_financial_summary_endpoint_unauthenticated_returns_401(self) -> None:
        anon = APIClient()
        anon.defaults["SERVER_NAME"] = "dscar.localhost"
        resp = anon.get(self._summary_url())
        self.assertEqual(resp.status_code, 401)

    def test_financial_summary_reflects_items(self) -> None:
        """Valores no endpoint devem refletir os itens da OS."""
        os = ServiceOrder.objects.create(
            number=7021,
            plate="FIN2002",
            customer_name="Reflexo Test",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Peça complemento",
            quantity=Decimal("1"),
            unit_price=Decimal("450"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        resp = self.client.get(f"/api/v1/service-orders/{os.id}/financial-summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Decimal(resp.data["complement_parts"]), Decimal("450"))
        self.assertEqual(Decimal(resp.data["complement_pending"]), Decimal("450"))
