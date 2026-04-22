# apps/budgets/serializers.py
from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.items.models import ItemOperation, ItemOperationType, LaborCategory
from apps.items.serializers import ItemOperationReadSerializer

from .models import Budget, BudgetVersion, BudgetVersionItem


class BudgetVersionItemReadSerializer(serializers.ModelSerializer):
    operations = ItemOperationReadSerializer(many=True, read_only=True)

    class Meta:
        model = BudgetVersionItem
        fields = [
            "id", "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order", "operations",
        ]


class BudgetVersionItemWriteSerializer(serializers.ModelSerializer):
    """Write: aceita campos do item + operations como lista aninhada."""

    operations = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = BudgetVersionItem
        fields = [
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order", "operations",
        ]

    def create(self, validated_data: dict) -> BudgetVersionItem:
        operations = validated_data.pop("operations", [])
        item = BudgetVersionItem.objects.create(**validated_data)
        for op_data in operations:
            ItemOperation.objects.create(
                item_budget=item,
                operation_type=ItemOperationType.objects.get(code=op_data["operation_type_code"]),
                labor_category=LaborCategory.objects.get(code=op_data["labor_category_code"]),
                hours=Decimal(str(op_data["hours"])),
                hourly_rate=Decimal(str(op_data["hourly_rate"])),
                labor_cost=Decimal(str(op_data.get(
                    "labor_cost",
                    Decimal(str(op_data["hours"])) * Decimal(str(op_data["hourly_rate"])),
                ))),
            )
        return item


class BudgetVersionReadSerializer(serializers.ModelSerializer):
    items = BudgetVersionItemReadSerializer(many=True, read_only=True)
    status_label = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = BudgetVersion
        fields = [
            "id", "version_number", "status", "status_display", "status_label",
            "valid_until", "subtotal", "discount_total", "net_total",
            "labor_total", "parts_total", "pdf_s3_key",
            "sent_at", "approved_at", "approved_by", "approval_evidence_s3_key",
            "created_by", "created_at", "items",
        ]


class BudgetReadSerializer(serializers.ModelSerializer):
    active_version = BudgetVersionReadSerializer(read_only=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)

    class Meta:
        model = Budget
        fields = [
            "id", "number", "customer", "customer_name",
            "vehicle_plate", "vehicle_description",
            "cloned_from", "service_order", "active_version",
            "is_active", "created_at", "updated_at",
        ]


class BudgetCreateSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    vehicle_plate = serializers.CharField(max_length=10)
    vehicle_description = serializers.CharField(max_length=200)


class BudgetApproveSerializer(serializers.Serializer):
    approved_by = serializers.CharField(max_length=120)
    evidence_s3_key = serializers.CharField(max_length=500, required=False, default="")
