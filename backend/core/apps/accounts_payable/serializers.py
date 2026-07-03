"""
Paddock Solutions — Accounts Payable Serializers
"""
import logging

from rest_framework import serializers

from .models import DocumentStatus, PayableDocument, PayablePayment

logger = logging.getLogger(__name__)


# Supplier serializers removidos — usar persons.PersonSerializer (?role=SUPPLIER).
# Mantemos SupplierListSerializer mínimo pra retro-compat em PayableDocumentSerializer.


class SupplierListSerializer(serializers.Serializer):
    """Serializer minimo de fornecedor — agora aponta para Person.

    Usado apenas em PayableDocumentSerializer.supplier (read_only).
    """

    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(source="full_name", read_only=True)
    cnpj = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)

    def get_cnpj(self, obj) -> str:
        doc = obj.documents.filter(doc_type="CNPJ", is_primary=True).first()
        return doc.value if doc else ""


# ── PayablePayment ─────────────────────────────────────────────────────────────


class PayablePaymentSerializer(serializers.ModelSerializer):
    """Serializer de leitura de PayablePayment."""

    payment_method_display = serializers.CharField(
        source="get_payment_method_display", read_only=True
    )

    class Meta:
        model = PayablePayment
        fields = [
            "id",
            "payment_date",
            "amount",
            "payment_method",
            "payment_method_display",
            "bank_account",
            "notes",
            "journal_entry_id",
            "created_at",
        ]
        read_only_fields = ["id", "journal_entry_id", "created_at"]


# ── PayableDocument ────────────────────────────────────────────────────────────


class PayableDocumentListSerializer(serializers.ModelSerializer):
    """Serializer de listagem de titulos a pagar — dados essenciais para tabelas."""

    supplier_name = serializers.SerializerMethodField()
    amount_remaining = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    origin_display = serializers.CharField(source="get_origin_display", read_only=True)

    class Meta:
        model = PayableDocument
        fields = [
            "id",
            "supplier_name",
            "description",
            "due_date",
            "amount",
            "amount_paid",
            "amount_remaining",
            "status",
            "status_display",
            "origin",
            "origin_display",
            "created_at",
        ]
        read_only_fields = fields

    def get_supplier_name(self, obj: PayableDocument) -> str:
        """Retorna nome do fornecedor."""
        return obj.supplier.name

    def get_amount_remaining(self, obj: PayableDocument) -> str:
        """Retorna saldo restante a pagar."""
        return str(obj.amount_remaining)


class PayableDocumentSerializer(serializers.ModelSerializer):
    """Serializer completo de titulo a pagar — inclui pagamentos."""

    supplier = SupplierListSerializer(read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    payments = PayablePaymentSerializer(many=True, read_only=True)
    amount_remaining = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    origin_display = serializers.CharField(source="get_origin_display", read_only=True)
    cancelled_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PayableDocument
        fields = [
            "id",
            "supplier",
            "supplier_name",
            "description",
            "document_number",
            "document_date",
            "amount",
            "amount_paid",
            "amount_remaining",
            "due_date",
            "competence_date",
            "status",
            "status_display",
            "origin",
            "origin_display",
            "cost_center",
            "expense_account",
            "notes",
            "cancelled_at",
            "cancelled_by",
            "cancelled_by_name",
            "cancel_reason",
            "payments",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "amount_paid",
            "status",
            "cancelled_at",
            "cancelled_by",
            "created_at",
            "updated_at",
        ]

    def get_amount_remaining(self, obj: PayableDocument) -> str:
        """Retorna saldo restante a pagar."""
        return str(obj.amount_remaining)

    def get_cancelled_by_name(self, obj: PayableDocument) -> str | None:
        """Retorna nome do usuario que cancelou, se houver."""
        if obj.cancelled_by:
            return obj.cancelled_by.name
        return None


class CreatePayableDocumentSerializer(serializers.Serializer):
    """Serializer de escrita para criacao de titulo a pagar."""

    supplier_id = serializers.UUIDField()
    description = serializers.CharField(max_length=300)
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value="0.01")
    due_date = serializers.DateField()
    competence_date = serializers.DateField()
    document_number = serializers.CharField(max_length=100, required=False, default="")
    origin = serializers.ChoiceField(
        choices=["MAN", "FOLHA", "NFE_E", "AUTO"],
        required=False,
        default="MAN",
    )
    cost_center_id = serializers.UUIDField(required=False, allow_null=True)
    expense_account_id = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, default="", allow_blank=True)


class RecordPaymentSerializer(serializers.Serializer):
    """Serializer de escrita para registro de pagamento."""

    payment_date = serializers.DateField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value="0.01")
    payment_method = serializers.ChoiceField(
        choices=[
            "bank_transfer",
            "pix",
            "boleto",
            "check",
            "cash",
            "credit_card",
            "debit_card",
        ],
        required=False,
        default="bank_transfer",
    )
    bank_account = serializers.CharField(max_length=100, required=False, default="", allow_blank=True)
    notes = serializers.CharField(required=False, default="", allow_blank=True)
