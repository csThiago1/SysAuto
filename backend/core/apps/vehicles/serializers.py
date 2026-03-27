from rest_framework import serializers

from .models import Vehicle, VehicleBrand, VehicleModel, VehicleVersion


# ── Catálogo FIPE ─────────────────────────────────────────────────────────────

class VehicleBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleBrand
        fields = ["id", "fipe_brand_id", "name", "vehicle_type"]
        read_only_fields = fields


class VehicleModelSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True)

    class Meta:
        model = VehicleModel
        fields = ["id", "fipe_model_id", "name", "brand_name"]
        read_only_fields = fields


class VehicleVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleVersion
        fields = ["id", "fipe_code", "year_model", "fuel", "full_name"]
        read_only_fields = fields


# ── Veículo ───────────────────────────────────────────────────────────────────

class VehicleListSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Vehicle
        fields = ["id", "plate", "display_name", "color", "year_manufacture", "created_at"]
        read_only_fields = fields


class VehicleDetailSerializer(serializers.ModelSerializer):
    version = VehicleVersionSerializer(read_only=True)
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Vehicle
        fields = [
            "id", "plate", "version", "description", "display_name",
            "color", "year_manufacture", "chassis", "renavam",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "display_name", "created_at", "updated_at"]


class VehicleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ["plate", "version", "description", "color", "year_manufacture", "chassis", "renavam"]

    def validate_plate(self, value: str) -> str:
        return value.upper().strip()
