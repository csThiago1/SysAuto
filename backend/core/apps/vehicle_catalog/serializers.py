"""
Paddock Solutions — Vehicle Catalog Serializers
"""
import re

from rest_framework import serializers

from apps.vehicle_catalog.models import VehicleColor, VehicleMake, VehicleModel, VehicleYearVersion

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
    class Meta:
        model = VehicleMake
        fields = ["id", "fipe_id", "nome", "nome_normalizado", "logo_url"]


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
