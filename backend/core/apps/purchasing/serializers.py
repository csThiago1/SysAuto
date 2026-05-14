"""
Paddock Solutions — Purchasing — Serializers
"""
from rest_framework import serializers

from apps.purchasing.models import AprovacaoCotacao, CondicaoPagamento, CotacaoLog, ItemOrdemCompra, OrdemCompra, PedidoCompra, PrazoEntrega, RespostaCotacao


class PrazoEntregaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrazoEntrega
        fields = ["id", "label", "dias_uteis"]
        read_only_fields = ["id"]


class CondicaoPagamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CondicaoPagamento
        fields = ["id", "label"]
        read_only_fields = ["id"]


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
    os_plate = serializers.CharField(
        source="service_order.plate", read_only=True, default="",
    )
    os_chassis = serializers.CharField(
        source="service_order.chassis", read_only=True, default="",
    )
    os_make = serializers.CharField(
        source="service_order.make", read_only=True, default="",
    )
    os_model = serializers.CharField(
        source="service_order.model", read_only=True, default="",
    )
    os_vehicle_version = serializers.CharField(
        source="service_order.vehicle_version", read_only=True, default="",
    )
    os_year = serializers.SerializerMethodField()
    os_fuel_type = serializers.CharField(
        source="service_order.fuel_type", read_only=True, default="",
    )
    os_customer_type = serializers.CharField(
        source="service_order.customer_type", read_only=True, default="",
    )
    os_customer_name = serializers.SerializerMethodField()
    os_insurer_name = serializers.SerializerMethodField()
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
            "os_plate",
            "os_chassis",
            "os_make",
            "os_model",
            "os_vehicle_version",
            "os_year",
            "os_fuel_type",
            "os_customer_type",
            "os_customer_name",
            "os_insurer_name",
            "veiculo",
            "created_at",
        ]
        read_only_fields = fields

    def get_os_year(self, obj: PedidoCompra) -> str:
        year = getattr(obj.service_order, "year", None)
        return str(year) if year else ""

    def get_os_customer_name(self, obj: PedidoCompra) -> str:
        so = obj.service_order
        customer = getattr(so, "customer", None)
        if customer:
            return getattr(customer, "name", "") or ""
        return getattr(so, "customer_name", "") or ""

    def get_os_insurer_name(self, obj: PedidoCompra) -> str:
        insurer = getattr(obj.service_order, "insurer", None)
        return insurer.name if insurer else ""

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
    status_entrega = serializers.CharField(read_only=True)
    data_prevista = serializers.DateField(read_only=True)
    data_recebimento = serializers.DateField(read_only=True)
    destino = serializers.CharField(read_only=True)

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
            "status_entrega",
            "data_prevista",
            "data_recebimento",
            "destino",
            "nfe_entrada",
            "created_at",
        ]
        read_only_fields = ["id", "valor_total", "status_entrega", "data_prevista", "data_recebimento", "destino", "nfe_entrada", "created_at"]


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


class CotacaoLogSerializer(serializers.ModelSerializer):
    enviado_por_nome = serializers.CharField(source="enviado_por.email", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    contact_name = serializers.CharField(source="supplier_contact.name", read_only=True, default="")

    class Meta:
        model = CotacaoLog
        fields = [
            "id",
            "service_order",
            "supplier",
            "supplier_name",
            "supplier_contact",
            "contact_name",
            "enviado_por",
            "enviado_por_nome",
            "mensagem",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "enviado_por",
            "enviado_por_nome",
            "supplier_name",
            "contact_name",
            "created_at",
        ]


class RespostaCotacaoSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    registrado_por_nome = serializers.CharField(source="registrado_por.email", read_only=True)
    prazo_entrega_obj = serializers.PrimaryKeyRelatedField(
        queryset=PrazoEntrega.objects.all(), required=False, allow_null=True,
    )
    condicao_pagamento_obj = serializers.PrimaryKeyRelatedField(
        queryset=CondicaoPagamento.objects.all(), required=False, allow_null=True,
    )
    prazo_entrega_label = serializers.CharField(
        source="prazo_entrega_obj.label", read_only=True, default="",
    )
    condicao_pagamento_label = serializers.CharField(
        source="condicao_pagamento_obj.label", read_only=True, default="",
    )

    class Meta:
        model = RespostaCotacao
        fields = [
            "id",
            "pedido_compra",
            "supplier",
            "supplier_name",
            "valor_unitario",
            "prazo_entrega",
            "prazo_entrega_obj",
            "prazo_entrega_label",
            "condicoes_pagamento",
            "condicao_pagamento_obj",
            "condicao_pagamento_label",
            "observacoes",
            "selecionada",
            "registrado_por",
            "registrado_por_nome",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "registrado_por",
            "registrado_por_nome",
            "supplier_name",
            "prazo_entrega_label",
            "condicao_pagamento_label",
            "created_at",
        ]


class DashboardComprasSerializer(serializers.Serializer):
    """Serializer para dashboard de compras."""

    solicitados = serializers.IntegerField()
    em_cotacao = serializers.IntegerField()
    aguardando_aprovacao = serializers.IntegerField()
    aprovadas_hoje = serializers.IntegerField()


class AprovacaoCotacaoSerializer(serializers.ModelSerializer):
    enviado_por_nome = serializers.CharField(source="enviado_por.email", read_only=True)
    aprovado_por_nome = serializers.CharField(source="aprovado_por.email", read_only=True, default="")
    os_number = serializers.IntegerField(source="service_order.number", read_only=True)
    os_make = serializers.CharField(source="service_order.make", read_only=True)
    os_model = serializers.CharField(source="service_order.model", read_only=True)
    os_year = serializers.SerializerMethodField()
    os_plate = serializers.CharField(source="service_order.plate", read_only=True)
    os_customer_type = serializers.CharField(source="service_order.customer_type", read_only=True)
    os_customer_name = serializers.CharField(source="service_order.customer_name", read_only=True)
    os_insurer_name = serializers.SerializerMethodField()

    class Meta:
        model = AprovacaoCotacao
        fields = [
            "id", "service_order", "status",
            "enviado_por", "enviado_por_nome",
            "aprovado_por", "aprovado_por_nome", "aprovado_em",
            "observacoes_comprador", "observacoes_financeiro", "motivo_rejeicao",
            "os_number", "os_make", "os_model", "os_year", "os_plate",
            "os_customer_type", "os_customer_name", "os_insurer_name",
            "created_at",
        ]
        read_only_fields = [
            "id", "enviado_por", "enviado_por_nome",
            "aprovado_por", "aprovado_por_nome", "aprovado_em",
            "os_number", "os_make", "os_model", "os_year", "os_plate",
            "os_customer_type", "os_customer_name", "os_insurer_name",
            "created_at",
        ]

    def get_os_year(self, obj: AprovacaoCotacao) -> str:
        year = getattr(obj.service_order, "year", None)
        return str(year) if year else ""

    def get_os_insurer_name(self, obj: AprovacaoCotacao) -> str:
        insurer = getattr(obj.service_order, "insurer", None)
        return insurer.name if insurer else ""
