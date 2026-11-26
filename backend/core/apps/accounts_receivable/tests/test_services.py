"""
Paddock Solutions — Accounts Receivable Service Tests — Sprint 14

Suíte simétrica ao AP para ReceivableDocumentService.
Usa TenantTestCase para isolamento de schema por tenant.
"""

import hashlib
import uuid
from datetime import date, datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest import mock

from django.core.exceptions import ValidationError
from django_tenants.test.cases import TenantTestCase

from apps.accounting.models import JournalEntry
from apps.accounting.tests.base import make_account
from apps.accounts_receivable.models import ReceivableDocument, ReceivableReceipt, ReceivableStatus
from apps.accounts_receivable.services import ReceivableDocumentService
from apps.authentication.models import GlobalUser

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

    def _receive(self, doc: ReceivableDocument, amount: str) -> ReceivableReceipt:
        """Helper para dar baixa em um titulo."""
        return ReceivableDocumentService.record_receipt(
            document_id=str(doc.id),
            receipt_date=date.today(),
            amount=Decimal(amount),
            user=self.user,
        )

    def _make_ar_accounts(self) -> None:
        """Contas que a baixa usa: com elas o recebimento gera lancamento contabil."""
        make_account(code="1.1.01.002", name="Banco Bradesco C/C")
        make_account(code="1.1.02.001", name="Clientes a Receber")


REVERSE_ENTRY = "apps.accounting.services.journal_entry_service.JournalEntryService.reverse_entry"


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

    def test_due_on_local_day_is_open_when_utc_is_already_next_day(self) -> None:
        """21h em Manaus ja e o dia seguinte em UTC: vencimento no dia local nasce OPEN."""
        local_day = date(2026, 3, 10)
        utc_next_day = datetime(2026, 3, 11, 1, 0, tzinfo=dt_timezone.utc)
        with mock.patch("django.utils.timezone.now", return_value=utc_next_day):
            doc = self._create_receivable(due_date=local_day, competence_date=local_day)
            updated = ReceivableDocumentService.refresh_overdue_status()
        self.assertEqual(doc.status, ReceivableStatus.OPEN)
        self.assertEqual(updated, 0)

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


