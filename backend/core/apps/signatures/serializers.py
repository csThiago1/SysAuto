from rest_framework import serializers

from .models import Signature


class SignatureReadSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    document_type_display = serializers.CharField(
        source="get_document_type_display", read_only=True,
    )

    class Meta:
        model = Signature
        fields = [
            "id",
            "service_order", "orcamento",
            "document_type", "document_type_display",
            "method", "method_display",
            "signer_name", "signer_cpf",
            "signature_hash",
            "ip_address", "user_agent",
            "signed_at",
            "notes",
        ]
        # signature_png_base64 omitido do list (muito grande); disponível no detail
        read_only_fields = fields


class SignatureDetailSerializer(SignatureReadSerializer):
    """Variante com o PNG base64 completo (pra renderizar no frontend)."""

    class Meta(SignatureReadSerializer.Meta):
        fields = SignatureReadSerializer.Meta.fields + ["signature_png_base64"]
        read_only_fields = fields


class CaptureSignatureSerializer(serializers.Serializer):
    """Entrada do POST /signatures/capture/."""

    document_type = serializers.ChoiceField(choices=[
        "BUDGET_APPROVAL", "OS_OPEN", "OS_DELIVERY",
        "COMPLEMENT_APPROVAL", "INSURANCE_ACCEPTANCE",
    ])
    method = serializers.ChoiceField(choices=[
        "CANVAS_TABLET", "REMOTE_LINK", "SCAN_PDF",
    ])
    signer_name = serializers.CharField(max_length=200)
    signature_png_base64 = serializers.CharField()

    service_order_id = serializers.IntegerField(required=False, allow_null=True)
    orcamento_id = serializers.UUIDField(required=False, allow_null=True)

    signer_cpf = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, data):
        if not data.get("service_order_id") and not data.get("orcamento_id"):
            raise serializers.ValidationError(
                "Informe service_order_id ou orcamento_id.",
            )
        return data
