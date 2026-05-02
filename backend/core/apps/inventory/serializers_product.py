"""
Paddock Solutions — Inventory — Serializers de Produto Comercial
TipoPeca, CategoriaProduto, CategoriaInsumo, ProdutoComercialPeca, ProdutoComercialInsumo
"""
from rest_framework import serializers

from apps.inventory.models_product import (
    CategoriaInsumo,
    CategoriaProduto,
    ProdutoComercialInsumo,
    ProdutoComercialPeca,
    TipoPeca,
)


class TipoPecaSerializer(serializers.ModelSerializer):
    """CRUD de Tipo de Peça."""

    class Meta:
        model = TipoPeca
        fields = [
            "id",
            "nome",
            "codigo",
            "ordem",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class CategoriaProdutoSerializer(serializers.ModelSerializer):
    """CRUD de Categoria de Produto (Peça)."""

    class Meta:
        model = CategoriaProduto
        fields = [
            "id",
            "nome",
            "codigo",
            "margem_padrao_pct",
            "ordem",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class CategoriaInsumoSerializer(serializers.ModelSerializer):
    """CRUD de Categoria de Insumo."""

    class Meta:
        model = CategoriaInsumo
        fields = [
            "id",
            "nome",
            "codigo",
            "margem_padrao_pct",
            "ordem",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ProdutoComercialPecaSerializer(serializers.ModelSerializer):
    """CRUD de Produto Comercial (Peça)."""

    tipo_peca_nome = serializers.CharField(
        source="tipo_peca.nome", read_only=True, default=""
    )
    posicao_veiculo_display = serializers.SerializerMethodField()
    lado_display = serializers.SerializerMethodField()
    categoria_nome = serializers.CharField(
        source="categoria.nome", read_only=True, default=""
    )

    class Meta:
        model = ProdutoComercialPeca
        fields = [
            "id",
            "sku_interno",
            "nome_interno",
            "codigo_fabricante",
            "codigo_ean",
            "codigo_distribuidor",
            "nome_fabricante",
            "tipo_peca",
            "tipo_peca_nome",
            "posicao_veiculo",
            "posicao_veiculo_display",
            "lado",
            "lado_display",
            "categoria",
            "categoria_nome",
            "peca_canonica",
            "preco_venda_sugerido",
            "margem_padrao_pct",
            "observacoes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_posicao_veiculo_display(self, obj: ProdutoComercialPeca) -> str:
        return obj.get_posicao_veiculo_display()  # type: ignore[attr-defined]

    def get_lado_display(self, obj: ProdutoComercialPeca) -> str:
        return obj.get_lado_display()  # type: ignore[attr-defined]


class ProdutoComercialInsumoSerializer(serializers.ModelSerializer):
    """CRUD de Produto Comercial (Insumo)."""

    categoria_insumo_nome = serializers.CharField(
        source="categoria_insumo.nome", read_only=True, default=""
    )

    class Meta:
        model = ProdutoComercialInsumo
        fields = [
            "id",
            "sku_interno",
            "nome_interno",
            "codigo_fabricante",
            "codigo_ean",
            "nome_fabricante",
            "unidade_base",
            "categoria_insumo",
            "categoria_insumo_nome",
            "material_canonico",
            "preco_venda_sugerido",
            "margem_padrao_pct",
            "observacoes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
