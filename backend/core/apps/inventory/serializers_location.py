"""
Paddock Solutions — Inventory — Serializers de Localização
WMS: Armazem -> Rua -> Prateleira -> Nivel
"""
from rest_framework import serializers

from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua


class ArmazemSerializer(serializers.ModelSerializer):
    """CRUD de Armazém — total_ruas vem via annotate na view."""

    total_ruas = serializers.IntegerField(read_only=True)

    class Meta:
        model = Armazem
        fields = [
            "id",
            "nome",
            "codigo",
            "tipo",
            "endereco",
            "responsavel",
            "observacoes",
            "total_ruas",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RuaSerializer(serializers.ModelSerializer):
    """CRUD de Rua — armazem_codigo resolvido via source."""

    armazem_codigo = serializers.CharField(source="armazem.codigo", read_only=True)
    total_prateleiras = serializers.IntegerField(read_only=True)

    class Meta:
        model = Rua
        fields = [
            "id",
            "armazem",
            "armazem_codigo",
            "codigo",
            "descricao",
            "ordem",
            "total_prateleiras",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PrateleiraSerializer(serializers.ModelSerializer):
    """CRUD de Prateleira."""

    rua_codigo = serializers.CharField(source="rua.codigo", read_only=True)
    total_niveis = serializers.IntegerField(read_only=True)

    class Meta:
        model = Prateleira
        fields = [
            "id",
            "rua",
            "rua_codigo",
            "codigo",
            "descricao",
            "capacidade_kg",
            "ordem",
            "total_niveis",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class NivelSerializer(serializers.ModelSerializer):
    """CRUD de Nível — ponto terminal do endereçamento WMS."""

    prateleira_codigo = serializers.CharField(source="prateleira.codigo", read_only=True)
    endereco_completo = serializers.CharField(read_only=True)
    total_unidades = serializers.IntegerField(read_only=True)
    total_lotes = serializers.IntegerField(read_only=True)

    class Meta:
        model = Nivel
        fields = [
            "id",
            "prateleira",
            "prateleira_codigo",
            "codigo",
            "descricao",
            "altura_cm",
            "largura_cm",
            "profundidade_cm",
            "ordem",
            "endereco_completo",
            "total_unidades",
            "total_lotes",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "endereco_completo", "created_at"]
