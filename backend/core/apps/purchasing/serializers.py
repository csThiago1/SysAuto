"""
Paddock Solutions — Purchasing — Serializers
"""
from rest_framework import serializers

from apps.purchasing.models import ItemOrdemCompra, OrdemCompra, PedidoCompra


class PedidoCompraSerializer(serializers.ModelSerializer):
    """Read-only serializer para listagem de pedidos de compra."""

    status_display = serializers.CharField(
        source="get_status_display", read_only=True,
    )
    tipo_qualidade_display = serializers.CharField(
        source="get_tipo_qualidade_display", read_only=True,
    )
    solicitado_por_nome = serializers.CharField(
        source="solicitado_por.email", default="", read_only=True,
    )
    os_number = serializers.IntegerField(
        source="service_order.number", read_only=True,
    )
    veiculo = serializers.SerializerMethodField()

    class Meta:
        model = PedidoCompra
        fields = [
            "id",
            "service_order",
            "service_order_part",
            "descricao",
            "codigo_referencia",
            "tipo_qualidade",
            "tipo_qualidade_display",
            "quantidade",
            "valor_cobrado_cliente",
            "observacoes",
            "status",
            "status_display",
            "solicitado_por",
            "solicitado_por_nome",
            "os_number",
            "veiculo",
            "created_at",
        ]
        read_only_fields = fields

    def get_veiculo(self, obj: PedidoCompra) -> str:
        os = obj.service_order
        parts = [
            getattr(os, "vehicle_brand", "") or "",
            getattr(os, "vehicle_model", "") or "",
            str(getattr(os, "vehicle_year", "") or ""),
        ]
        return " ".join(p for p in parts if p).strip()


class ItemOrdemCompraSerializer(serializers.ModelSerializer):
    """Serializer para itens de ordem de compra."""

    tipo_qualidade_display = serializers.CharField(
        source="get_tipo_qualidade_display", read_only=True,
    )

    class Meta:
        model = ItemOrdemCompra
        fields = [
            "id",
            "ordem_compra",
            "pedido_compra",
            "fornecedor",
            "fornecedor_nome",
            "fornecedor_cnpj",
            "fornecedor_contato",
            "descricao",
            "codigo_referencia",
            "tipo_qualidade",
            "tipo_qualidade_display",
            "quantidade",
            "valor_unitario",
            "valor_total",
            "prazo_entrega",
            "observacoes",
            "created_at",
        ]
        read_only_fields = ["id", "valor_total", "created_at"]


class OrdemCompraListSerializer(serializers.ModelSerializer):
    """Serializer para listagem de ordens de compra."""

    status_display = serializers.CharField(
        source="get_status_display", read_only=True,
    )
    os_number = serializers.IntegerField(
        source="service_order.number", read_only=True,
    )
    criado_por_nome = serializers.CharField(
        source="criado_por.email", default="", read_only=True,
    )
    aprovado_por_nome = serializers.CharField(
        source="aprovado_por.email", default="", read_only=True,
    )
    total_itens = serializers.IntegerField(read_only=True)

    class Meta:
        model = OrdemCompra
        fields = [
            "id",
            "numero",
            "service_order",
            "os_number",
            "status",
            "status_display",
            "valor_total",
            "criado_por",
            "criado_por_nome",
            "aprovado_por_nome",
            "total_itens",
            "created_at",
        ]


class OrdemCompraDetailSerializer(OrdemCompraListSerializer):
    """Serializer com itens aninhados para detalhe da OC."""

    itens = ItemOrdemCompraSerializer(many=True, read_only=True)

    class Meta(OrdemCompraListSerializer.Meta):
        fields = OrdemCompraListSerializer.Meta.fields + ["itens"]


class AdicionarItemOCInputSerializer(serializers.Serializer):
    """Input para adicionar item a uma OC."""

    pedido_compra_id = serializers.UUIDField(required=False, allow_null=True)
    fornecedor_id = serializers.UUIDField(required=False, allow_null=True)
    fornecedor_nome = serializers.CharField(max_length=150)
    fornecedor_cnpj = serializers.CharField(
        max_length=20, required=False, default="", allow_blank=True,
    )
    fornecedor_contato = serializers.CharField(
        max_length=100, required=False, default="", allow_blank=True,
    )
    descricao = serializers.CharField(max_length=300)
    codigo_referencia = serializers.CharField(
        max_length=100, required=False, default="", allow_blank=True,
    )
    tipo_qualidade = serializers.ChoiceField(
        choices=ItemOrdemCompra.TipoQualidade.choices,
    )
    quantidade = serializers.DecimalField(max_digits=10, decimal_places=2)
    valor_unitario = serializers.DecimalField(max_digits=12, decimal_places=2)
    prazo_entrega = serializers.CharField(
        max_length=100, required=False, default="", allow_blank=True,
    )
    observacoes = serializers.CharField(required=False, default="", allow_blank=True)


class DashboardComprasSerializer(serializers.Serializer):
    """Serializer para dashboard de compras."""

    solicitados = serializers.IntegerField()
    em_cotacao = serializers.IntegerField()
    aguardando_aprovacao = serializers.IntegerField()
    aprovadas_hoje = serializers.IntegerField()
