"""
Paddock Solutions — Accounting: Serializers de Despesas Recorrentes
"""
import logging

from rest_framework import serializers

from apps.accounting.models.despesa_recorrente import DespesaRecorrente

logger = logging.getLogger(__name__)


class DespesaRecorrenteListSerializer(serializers.ModelSerializer):
    """Serializer de listagem — campos essenciais para tabelas."""

    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = DespesaRecorrente
        fields = [
            "id",
            "empresa",
            "tipo",
            "tipo_display",
            "descricao",
            "valor_mensal",
            "vigente_desde",
            "vigente_ate",
            "is_active",
        ]


class DespesaRecorrenteSerializer(serializers.ModelSerializer):
    """Serializer de detalhe — todos os campos para create/retrieve/update."""

    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = DespesaRecorrente
        fields = [
            "id",
            "empresa",
            "tipo",
            "tipo_display",
            "descricao",
            "valor_mensal",
            "vigente_desde",
            "vigente_ate",
            "conta_contabil",
            "observacoes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "tipo_display", "created_at", "updated_at"]
