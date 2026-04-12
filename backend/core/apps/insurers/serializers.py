"""
Paddock Solutions — Insurers Serializers
"""
from rest_framework import serializers

from apps.insurers.models import Insurer


class InsurerSerializer(serializers.ModelSerializer):
    """Serializer completo para seguradoras."""

    class Meta:
        model = Insurer
        fields = [
            "id",
            "name",
            "trade_name",
            "cnpj",
            "brand_color",
            "abbreviation",
            "logo_url",
            "is_active",
            "uses_cilia",
        ]
        read_only_fields = ["id"]


class InsurerMinimalSerializer(serializers.ModelSerializer):
    """Serializer compacto para uso em nested (exibição em OS)."""

    display_name = serializers.SerializerMethodField()
    logo = serializers.CharField(source="logo_url", default="")

    class Meta:
        model = Insurer
        fields = ["id", "name", "trade_name", "brand_color", "abbreviation", "display_name", "logo", "uses_cilia"]

    def get_display_name(self, obj: Insurer) -> str:
        return obj.trade_name or obj.name
