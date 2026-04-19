"""
Paddock Solutions — Quotes Serializers
Motor de Orçamentos (MO) — Sprint MO-7
"""
from rest_framework import serializers

from apps.quotes.models import AreaImpacto, Orcamento, OrcamentoIntervencao, OrcamentoItemAdicional


class AreaImpactoSerializer(serializers.ModelSerializer):
    class Meta:
        model = AreaImpacto
        fields = [
            "id", "titulo", "ordem", "status", "observacao_regulador",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class OrcamentoIntervencaoSerializer(serializers.ModelSerializer):
    peca_nome      = serializers.CharField(source="peca_canonica.nome", read_only=True)
    servico_nome   = serializers.CharField(source="servico_canonico.nome", read_only=True)
    area_titulo    = serializers.CharField(source="area_impacto.titulo", read_only=True)

    class Meta:
        model = OrcamentoIntervencao
        fields = [
            "id", "area_impacto", "area_titulo",
            "peca_canonica", "peca_nome",
            "acao",
            "servico_canonico", "servico_nome",
            "ficha_tecnica",
            "qualificador_peca", "fornecimento", "codigo_peca",
            "quantidade", "horas_mao_obra",
            "valor_peca", "valor_mao_obra", "valor_insumos", "preco_total",
            "snapshot",
            "status",
            "abaixo_padrao", "acima_padrao", "inclusao_manual", "codigo_diferente",
            "ordem", "descricao_visivel", "observacao",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "area_titulo", "peca_nome", "servico_nome",
            "servico_canonico", "ficha_tecnica",
            "horas_mao_obra", "valor_peca", "valor_mao_obra", "valor_insumos", "preco_total",
            "snapshot",
            "created_at", "updated_at",
        ]


class OrcamentoIntervencaoCreateSerializer(serializers.Serializer):
    """Payload para adicionar intervenção via OrcamentoService.adicionar_intervencao."""

    area_impacto_id    = serializers.UUIDField()
    peca_canonica_id   = serializers.UUIDField()
    acao               = serializers.ChoiceField(choices=["trocar", "reparar", "pintar", "remocao_instalacao"])
    qualificador_peca  = serializers.ChoiceField(choices=["PPO", "PRO", "PR", "PREC"], default="PPO")
    fornecimento       = serializers.ChoiceField(choices=["oficina", "seguradora", "cliente"], default="oficina")
    quantidade         = serializers.IntegerField(min_value=1, default=1)
    codigo_peca        = serializers.CharField(max_length=60, default="", allow_blank=True)
    inclusao_manual    = serializers.BooleanField(default=False)
    descricao          = serializers.CharField(max_length=300, default="", allow_blank=True)


class OrcamentoItemAdicionalSerializer(serializers.ModelSerializer):
    servico_nome = serializers.CharField(source="service_catalog.name", read_only=True)

    class Meta:
        model = OrcamentoItemAdicional
        fields = [
            "id", "service_catalog", "servico_nome",
            "quantidade", "preco_unitario", "preco_total",
            "snapshot", "status", "fornecimento",
            "inclusao_manual", "abaixo_padrao", "acima_padrao",
            "ordem", "descricao_visivel", "observacao",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "servico_nome", "preco_unitario", "preco_total",
            "snapshot", "created_at", "updated_at",
        ]


class OrcamentoItemAdicionalCreateSerializer(serializers.Serializer):
    """Payload para adicionar item adicional via OrcamentoService.adicionar_item_adicional."""

    service_catalog_id = serializers.UUIDField()
    quantidade         = serializers.IntegerField(min_value=1, default=1)
    fornecimento       = serializers.ChoiceField(choices=["oficina", "seguradora", "cliente"], default="oficina")
    descricao          = serializers.CharField(max_length=300, default="", allow_blank=True)
    inclusao_manual    = serializers.BooleanField(default=False)


class OrcamentoListSerializer(serializers.ModelSerializer):
    """Serializer enxuto para listagem."""

    customer_nome = serializers.CharField(source="customer.name", read_only=True)
    seguradora    = serializers.CharField(source="insurer.name", read_only=True, default=None)

    class Meta:
        model = Orcamento
        fields = [
            "id", "numero", "versao", "status",
            "customer_nome", "seguradora",
            "veiculo_marca", "veiculo_modelo", "veiculo_ano", "veiculo_placa",
            "tipo_responsabilidade",
            "subtotal", "desconto", "total", "validade",
            "created_at",
        ]


class OrcamentoSerializer(serializers.ModelSerializer):
    """Serializer completo para detalhe."""

    areas        = AreaImpactoSerializer(many=True, read_only=True)
    intervencoes = OrcamentoIntervencaoSerializer(many=True, read_only=True)
    itens_adicionais = OrcamentoItemAdicionalSerializer(many=True, read_only=True)
    customer_nome = serializers.CharField(source="customer.name", read_only=True)
    seguradora    = serializers.CharField(source="insurer.name", read_only=True, default=None)

    class Meta:
        model = Orcamento
        fields = [
            "id", "numero", "versao", "status",
            "empresa",
            "customer", "customer_nome",
            "insurer", "seguradora",
            "tipo_responsabilidade", "sinistro_numero",
            "veiculo_marca", "veiculo_modelo", "veiculo_ano",
            "veiculo_versao", "veiculo_placa",
            "enquadramento_snapshot",
            "subtotal", "desconto", "total", "validade",
            "observacoes",
            "enviado_em", "aprovado_em",
            "service_order",
            "areas", "intervencoes", "itens_adicionais",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "numero", "versao", "enquadramento_snapshot",
            "subtotal", "total",
            "enviado_em", "aprovado_em",
            "service_order",
            "created_at", "updated_at",
        ]


class OrcamentoCreateSerializer(serializers.Serializer):
    """Payload para OrcamentoService.criar()."""

    empresa_id            = serializers.UUIDField()
    customer_id           = serializers.UUIDField()
    insurer_id            = serializers.UUIDField(required=False, allow_null=True, default=None)
    tipo_responsabilidade = serializers.ChoiceField(
        choices=["cliente", "seguradora", "rcf"], default="cliente"
    )
    sinistro_numero = serializers.CharField(max_length=40, default="", allow_blank=True)
    veiculo         = serializers.DictField()
    observacoes     = serializers.CharField(default="", allow_blank=True)


class AprovarSerializer(serializers.Serializer):
    """Payload para OrcamentoService.aprovar()."""

    intervencoes_ids      = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_null=True, default=None
    )
    itens_adicionais_ids  = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_null=True, default=None
    )
    areas_negadas         = serializers.ListField(
        child=serializers.DictField(), required=False, allow_null=True, default=None
    )