class TestReverseReceipt(ARServiceTestCase):
    """Estorno de uma baixa: a baixa fica inativa e o titulo e recalculado."""

    def _reverse(
        self, doc: ReceivableDocument, receipt: ReceivableReceipt, reason: str = "Titulo errado"
    ) -> ReceivableDocument:
        return ReceivableDocumentService.reverse_receipt(
            document_id=str(doc.id), receipt_id=str(receipt.id), reason=reason, user=self.user
        )

    def test_reverse_only_receipt_reopens_document(self) -> None:
        """Estornar a unica baixa de um titulo recebido devolve o titulo para em aberto."""
        doc = self._create_receivable(amount=Decimal("1000.00"))
        receipt = self._receive(doc, "1000.00")

        result = self._reverse(doc, receipt)

        receipt.refresh_from_db()
        self.assertFalse(receipt.is_active)
        self.assertIsNotNone(receipt.reversed_at)
        self.assertEqual(receipt.reversed_by, self.user)
        self.assertEqual(receipt.reverse_reason, "Titulo errado")
        self.assertEqual(ReceivableReceipt.objects.filter(document=doc).count(), 1)
        doc.refresh_from_db()
        self.assertEqual(result.id, doc.id)
        self.assertEqual(doc.amount_received, Decimal("0.00"))
        self.assertEqual(doc.status, ReceivableStatus.OPEN)

    def test_reverse_on_past_due_document_goes_overdue(self) -> None:
        """Sem recebimento e com vencimento passado, o titulo volta para vencido."""
        doc = self._create_receivable(due_date=date.today() - timedelta(days=3))
        receipt = self._receive(doc, "300.00")
        self._reverse(doc, receipt)
        doc.refresh_from_db()
        self.assertEqual(doc.status, ReceivableStatus.OVERDUE)

    def test_reverse_one_of_two_receipts_keeps_partial(self) -> None:
        """So a baixa estornada sai da soma: o titulo continua parcial com a outra."""
        doc = self._create_receivable(amount=Decimal("1000.00"))
        first = self._receive(doc, "200.00")
        self._receive(doc, "300.00")
        self._reverse(doc, first)
        doc.refresh_from_db()
        self.assertEqual(doc.amount_received, Decimal("300.00"))
        self.assertEqual(doc.status, ReceivableStatus.PARTIAL)

    def test_reverse_refuses_reversed_receipt_cancelled_document_and_empty_reason(self) -> None:
        """Baixa ja estornada, titulo cancelado e motivo vazio: ValidationError em 'detail'."""
        doc = self._create_receivable(amount=Decimal("1000.00"))
        first = self._receive(doc, "200.00")
        second = self._receive(doc, "300.00")

        with self.assertRaises(ValidationError) as ctx:
            self._reverse(doc, second, reason="   ")
        self.assertIn("detail", ctx.exception.message_dict)

        self._reverse(doc, first)
        with self.assertRaises(ValidationError) as ctx:
            self._reverse(doc, first)
        self.assertIn("detail", ctx.exception.message_dict)

        ReceivableDocument.objects.filter(id=doc.id).update(status=ReceivableStatus.CANCELLED)
        with self.assertRaises(ValidationError) as ctx:
            self._reverse(doc, second)
        self.assertIn("detail", ctx.exception.message_dict)
        second.refresh_from_db()
        self.assertTrue(second.is_active)

    def test_reverse_reverses_journal_entry(self) -> None:
        """O lancamento contabil da baixa e estornado junto."""
        self._make_ar_accounts()
        doc = self._create_receivable(amount=Decimal("1000.00"))
        receipt = self._receive(doc, "400.00")
        self.assertIsNotNone(receipt.journal_entry_id)

        self._reverse(doc, receipt)

        self.assertTrue(JournalEntry.objects.get(id=receipt.journal_entry_id).is_reversed)

    def test_reverse_when_entry_was_already_reversed_in_accounting(self) -> None:
        """Lancamento ja estornado a mao na contabilidade: a baixa so e desativada."""
        from apps.accounting.services.journal_entry_service import JournalEntryService

        self._make_ar_accounts()
        doc = self._create_receivable(amount=Decimal("1000.00"))
        receipt = self._receive(doc, "400.00")
        entry = JournalEntry.objects.get(id=receipt.journal_entry_id)
        JournalEntryService.reverse_entry(entry=entry, user=self.user)

        self._reverse(doc, receipt)

        receipt.refresh_from_db()
        doc.refresh_from_db()
        self.assertFalse(receipt.is_active)
        self.assertEqual(doc.amount_received, Decimal("0.00"))

    def test_receive_again_after_reversal(self) -> None:
        """Depois do estorno o titulo aceita nova baixa e so a ativa conta."""
        doc = self._create_receivable(amount=Decimal("1000.00"))
        self._reverse(doc, self._receive(doc, "1000.00"))

        self._receive(doc, "1000.00")

        doc.refresh_from_db()
        self.assertEqual(doc.amount_received, Decimal("1000.00"))
        self.assertEqual(doc.status, ReceivableStatus.RECEIVED)
        self.assertEqual(doc.receipts.filter(is_active=True).count(), 1)

    def test_reverse_fails_and_changes_nothing_when_accounting_fails(self) -> None:
        """Falha no estorno contabil propaga e a baixa continua valendo."""
        self._make_ar_accounts()
        doc = self._create_receivable(amount=Decimal("1000.00"))
        receipt = self._receive(doc, "400.00")

        with mock.patch(REVERSE_ENTRY, side_effect=ValidationError("Periodo fechado")):
            with self.assertRaises(ValidationError):
                self._reverse(doc, receipt)

        receipt.refresh_from_db()
        doc.refresh_from_db()
        self.assertTrue(receipt.is_active)
        self.assertEqual(doc.amount_received, Decimal("400.00"))
        self.assertEqual(doc.status, ReceivableStatus.PARTIAL)


class TestCancelReceivableWithReceipts(ARServiceTestCase):
    """Cancelar titulo parcial estorna e desativa as baixas e zera o recebido."""

    def _cancel(self, doc: ReceivableDocument, reason: str = "OS cancelada") -> ReceivableDocument:
        return ReceivableDocumentService.cancel_receivable(
            document_id=str(doc.id), reason=reason, user=self.user
        )

    def test_cancel_partial_document_reverses_and_deactivates_receipts(self) -> None:
        """Baixas ficam inativas com o motivo, lancamentos estornados e recebido zerado."""
        self._make_ar_accounts()
        doc = self._create_receivable(amount=Decimal("1000.00"))
        receipt = self._receive(doc, "400.00")

        self._cancel(doc)

        doc.refresh_from_db()
        receipt.refresh_from_db()
        self.assertEqual(doc.status, ReceivableStatus.CANCELLED)
        self.assertEqual(doc.amount_received, Decimal("0.00"))
        self.assertFalse(receipt.is_active)
        self.assertEqual(receipt.reversed_by, self.user)
        self.assertIsNotNone(receipt.reversed_at)
        self.assertEqual(receipt.reverse_reason, "Titulo cancelado: OS cancelada")
        self.assertTrue(JournalEntry.objects.get(id=receipt.journal_entry_id).is_reversed)

    def test_dashboard_ignores_active_receipt_of_cancelled_document(self) -> None:
        """Titulo cancelado pelo codigo antigo ficou com baixa ativa: nao conta no painel."""
        from apps.accounting.services.financial_dashboard import FinancialDashboardService

        doc = self._create_receivable(amount=Decimal("1000.00"))
        self._receive(doc, "300.00")
        today = date.today()
        self.assertEqual(
            Decimal(FinancialDashboardService._total_received(today, today)), Decimal("300.00")
        )

        ReceivableDocument.objects.filter(id=doc.id).update(status=ReceivableStatus.CANCELLED)

        self.assertEqual(
            Decimal(FinancialDashboardService._total_received(today, today)), Decimal("0")
        )

    def test_cancel_cuts_reverse_reason_at_200(self) -> None:
        """O motivo gravado na baixa cabe no campo mesmo com motivo de cancelamento longo."""
        doc = self._create_receivable(amount=Decimal("1000.00"))
        receipt = self._receive(doc, "400.00")
        self._cancel(doc, reason="x" * 195)
        receipt.refresh_from_db()
        self.assertEqual(len(receipt.reverse_reason), 200)

    def test_cancel_fails_and_rolls_back_when_accounting_fails(self) -> None:
        """Falha no estorno de uma baixa desfaz tudo: titulo e baixas ficam como estavam."""
        self._make_ar_accounts()
        doc = self._create_receivable(amount=Decimal("1000.00"))
        first = self._receive(doc, "200.00")
        second = self._receive(doc, "300.00")

        # a primeira baixa estorna, a segunda falha
        with mock.patch(REVERSE_ENTRY, side_effect=[mock.Mock(), ValidationError("Falhou")]):
            with self.assertRaises(ValidationError):
                self._cancel(doc)

        doc.refresh_from_db()
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(doc.status, ReceivableStatus.PARTIAL)
        self.assertEqual(doc.amount_received, Decimal("500.00"))
        self.assertTrue(first.is_active)
        self.assertTrue(second.is_active)


