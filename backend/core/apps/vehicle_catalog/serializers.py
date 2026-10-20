"""
Paddock Solutions — Vehicle Catalog Serializers
"""

import re

from rest_framework import serializers

from apps.vehicle_catalog.models import (
    VehicleColor,
    VehicleFamily,
    VehicleMake,
    VehicleModel,
    VehicleYearVersion,
)

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class VehicleColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleColor
        fields = ["id", "name", "hex_code"]

    def validate_hex_code(self, value: str) -> str:
        if not _HEX_RE.match(value):
            raise serializers.ValidationError("Cor hex inválida (ex: #C0C0C0).")
        return value


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
    """Versão FIPE no seletor. O legado (makes/{id}/models/) segue no VehicleModelSerializer."""

    label = serializers.CharField(source="nome", read_only=True)

    class Meta:
        model = VehicleModel
        fields = ["id", "label", "codigo_fipe", "familia"]


class VehicleYearOptionSerializer(serializers.ModelSerializer):
    """Ano/combustível no seletor. O legado (models/{id}/years/) segue no
    VehicleYearVersionSerializer."""

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


class VehicleModelSerializer(serializers.ModelSerializer):
    marca_nome = serializers.CharField(source="marca.nome", read_only=True)

    class Meta:
        model = VehicleModel
        fields = ["id", "fipe_id", "nome", "nome_normalizado", "marca", "marca_nome"]


class VehicleYearVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleYearVersion
        fields = [
            "id",
            "fipe_id",
            "ano",
            "combustivel",
            "descricao",
            "codigo_fipe",
            "valor_referencia",
        ]
