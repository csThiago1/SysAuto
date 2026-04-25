"""payments.serializers."""
from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id", "service_order", "payer_block", "amount", "method",
            "reference", "received_at", "received_by", "fiscal_doc_ref",
            "status", "created_at",
        ]
        read_only_fields = ["service_order", "received_at", "status", "created_at"]