class TestRecordReceiptsBatch(ARServiceTestCase):
    """Baixa em lote: cada titulo pelo saldo, tudo ou nada."""

    def _batch(self, ids: list[object]) -> list[ReceivableReceipt]:
        return ReceivableDocumentService.record_receipts_batch(
            document_ids=[str(i) for i in ids],
            receipt_date=date.today(),
            payment_method="bank_transfer",
            bank_account="Bradesco",
            notes="Deposito da seguradora",
            user=self.user,
        )

    def test_batch_receives_each_document_by_its_balance(self) -> None:
        """Parcial, em aberto e vencido saem recebidos; id repetido conta uma vez."""
        partial = self._create_receivable(amount=Decimal("1000.00"))
        self._receive(partial, "400.00")
        opened = self._create_receivable(amount=Decimal("500.00"))
        overdue = self._create_receivable(
            amount=Decimal("250.00"), due_date=date.today() - timedelta(days=2)
        )

        receipts = self._batch([partial.id, opened.id, overdue.id, partial.id])

        self.assertEqual(len(receipts), 3)
        self.assertEqual(
            {r.document_id: r.amount for r in receipts},
            {
                partial.id: Decimal("600.00"),
                opened.id: Decimal("500.00"),
                overdue.id: Decimal("250.00"),
            },
        )
        for receipt in receipts:
            self.assertEqual(receipt.payment_method, "bank_transfer")
            self.assertEqual(receipt.bank_account, "Bradesco")
            self.assertEqual(receipt.receipt_date, date.today())
        for doc in (partial, opened, overdue):
            doc.refresh_from_db()
            self.assertEqual(doc.status, ReceivableStatus.RECEIVED)
            self.assertEqual(doc.amount_received, doc.amount)

    def test_batch_with_unknown_or_inactive_id_records_nothing(self) -> None:
        """Id que nao existe ou titulo inativo derruba o lote inteiro."""
        good = self._create_receivable(amount=Decimal("500.00"))
        inactive = self._create_receivable(amount=Decimal("100.00"))
        ReceivableDocument.objects.filter(id=inactive.id).update(is_active=False)

        for bad_id in (uuid.uuid4(), inactive.id):
            with self.assertRaises(ValidationError) as ctx:
                self._batch([good.id, bad_id])
            self.assertIn("detail", ctx.exception.message_dict)
        self.assertEqual(ReceivableReceipt.objects.count(), 0)

    def test_batch_with_received_or_cancelled_document_records_nothing(self) -> None:
        """Titulo recebido ou cancelado no lote: erro diz quantos, sem nome de cliente."""
        good = self._create_receivable(amount=Decimal("500.00"))
        received = self._create_receivable(amount=Decimal("100.00"))
        self._receive(received, "100.00")
        cancelled = self._create_receivable(amount=Decimal("100.00"))
        ReceivableDocumentService.cancel_receivable(
            document_id=str(cancelled.id), reason="Teste", user=self.user
        )

        with self.assertRaises(ValidationError) as ctx:
            self._batch([good.id, received.id, cancelled.id])

        message = ctx.exception.message_dict["detail"][0]
        self.assertIn("2", message)
        self.assertNotIn(self.customer_name, message)
        good.refresh_from_db()
        self.assertEqual(good.status, ReceivableStatus.OPEN)
        self.assertEqual(ReceivableReceipt.objects.filter(document=good).count(), 0)
