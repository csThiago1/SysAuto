"""
Paddock Solutions — Pricing Benchmark — Serializers
Motor de Orçamentos (MO) — Sprint MO-8
"""
from decimal import Decimal

from rest_framework import serializers

from apps.pricing_benchmark.models import (
    BenchmarkAmostra,
    BenchmarkFonte,
    BenchmarkIngestao,
    SugestaoIA,
)


class BenchmarkFonteSerializer(serializers.ModelSerializer):
    class Meta:
        model = BenchmarkFonte
        fields = [
            "id", "empresa", "nome", "tipo", "fornecedor",
            "confiabilidade", "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class BenchmarkIngestaoSerializer(serializers.ModelSerializer):
    fonte_nome = serializers.CharField(source="fonte.nome", read_only=True)
    fonte_tipo = serializers.CharField(source="fonte.tipo", read_only=True)

    class Meta:
        model = BenchmarkIngestao
        fields = [
            "id", "fonte", "fonte_nome", "fonte_tipo", "arquivo",
            "metadados", "status", "iniciado_em", "concluido_em",
            "amostras_importadas", "amostras_descartadas", "log_erro",
            "criado_por", "criado_em",
        ]
        read_only_fields = [
            "id", "status", "iniciado_em", "concluido_em",
            "amostras_importadas", "amostras_descartadas", "log_erro",
            "criado_por", "criado_em",
        ]


class BenchmarkAmostraSerializer(serializers.ModelSerializer):
    servico_nome = serializers.CharField(
        source="servico_canonico.nome", read_only=True, allow_null=True,
    )
    peca_nome = serializers.CharField(
        source="peca_canonica.nome", read_only=True, allow_null=True,
    )

    class Meta:
        model = BenchmarkAmostra
        fields = [
            "id", "ingestao", "fonte", "tipo_item",
            "servico_canonico", "servico_nome",
            "peca_canonica", "peca_nome",
            "descricao_bruta", "alias_match_confianca",
            "segmento", "tamanho",
            "veiculo_marca", "veiculo_modelo", "veiculo_ano",
            "valor_praticado", "moeda", "data_referencia",
            "metadados", "revisado", "descartada", "motivo_descarte",
        ]
        read_only_fields = ["id", "ingestao", "fonte", "revisado", "metadados"]


class AceitarMatchSerializer(serializers.Serializer):
    canonical_id = serializers.UUIDField()


class DescartarAmostraSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=200)


class SugestaoIACreateSerializer(serializers.Serializer):
    briefing = serializers.CharField(min_length=20, max_length=2000)
    orcamento_id = serializers.UUIDField(required=False, allow_null=True)
    veiculo = serializers.DictField()


class AvaliarSugestaoSerializer(serializers.Serializer):
    avaliacao = serializers.ChoiceField(choices=["util", "parcial", "ruim"])
    servicos_aceitos_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list,
    )
    pecas_aceitas_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list,
    )


class SugestaoIASerializer(serializers.ModelSerializer):
    class Meta:
        model = SugestaoIA
        fields = [
            "id", "orcamento", "briefing", "veiculo_info", "resposta_raw",
            "avaliacao", "modelo_usado", "tempo_resposta_ms",
            "criado_por", "criado_em",
        ]
        read_only_fields = fields
