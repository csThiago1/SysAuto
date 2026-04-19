"""
Paddock Solutions — Pricing Engine — Serializers
Motor de Orçamentos (MO) — Sprint 03+06: Adapters de Custo + Motor de Precificação

Serializers para ParametroRateio, ParametroCustoHora, CustoHoraFallback,
MargemOperacao, MarkupPeca, CalculoCustoSnapshot e inputs do motor.

RBAC para snapshot (P10 — serializer distinto por role, nunca filtro no frontend):
- SnapshotMinSerializer  → CONSULTANT+ (preco_final, contexto)
- SnapshotMgrSerializer  → MANAGER+ (+ custo_total_base, margem_ajustada, decomposicao)
- SnapshotFullSerializer → ADMIN+   (+ custo_mo, custo_insumos, rateio, custo_peca_base, margem_base)
"""

from rest_framework import serializers

from apps.pricing_engine.models import (
    CalculoCustoSnapshot,
    CustoHoraFallback,
    MargemOperacao,
    MarkupPeca,
    ParametroCustoHora,
    ParametroRateio,
)


class ParametroRateioSerializer(serializers.ModelSerializer):
    """Serializer para ParametroRateio — parâmetros de rateio de despesas."""

    class Meta:
        model = ParametroRateio
        fields = [
            "id",
            "empresa",
            "vigente_desde",
            "vigente_ate",
            "horas_produtivas_mes",
            "metodo",
            "observacoes",
            "is_active",
        ]
        read_only_fields = ["id"]


class ParametroCustoHoraSerializer(serializers.ModelSerializer):
    """Serializer para ParametroCustoHora — encargos sobre salário bruto."""

    class Meta:
        model = ParametroCustoHora
        fields = [
            "id",
            "empresa",
            "vigente_desde",
            "vigente_ate",
            "provisao_13_ferias",
            "multa_fgts_rescisao",
            "beneficios_por_funcionario",
            "horas_produtivas_mes",
            "observacoes",
            "is_active",
        ]
        read_only_fields = ["id"]


class CustoHoraFallbackSerializer(serializers.ModelSerializer):
    """Serializer para CustoHoraFallback — valor direto enquanto RH não está disponível."""

    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True)

    class Meta:
        model = CustoHoraFallback
        fields = [
            "id",
            "empresa",
            "categoria",
            "categoria_nome",
            "vigente_desde",
            "vigente_ate",
            "valor_hora",
            "motivo",
            "is_active",
        ]
        read_only_fields = ["id"]


# ─── Serializers de input para endpoints de debug ────────────────────────────


class DebugCustoHoraInputSerializer(serializers.Serializer):
    """Input do endpoint POST /debug/custo-hora/."""

    categoria_codigo = serializers.CharField(
        help_text="Código da CategoriaMaoObra (ex: 'funileiro')."
    )
    data = serializers.DateField(
        help_text="Data de referência para busca de vigência (YYYY-MM-DD)."
    )
    empresa_id = serializers.UUIDField(
        help_text="UUID da Empresa (pricing_profile.Empresa)."
    )


class DebugRateioInputSerializer(serializers.Serializer):
    """Input do endpoint POST /debug/rateio/."""

    data = serializers.DateField(
        help_text="Data de referência para busca de vigência (YYYY-MM-DD)."
    )
    empresa_id = serializers.UUIDField(
        help_text="UUID da Empresa (pricing_profile.Empresa)."
    )


# ─── Motor MO-6: Margem + Markup ─────────────────────────────────────────────


class MargemOperacaoSerializer(serializers.ModelSerializer):
    """Serializer para MargemOperacao — margem base por segmento × tipo."""

    segmento_codigo = serializers.CharField(source="segmento.codigo", read_only=True)
    segmento_nome = serializers.CharField(source="segmento.nome", read_only=True)
    tipo_operacao_display = serializers.CharField(
        source="get_tipo_operacao_display", read_only=True
    )

    class Meta:
        model = MargemOperacao
        fields = [
            "id",
            "empresa",
            "segmento",
            "segmento_codigo",
            "segmento_nome",
            "tipo_operacao",
            "tipo_operacao_display",
            "margem_percentual",
            "vigente_desde",
            "vigente_ate",
            "is_active",
        ]
        read_only_fields = ["id"]


