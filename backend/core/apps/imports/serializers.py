"""Serializers DRF do app imports."""
from __future__ import annotations

from rest_framework import serializers

from .models import ImportAttempt


class ImportAttemptReadSerializer(serializers.ModelSerializer):
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    trigger_display = serializers.CharField(source="get_trigger_display", read_only=True)

    class Meta:
        model = ImportAttempt
        fields = [
            "id",
            "source", "source_display",
            "trigger", "trigger_display",
            "casualty_number", "budget_number", "version_number",
            "http_status", "parsed_ok", "error_message", "error_type",
            "raw_hash",
            "service_order", "version_created", "duplicate_of",
            "duration_ms", "created_at", "created_by",
        ]


class FetchCiliaSerializer(serializers.Serializer):
    """Entrada do endpoint `POST /imports/cilia/fetch/`."""

    casualty_number = serializers.CharField(max_length=40)
    budget_number = serializers.CharField(max_length=40)
    version_number = serializers.IntegerField(required=False, allow_null=True)


class UploadXmlIfxSerializer(serializers.Serializer):
    """Entrada do endpoint `POST /imports/xml/upload/`."""

    file = serializers.FileField()
    insurer_code = serializers.ChoiceField(choices=["porto", "azul", "itau"])
