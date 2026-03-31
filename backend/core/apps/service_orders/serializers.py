"""
Paddock Solutions — Service Orders Serializers
"""
import logging

from rest_framework import serializers

from .models import ServiceOrder, ServiceOrderPhoto, ServiceOrderStatus, VALID_TRANSITIONS

logger = logging.getLogger(__name__)


class ServiceOrderPhotoSerializer(serializers.ModelSerializer):
    """Serializer somente-leitura para fotos de OS."""

    class Meta:
        model = ServiceOrderPhoto
        fields = ["id", "stage", "s3_key", "uploaded_at", "is_active"]
        read_only_fields = fields


class ServiceOrderListSerializer(serializers.ModelSerializer):
    """
    Serializer compacto para listagem (Kanban, tabelas).
    Não inclui fotos nem campos de IA para reduzir payload.
    """

    total = serializers.FloatField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "number",
            "customer_id",
            "customer_name",
            "plate",
            "make",
            "model",
            "year",
            "color",
            "status",
            "status_display",
            "opened_at",
            "estimated_delivery",
            "delivered_at",
            "parts_total",
            "services_total",
            "discount_total",
            "total",
            "is_active",
        ]
        read_only_fields = ["id", "opened_at", "total", "status_display"]


class ServiceOrderDetailSerializer(serializers.ModelSerializer):
    """
    Serializer completo para detalhe/criação/edição de OS.
    Inclui fotos ativas e recomendações de IA.
    """

    total = serializers.FloatField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    allowed_transitions = serializers.SerializerMethodField()
    photos = ServiceOrderPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "number",
            "customer_id",
            "customer_name",
            "plate",
            "make",
            "model",
            "year",
            "color",
            "mileage_in",
            "mileage_out",
            "status",
            "status_display",
            "allowed_transitions",
            "opened_at",
            "estimated_delivery",
            "delivered_at",
            "parts_total",
            "services_total",
            "discount_total",
            "total",
            "nfe_key",
            "nfse_number",
            "ai_recommendations",
            "photos",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "opened_at",
            "total",
            "status_display",
            "allowed_transitions",
            "created_at",
            "updated_at",
        ]

    def get_allowed_transitions(self, obj: ServiceOrder) -> list[str]:
        """Retorna os status para os quais esta OS pode transitar."""
        return VALID_TRANSITIONS.get(obj.status, [])


class ServiceOrderCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para abertura de nova OS.
    Número é gerado automaticamente pelo perform_create — não exposto como campo de entrada.
    """

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "customer_id",
            "customer_name",
            "plate",
            "make",
            "model",
            "year",
            "color",
            "mileage_in",
            "estimated_delivery",
        ]
        read_only_fields = ["id"]


class ServiceOrderStatusTransitionSerializer(serializers.Serializer):
    """Serializer para mudança de status via ação customizada."""

    new_status = serializers.ChoiceField(choices=ServiceOrderStatus.choices)

    def validate_new_status(self, value: str) -> str:
        """Valida se a transição é permitida pelas regras do Kanban."""
        service_order: ServiceOrder = self.context["service_order"]
        if not service_order.can_transition_to(value):
            allowed = VALID_TRANSITIONS.get(service_order.status, [])
            raise serializers.ValidationError(
                f"Transição inválida: '{service_order.status}' → '{value}'. "
                f"Permitidas: {allowed}"
            )
        return value
