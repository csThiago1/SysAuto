"""Serializers para movimentacao de estoque e aprovacao."""
from rest_framework import serializers

from apps.inventory.models_movement import MovimentacaoEstoque


class MovimentacaoEstoqueSerializer(serializers.ModelSerializer):
    """Read-only serializer para listagem de movimentacoes."""

    realizado_por_nome = serializers.CharField(
        source="realizado_por.email", read_only=True, default="",
    )
    aprovado_por_nome = serializers.CharField(
        source="aprovado_por.email", read_only=True, default="",
    )
    nivel_origem_endereco = serializers.CharField(
        source="nivel_origem.endereco_completo", read_only=True, default="",
    )
    nivel_destino_endereco = serializers.CharField(
        source="nivel_destino.endereco_completo", read_only=True, default="",
    )
    unidade_barcode = serializers.CharField(
        source="unidade_fisica.codigo_barras", read_only=True, default="",
    )
    lote_barcode = serializers.CharField(
        source="lote_insumo.codigo_barras", read_only=True, default="",
    )
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = MovimentacaoEstoque
        fields = [
            "id", "tipo", "tipo_display",
            "unidade_fisica", "unidade_barcode",
            "lote_insumo", "lote_barcode",
            "quantidade",
            "nivel_origem", "nivel_origem_endereco",
            "nivel_destino", "nivel_destino_endereco",
            "ordem_servico", "nfe_entrada",
            "motivo", "evidencia",
            "aprovado_por", "aprovado_por_nome", "aprovado_em",
            "realizado_por", "realizado_por_nome",
            "created_at",
        ]
        read_only_fields = fields


class EntradaPecaInputSerializer(serializers.Serializer):
    """Input para entrada manual de peca."""

    peca_canonica_id = serializers.UUIDField()
    valor_nf = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0.01)
    nivel_id = serializers.UUIDField()
    motivo = serializers.CharField(max_length=500)
    produto_peca_id = serializers.UUIDField(required=False, allow_null=True)
    numero_serie = serializers.CharField(max_length=80, required=False, default="")


class EntradaLoteInputSerializer(serializers.Serializer):
    """Input para entrada manual de lote de insumo."""

    material_canonico_id = serializers.UUIDField()
    quantidade_compra = serializers.DecimalField(
        max_digits=10, decimal_places=3, min_value=0.001,
    )
    unidade_compra = serializers.CharField(max_length=20)
    fator_conversao = serializers.DecimalField(
        max_digits=10, decimal_places=4, min_value=0.0001,
    )
    valor_total_nf = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0.01,
    )
    nivel_id = serializers.UUIDField()
    motivo = serializers.CharField(max_length=500)
    produto_insumo_id = serializers.UUIDField(required=False, allow_null=True)
    validade = serializers.DateField(required=False, allow_null=True)


class DevolucaoInputSerializer(serializers.Serializer):
    """Input para devolucao de peca."""

    nivel_destino_id = serializers.UUIDField()
    motivo = serializers.CharField(max_length=500)


class TransferenciaInputSerializer(serializers.Serializer):
    """Input para transferencia de item entre niveis."""

    item_tipo = serializers.ChoiceField(choices=["unidade", "lote"])
    item_id = serializers.UUIDField()
    nivel_destino_id = serializers.UUIDField()


class PerdaInputSerializer(serializers.Serializer):
    """Input para registro de perda/avaria."""

    item_tipo = serializers.ChoiceField(choices=["unidade", "lote"])
    item_id = serializers.UUIDField()
    motivo = serializers.CharField(max_length=500)
    quantidade = serializers.DecimalField(
        max_digits=10, decimal_places=3, required=False, allow_null=True,
        help_text="Obrigatorio para lotes (quantidade perdida em unidade_base).",
    )


class RejeicaoInputSerializer(serializers.Serializer):
    """Input para rejeicao de movimentacao pendente."""

    motivo = serializers.CharField(max_length=500)
