"""
Paddock Solutions — Pricing Engine — Serializers
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Serializers para ParametroRateio, ParametroCustoHora, CustoHoraFallback
e inputs de endpoints de debug.
"""

from rest_framework import serializers

from apps.pricing_engine.models import (
    CustoHoraFallback,
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
