"""
Paddock Solutions — Accounts Payable Service Tests — Sprint 14

Suíte completa para PayableDocumentService.
Usa TenantTestCase para isolamento de schema por tenant.
"""
import hashlib
from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.accounts_payable.models import (
    DocumentStatus,
    PayableDocument,
    PayablePayment,
    Supplier,
)
from apps.accounts_payable.services import PayableDocumentService


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_user(email: str = "test@dscar.com", name: str = "Test User") -> GlobalUser:
    """Cria GlobalUser com email_hash calculado — necessário para unique constraint."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email, password="test123", name=name, email_hash=email_hash
    )


# ── Base ──────────────────────────────────────────────────────────────────────


class APServiceTestCase(TenantTestCase):
    """Base: TenantTestCase com usuário e fornecedor prontos para cada teste."""

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user()
        self.supplier = Supplier.objects.create(
            name="Fornecedor Teste",
            created_by=self.user,
        )

    def _create_payable(
        self,
        due_date: date | None = None,
        amount: Decimal = Decimal("1000.00"),
        competence_date: date | None = None,
    ) -> PayableDocument:
        """Helper para criar PayableDocument com valores padrão."""
        today = date.today()
        return PayableDocumentService.create_payable(
            supplier_id=str(self.supplier.id),
            description="Nota Fiscal Teste",
            amount=amount,
            due_date=due_date or (today + timedelta(days=30)),
            competence_date=competence_date or today,
            user=self.user,
        )


# ── TC-AP-01 a TC-AP-11 ───────────────────────────────────────────────────────


class TestCreatePayable(APServiceTestCase):
    """Testes de criação de títulos a pagar."""

    def test_create_with_future_due_date_returns_open_status(self) -> None:
        """TC-AP-01: título com vencimento futuro deve ter status=open e amount_paid=0."""
        future = date.today() + timedelta(days=30)
        doc = self._create_payable(due_date=future)
        self.assertEqual(doc.status, DocumentStatus.OPEN)
        self.assertEqual(doc.amount_paid, Decimal("0.00"))

    def test_create_with_past_due_date_returns_overdue_status(self) -> None:
        """TC-AP-02: título com vencimento passado deve ter status=overdue imediatamente."""
        past = date.today() - timedelta(days=1)
        doc = self._create_payable(due_date=past)
        self.assertEqual(doc.status, DocumentStatus.OVERDUE)

    def test_create_with_zero_amount_raises_validation_error(self) -> None:
        """TC-AP-03: amount=0 deve levantar ValidationError com chave 'amount'."""
        with self.assertRaises(ValidationError) as ctx:
            self._create_payable(amount=Decimal("0.00"))
        self.assertIn("amount", ctx.exception.message_dict)

    def test_create_with_negative_amount_raises_validation_error(self) -> None:
        """TC-AP-03b: amount negativo também deve levantar ValidationError com chave 'amount'."""
        with self.assertRaises(ValidationError) as ctx:
            self._create_payable(amount=Decimal("-50.00"))
        self.assertIn("amount", ctx.exception.message_dict)


class TestRecordPayment(APServiceTestCase):
    """Testes de registro de baixa de pagamento."""

    def test_partial_payment_updates_amount_paid_and_status(self) -> None:
        """TC-AP-04: pagamento parcial atualiza amount_paid e status para partial."""
        doc = self._create_payable(amount=Decimal("1000.00"))
        payment = PayableDocumentService.record_payment(
            document_id=str(doc.id),
            payment_date=date.today(),
            amount=Decimal("400.00"),
            user=self.user,
        )
        doc.refresh_from_db()
        self.assertIsInstance(payment, PayablePayment)
        self.assertEqual(doc.amount_paid, Decimal("400.00"))
        self.assertEqual(doc.status, DocumentStatus.PARTIAL)

    def test_partial_payment_creates_payable_payment_record(self) -> None:
        """TC-AP-04b: registro de pagamento parcial deve criar exatamente um PayablePayment."""
        doc = self._create_payable(amount=Decimal("1000.00"))
        PayableDocumentService.record_payment(
            document_id=str(doc.id),
            payment_date=date.today(),
            amount=Decimal("400.00"),
            user=self.user,
        )
        self.assertEqual(PayablePayment.objects.filter(document=doc).count(), 1)

    def test_full_payment_sets_status_paid(self) -> None:
        """TC-AP-05: pagamento que quita o total atualiza status para paid."""
        doc = self._create_payable(amount=Decimal("1000.00"))
        PayableDocumentService.record_payment(
            document_id=str(doc.id),
            payment_date=date.today(),
            amount=Decimal("1000.00"),
            user=self.user,
        )
        doc.refresh_from_db()
        self.assertEqual(doc.status, DocumentStatus.PAID)

    def test_payment_exceeding_balance_raises_validation_error(self) -> None:
        """TC-AP-06: pagamento acima do saldo restante deve levantar ValidationError."""
        doc = self._create_payable(amount=Decimal("1000.00"))
        with self.assertRaises(ValidationError) as ctx:
            PayableDocumentService.record_payment(
                document_id=str(doc.id),
                payment_date=date.today(),
                amount=Decimal("1500.00"),
                user=self.user,
            )
        self.assertIn("amount", ctx.exception.message_dict)

    def test_payment_on_paid_document_raises_validation_error(self) -> None:
        """TC-AP-07: pagamento em título já pago deve levantar ValidationError."""
        doc = self._create_payable(amount=Decimal("1000.00"))
        PayableDocumentService.record_payment(
            document_id=str(doc.id),
            payment_date=date.today(),
            amount=Decimal("1000.00"),
            user=self.user,
        )
        with self.assertRaises(ValidationError) as ctx:
            PayableDocumentService.record_payment(
                document_id=str(doc.id),
                payment_date=date.today(),
                amount=Decimal("1.00"),
                user=self.user,
            )
        self.assertIn("detail", ctx.exception.message_dict)

    def test_payment_on_cancelled_document_raises_validation_error(self) -> None:
        """TC-AP-08: pagamento em título cancelado deve levantar ValidationError."""
        doc = self._create_payable(amount=Decimal("1000.00"))
        PayableDocumentService.cancel_payable(
            document_id=str(doc.id),
            reason="Duplicado",
            user=self.user,
        )
        with self.assertRaises(ValidationError) as ctx:
            PayableDocumentService.record_payment(
                document_id=str(doc.id),
                payment_date=date.today(),
                amount=Decimal("500.00"),
                user=self.user,
            )
        self.assertIn("detail", ctx.exception.message_dict)

    def test_two_partial_payments_aggregate_correctly(self) -> None:
        """TC-AP-04c: duas baixas parciais devem somar corretamente em amount_paid."""
        doc = self._create_payable(amount=Decimal("1000.00"))
        PayableDocumentService.record_payment(
            document_id=str(doc.id),
            payment_date=date.today(),
            amount=Decimal("300.00"),
            user=self.user,
        )
        PayableDocumentService.record_payment(
            document_id=str(doc.id),
            payment_date=date.today(),
            amount=Decimal("400.00"),
            user=self.user,
        )
        doc.refresh_from_db()
        self.assertEqual(doc.amount_paid, Decimal("700.00"))
        self.assertEqual(doc.status, DocumentStatus.PARTIAL)


class TestCancelPayable(APServiceTestCase):
    """Testes de cancelamento de títulos a pagar."""

    def test_cancel_open_document_sets_cancelled_status(self) -> None:
        """TC-AP-09: cancelar título aberto deve setar status=cancelled e cancelled_at."""
        doc = self._create_payable()
        result = PayableDocumentService.cancel_payable(
            document_id=str(doc.id),
            reason="Pedido duplicado",
            user=self.user,
        )
        self.assertEqual(result.status, DocumentStatus.CANCELLED)
        self.assertIsNotNone(result.cancelled_at)
        self.assertEqual(result.cancelled_by, self.user)
        self.assertEqual(result.cancel_reason, "Pedido duplicado")

    def test_cancel_paid_document_raises_validation_error(self) -> None:
        """TC-AP-10: cancelar título pago deve levantar ValidationError."""
        doc = self._create_payable(amount=Decimal("500.00"))
        PayableDocumentService.record_payment(
            document_id=str(doc.id),
            payment_date=date.today(),
            amount=Decimal("500.00"),
            user=self.user,
        )
        with self.assertRaises(ValidationError) as ctx:
            PayableDocumentService.cancel_payable(
                document_id=str(doc.id),
                reason="Tentativa inválida",
                user=self.user,
            )
        self.assertIn("detail", ctx.exception.message_dict)

    def test_cancel_already_cancelled_document_raises_validation_error(self) -> None:
        """TC-AP-10b: cancelar título já cancelado deve levantar ValidationError."""
        doc = self._create_payable()
        PayableDocumentService.cancel_payable(
            document_id=str(doc.id),
            reason="Primeira vez",
            user=self.user,
        )
        with self.assertRaises(ValidationError) as ctx:
            PayableDocumentService.cancel_payable(
                document_id=str(doc.id),
                reason="Segunda vez",
                user=self.user,
            )
        self.assertIn("detail", ctx.exception.message_dict)


class TestRefreshOverdueStatus(APServiceTestCase):
    """Testes do job de atualização de status vencidos."""

    def test_refresh_marks_open_overdue_documents(self) -> None:
        """TC-AP-11: refresh_overdue_status marca open/partial vencidos como overdue."""
        past = date.today() - timedelta(days=5)
        # Cria diretamente com status OPEN forçando due_date no passado via ORM
        doc_open = PayableDocument.objects.create(
            supplier=self.supplier,
            description="Titulo Vencido Open",
            amount=Decimal("200.00"),
            due_date=past,
            competence_date=past,
            status=DocumentStatus.OPEN,
            created_by=self.user,
        )
        doc_partial = PayableDocument.objects.create(
            supplier=self.supplier,
            description="Titulo Vencido Partial",
            amount=Decimal("500.00"),
            amount_paid=Decimal("100.00"),
            due_date=past,
            competence_date=past,
            status=DocumentStatus.PARTIAL,
            created_by=self.user,
        )
        count = PayableDocumentService.refresh_overdue_status()
        self.assertGreaterEqual(count, 2)
        doc_open.refresh_from_db()
        doc_partial.refresh_from_db()
        self.assertEqual(doc_open.status, DocumentStatus.OVERDUE)
        self.assertEqual(doc_partial.status, DocumentStatus.OVERDUE)

    def test_refresh_ignores_paid_and_cancelled_documents(self) -> None:
        """TC-AP-11b: refresh_overdue_status não altera títulos paid ou cancelled."""
        past = date.today() - timedelta(days=10)
        doc_paid = PayableDocument.objects.create(
            supplier=self.supplier,
            description="Titulo Pago",
            amount=Decimal("300.00"),
            amount_paid=Decimal("300.00"),
            due_date=past,
            competence_date=past,
            status=DocumentStatus.PAID,
            created_by=self.user,
        )
        doc_cancelled = PayableDocument.objects.create(
            supplier=self.supplier,
            description="Titulo Cancelado",
            amount=Decimal("300.00"),
            due_date=past,
            competence_date=past,
            status=DocumentStatus.CANCELLED,
            created_by=self.user,
        )
        PayableDocumentService.refresh_overdue_status()
        doc_paid.refresh_from_db()
        doc_cancelled.refresh_from_db()
        self.assertEqual(doc_paid.status, DocumentStatus.PAID)
        self.assertEqual(doc_cancelled.status, DocumentStatus.CANCELLED)

    def test_refresh_returns_count_of_updated_documents(self) -> None:
        """TC-AP-11c: refresh_overdue_status retorna quantidade de títulos atualizados."""
        past = date.today() - timedelta(days=3)
        for i in range(3):
            PayableDocument.objects.create(
                supplier=self.supplier,
                description=f"Titulo {i}",
                amount=Decimal("100.00"),
                due_date=past,
                competence_date=past,
                status=DocumentStatus.OPEN,
                created_by=self.user,
            )
        count = PayableDocumentService.refresh_overdue_status()
        self.assertGreaterEqual(count, 3)
