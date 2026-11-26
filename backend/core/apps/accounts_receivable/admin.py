"""
Paddock Solutions — Accounts Receivable Admin
"""

from django.contrib import admin
from django.http import HttpRequest

from .models import ReceivableDocument, ReceivableReceipt


class ReadOnlyReceiptMixin:
    """Baixa so e criada ou estornada pelo service, que recalcula o titulo e a contabilidade."""

    def has_add_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False


class ReceivableReceiptInline(ReadOnlyReceiptMixin, admin.TabularInline):
    """Inline de recebimentos no detalhe do titulo."""

    model = ReceivableReceipt
    extra = 0
    readonly_fields = ["id", "journal_entry_id", "created_at", "created_by"]
    fields = [
        "receipt_date",
        "amount",
        "payment_method",
        "bank_account",
        "notes",
        "journal_entry_id",
        "is_active",
        "reverse_reason",
    ]


@admin.register(ReceivableDocument)
class ReceivableDocumentAdmin(admin.ModelAdmin):
    """Admin de titulos a receber."""

    list_display = [
        "description",
        "customer_name",
        "amount",
        "amount_received",
        "due_date",
        "status",
        "origin",
        "created_at",
    ]
    list_filter = ["status", "origin", "is_active"]
    search_fields = ["description", "document_number", "customer_name"]
    ordering = ["due_date"]
    readonly_fields = [
        "id",
        "customer_id",
        "amount",
        "amount_received",
        "status",
        "origin",
        "service_order_id",
        "is_active",
        "cancelled_at",
        "cancelled_by",
        "created_at",
        "updated_at",
        "created_by",
    ]
    inlines = [ReceivableReceiptInline]
    raw_id_fields = ["cost_center", "cancelled_by"]

    def has_add_permission(self, request: HttpRequest) -> bool:
        """Titulo nasce pelo service, que valida valor e define o status."""
        return False

    def has_delete_permission(self, request: HttpRequest, obj: object = None) -> bool:
        """Titulo nao e excluido: cancela-se pela acao do sistema."""
        return False


@admin.register(ReceivableReceipt)
class ReceivableReceiptAdmin(ReadOnlyReceiptMixin, admin.ModelAdmin):
    """Admin de recebimentos."""

    list_display = [
        "document",
        "receipt_date",
        "amount",
        "payment_method",
        "journal_entry_id",
        "created_at",
    ]
    list_filter = ["payment_method", "is_active"]
    search_fields = ["document__description", "bank_account"]
    ordering = ["-receipt_date"]
    readonly_fields = ["id", "journal_entry_id", "created_at", "updated_at", "created_by"]
    raw_id_fields = ["document"]
