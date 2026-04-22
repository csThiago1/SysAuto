from __future__ import annotations

from rest_framework import serializers

from apps.items.serializers import ItemOperationReadSerializer

from .models import (
    Insurer,
    ServiceOrder,
    ServiceOrderEvent,
    ServiceOrderParecer,
    ServiceOrderStatusHistory,
    ServiceOrderVersion,
    ServiceOrderVersionItem,
)


class ServiceOrderVersionItemReadSerializer(serializers.ModelSerializer):
    operations = ItemOperationReadSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceOrderVersionItem
        fields = [
            "id", "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order", "operations",
        ]


class ServiceOrderVersionReadSerializer(serializers.ModelSerializer):
    items = ServiceOrderVersionItemReadSerializer(many=True, read_only=True)
    status_label = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrderVersion
        fields = [
            "id", "version_number", "external_version", "external_numero_vistoria",
            "external_integration_id", "source", "status", "status_display", "status_label",
            "subtotal", "discount_total", "net_total", "labor_total", "parts_total",
            "total_seguradora", "total_complemento_particular", "total_franquia",
            "content_hash", "raw_payload_s3_key",
            "hourly_rates", "global_discount_pct",
            "created_at", "created_by", "approved_at",
            "items",
        ]


class ServiceOrderEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)

    class Meta:
        model = ServiceOrderEvent
        fields = [
            "id", "event_type", "event_type_display", "actor", "payload",
            "from_state", "to_state", "created_at",
        ]


class ServiceOrderParecerSerializer(serializers.ModelSerializer):
    parecer_type_display = serializers.CharField(source="get_parecer_type_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = ServiceOrderParecer
        fields = [
            "id", "version", "source", "source_display",
            "flow_number", "author_external", "author_org", "author_internal",
            "parecer_type", "parecer_type_display", "body",
            "created_at_external", "created_at",
        ]


class ServiceOrderReadSerializer(serializers.ModelSerializer):
    """Read serializer completo para ServiceOrder — usado em budget approve response e ViewSet."""

    active_version = ServiceOrderVersionReadSerializer(read_only=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    insurer_name = serializers.CharField(source="insurer.name", read_only=True, default="")
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id", "os_number", "customer", "customer_name", "customer_type",
            "vehicle_plate", "vehicle_description",
            "status", "status_display", "previous_status",
            "source_budget",
            "insurer", "insurer_name", "casualty_number",
            "external_budget_number", "policy_number", "policy_item",
            "franchise_amount",
            "notes", "is_active", "created_at", "updated_at",
            "active_version",
        ]
        read_only_fields = fields


class ChangeStatusSerializer(serializers.Serializer):
    new_status = serializers.CharField()
    notes = serializers.CharField(required=False, default="")


class ComplementItemSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=300)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3, default="1")
    unit_price = serializers.DecimalField(max_digits=14, decimal_places=2)
    net_price = serializers.DecimalField(max_digits=14, decimal_places=2)
    item_type = serializers.ChoiceField(
        choices=["PART", "SERVICE", "EXTERNAL_SERVICE", "FEE", "DISCOUNT"],
        default="SERVICE",
    )
    impact_area = serializers.IntegerField(required=False, allow_null=True)
    external_code = serializers.CharField(required=False, default="")


class AddComplementSerializer(serializers.Serializer):
    items = ComplementItemSerializer(many=True)
    approved_by = serializers.CharField(max_length=120, required=False, default="")


class InternalParecerSerializer(serializers.Serializer):
    body = serializers.CharField()
    version_id = serializers.IntegerField(required=False, allow_null=True)
    parecer_type = serializers.CharField(required=False, default="COMENTARIO_INTERNO")


# Legacy aliases kept for backward compat with existing tests that import these
class ServiceOrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderStatusHistory
        fields = ["id", "from_status", "to_status", "changed_by", "notes", "changed_at"]
        read_only_fields = fields


class ServiceOrderListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "os_number",
            "customer",
            "customer_name",
            "vehicle_plate",
            "vehicle_description",
            "status",
            "total_value",
            "created_at",
        ]
        read_only_fields = fields


class ServiceOrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrder
        fields = ["os_number", "customer", "vehicle_plate", "vehicle_description", "total_value", "notes"]


class ServiceOrderDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    status_history = ServiceOrderStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "os_number",
            "customer",
            "customer_name",
            "vehicle_plate",
            "vehicle_description",
            "status",
            "total_value",
            "notes",
            "status_history",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "status_history"]
