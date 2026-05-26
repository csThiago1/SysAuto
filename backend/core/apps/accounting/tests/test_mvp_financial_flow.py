"""MVP financial flow: billing, AR/AP receipts/payments and accounting entries."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import patch

from apps.accounting.models import JournalEntry
from apps.accounting.models.journal_entry import JournalEntryOrigin
from apps.accounting.services.journal_entry_service import JournalEntryService
from apps.accounts_payable.models import DocumentStatus, PayableOrigin, Supplier
from apps.accounts_payable.services import PayableDocumentService
from apps.accounts_receivable.models import (
    ReceivableDocument,
    ReceivableOrigin,
    ReceivableStatus,
)
from apps.accounts_receivable.services import ReceivableDocumentService
from apps.fiscal.models import FiscalDocument
from apps.fiscal.services.fiscal_service import FiscalService
from apps.service_orders.billing import BillingService
from apps.service_orders.models import (
    ServiceOrder,
    ServiceOrderLabor,
    ServiceOrderPart,
    ServiceOrderStatus,
)

from .base import AccountingTestCase


class MvpFinancialFlowTestCase(AccountingTestCase):
    """Covers the Sprint 5 operational contract end to end."""

    def _make_service_order(self, *, number: int = 9801, **extra: Any) -> ServiceOrder:
        defaults: dict[str, Any] = {
            "number": number,
            "plate": f"FIN{number % 10000:04d}",
            "customer_name": "Cliente Financeiro MVP",
            "customer_type": "private",
            "status": ServiceOrderStatus.REPAIR,
            "created_by": self.admin,
        }
        defaults.update(extra)
        return ServiceOrder.objects.create(**defaults)

    def test_billing_creates_ar_invoice_flag_and_accounting_entry(self) -> None:
        """OS billing creates AR and posts the revenue journal entry."""
        order = self._make_service_order(
            number=9801,
            services_total=Decimal("1000.00"),
        )

        def fake_emit_nfse(
            service_order: ServiceOrder,
            _config: object | None = None,
            **_kwargs: Any,
        ) -> FiscalDocument:
            return FiscalDocument.objects.create(
                document_type=FiscalDocument.DocumentType.NFSE,
                status=FiscalDocument.Status.AUTHORIZED,
                service_order=service_order,
                total_value=service_order.services_total,
            )

        items = BillingService.preview(order)["items"]
        with (
            patch.object(FiscalService, "get_config", return_value=object()),
            patch.object(FiscalService, "emit_nfse", side_effect=fake_emit_nfse),
        ):
            result = BillingService.bill(order=order, items=items, user=self.admin)

        order.refresh_from_db()
        receivables = ReceivableDocument.objects.filter(service_order_id=order.pk)
        entry = JournalEntry.objects.get(origin=JournalEntryOrigin.SERVICE_ORDER)

        self.assertTrue(order.invoice_issued)
        self.assertEqual(receivables.count(), 1)
        self.assertEqual(receivables.first().amount, Decimal("1000.00"))
        self.assertEqual(result["summary"]["fiscal_errors"], [])
        self.assertTrue(entry.is_approved)
        self.assertEqual(entry.total_debit, Decimal("1000.00"))
        self.assertEqual(entry.total_credit, Decimal("1000.00"))

    def test_service_order_accounting_uses_current_totals_and_real_parts_cost(self) -> None:
        """JournalEntryService reads current OS totals instead of legacy fields."""
        order = self._make_service_order(number=9802)
        ServiceOrderPart.objects.create(
            service_order=order,
            created_by=self.admin,
            description="Parachoque",
            quantity=Decimal("2.00"),
            unit_price=Decimal("250.00"),
            discount=Decimal("0.00"),
            custo_real=Decimal("100.00"),
        )
        ServiceOrderLabor.objects.create(
            service_order=order,
            created_by=self.admin,
            description="Funilaria",
            quantity=Decimal("1.00"),
            unit_price=Decimal("700.00"),
            discount=Decimal("0.00"),
        )
        order.refresh_from_db()

        entry = JournalEntryService.create_from_service_order(order, user=self.admin)

        self.assertTrue(entry.is_balanced)
        self.assertEqual(entry.total_debit, Decimal("1400.00"))
        self.assertEqual(entry.total_credit, Decimal("1400.00"))
        line_values = {
            line.account.code: (line.debit_amount, line.credit_amount)
            for line in entry.lines.select_related("account")
        }
        self.assertEqual(line_values["1.1.02.001"], (Decimal("1200.00"), Decimal("0.00")))
        self.assertEqual(line_values["4.1.02.001"], (Decimal("0.00"), Decimal("700.00")))
        self.assertEqual(line_values["4.1.03.001"], (Decimal("0.00"), Decimal("500.00")))
        self.assertEqual(line_values["5.1.01.001"], (Decimal("200.00"), Decimal("0.00")))
        self.assertEqual(line_values["1.1.04.001"], (Decimal("0.00"), Decimal("200.00")))

    def test_receipt_and_payment_partial_then_total_create_accounting_entries(self) -> None:
        """Partial and full AR/AP settlements update status and post bank entries."""
        receivable = ReceivableDocumentService.create_receivable(
            customer_id="cliente-mvp",
            customer_name="Cliente MVP",
            description="OS MVP",
            amount=Decimal("1000.00"),
            due_date=date.today() + timedelta(days=5),
            competence_date=date.today(),
            origin=ReceivableOrigin.OS,
            user=self.admin,
        )
        first_receipt = ReceivableDocumentService.record_receipt(
            document_id=str(receivable.id),
            receipt_date=date.today(),
            amount=Decimal("400.00"),
            user=self.admin,
        )
        second_receipt = ReceivableDocumentService.record_receipt(
            document_id=str(receivable.id),
            receipt_date=date.today(),
            amount=Decimal("600.00"),
            user=self.admin,
        )
        receivable.refresh_from_db()

        supplier = Supplier.objects.create(name="Fornecedor MVP", created_by=self.admin)
        payable = PayableDocumentService.create_payable(
            supplier_id=str(supplier.id),
            description="NF-e de entrada MVP",
            amount=Decimal("500.00"),
            due_date=date.today() + timedelta(days=10),
            competence_date=date.today(),
            document_number="NFE-ENT-001",
            origin=PayableOrigin.NFE_IN,
            user=self.admin,
        )
        first_payment = PayableDocumentService.record_payment(
            document_id=str(payable.id),
            payment_date=date.today(),
            amount=Decimal("200.00"),
            user=self.admin,
        )
        second_payment = PayableDocumentService.record_payment(
            document_id=str(payable.id),
            payment_date=date.today(),
            amount=Decimal("300.00"),
            user=self.admin,
        )
        payable.refresh_from_db()

        self.assertEqual(receivable.status, ReceivableStatus.RECEIVED)
        self.assertEqual(payable.status, DocumentStatus.PAID)
        self.assertIsNotNone(first_receipt.journal_entry_id)
        self.assertIsNotNone(second_receipt.journal_entry_id)
        self.assertIsNotNone(first_payment.journal_entry_id)
        self.assertIsNotNone(second_payment.journal_entry_id)
        self.assertEqual(
            JournalEntry.objects.filter(origin=JournalEntryOrigin.BANK_RECEIPT).count(),
            2,
        )
        self.assertEqual(
            JournalEntry.objects.filter(origin=JournalEntryOrigin.BANK_PAYMENT).count(),
            2,
        )
