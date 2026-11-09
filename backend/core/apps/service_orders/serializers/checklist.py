"""Serializers do checklist de entrada 3D — danos e pertences."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from ..models import ChecklistDamage, CustomerBelonging
from .core import ServiceOrderPhotoSerializer


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
