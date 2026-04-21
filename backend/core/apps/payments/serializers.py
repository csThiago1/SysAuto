from __future__ import annotations

from rest_framework import serializers

from .models import Payment


class PaymentReadSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    payer_block_display = serializers.CharField(source="get_payer_block_display", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id", "service_order", "payer_block", "payer_block_display",
            "amount", "method", "method_display", "reference",
            "received_at", "received_by", "fiscal_doc_ref",
            "status", "created_at",
        ]


class RecordPaymentSerializer(serializers.Serializer):
    payer_block = serializers.ChoiceField(choices=[
        "SEGURADORA", "COMPLEMENTO_PARTICULAR", "FRANQUIA", "PARTICULAR",
    ])
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    method = serializers.ChoiceField(choices=["PIX", "BOLETO", "DINHEIRO", "CARTAO", "TRANSFERENCIA"])
    reference = serializers.CharField(required=False, default="")
    fiscal_doc_ref = serializers.CharField(required=False, default="")
