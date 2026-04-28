"""Serializers do módulo de documentos PDF."""
from __future__ import annotations

from rest_framework import serializers

from apps.documents.models import DocumentGeneration, DocumentType


class GenerateDocumentSerializer(serializers.Serializer):
    document_type = serializers.ChoiceField(choices=DocumentType.choices)
    receivable_id = serializers.UUIDField(required=False, allow_null=True)
    data = serializers.JSONField()


class DocumentGenerationSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(source="get_document_type_display", read_only=True)
    generated_by_name = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = DocumentGeneration
        fields = [
            "id", "document_type", "document_type_display", "version",
            "service_order_id", "receivable_id", "s3_key", "file_size_bytes",
            "generated_by_name", "generated_at", "download_url", "created_at",
        ]
        read_only_fields = fields

    def get_generated_by_name(self, obj: DocumentGeneration) -> str:
        user = obj.generated_by
        return getattr(user, "full_name", "") or getattr(user, "email", str(user))

    def get_download_url(self, obj: DocumentGeneration) -> str:
        return f"/api/v1/documents/{obj.pk}/download/"

    def to_representation(self, instance: DocumentGeneration) -> dict:
        data = super().to_representation(instance)
        data["generated_at"] = data["created_at"]
        return data


class DocumentSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentGeneration
        fields = ["id", "document_type", "version", "data_snapshot", "created_at"]
        read_only_fields = fields
