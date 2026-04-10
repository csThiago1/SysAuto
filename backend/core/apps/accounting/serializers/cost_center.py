"""
Paddock Solutions — Accounting: Serializers de Centro de Custo
"""
import logging

from rest_framework import serializers

from apps.accounting.models.chart_of_accounts import CostCenter

logger = logging.getLogger(__name__)


class CostCenterListSerializer(serializers.ModelSerializer):
    """Serializer de listagem."""

    class Meta:
        model = CostCenter
        fields = [
            "id",
            "code",
            "name",
            "parent",
            "os_type_code",
            "is_active",
        ]
        read_only_fields = fields


class CostCenterDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe."""

    parent_code = serializers.SerializerMethodField()

    def get_parent_code(self, obj: CostCenter) -> str | None:
        return obj.parent.code if obj.parent else None

    class Meta:
        model = CostCenter
        fields = [
            "id",
            "code",
            "name",
            "parent",
            "parent_code",
            "os_type_code",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "parent_code", "created_at", "updated_at"]


class CostCenterCreateSerializer(serializers.ModelSerializer):
    """Serializer de criação e atualização."""

    class Meta:
        model = CostCenter
        fields = [
            "code",
            "name",
            "parent",
            "os_type_code",
        ]
