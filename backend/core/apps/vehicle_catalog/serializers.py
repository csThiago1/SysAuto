"""
Paddock Solutions — Vehicle Catalog Serializers
"""
from rest_framework import serializers

from apps.vehicle_catalog.models import VehicleColor, VehicleMake, VehicleModel, VehicleYearVersion


class VehicleColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleColor
        fields = ["id", "name", "hex_code"]


class VehicleMakeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleMake
        fields = ["id", "fipe_id", "nome", "nome_normalizado"]


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
