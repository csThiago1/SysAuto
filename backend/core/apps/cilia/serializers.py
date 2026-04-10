"""
Paddock Solutions — Cilia Serializers
"""
from rest_framework import serializers
from .models import OrcamentoCilia

class OrcamentoCiliaSerializer(serializers.ModelSerializer):
    """
    Serializer padrão, esconde a raw_data volumosa.
    """
    class Meta:
        model = OrcamentoCilia
        exclude = ["raw_data"]

class OrcamentoCiliaDetalheSerializer(serializers.ModelSerializer):
    """
    Serializer com todos os campos + peças puxadas dinamicamente.
    """
    itens = serializers.SerializerMethodField()

    class Meta:
        model = OrcamentoCilia
        fields = "__all__"

    def get_itens(self, obj: OrcamentoCilia) -> list:
        return obj.raw_data.get("budgetings", [])
