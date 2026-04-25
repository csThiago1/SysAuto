from rest_framework import serializers

from .models import ImportAttempt


class ImportAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportAttempt
        fields = [
            "id", "source", "trigger", "casualty_number", "budget_number",
            "version_number", "http_status", "parsed_ok", "error_message",
            "error_type", "raw_hash", "service_order", "version_created",
            "duplicate_of", "created_at", "created_by", "duration_ms",
        ]
        read_only_fields = fields
