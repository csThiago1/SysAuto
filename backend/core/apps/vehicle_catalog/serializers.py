"""
Paddock Solutions — Vehicle Catalog Serializers
"""

from rest_framework import serializers

from apps.vehicle_catalog.models import VehicleFamily, VehicleMake, VehicleModel, VehicleYearVersion


class VehicleMakeSerializer(serializers.ModelSerializer):
    """Montadora do seletor. Só is_active é gravável aqui; o logo tem action própria."""

    label = serializers.CharField(source="display_name", read_only=True)

    class Meta:
        model = VehicleMake
        fields = ["id", "label", "nome", "tipo", "logo_url", "is_active"]
        read_only_fields = ["nome", "tipo", "logo_url"]


class VehicleFamilySerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="nome", read_only=True)
    marca = serializers.PrimaryKeyRelatedField(source="make", read_only=True)

    class Meta:
        model = VehicleFamily
        fields = ["id", "label", "marca"]


class VehicleModelOptionSerializer(serializers.ModelSerializer):
    """Versão FIPE no seletor."""

    label = serializers.CharField(source="nome", read_only=True)

    class Meta:
        model = VehicleModel
        fields = ["id", "label", "codigo_fipe", "familia"]


class VehicleYearOptionSerializer(serializers.ModelSerializer):
    """Ano/combustível no seletor."""

    label = serializers.CharField(read_only=True)
    combustivel_label = serializers.CharField(source="get_combustivel_display", read_only=True)

    class Meta:
        model = VehicleYearVersion
        fields = [
            "id",
            "label",
            "ano",
            "zero_km",
            "combustivel",
            "combustivel_label",
            "valor_referencia",
        ]
