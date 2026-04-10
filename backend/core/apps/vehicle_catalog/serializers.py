"""
Paddock Solutions — Vehicle Catalog Serializers
"""
from rest_framework import serializers

from apps.vehicle_catalog.models import VehicleColor


class VehicleColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleColor
        fields = ["id", "name", "hex_code"]
