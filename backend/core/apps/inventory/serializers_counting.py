"""Serializers para contagem de inventario."""
from rest_framework import serializers

from apps.inventory.models_counting import ContagemInventario, ItemContagem


class ItemContagemSerializer(serializers.ModelSerializer):
    """Serializer para itens de contagem."""

    nivel_endereco = serializers.CharField(
        source="nivel.endereco_completo", read_only=True, default="",
    )
    unidade_barcode = serializers.CharField(
        source="unidade_fisica.codigo_barras", read_only=True, default="",
    )
    lote_barcode = serializers.CharField(
        source="lote_insumo.codigo_barras", read_only=True, default="",
    )
    contado_por_nome = serializers.CharField(
        source="contado_por.email", read_only=True, default="",
    )

    class Meta:
        model = ItemContagem
        fields = [
            "id", "nivel", "nivel_endereco",
            "unidade_fisica", "unidade_barcode",
            "lote_insumo", "lote_barcode",
            "quantidade_sistema", "quantidade_contada", "divergencia",
            "contado_por", "contado_por_nome", "observacao",
            "created_at",
        ]
        read_only_fields = [
            "id", "nivel", "unidade_fisica", "lote_insumo",
            "quantidade_sistema", "divergencia", "created_at",
        ]


class ContagemInventarioSerializer(serializers.ModelSerializer):
    """Serializer para listagem de contagens."""

    iniciado_por_nome = serializers.CharField(
        source="iniciado_por.email", read_only=True, default="",
    )
    fechado_por_nome = serializers.CharField(
        source="fechado_por.email", read_only=True, default="",
    )
    total_itens = serializers.IntegerField(read_only=True, default=0)
    total_contados = serializers.IntegerField(read_only=True, default=0)
    total_divergencias = serializers.IntegerField(read_only=True, default=0)
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ContagemInventario
        fields = [
            "id", "tipo", "tipo_display", "status", "status_display",
            "armazem", "rua",
            "data_abertura", "data_fechamento",
            "iniciado_por", "iniciado_por_nome",
            "fechado_por", "fechado_por_nome",
            "observacoes",
            "total_itens", "total_contados", "total_divergencias",
            "created_at",
        ]
        read_only_fields = [
            "id", "status", "data_abertura", "data_fechamento",
            "iniciado_por", "fechado_por", "created_at",
        ]


class ContagemInventarioDetailSerializer(ContagemInventarioSerializer):
    """Serializer para detalhe de contagem (inclui itens)."""

    itens = ItemContagemSerializer(many=True, read_only=True)

    class Meta(ContagemInventarioSerializer.Meta):
        fields = ContagemInventarioSerializer.Meta.fields + ["itens"]


class AbrirContagemInputSerializer(serializers.Serializer):
    """Input para abertura de contagem."""

    tipo = serializers.ChoiceField(choices=["ciclica", "total"])
    armazem_id = serializers.UUIDField(required=False, allow_null=True)
    rua_id = serializers.UUIDField(required=False, allow_null=True)


class RegistrarItemInputSerializer(serializers.Serializer):
    """Input para registro de quantidade contada em um item."""

    quantidade_contada = serializers.DecimalField(
        max_digits=10, decimal_places=3, min_value=0,
    )
    observacao = serializers.CharField(max_length=200, required=False, default="")
