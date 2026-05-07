"""
Testes para o campo closure_status nas OS e o filtro ?closure= no endpoint de listagem.

Regras de negócio:
- Uma OS está "fechada" quando: status=delivered + invoice_issued=True + todos os
  ReceivableDocument vinculados têm status "received" (e existem ao menos um).
- closure_status é None se a OS não estiver no status delivered.
"""
import hashlib
import uuid
from datetime import date

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.accounts_receivable.models import ReceivableDocument
from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _make_receivable(
    service_order: ServiceOrder,
    status: str = "open",
    **kwargs,
) -> ReceivableDocument:
    """Cria um ReceivableDocument vinculado à OS informada."""
    defaults = {
        "customer_id": uuid.uuid4(),
        "customer_name": "Cliente Teste",
        "description": "Título de teste",
        "amount": "1000.00",
        "amount_received": "0.00",
        "due_date": date.today(),
        "competence_date": date.today(),
        "status": status,
        "service_order_id": service_order.pk,
    }
    defaults.update(kwargs)
    return ReceivableDocument.objects.create(**defaults)


class ClosureStatusSerializerTestCase(TenantTestCase):
    """Testes unitários do campo closure_status via endpoint de detalhe."""

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.user = GlobalUser.objects.create_user(
            email="closure@dscar.com",
            email_hash=_sha256("closure@dscar.com"),
            password="x",
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.client.defaults["SERVER_NAME"] = "tenant.test.com"

    def _make_os(self, number: int, plate: str, **kwargs) -> ServiceOrder:
        return ServiceOrder.objects.create(
            number=number,
            plate=plate,
            customer_name="Teste Encerramento",
            created_by=self.user,
            **kwargs,
        )

    def _detail_url(self, os: ServiceOrder) -> str:
        return f"/api/v1/service-orders/{os.id}/"

    # ── Caso 1: OS totalmente fechada ─────────────────────────────────────────

    def test_closure_status_is_closed_true(self) -> None:
        """OS entregue + faturada + recebível quitado → is_closed=True."""
        os = self._make_os(
            9001,
            "CLO1001",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=True,
        )
        _make_receivable(os, status="received")

        resp = self.client.get(self._detail_url(os))

        self.assertEqual(resp.status_code, 200)
        cs = resp.data["closure_status"]
        self.assertIsNotNone(cs)
        self.assertTrue(cs["is_delivered"])
        self.assertTrue(cs["is_invoiced"])
        self.assertTrue(cs["is_paid"])
        self.assertTrue(cs["is_closed"])

    # ── Caso 2: pagamento pendente ────────────────────────────────────────────

    def test_closure_status_pending_payment(self) -> None:
        """OS entregue + faturada + recebível aberto → is_paid=False, is_closed=False."""
        os = self._make_os(
            9002,
            "CLO1002",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=True,
        )
        _make_receivable(os, status="open")

        resp = self.client.get(self._detail_url(os))

        self.assertEqual(resp.status_code, 200)
        cs = resp.data["closure_status"]
        self.assertIsNotNone(cs)
        self.assertTrue(cs["is_invoiced"])
        self.assertFalse(cs["is_paid"])
        self.assertFalse(cs["is_closed"])

    # ── Caso 3: não faturada ──────────────────────────────────────────────────

    def test_closure_status_not_invoiced(self) -> None:
        """OS entregue sem nota emitida → is_invoiced=False, is_closed=False."""
        os = self._make_os(
            9003,
            "CLO1003",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=False,
        )
        _make_receivable(os, status="received")

        resp = self.client.get(self._detail_url(os))

        self.assertEqual(resp.status_code, 200)
        cs = resp.data["closure_status"]
        self.assertIsNotNone(cs)
        self.assertFalse(cs["is_invoiced"])
        self.assertFalse(cs["is_closed"])

    # ── Caso 4: OS não entregue → closure_status = None ──────────────────────

    def test_closure_status_is_none_when_not_delivered(self) -> None:
        """OS em reparo não deve ter closure_status."""
        os = self._make_os(9004, "CLO1004", status=ServiceOrderStatus.REPAIR)

        resp = self.client.get(self._detail_url(os))

        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.data["closure_status"])

    # ── Caso 5: sem recebíveis → is_paid=False ────────────────────────────────

    def test_closure_status_no_receivables_is_not_paid(self) -> None:
        """OS entregue + faturada mas sem recebíveis → is_paid=False."""
        os = self._make_os(
            9005,
            "CLO1005",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=True,
        )

        resp = self.client.get(self._detail_url(os))

        self.assertEqual(resp.status_code, 200)
        cs = resp.data["closure_status"]
        self.assertIsNotNone(cs)
        self.assertTrue(cs["is_invoiced"])
        self.assertFalse(cs["is_paid"])
        self.assertFalse(cs["is_closed"])

    # ── Caso 6: múltiplos recebíveis, todos quitados ──────────────────────────

    def test_closure_status_multiple_receivables_all_received(self) -> None:
        """Todos os recebíveis quitados → is_paid=True."""
        os = self._make_os(
            9006,
            "CLO1006",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=True,
        )
        _make_receivable(os, status="received")
        _make_receivable(os, status="received")

        resp = self.client.get(self._detail_url(os))

        self.assertEqual(resp.status_code, 200)
        cs = resp.data["closure_status"]
        self.assertTrue(cs["is_paid"])
        self.assertTrue(cs["is_closed"])

    # ── Caso 7: múltiplos recebíveis, um pendente ─────────────────────────────

    def test_closure_status_multiple_receivables_one_pending(self) -> None:
        """Um recebível pendente → is_paid=False mesmo com outros quitados."""
        os = self._make_os(
            9007,
            "CLO1007",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=True,
        )
        _make_receivable(os, status="received")
        _make_receivable(os, status="partial")

        resp = self.client.get(self._detail_url(os))

        self.assertEqual(resp.status_code, 200)
        cs = resp.data["closure_status"]
        self.assertFalse(cs["is_paid"])
        self.assertFalse(cs["is_closed"])


