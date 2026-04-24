"""
Paddock Solutions — Fiscal — Serializers DRF
Motor de Orçamentos (MO) — Sprint MO-5: NF-e Entrada

Serializers para NFeEntrada e NFeEntradaItem.
"""

from rest_framework import serializers

from apps.fiscal.models import NFeEntrada, NFeEntradaItem


class NFeEntradaItemSerializer(serializers.ModelSerializer):
    peca_nome = serializers.CharField(source="peca_canonica.nome", read_only=True, default=None)
    material_nome = serializers.CharField(
        source="material_canonico.nome", read_only=True, default=None
    )

    class Meta:
        model = NFeEntradaItem
        fields = [
            "id",
            "numero_item",
            "descricao_original",
            "codigo_produto_nf",
            "ncm",
            "unidade_compra",
            "quantidade",
            "valor_unitario_bruto",
            "valor_unitario_com_tributos",
            "valor_total_com_tributos",
            "fator_conversao",
            "peca_canonica_id",
            "peca_nome",
            "material_canonico_id",
            "material_nome",
            "codigo_fornecedor_id",
            "status_reconciliacao",
        ]
        read_only_fields = fields


class NFeEntradaItemReconciliarSerializer(serializers.Serializer):
    """Input para reconciliar um item com peça ou material canônico."""

    peca_canonica_id = serializers.UUIDField(required=False, allow_null=True)
    material_canonico_id = serializers.UUIDField(required=False, allow_null=True)
    codigo_fornecedor_id = serializers.UUIDField(required=False, allow_null=True)
    status_reconciliacao = serializers.ChoiceField(
        choices=NFeEntradaItem.StatusReconciliacao.choices
    )

    def validate(self, data: dict) -> dict:
        status = data.get("status_reconciliacao")
        if status == NFeEntradaItem.StatusReconciliacao.PECA and not data.get("peca_canonica_id"):
            raise serializers.ValidationError("peca_canonica_id obrigatório para status PECA.")
        if status == NFeEntradaItem.StatusReconciliacao.INSUMO and not data.get(
            "material_canonico_id"
        ):
            raise serializers.ValidationError(
                "material_canonico_id obrigatório para status INSUMO."
            )
        return data


class NFeEntradaListSerializer(serializers.ModelSerializer):
    total_itens = serializers.SerializerMethodField()

    class Meta:
        model = NFeEntrada
        fields = [
            "id",
            "chave_acesso",
            "numero",
            "serie",
            "emitente_cnpj",
            "emitente_nome",
            "data_emissao",
            "valor_total",
            "status",
            "estoque_gerado",
            "total_itens",
            "created_at",
        ]
        read_only_fields = fields

    def get_total_itens(self, obj: NFeEntrada) -> int:
        return obj.itens.count()


class NFeEntradaDetailSerializer(serializers.ModelSerializer):
    itens = NFeEntradaItemSerializer(many=True, read_only=True)

    class Meta:
        model = NFeEntrada
        fields = [
            "id",
            "chave_acesso",
            "numero",
            "serie",
            "emitente_cnpj",
            "emitente_nome",
            "data_emissao",
            "valor_total",
            "status",
            "estoque_gerado",
            "xml_s3_key",
            "observacoes",
            "itens",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class NFeEntradaCreateSerializer(serializers.ModelSerializer):
    """Criação manual de NF-e de entrada (sem XML — para importação simplificada)."""

    class Meta:
        model = NFeEntrada
        fields = [
            "chave_acesso",
            "numero",
            "serie",
            "emitente_cnpj",
            "emitente_nome",
            "data_emissao",
            "valor_total",
            "observacoes",
        ]

    def validate_chave_acesso(self, value: str) -> str:
        if value and len(value) not in (0, 44):
            raise serializers.ValidationError("Chave de acesso deve ter 44 dígitos.")
        return value
