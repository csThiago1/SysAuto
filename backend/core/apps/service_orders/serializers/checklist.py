"""Serializers do checklist de entrada 3D — estado, danos e pertences."""

from __future__ import annotations

from typing import Any

from django.db.models import Count
from rest_framework import serializers

from apps.vehicle_catalog.normalize import COR_HEX

from ..checklist_constants import PANEL_KEYS, BodyType
from ..models import (
    BudgetPanelRule,
    ChecklistDamage,
    ChecklistItemStatus,
    CustomerBelonging,
    EntryChecklist,
)
from ..models.checklist import ENTRY
from ..services.budget_panels import normalize_description
from ..services.checklist_service import suggest_body_type
from .core import ServiceOrderPhotoSerializer

NO_COLOR_HEX = "#9a9a9a"  # FANTASIA / NAO_INFORMADA / cor fora do mapa
STOP_VALUES = ("done", "sem_dano")


def pdf_url(pdf_id: object) -> str | None:
    return f"/api/v1/documents/{pdf_id}/download/" if pdf_id else None


class EntryChecklistStateSerializer(serializers.ModelSerializer):
    """Estado do checklist. Escrita: `body_type` e `stops_done` (merge no service)."""

    body_type = serializers.ChoiceField(choices=BodyType.choices, required=False)
    stops_done = serializers.DictField(
        child=serializers.ChoiceField(choices=STOP_VALUES), required=False
    )
    suggested_body_type = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    vehicle_color_hex = serializers.SerializerMethodField()
    customer_type = serializers.CharField(source="service_order.customer_type", read_only=True)
    items_summary = serializers.SerializerMethodField()

    class Meta:
        model = EntryChecklist
        fields = [
            "id",
            "body_type",
            "suggested_body_type",
            "stops_done",
            "finalized_at",
            "version",
            "signature_status",
            "pdf_url",
            "vehicle_color_hex",
            "customer_type",
            "items_summary",
        ]
        read_only_fields = ["id", "finalized_at", "version", "signature_status"]

    def get_suggested_body_type(self, obj: EntryChecklist) -> str | None:
        return suggest_body_type(obj.service_order)

    def get_pdf_url(self, obj: EntryChecklist) -> str | None:
        return pdf_url(obj.pdf_id)

    def get_vehicle_color_hex(self, obj: EntryChecklist) -> str:
        return COR_HEX.get(obj.service_order.color) or NO_COLOR_HEX

    def get_items_summary(self, obj: EntryChecklist) -> dict[str, int]:
        """Itens do checklist textual de entrada, contados por status."""
        counts = dict(
            obj.service_order.checklist_items.filter(checklist_type=ENTRY)
            .order_by()  # sem o ordering do model, senão o GROUP BY quebra
            .values_list("status")
            .annotate(n=Count("id"))
        )
        return {status: counts.get(status, 0) for status in ChecklistItemStatus.values}


class ChecklistHistorySerializer(serializers.ModelSerializer):
    """Checklist finalizado de outra OS do mesmo veículo (espera `damage_count` anotado)."""

    os_number = serializers.IntegerField(source="service_order.number", read_only=True)
    pdf_url = serializers.SerializerMethodField()
    damage_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = EntryChecklist
        fields = ["os_number", "finalized_at", "pdf_url", "damage_count"]
        read_only_fields = fields

    def get_pdf_url(self, obj: EntryChecklist) -> str | None:
        return pdf_url(obj.pdf_id)


class _PhotoRefSerializer(ServiceOrderPhotoSerializer):
    """Foto como `{id, url}` — reaproveita o get_url do storage."""

    class Meta(ServiceOrderPhotoSerializer.Meta):
        fields = ["id", "url"]
        read_only_fields = fields


class ChecklistDamageSerializer(serializers.ModelSerializer):
    """Dano do checklist. Fotos entram por `photo_ids` ou `photo_client_uuids`."""

    photo_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, write_only=True
    )
    photo_client_uuids = serializers.ListField(
        child=serializers.CharField(max_length=36), required=False, write_only=True
    )
    photos = _PhotoRefSerializer(many=True, read_only=True)
    client_uuid = serializers.CharField(
        max_length=36, required=False, allow_null=True, allow_blank=True
    )

    class Meta:
        model = ChecklistDamage
        fields = [
            "id",
            "number",
            "panel_key",
            "damage_type",
            "severity",
            "relation",
            "point",
            "notes",
            "photo_ids",
            "photo_client_uuids",
            "photos",
            "budget_match",
            "matched_budget_items",
            "client_uuid",
        ]
        read_only_fields = ["id", "number", "budget_match", "matched_budget_items"]

    def to_representation(self, instance: ChecklistDamage) -> dict[str, Any]:
        data = super().to_representation(instance)
        data["photo_ids"] = [photo["id"] for photo in data["photos"]]
        return data

    def get_fields(self) -> dict[str, serializers.Field]:
        fields = super().get_fields()
        if self.instance is not None:  # PATCH: client_uuid é só da criação
            fields["client_uuid"].read_only = True
        return fields


class CustomerBelongingSerializer(serializers.ModelSerializer):
    """Pertence do cliente. Foto entra por `photo_id` ou `photo_client_uuid`."""

    photo_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    photo_client_uuid = serializers.CharField(
        max_length=36, required=False, allow_null=True, write_only=True
    )
    photo = _PhotoRefSerializer(read_only=True, allow_null=True)
    returned_by = serializers.UUIDField(source="returned_by_id", read_only=True)
    client_uuid = serializers.CharField(
        max_length=36, required=False, allow_null=True, allow_blank=True
    )

    class Meta:
        model = CustomerBelonging
        fields = [
            "id",
            "description",
            "photo_id",
            "photo_client_uuid",
            "photo",
            "returned_at",
            "returned_by",
            "client_uuid",
        ]
        read_only_fields = ["id", "returned_at"]

    def get_fields(self) -> dict[str, serializers.Field]:
        fields = super().get_fields()
        if self.instance is not None:
            fields["client_uuid"].read_only = True
        return fields

    def to_representation(self, instance: CustomerBelonging) -> dict[str, Any]:
        data = super().to_representation(instance)
        data["photo_id"] = str(instance.photo_id) if instance.photo_id else None
        return data


class BudgetPanelRuleSerializer(serializers.ModelSerializer):
    """Regra do dicionário. Escrita grava `pattern` normalizado; `source` é sempre do servidor."""

    panel_keys = serializers.ListField(
        child=serializers.ChoiceField(choices=PANEL_KEYS), allow_empty=True
    )
    # Sem o UniqueValidator do model: o POST é upsert por pattern.
    pattern = serializers.CharField(max_length=200)
    # OS a recruzar depois de gravar a regra (ligação manual feita na conferência).
    service_order_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = BudgetPanelRule
        fields = ["id", "pattern", "panel_keys", "source", "service_order_id"]
        read_only_fields = ["id", "source"]

    def validate_pattern(self, value: str) -> str:
        normalized = normalize_description(value)
        if not normalized:
            raise serializers.ValidationError("Informe o texto do item.")
        return normalized