class MarkupPecaSerializer(serializers.ModelSerializer):
    """Serializer para MarkupPeca — override fino por peça ou faixa de custo."""

    peca_nome = serializers.CharField(
        source="peca_canonica.nome", read_only=True, default=None
    )

    class Meta:
        model = MarkupPeca
        fields = [
            "id",
            "empresa",
            "peca_canonica",
            "peca_nome",
            "faixa_custo_min",
            "faixa_custo_max",
            "margem_percentual",
            "vigente_desde",
            "vigente_ate",
            "observacao",
            "is_active",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs: dict) -> dict:
        """Valida XOR: peça específica ou faixa, nunca ambos."""
        peca = attrs.get("peca_canonica")
        faixa_min = attrs.get("faixa_custo_min")

        if peca and faixa_min is not None:
            raise serializers.ValidationError(
                "Informe peça específica OU faixa de custo — não ambos."
            )
        if not peca and faixa_min is None:
            raise serializers.ValidationError(
                "Informe peça específica ou faixa de custo (faixa_custo_min obrigatório)."
            )
        if faixa_min is not None:
            faixa_max = attrs.get("faixa_custo_max")
            if faixa_max is None:
                raise serializers.ValidationError(
                    "faixa_custo_max é obrigatório quando faixa_custo_min é informado."
                )
            if faixa_max <= faixa_min:
                raise serializers.ValidationError(
                    "faixa_custo_max deve ser maior que faixa_custo_min."
                )
        return attrs


# ─── Snapshot — 3 níveis RBAC (P10) ──────────────────────────────────────────


class SnapshotMinSerializer(serializers.ModelSerializer):
    """CONSULTANT+ — apenas preço final e contexto."""

    class Meta:
        model = CalculoCustoSnapshot
        fields = [
            "id",
            "origem",
            "servico_canonico",
            "peca_canonica",
            "contexto",
            "preco_calculado",
            "preco_teto_benchmark",
            "preco_final",
            "calculado_em",
            "calculado_por",
        ]
        read_only_fields = fields


class SnapshotMgrSerializer(serializers.ModelSerializer):
    """MANAGER+ — acima + custo_total_base, margem_ajustada, decomposicao."""

    class Meta:
        model = CalculoCustoSnapshot
        fields = [
            "id",
            "origem",
            "servico_canonico",
            "peca_canonica",
            "contexto",
            "custo_total_base",
            "fator_responsabilidade",
            "margem_ajustada",
            "preco_calculado",
            "preco_teto_benchmark",
            "preco_final",
            "decomposicao",
            "calculado_em",
            "calculado_por",
        ]
        read_only_fields = fields


class SnapshotFullSerializer(serializers.ModelSerializer):
    """ADMIN+ — todos os campos de decomposição."""

    class Meta:
        model = CalculoCustoSnapshot
        fields = [
            "id",
            "empresa",
            "origem",
            "servico_canonico",
            "peca_canonica",
            "contexto",
            "custo_mo",
            "custo_insumos",
            "rateio",
            "custo_peca_base",
            "custo_total_base",
            "fator_responsabilidade",
            "margem_base",
            "margem_ajustada",
            "preco_calculado",
            "preco_teto_benchmark",
            "preco_final",
            "decomposicao",
            "calculado_em",
            "calculado_por",
        ]
        read_only_fields = fields


# ─── Inputs do motor ──────────────────────────────────────────────────────────


class ContextoCalculoSerializer(serializers.Serializer):
    """Input de contexto de cálculo — obrigatório em calcular-servico e calcular-peca."""

    empresa_id = serializers.UUIDField(
        help_text="UUID da Empresa (pricing_profile.Empresa). Obrigatório — P9."
    )
    veiculo_marca = serializers.CharField(max_length=100)
    veiculo_modelo = serializers.CharField(max_length=100)
    veiculo_ano = serializers.IntegerField(min_value=1900, max_value=2100)
    veiculo_versao = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=None
    )
    tipo_pintura_codigo = serializers.CharField(
        max_length=30, required=False, allow_blank=True, default=None
    )
    quem_paga = serializers.ChoiceField(
        choices=["cliente", "seguradora"], default="cliente"
    )
    aplica_multiplicador_tamanho = serializers.BooleanField(default=True)


class CalcularServicoInputSerializer(serializers.Serializer):
    """Input para POST /calcular-servico/."""

    contexto = ContextoCalculoSerializer()
    servico_canonico_id = serializers.UUIDField(
        help_text="UUID do ServicoCanonico."
    )
    origem = serializers.ChoiceField(
        choices=["orcamento_linha", "os_linha", "simulacao"],
        default="simulacao",
    )


class CalcularPecaInputSerializer(serializers.Serializer):
    """Input para POST /calcular-peca/."""

    contexto = ContextoCalculoSerializer()
    peca_canonica_id = serializers.UUIDField(
        help_text="UUID da PecaCanonica."
    )
    quantidade = serializers.IntegerField(min_value=1, default=1)
    origem = serializers.ChoiceField(
        choices=["orcamento_linha", "os_linha", "simulacao"],
        default="simulacao",
    )


class SimularItemSerializer(serializers.Serializer):
    """Item de simulação — serviço ou peça."""

    tipo = serializers.ChoiceField(choices=["servico", "peca"])
    id = serializers.UUIDField(help_text="UUID do ServicoCanonico ou PecaCanonica.")
    quantidade = serializers.IntegerField(min_value=1, default=1)


class SimularInputSerializer(serializers.Serializer):
    """Input para POST /simular/ — múltiplos itens em lote."""

    contexto = ContextoCalculoSerializer()
    itens = serializers.ListField(
        child=SimularItemSerializer(),
        min_length=1,
        max_length=50,
    )
