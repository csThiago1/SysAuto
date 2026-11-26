"""
Paddock Solutions — Accounts Receivable — admin.

Pelo admin dava para mexer em baixa sem recalcular o titulo nem gerar lancamento:
baixa e somente leitura e o titulo nao deixa mudar valor, vinculo nem excluir.
"""

from django.contrib import admin
from django.test import RequestFactory, SimpleTestCase

from apps.accounts_receivable.admin import (
    ReceivableDocumentAdmin,
    ReceivableReceiptAdmin,
    ReceivableReceiptInline,
)
from apps.accounts_receivable.models import ReceivableDocument, ReceivableReceipt


class TestReceivableAdminLocks(SimpleTestCase):
    """Travas do admin de Contas a Receber."""

    def setUp(self) -> None:
        self.request = RequestFactory().get("/admin/")

    def test_receipt_is_read_only_everywhere(self) -> None:
        """Baixa nao e incluida, alterada nem excluida, nem no inline do titulo."""
        for receipt_admin in (
            ReceivableReceiptAdmin(ReceivableReceipt, admin.site),
            ReceivableReceiptInline(ReceivableDocument, admin.site),
        ):
            self.assertFalse(receipt_admin.has_add_permission(self.request, None))
            self.assertFalse(receipt_admin.has_change_permission(self.request, None))
            self.assertFalse(receipt_admin.has_delete_permission(self.request, None))

    def test_document_locks_money_and_links_and_cannot_be_deleted(self) -> None:
        """Valor, origem, OS, cliente e ativo sao somente leitura; excluir fica desligado."""
        document_admin = ReceivableDocumentAdmin(ReceivableDocument, admin.site)
        self.assertFalse(document_admin.has_delete_permission(self.request, None))
        self.assertFalse(document_admin.has_add_permission(self.request))
        for field in ("amount", "origin", "service_order_id", "customer_id", "is_active"):
            self.assertIn(field, document_admin.get_readonly_fields(self.request))
