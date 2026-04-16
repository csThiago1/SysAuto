"""Serializers do app pricing_profile."""
from rest_framework import serializers

from apps.pricing_profile.models import (
    CategoriaTamanho,
    Empresa,
    EnquadramentoFaltante,
    EnquadramentoVeiculo,
    SegmentoVeicular,
    TipoPintura,
)


class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = [
            "id",
            "cnpj",
            "nome_fantasia",
            "razao_social",
            "inscricao_estadual",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SegmentoVeicularSerializer(serializers.ModelSerializer):
    class Meta:
        model = SegmentoVeicular
        fields = [
            "id",
            "codigo",
            "nome",
            "ordem",
            "fator_responsabilidade",
            "descricao",
            "is_active",
        ]
        read_only_fields = ["id"]


class CategoriaTamanhoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaTamanho
        fields = [
            "id",
            "codigo",
            "nome",
            "ordem",
            "multiplicador_insumos",
            "multiplicador_horas",
            "is_active",
        ]
        read_only_fields = ["id"]


class TipoPinturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoPintura
        fields = ["id", "codigo", "nome", "complexidade", "is_active"]
        read_only_fields = ["id"]


class EnquadramentoVeiculoSerializer(serializers.ModelSerializer):
    # Write fields — aceitam slug (codigo) para criação/atualização
    segmento_codigo = serializers.SlugRelatedField(
        source="segmento",
        slug_field="codigo",
        queryset=SegmentoVeicular.objects.all(),
    )
    tamanho_codigo = serializers.SlugRelatedField(
        source="tamanho",
        slug_field="codigo",
        queryset=CategoriaTamanho.objects.all(),
    )
    tipo_pintura_codigo = serializers.SlugRelatedField(
        source="tipo_pintura_default",
        slug_field="codigo",
        queryset=TipoPintura.objects.all(),
        allow_null=True,
        required=False,
    )
    # Read fields nested (detalhes completos nos GETs)
    segmento = SegmentoVeicularSerializer(read_only=True)
    tamanho = CategoriaTamanhoSerializer(read_only=True)
    tipo_pintura_default = TipoPinturaSerializer(read_only=True)

    class Meta:
        model = EnquadramentoVeiculo
        fields = [
            "id",
            "marca",
            "modelo",
            "ano_inicio",
            "ano_fim",
            # write slugs
            "segmento_codigo",
            "tamanho_codigo",
            "tipo_pintura_codigo",
            # read nested
            "segmento",
            "tamanho",
            "tipo_pintura_default",
            "prioridade",
            "is_active",
        ]
        read_only_fields = ["id"]


class EnquadramentoFaltanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnquadramentoFaltante
        fields = [
            "id",
            "marca",
            "modelo",
            "ocorrencias",
            "primeira_ocorrencia",
            "ultima_ocorrencia",
        ]
        read_only_fields = ["id", "primeira_ocorrencia", "ultima_ocorrencia"]


class EnquadramentoResolverInputSerializer(serializers.Serializer):
    marca = serializers.CharField(max_length=60)
    modelo = serializers.CharField(max_length=100)
    ano = serializers.IntegerField(min_value=1900, max_value=2100)


class EnquadramentoResolverOutputSerializer(serializers.Serializer):
    segmento_codigo = serializers.CharField()
    tamanho_codigo = serializers.CharField()
    tipo_pintura_codigo = serializers.CharField(allow_null=True)
    origem = serializers.ChoiceField(choices=["exato", "marca_modelo", "marca", "fallback"])
    enquadramento_id = serializers.UUIDField(allow_null=True)
    # Detalhes dos objetos resolvidos (preenchidos na view)
    segmento = SegmentoVeicularSerializer(read_only=True, required=False)
    tamanho = CategoriaTamanhoSerializer(read_only=True, required=False)
    tipo_pintura_default = TipoPinturaSerializer(read_only=True, required=False, allow_null=True)