class ClosureStatusListTestCase(TenantTestCase):
    """Testes para closure_status na listagem e filtros ?closure=."""

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.user = GlobalUser.objects.create_user(
            email="closurelist@dscar.com",
            email_hash=_sha256("closurelist@dscar.com"),
            password="x",
        )

        # OS 1: totalmente fechada (delivered + invoiced + received)
        cls.os_closed = ServiceOrder.objects.create(
            number=9101,
            plate="LST1001",
            customer_name="Fechada",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=True,
            created_by=cls.user,
        )
        _make_receivable(cls.os_closed, status="received")

        # OS 2: delivered + invoiced + recebível aberto (pendente pagamento)
        cls.os_pending_payment = ServiceOrder.objects.create(
            number=9102,
            plate="LST1002",
            customer_name="Pendente Pagamento",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=True,
            created_by=cls.user,
        )
        _make_receivable(cls.os_pending_payment, status="open")

        # OS 3: delivered sem nota (pendente faturamento)
        cls.os_pending_invoice = ServiceOrder.objects.create(
            number=9103,
            plate="LST1003",
            customer_name="Pendente Fatura",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=False,
            created_by=cls.user,
        )

        # OS 4: em reparo (não delivered)
        cls.os_in_repair = ServiceOrder.objects.create(
            number=9104,
            plate="LST1004",
            customer_name="Em Reparo",
            status=ServiceOrderStatus.REPAIR,
            created_by=cls.user,
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.client.defaults["SERVER_NAME"] = "tenant.test.com"

    LIST_URL = "/api/v1/service-orders/"

    def _list_numbers(self, resp) -> list[int]:
        results = resp.data.get("results", resp.data)
        return [item["number"] for item in results]

    # ── Caso 5: listagem inclui closure_status ────────────────────────────────

    def test_list_includes_closure_status_field(self) -> None:
        """O endpoint de listagem deve incluir o campo closure_status em cada item."""
        resp = self.client.get(self.LIST_URL)
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get("results", resp.data)
        self.assertTrue(len(results) > 0)
        for item in results:
            self.assertIn("closure_status", item)

    def test_list_closure_status_none_for_non_delivered(self) -> None:
        """OS não entregue deve ter closure_status=None na listagem."""
        resp = self.client.get(self.LIST_URL)
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get("results", resp.data)
        in_repair = next(
            (item for item in results if item["number"] == 9104), None
        )
        self.assertIsNotNone(in_repair)
        self.assertIsNone(in_repair["closure_status"])

    def test_list_closure_status_is_closed_for_closed_os(self) -> None:
        """OS fechada deve ter closure_status.is_closed=True na listagem."""
        resp = self.client.get(self.LIST_URL)
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get("results", resp.data)
        closed_item = next(
            (item for item in results if item["number"] == 9101), None
        )
        self.assertIsNotNone(closed_item)
        cs = closed_item["closure_status"]
        self.assertIsNotNone(cs)
        self.assertTrue(cs["is_closed"])

    # ── Caso 6: filtro ?closure=closed ───────────────────────────────────────

    def test_filter_closure_closed_returns_only_fully_closed(self) -> None:
        """?closure=closed retorna somente OS totalmente fechadas."""
        resp = self.client.get(self.LIST_URL, {"closure": "closed"})
        self.assertEqual(resp.status_code, 200)
        numbers = self._list_numbers(resp)
        self.assertIn(9101, numbers)
        self.assertNotIn(9102, numbers)
        self.assertNotIn(9103, numbers)
        self.assertNotIn(9104, numbers)

    # ── Caso 7: filtro ?closure=pending ──────────────────────────────────────

    def test_filter_closure_pending_returns_delivered_with_pending_conditions(self) -> None:
        """?closure=pending retorna OS delivered que não estão totalmente fechadas."""
        resp = self.client.get(self.LIST_URL, {"closure": "pending"})
        self.assertEqual(resp.status_code, 200)
        numbers = self._list_numbers(resp)
        self.assertNotIn(9101, numbers)  # fechada — excluída
        self.assertIn(9102, numbers)     # delivered + invoice + recebível aberto
        self.assertIn(9103, numbers)     # delivered + sem nota
        self.assertNotIn(9104, numbers)  # em reparo — não delivered
