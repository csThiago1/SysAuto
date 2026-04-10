"""
Paddock Solutions — Accounts Receivable Admin
"""
from django.contrib import admin

from .models import ReceivableDocument, ReceivableReceipt


class ReceivableReceiptInline(admin.TabularInline):
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
        "amount_received",
        "status",
        "cancelled_at",
        "cancelled_by",
        "created_at",
        "updated_at",
        "created_by",
    ]
    inlines = [ReceivableReceiptInline]
    raw_id_fields = ["cost_center", "cancelled_by"]


@admin.register(ReceivableReceipt)
class ReceivableReceiptAdmin(admin.ModelAdmin):
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
