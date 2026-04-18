"""
Paddock Solutions — Inventory — Serializers
Motor de Orçamentos (MO) — Sprint MO-5: Estoque Físico + NF-e Entrada

RBAC: valor_nf visível apenas para MANAGER+.
"""
from decimal import Decimal

from rest_framework import serializers

from apps.inventory.models import (
    EtiquetaImpressa,
    ImpressoraEtiqueta,
    LoteInsumo,
    UnidadeFisica,
)


class UnidadeFisicaListSerializer(serializers.ModelSerializer):
    """Lista pública — sem valor_nf para roles abaixo de MANAGER."""

    peca_nome = serializers.CharField(source="peca_canonica.nome", read_only=True)

    class Meta:
        model = UnidadeFisica
        fields = [
            "id", "codigo_barras", "peca_canonica_id", "peca_nome",
            "status", "localizacao", "numero_serie",
            "ordem_servico_id", "consumida_em", "created_at",
        ]
        read_only_fields = fields


class UnidadeFisicaDetailSerializer(serializers.ModelSerializer):
    """Detalhe com valor_nf — MANAGER+ apenas."""

    peca_nome = serializers.CharField(source="peca_canonica.nome", read_only=True)
    nfe_numero = serializers.CharField(source="nfe_entrada.numero", read_only=True, default=None)

    class Meta:
        model = UnidadeFisica
        fields = [
            "id", "codigo_barras", "peca_canonica_id", "peca_nome",
            "codigo_fornecedor_id", "nfe_entrada_id", "nfe_numero",
            "numero_serie", "valor_nf", "status", "localizacao",
            "ordem_servico_id", "consumida_em", "created_at", "updated_at",
        ]
        read_only_fields = fields


class ReservaInputSerializer(serializers.Serializer):
    ordem_servico_id = serializers.UUIDField()
    forcar_mais_caro = serializers.BooleanField(default=False)
    justificativa = serializers.CharField(required=False, allow_blank=True, max_length=300)


class BipagemInputSerializer(serializers.Serializer):
    codigo_barras = serializers.CharField(max_length=40)
    ordem_servico_id = serializers.UUIDField()


class LoteInsumoListSerializer(serializers.ModelSerializer):
    material_nome = serializers.CharField(source="material_canonico.nome", read_only=True)
    unidade_base = serializers.CharField(source="material_canonico.unidade_base", read_only=True)
    saldo_percentual = serializers.SerializerMethodField()

    class Meta:
        model = LoteInsumo
        fields = [
            "id", "codigo_barras", "material_canonico_id", "material_nome",
            "unidade_base", "saldo", "quantidade_base", "saldo_percentual",
            "unidade_compra", "valor_unitario_base", "validade", "localizacao",
            "nfe_entrada_id", "created_at",
        ]
        read_only_fields = fields

    def get_saldo_percentual(self, obj: LoteInsumo) -> float:
        if not obj.quantidade_base:
            return 0.0
        return round(float(obj.saldo / obj.quantidade_base) * 100, 1)


class BaixaInsumoInputSerializer(serializers.Serializer):
    material_canonico_id = serializers.UUIDField()
    quantidade_base = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.001"))
    ordem_servico_id = serializers.UUIDField()


class ImpressoraEtiquetaSerializer(serializers.ModelSerializer):
    modelo_display = serializers.SerializerMethodField()

    class Meta:
        model = ImpressoraEtiqueta
        fields = ["id", "nome", "modelo", "modelo_display", "endpoint", "largura_mm", "altura_mm", "is_active"]

    def get_modelo_display(self, obj: ImpressoraEtiqueta) -> str:
        return obj.get_modelo_display()


class EtiquetaImpressaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EtiquetaImpressa
        fields = ["id", "unidade_fisica_id", "lote_insumo_id", "impressora_id", "created_at"]
        read_only_fields = fields
