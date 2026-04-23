"""vehicles.serializers — serializer de Vehicle."""
from rest_framework import serializers

from .models import Vehicle


class VehicleSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()

    class Meta:
        model = Vehicle
        fields = [
            "id", "plate", "version", "description", "display_name",
            "color", "year_manufacture", "chassis", "renavam",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
