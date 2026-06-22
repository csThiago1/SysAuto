"""
Paddock Solutions — Accounts Payable Admin
"""
from django.contrib import admin

from .models import PayableDocument, PayablePayment

# Supplier removido — fornecedores agora em /admin/persons/person/ (role=SUPPLIER)


class PayablePaymentInline(admin.TabularInline):
    """Inline de pagamentos no detalhe do titulo."""

    model = PayablePayment
    extra = 0
    readonly_fields = ["id", "journal_entry_id", "created_at", "created_by"]
    fields = [
        "payment_date",
        "amount",
        "payment_method",
        "bank_account",
        "notes",
        "journal_entry_id",
    ]


@admin.register(PayableDocument)
class PayableDocumentAdmin(admin.ModelAdmin):
    """Admin de titulos a pagar."""

    list_display = [
        "description",
        "supplier",
        "amount",
        "amount_paid",
        "due_date",
        "status",
        "origin",
        "created_at",
    ]
    list_filter = ["status", "origin", "is_active"]
    search_fields = ["description", "document_number", "supplier__full_name"]
    ordering = ["due_date"]
    readonly_fields = [
        "id",
        "amount_paid",
        "status",
        "cancelled_at",
        "cancelled_by",
        "created_at",
        "updated_at",
        "created_by",
    ]
    inlines = [PayablePaymentInline]
    raw_id_fields = ["supplier", "cost_center", "cancelled_by"]


@admin.register(PayablePayment)
class PayablePaymentAdmin(admin.ModelAdmin):
    """Admin de pagamentos."""

    list_display = [
        "document",
        "payment_date",
        "amount",
        "payment_method",
        "journal_entry_id",
        "created_at",
    ]
    list_filter = ["payment_method", "is_active"]
    search_fields = ["document__description", "bank_account"]
    ordering = ["-payment_date"]
    readonly_fields = ["id", "journal_entry_id", "created_at", "updated_at", "created_by"]
    raw_id_fields = ["document"]
