"""
Paddock Solutions — Service Orders: Versioning Serializers
Version, VersionItem, Event, Parecer, Diff serializers + Override serializers.
"""
from rest_framework import serializers

from ..models import (
    ServiceOrderEvent,
    ServiceOrderParecer,
    ServiceOrderVersion,
    ServiceOrderVersionItem,
)


class ServiceOrderVersionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderVersionItem
        fields = [
            "id", "version",
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order",
        ]
        read_only_fields = [
            "id", "version",
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order",
        ]


class ServiceOrderVersionSerializer(serializers.ModelSerializer):
    items = ServiceOrderVersionItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrderVersion
        fields = [
            "id", "service_order", "version_number",
            "external_version", "external_numero_vistoria", "external_integration_id",
            "source", "status", "status_display",
            "subtotal", "discount_total", "net_total",
            "labor_total", "parts_total",
            "total_seguradora", "total_complemento_particular", "total_franquia",
            "content_hash", "hourly_rates", "global_discount_pct",
            "created_at", "created_by", "approved_at",
            "items",
        ]
        read_only_fields = [
            "id", "service_order", "version_number",
            "external_version", "external_numero_vistoria", "external_integration_id",
            "source", "status", "status_display",
            "subtotal", "discount_total", "net_total",
            "labor_total", "parts_total",
            "total_seguradora", "total_complemento_particular", "total_franquia",
            "content_hash", "hourly_rates", "global_discount_pct",
            "created_at", "created_by", "approved_at",
        ]


class ServiceOrderEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderEvent
        fields = [
            "id", "service_order", "event_type",
            "actor", "payload", "from_state", "to_state", "created_at",
        ]
        read_only_fields = [
            "id", "service_order", "event_type",
            "actor", "payload", "from_state", "to_state", "created_at",
        ]


class ServiceOrderParecerSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderParecer
        fields = [
            "id", "service_order", "version",
            "source", "flow_number",
            "author_external", "author_org", "author_internal",
            "parecer_type", "body",
            "created_at_external", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# -- Versoes: detalhe, diff e complemento --

class VersionItemCompactSerializer(serializers.ModelSerializer):
    """Serializer compacto de itens de versao para exibicao em detalhe e diff."""

    class Meta:
        model = ServiceOrderVersionItem
        fields = [
            "id", "bucket", "payer_block", "item_type", "description",
            "external_code", "part_type", "quantity", "unit_price",
            "discount_pct", "net_price", "flag_inclusao_manual",
        ]


class VersionDetailSerializer(serializers.ModelSerializer):
    """Serializer completo de uma versao de OS, incluindo itens compactos."""

    items = VersionItemCompactSerializer(many=True, read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrderVersion
        fields = [
            "id", "version_number", "external_version", "source", "source_display",
            "status", "status_display", "subtotal", "discount_total", "net_total",
            "labor_total", "parts_total", "total_seguradora",
            "total_complemento_particular", "total_franquia",
            "created_at", "approved_at", "items",
        ]


class VersionDiffItemSerializer(serializers.Serializer):
    """Representa um item na comparacao entre duas versoes."""

    description = serializers.CharField()
    item_type = serializers.CharField()
    old_value = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    new_value = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    change_type = serializers.ChoiceField(choices=["added", "removed", "changed", "unchanged"])
    is_executed = serializers.BooleanField(default=False)


class VersionDiffSerializer(serializers.Serializer):
    """Resultado da comparacao entre a versao atual e uma nova versao."""

    current_version = VersionDetailSerializer()
    new_version = VersionDetailSerializer()
    diff_items = VersionDiffItemSerializer(many=True)
    totals_diff = serializers.DictField()
