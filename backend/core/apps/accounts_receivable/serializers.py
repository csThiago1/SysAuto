"""
Paddock Solutions — Accounts Receivable Serializers
"""
import logging

from rest_framework import serializers

from .models import ReceivableDocument, ReceivableReceipt, ReceivableStatus

logger = logging.getLogger(__name__)


# ── ReceivableReceipt ──────────────────────────────────────────────────────────


class ReceivableReceiptSerializer(serializers.ModelSerializer):
    """Serializer de leitura de ReceivableReceipt."""

    payment_method_display = serializers.CharField(
        source="get_payment_method_display", read_only=True
    )

    class Meta:
        model = ReceivableReceipt
        fields = [
            "id",
            "receipt_date",
            "amount",
            "payment_method",
            "payment_method_display",
            "bank_account",
            "notes",
            "journal_entry_id",
            "created_at",
        ]
        read_only_fields = ["id", "journal_entry_id", "created_at"]


# ── ReceivableDocument ─────────────────────────────────────────────────────────


class ReceivableDocumentListSerializer(serializers.ModelSerializer):
    """Serializer de listagem de titulos a receber — dados essenciais para tabelas."""

    amount_remaining = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    origin_display = serializers.CharField(source="get_origin_display", read_only=True)

    class Meta:
        model = ReceivableDocument
        fields = [
            "id",
            "customer_name",
            "description",
            "due_date",
            "amount",
            "amount_received",
            "amount_remaining",
            "status",
            "status_display",
            "origin",
            "origin_display",
            "created_at",
        ]
        read_only_fields = fields

    def get_amount_remaining(self, obj: ReceivableDocument) -> str:
        """Retorna saldo restante a receber."""
        return str(obj.amount_remaining)


class ReceivableDocumentSerializer(serializers.ModelSerializer):
    """Serializer completo de titulo a receber — inclui recebimentos."""

    receipts = ReceivableReceiptSerializer(many=True, read_only=True)
    amount_remaining = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    origin_display = serializers.CharField(source="get_origin_display", read_only=True)
    cancelled_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ReceivableDocument
        fields = [
            "id",
            "customer_id",
            "customer_name",
            "description",
            "document_number",
            "document_date",
            "amount",
            "amount_received",
            "amount_remaining",
            "due_date",
            "competence_date",
            "status",
            "status_display",
            "origin",
            "origin_display",
            "service_order_id",
            "cost_center",
            "notes",
            "cancelled_at",
            "cancelled_by",
            "cancelled_by_name",
            "cancel_reason",
            "receipts",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "amount_received",
            "status",
            "cancelled_at",
            "cancelled_by",
            "created_at",
            "updated_at",
        ]

    def get_amount_remaining(self, obj: ReceivableDocument) -> str:
        """Retorna saldo restante a receber."""
        return str(obj.amount_remaining)

    def get_cancelled_by_name(self, obj: ReceivableDocument) -> str | None:
        """Retorna nome do usuario que cancelou, se houver."""
        if obj.cancelled_by:
            return obj.cancelled_by.name
        return None


class CreateReceivableDocumentSerializer(serializers.Serializer):
    """Serializer de escrita para criacao de titulo a receber."""

    customer_id = serializers.UUIDField()
    customer_name = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=300)
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value="0.01")
    due_date = serializers.DateField()
    competence_date = serializers.DateField()
    origin = serializers.ChoiceField(
        choices=["MAN", "OS", "NFE", "NFCE", "NFSE"],
        required=False,
        default="MAN",
    )
    service_order_id = serializers.UUIDField(required=False, allow_null=True)
    document_number = serializers.CharField(max_length=100, required=False, default="")
    cost_center_id = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, default="", allow_blank=True)


class RecordReceiptSerializer(serializers.Serializer):
    """Serializer de escrita para registro de recebimento."""

    receipt_date = serializers.DateField()
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
        default="pix",
    )
    bank_account = serializers.CharField(
        max_length=100, required=False, default="", allow_blank=True
    )
    notes = serializers.CharField(required=False, default="", allow_blank=True)
