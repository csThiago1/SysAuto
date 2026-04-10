"""
Paddock Solutions — Accounts Receivable Service Tests — Sprint 14

Suíte simétrica ao AP para ReceivableDocumentService.
Usa TenantTestCase para isolamento de schema por tenant.
"""
import hashlib
import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.accounts_receivable.models import (
    ReceivableDocument,
    ReceivableReceipt,
    ReceivableStatus,
)
from apps.accounts_receivable.services import ReceivableDocumentService


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_user(email: str = "ar_test@dscar.com", name: str = "AR Test User") -> GlobalUser:
    """Cria GlobalUser com email_hash calculado — necessário para unique constraint."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email, password="test123", name=name, email_hash=email_hash
    )


# ── Base ──────────────────────────────────────────────────────────────────────


class ARServiceTestCase(TenantTestCase):
    """Base: TenantTestCase com usuário e customer_id prontos para cada teste."""

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user()
        # customer_id é referência livre (sem FK cross-schema)
        self.customer_id = str(uuid.uuid4())
        self.customer_name = "Cliente Teste AR"

    def _create_receivable(
        self,
        due_date: date | None = None,
        amount: Decimal = Decimal("1000.00"),
        competence_date: date | None = None,
        service_order_id: str | None = None,
    ) -> ReceivableDocument:
        """Helper para criar ReceivableDocument com valores padrão."""
        today = date.today()
        return ReceivableDocumentService.create_receivable(
            customer_id=self.customer_id,
            customer_name=self.customer_name,
            description="OS Teste AR",
            amount=amount,
            due_date=due_date or (today + timedelta(days=30)),
            competence_date=competence_date or today,
            service_order_id=service_order_id,
            user=self.user,
        )


# ── TC-AR-01 a TC-AR-08 ───────────────────────────────────────────────────────


class TestCreateReceivable(ARServiceTestCase):
    """Testes de criação de títulos a receber."""

    def test_create_with_service_order_id_links_correctly(self) -> None:
        """TC-AR-01: título criado com service_order_id deve manter a referência persistida."""
        so_id = str(uuid.uuid4())
        doc = self._create_receivable(service_order_id=so_id)
        self.assertEqual(str(doc.service_order_id), so_id)
        self.assertEqual(doc.status, ReceivableStatus.OPEN)

    def test_create_without_service_order_id_has_null_reference(self) -> None:
        """TC-AR-01b: título sem service_order_id deve ter service_order_id nulo."""
        doc = self._create_receivable()
        self.assertIsNone(doc.service_order_id)

    def test_create_with_past_due_date_returns_overdue_status(self) -> None:
        """TC-AR-02: título com vencimento passado deve ter status=overdue imediatamente."""
        past = date.today() - timedelta(days=1)
        doc = self._create_receivable(due_date=past)
        self.assertEqual(doc.status, ReceivableStatus.OVERDUE)

    def test_create_with_future_due_date_returns_open_status(self) -> None:
        """TC-AR-02b: título com vencimento futuro deve ter status=open e amount_received=0."""
        doc = self._create_receivable()
        self.assertEqual(doc.status, ReceivableStatus.OPEN)
        self.assertEqual(doc.amount_received, Decimal("0.00"))

    def test_create_with_zero_amount_raises_validation_error(self) -> None:
        """TC-AR-02c: amount=0 deve levantar ValidationError com chave 'amount'."""
        with self.assertRaises(ValidationError) as ctx:
            self._create_receivable(amount=Decimal("0.00"))
        self.assertIn("amount", ctx.exception.message_dict)

    def test_customer_name_is_persisted_correctly(self) -> None:
        """TC-AR-01c: nome do cliente deve ser desnormalizado e persistido."""
        doc = self._create_receivable()
        self.assertEqual(doc.customer_name, self.customer_name)
        self.assertEqual(str(doc.customer_id), self.customer_id)


class TestRecordReceipt(ARServiceTestCase):
    """Testes de registro de baixa de recebimento."""

    def test_partial_receipt_updates_amount_received_and_status(self) -> None:
        """TC-AR-03: recebimento parcial atualiza amount_received e status para partial."""
        doc = self._create_receivable(amount=Decimal("1000.00"))
        receipt = ReceivableDocumentService.record_receipt(
            document_id=str(doc.id),
            receipt_date=date.today(),
            amount=Decimal("350.00"),
            user=self.user,
        )
        doc.refresh_from_db()
        self.assertIsInstance(receipt, ReceivableReceipt)
        self.assertEqual(doc.amount_received, Decimal("350.00"))
        self.assertEqual(doc.status, ReceivableStatus.PARTIAL)

    def test_partial_receipt_creates_receivable_receipt_record(self) -> None:
        """TC-AR-03b: recebimento parcial deve criar exatamente um ReceivableReceipt."""
        doc = self._create_receivable(amount=Decimal("1000.00"))
        ReceivableDocumentService.record_receipt(
            document_id=str(doc.id),
            receipt_date=date.today(),
            amount=Decimal("350.00"),
            user=self.user,
        )
        self.assertEqual(ReceivableReceipt.objects.filter(document=doc).count(), 1)

    def test_full_receipt_sets_status_received(self) -> None:
        """TC-AR-04: recebimento que quita o total atualiza status para received."""
        doc = self._create_receivable(amount=Decimal("1000.00"))
        ReceivableDocumentService.record_receipt(
            document_id=str(doc.id),
            receipt_date=date.today(),
            amount=Decimal("1000.00"),
            user=self.user,
        )
        doc.refresh_from_db()
        self.assertEqual(doc.status, ReceivableStatus.RECEIVED)

    def test_receipt_exceeding_balance_raises_validation_error(self) -> None:
        """TC-AR-05: recebimento acima do saldo restante deve levantar ValidationError."""
        doc = self._create_receivable(amount=Decimal("1000.00"))
        with self.assertRaises(ValidationError) as ctx:
            ReceivableDocumentService.record_receipt(
                document_id=str(doc.id),
                receipt_date=date.today(),
                amount=Decimal("2000.00"),
                user=self.user,
            )
        self.assertIn("amount", ctx.exception.message_dict)

    def test_receipt_on_received_document_raises_validation_error(self) -> None:
        """TC-AR-05b: recebimento em título já recebido deve levantar ValidationError."""
        doc = self._create_receivable(amount=Decimal("500.00"))
        ReceivableDocumentService.record_receipt(
            document_id=str(doc.id),
            receipt_date=date.today(),
            amount=Decimal("500.00"),
            user=self.user,
        )
        with self.assertRaises(ValidationError) as ctx:
            ReceivableDocumentService.record_receipt(
                document_id=str(doc.id),
                receipt_date=date.today(),
                amount=Decimal("1.00"),
                user=self.user,
            )
        self.assertIn("detail", ctx.exception.message_dict)

    def test_receipt_on_cancelled_document_raises_validation_error(self) -> None:
        """TC-AR-05c: recebimento em título cancelado deve levantar ValidationError."""
        doc = self._create_receivable(amount=Decimal("500.00"))
        ReceivableDocumentService.cancel_receivable(
            document_id=str(doc.id),
            reason="OS cancelada",
            user=self.user,
        )
        with self.assertRaises(ValidationError) as ctx:
            ReceivableDocumentService.record_receipt(
                document_id=str(doc.id),
                receipt_date=date.today(),
                amount=Decimal("500.00"),
                user=self.user,
            )
        self.assertIn("detail", ctx.exception.message_dict)

    def test_two_partial_receipts_aggregate_correctly(self) -> None:
        """TC-AR-03c: dois recebimentos parciais devem somar corretamente em amount_received."""
        doc = self._create_receivable(amount=Decimal("1000.00"))
        ReceivableDocumentService.record_receipt(
            document_id=str(doc.id),
            receipt_date=date.today(),
            amount=Decimal("200.00"),
            user=self.user,
        )
        ReceivableDocumentService.record_receipt(
            document_id=str(doc.id),
            receipt_date=date.today(),
            amount=Decimal("300.00"),
            user=self.user,
        )
        doc.refresh_from_db()
        self.assertEqual(doc.amount_received, Decimal("500.00"))
        self.assertEqual(doc.status, ReceivableStatus.PARTIAL)


class TestCancelReceivable(ARServiceTestCase):
    """Testes de cancelamento de títulos a receber."""

    def test_cancel_open_document_sets_cancelled_status(self) -> None:
        """TC-AR-06: cancelar título aberto deve setar status=cancelled e cancelled_at."""
        doc = self._create_receivable()
        result = ReceivableDocumentService.cancel_receivable(
            document_id=str(doc.id),
            reason="OS cancelada pelo cliente",
            user=self.user,
        )
        self.assertEqual(result.status, ReceivableStatus.CANCELLED)
        self.assertIsNotNone(result.cancelled_at)
        self.assertEqual(result.cancelled_by, self.user)
        self.assertEqual(result.cancel_reason, "OS cancelada pelo cliente")

    def test_cancel_received_document_raises_validation_error(self) -> None:
        """TC-AR-07: cancelar título já recebido deve levantar ValidationError."""
        doc = self._create_receivable(amount=Decimal("500.00"))
        ReceivableDocumentService.record_receipt(
            document_id=str(doc.id),
            receipt_date=date.today(),
            amount=Decimal("500.00"),
            user=self.user,
        )
        with self.assertRaises(ValidationError) as ctx:
            ReceivableDocumentService.cancel_receivable(
                document_id=str(doc.id),
                reason="Tentativa inválida",
                user=self.user,
            )
        self.assertIn("detail", ctx.exception.message_dict)

    def test_cancel_already_cancelled_document_raises_validation_error(self) -> None:
        """TC-AR-07b: cancelar título já cancelado deve levantar ValidationError."""
        doc = self._create_receivable()
        ReceivableDocumentService.cancel_receivable(
            document_id=str(doc.id),
            reason="Primeira vez",
            user=self.user,
        )
        with self.assertRaises(ValidationError) as ctx:
            ReceivableDocumentService.cancel_receivable(
                document_id=str(doc.id),
                reason="Segunda vez",
                user=self.user,
            )
        self.assertIn("detail", ctx.exception.message_dict)


class TestRefreshOverdueStatusAR(ARServiceTestCase):
    """Testes do job de atualização de status vencidos em AR."""

    def test_refresh_marks_open_overdue_documents(self) -> None:
        """TC-AR-08: refresh_overdue_status marca open/partial vencidos como overdue."""
        past = date.today() - timedelta(days=5)
        doc_open = ReceivableDocument.objects.create(
            customer_id=self.customer_id,
            customer_name=self.customer_name,
            description="AR Vencido Open",
            amount=Decimal("200.00"),
            due_date=past,
            competence_date=past,
            status=ReceivableStatus.OPEN,
            created_by=self.user,
        )
        doc_partial = ReceivableDocument.objects.create(
            customer_id=self.customer_id,
            customer_name=self.customer_name,
            description="AR Vencido Partial",
            amount=Decimal("500.00"),
            amount_received=Decimal("100.00"),
            due_date=past,
            competence_date=past,
            status=ReceivableStatus.PARTIAL,
            created_by=self.user,
        )
        count = ReceivableDocumentService.refresh_overdue_status()
        self.assertGreaterEqual(count, 2)
        doc_open.refresh_from_db()
        doc_partial.refresh_from_db()
        self.assertEqual(doc_open.status, ReceivableStatus.OVERDUE)
        self.assertEqual(doc_partial.status, ReceivableStatus.OVERDUE)

    def test_refresh_ignores_received_and_cancelled_documents(self) -> None:
        """TC-AR-08b: refresh_overdue_status não altera títulos received ou cancelled."""
        past = date.today() - timedelta(days=10)
        doc_received = ReceivableDocument.objects.create(
            customer_id=self.customer_id,
            customer_name=self.customer_name,
            description="AR Recebido",
            amount=Decimal("300.00"),
            amount_received=Decimal("300.00"),
            due_date=past,
            competence_date=past,
            status=ReceivableStatus.RECEIVED,
            created_by=self.user,
        )
        doc_cancelled = ReceivableDocument.objects.create(
            customer_id=self.customer_id,
            customer_name=self.customer_name,
            description="AR Cancelado",
            amount=Decimal("300.00"),
            due_date=past,
            competence_date=past,
            status=ReceivableStatus.CANCELLED,
            created_by=self.user,
        )
        ReceivableDocumentService.refresh_overdue_status()
        doc_received.refresh_from_db()
        doc_cancelled.refresh_from_db()
        self.assertEqual(doc_received.status, ReceivableStatus.RECEIVED)
        self.assertEqual(doc_cancelled.status, ReceivableStatus.CANCELLED)

    def test_refresh_returns_count_of_updated_documents(self) -> None:
        """TC-AR-08c: refresh_overdue_status retorna quantidade de títulos atualizados."""
        past = date.today() - timedelta(days=3)
        for i in range(2):
            ReceivableDocument.objects.create(
                customer_id=self.customer_id,
                customer_name=self.customer_name,
                description=f"AR {i}",
                amount=Decimal("150.00"),
                due_date=past,
                competence_date=past,
                status=ReceivableStatus.OPEN,
                created_by=self.user,
            )
        count = ReceivableDocumentService.refresh_overdue_status()
        self.assertGreaterEqual(count, 2)
