"""Serializers for ItemOperation (read and write)."""
from __future__ import annotations

from rest_framework import serializers

from .models import ItemOperation, ItemOperationType, LaborCategory


class ItemOperationTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemOperationType
        fields = ["id", "code", "label", "description", "is_active", "sort_order"]


class LaborCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LaborCategory
        fields = ["id", "code", "label", "description", "is_active", "sort_order"]


class ItemOperationReadSerializer(serializers.ModelSerializer):
    """Representação read-only de ItemOperation com nested labels."""

    operation_type = ItemOperationTypeSerializer(read_only=True)
    labor_category = LaborCategorySerializer(read_only=True)

    class Meta:
        model = ItemOperation
        fields = [
            "id", "operation_type", "labor_category",
            "hours", "hourly_rate", "labor_cost",
        ]


class ItemOperationWriteSerializer(serializers.Serializer):
    """Write serializer: recebe codes, converte em FKs no create."""

    operation_type_code = serializers.CharField()
    labor_category_code = serializers.CharField()
    hours = serializers.DecimalField(max_digits=6, decimal_places=2)
    hourly_rate = serializers.DecimalField(max_digits=10, decimal_places=2)
    labor_cost = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False,
    )

    def validate_operation_type_code(self, value: str) -> str:
        if not ItemOperationType.objects.filter(code=value).exists():
            raise serializers.ValidationError(f"Operation type '{value}' desconhecido")
        return value

    def validate_labor_category_code(self, value: str) -> str:
        if not LaborCategory.objects.filter(code=value).exists():
            raise serializers.ValidationError(f"Labor category '{value}' desconhecida")
        return value
