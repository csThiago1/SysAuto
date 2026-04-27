"""
Paddock Solutions — Pricing Catalog — Serializers DRF
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Serializers para todos os models do app pricing_catalog.
Padrões CLAUDE.md:
  - read_only_fields explícito em todos os serializers de update
  - MaterialCanonico.unidade_base é read_only após criação (imutável)
  - Campos de auditoria (id, created_at, updated_at, created_by) sempre read_only
  - Embedding nunca exposto na API (dado interno)
"""
import logging

from rest_framework import serializers

from apps.pricing_catalog.models import (
    AliasMaterial,
    AliasPeca,
    AliasServico,
    CategoriaMaoObra,
    CategoriaServico,
    CompatibilidadePeca,
    Fornecedor,
    InsumoMaterial,
    MaterialCanonico,
    PecaCanonica,
    ServicoCanonico,
)

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────────────
# CategoriaServico
# ────────────────────────────────────────────────────────────────────────────


class CategoriaServicoSerializer(serializers.ModelSerializer):
    """Serializer completo para CategoriaServico (lista + detalhe + CRUD)."""

    class Meta:
        model = CategoriaServico
        fields = ["id", "codigo", "nome", "ordem", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


# ────────────────────────────────────────────────────────────────────────────
# CategoriaMaoObra
# ────────────────────────────────────────────────────────────────────────────


class CategoriaMaoObraSerializer(serializers.ModelSerializer):
    """Serializer completo para CategoriaMaoObra (lista + detalhe + CRUD)."""

    class Meta:
        model = CategoriaMaoObra
        fields = ["id", "codigo", "nome", "ordem", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


# ────────────────────────────────────────────────────────────────────────────
# ServicoCanonico
# ────────────────────────────────────────────────────────────────────────────


class ServicoCanicoListSerializer(serializers.ModelSerializer):
    """Serializer resumido para listagens de ServicoCanônico."""

    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True)

    class Meta:
        model = ServicoCanonico
        fields = [
            "id",
            "codigo",
            "nome",
            "categoria",
            "categoria_nome",
            "unidade",
            "aplica_multiplicador_tamanho",
            "is_active",
        ]
        read_only_fields = ["id", "categoria_nome"]


class ServicoCanonicoDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe para ServicoCanônico."""

    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True)
    tem_embedding = serializers.SerializerMethodField()

    class Meta:
        model = ServicoCanonico
        fields = [
            "id",
            "codigo",
            "nome",
            "categoria",
            "categoria_nome",
            "unidade",
            "descricao",
            "aplica_multiplicador_tamanho",
            "tem_embedding",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "categoria_nome", "tem_embedding", "created_at", "updated_at"]

    def get_tem_embedding(self, obj: ServicoCanonico) -> bool:
        """Indica se o embedding já foi gerado."""
        return obj.embedding is not None


class ServicoCanonicoCreateSerializer(serializers.ModelSerializer):
    """Serializer de criação para ServicoCanônico."""

    class Meta:
        model = ServicoCanonico
        fields = [
            "codigo",
            "nome",
            "categoria",
            "unidade",
            "descricao",
            "aplica_multiplicador_tamanho",
        ]


class ServicoCanonicoUpdateSerializer(serializers.ModelSerializer):
    """Serializer de atualização para ServicoCanônico.

    codigo é read_only — slug imutável após criação (alterar quebraria aliases existentes).
    """

    class Meta:
        model = ServicoCanonico
        fields = [
            "id",
            "codigo",
            "nome",
            "categoria",
            "unidade",
            "descricao",
            "aplica_multiplicador_tamanho",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "codigo", "created_at", "updated_at"]


# ────────────────────────────────────────────────────────────────────────────
# MaterialCanonico
# ────────────────────────────────────────────────────────────────────────────


class MaterialCanonicoListSerializer(serializers.ModelSerializer):
    """Serializer resumido para listagens de MaterialCanonico."""

    class Meta:
        model = MaterialCanonico
        fields = ["id", "codigo", "nome", "unidade_base", "tipo", "is_active"]
        read_only_fields = ["id"]


class MaterialCanonicoDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe para MaterialCanonico."""

    tem_embedding = serializers.SerializerMethodField()

    class Meta:
        model = MaterialCanonico
        fields = [
            "id",
            "codigo",
            "nome",
            "unidade_base",
            "tipo",
            "tem_embedding",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "tem_embedding", "created_at", "updated_at"]

    def get_tem_embedding(self, obj: MaterialCanonico) -> bool:
        """Indica se o embedding já foi gerado."""
        return obj.embedding is not None


class MaterialCanonicoCreateSerializer(serializers.ModelSerializer):
    """Serializer de criação para MaterialCanonico."""

    class Meta:
        model = MaterialCanonico
        fields = ["codigo", "nome", "unidade_base", "tipo"]


class MaterialCanonicoUpdateSerializer(serializers.ModelSerializer):
    """Serializer de atualização para MaterialCanonico.

    unidade_base é read_only — imutável após criação (quebra fator_conversao dos InsumoMaterial
    vinculados). codigo também é read_only — slug imutável após criação.
    """

    class Meta:
        model = MaterialCanonico
        fields = ["id", "codigo", "nome", "unidade_base", "tipo", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "codigo", "unidade_base", "created_at", "updated_at"]


# ────────────────────────────────────────────────────────────────────────────
# InsumoMaterial
# ────────────────────────────────────────────────────────────────────────────


class InsumoMaterialListSerializer(serializers.ModelSerializer):
    """Serializer resumido para listagens de InsumoMaterial."""

    material_canonico_nome = serializers.CharField(
        source="material_canonico.nome", read_only=True
    )

    class Meta:
        model = InsumoMaterial
        fields = [
            "id",
            "material_canonico",
            "material_canonico_nome",
            "sku_interno",
            "gtin",
            "descricao",
            "marca",
            "unidade_compra",
            "fator_conversao",
            "is_active",
        ]
        read_only_fields = ["id", "material_canonico_nome"]


class InsumoMaterialDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe para InsumoMaterial."""

    material_canonico_nome = serializers.CharField(
        source="material_canonico.nome", read_only=True
    )
    material_canonico_unidade_base = serializers.CharField(
        source="material_canonico.unidade_base", read_only=True
    )

    class Meta:
        model = InsumoMaterial
        fields = [
            "id",
            "material_canonico",
            "material_canonico_nome",
            "material_canonico_unidade_base",
            "sku_interno",
            "gtin",
            "descricao",
            "marca",
            "unidade_compra",
            "fator_conversao",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "material_canonico_nome",
            "material_canonico_unidade_base",
            "created_at",
            "updated_at",
        ]


class InsumoMaterialCreateSerializer(serializers.ModelSerializer):
    """Serializer de criação para InsumoMaterial."""

    class Meta:
        model = InsumoMaterial
        fields = [
            "material_canonico",
            "sku_interno",
            "gtin",
            "descricao",
            "marca",
            "unidade_compra",
            "fator_conversao",
        ]


class InsumoMaterialUpdateSerializer(serializers.ModelSerializer):
    """Serializer de atualização para InsumoMaterial.

    material_canonico e sku_interno são read_only — não devem ser remapeados
    após criação (quebra consistência de estoque e histórico).
    """

    class Meta:
        model = InsumoMaterial
        fields = [
            "id",
            "material_canonico",
            "sku_interno",
            "gtin",
            "descricao",
            "marca",
            "unidade_compra",
            "fator_conversao",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "material_canonico", "sku_interno", "created_at", "updated_at"]


# ────────────────────────────────────────────────────────────────────────────
# PecaCanonica
# ────────────────────────────────────────────────────────────────────────────


class PecaCanonicoListSerializer(serializers.ModelSerializer):
    """Serializer resumido para listagens de PecaCanonica."""

    class Meta:
        model = PecaCanonica
        fields = ["id", "codigo", "nome", "tipo_peca", "ncm", "is_active"]
        read_only_fields = ["id"]


class PecaCanonicoDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe para PecaCanonica."""

    tipo_peca_display = serializers.CharField(source="get_tipo_peca_display", read_only=True)
    tem_embedding = serializers.SerializerMethodField()

    class Meta:
        model = PecaCanonica
        fields = [
            "id",
            "codigo",
            "nome",
            "tipo_peca",
            "tipo_peca_display",
            "ncm",
            "tem_embedding",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "tipo_peca_display", "tem_embedding", "created_at", "updated_at"]

    def get_tem_embedding(self, obj: PecaCanonica) -> bool:
        """Indica se o embedding já foi gerado."""
        return obj.embedding is not None


class PecaCanonicoCreateSerializer(serializers.ModelSerializer):
    """Serializer de criação para PecaCanonica."""

    class Meta:
        model = PecaCanonica
        fields = ["codigo", "nome", "tipo_peca", "ncm"]


class PecaCanonicoUpdateSerializer(serializers.ModelSerializer):
    """Serializer de atualização para PecaCanonica.

    codigo é read_only — slug imutável após criação.
    """

    class Meta:
        model = PecaCanonica
        fields = ["id", "codigo", "nome", "tipo_peca", "ncm", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "codigo", "created_at", "updated_at"]


# ────────────────────────────────────────────────────────────────────────────
# CompatibilidadePeca
# ────────────────────────────────────────────────────────────────────────────


class CompatibilidadePecaSerializer(serializers.ModelSerializer):
    """Serializer para CompatibilidadePeca (usado aninhado ou standalone)."""

    class Meta:
        model = CompatibilidadePeca
        fields = ["id", "peca", "marca", "modelo", "ano_inicio", "ano_fim"]
        read_only_fields = ["id"]


# ────────────────────────────────────────────────────────────────────────────
# Fornecedor
# ────────────────────────────────────────────────────────────────────────────


class FornecedorListSerializer(serializers.ModelSerializer):
    """Serializer resumido para listagens de Fornecedor."""

    nome = serializers.CharField(source="pessoa.full_name", read_only=True)

    class Meta:
        model = Fornecedor
        fields = [
            "id",
            "pessoa",
            "nome",
            "condicoes_pagamento",
            "prazo_entrega_dias",
            "avaliacao",
            "is_active",
        ]
        read_only_fields = ["id", "nome"]


class FornecedorDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe para Fornecedor."""

    nome = serializers.CharField(source="pessoa.full_name", read_only=True)

    class Meta:
        model = Fornecedor
        fields = [
            "id",
            "pessoa",
            "nome",
            "condicoes_pagamento",
            "prazo_entrega_dias",
            "avaliacao",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "nome", "created_at", "updated_at"]


class FornecedorCreateSerializer(serializers.ModelSerializer):
    """Serializer de criação para Fornecedor."""

    class Meta:
        model = Fornecedor
        fields = ["pessoa", "condicoes_pagamento", "prazo_entrega_dias", "avaliacao"]


class FornecedorUpdateSerializer(serializers.ModelSerializer):
    """Serializer de atualização para Fornecedor.

    pessoa é read_only — OneToOne imutável após criação.
    """

    class Meta:
        model = Fornecedor
        fields = [
            "id",
            "pessoa",
            "condicoes_pagamento",
            "prazo_entrega_dias",
            "avaliacao",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "pessoa", "created_at", "updated_at"]


# ────────────────────────────────────────────────────────────────────────────
# AliasServico
# ────────────────────────────────────────────────────────────────────────────


class AliasServicoListSerializer(serializers.ModelSerializer):
    """Serializer resumido para listagens de AliasServico."""

    canonico_nome = serializers.CharField(source="canonico.nome", read_only=True)

    class Meta:
        model = AliasServico
        fields = [
            "id",
            "canonico",
            "canonico_nome",
            "texto",
            "origem",
            "confianca",
            "ocorrencias",
            "confirmado_em",
            "is_active",
        ]
        read_only_fields = ["id", "canonico_nome", "confirmado_em"]


class AliasServicoDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe para AliasServico."""

    canonico_nome = serializers.CharField(source="canonico.nome", read_only=True)
    confirmado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = AliasServico
        fields = [
            "id",
            "canonico",
            "canonico_nome",
            "texto",
            "texto_normalizado",
            "origem",
            "confianca",
            "ocorrencias",
            "confirmado_em",
            "confirmado_por",
            "confirmado_por_nome",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "canonico_nome",
            "texto_normalizado",
            "confirmado_em",
            "confirmado_por",
            "confirmado_por_nome",
            "created_at",
            "updated_at",
        ]

    def get_confirmado_por_nome(self, obj: AliasServico) -> str | None:
        """Retorna o email do usuário que confirmou o alias."""
        if obj.confirmado_por:
            return obj.confirmado_por.email
        return None


class AliasServicoCreateSerializer(serializers.ModelSerializer):
    """Serializer de criação para AliasServico."""

    class Meta:
        model = AliasServico
        fields = ["canonico", "texto", "origem", "confianca", "ocorrencias"]


class AliasServicoUpdateSerializer(serializers.ModelSerializer):
    """Serializer de atualização para AliasServico.

    canonico, texto e texto_normalizado são read_only — alterar quebra integridade
    do pipeline de match. Use delete + create para corrigir o mapeamento.
    confirmado_em e confirmado_por são preenchidos pelos actions approve/reject.
    """

    class Meta:
        model = AliasServico
        fields = [
            "id",
            "canonico",
            "texto",
            "texto_normalizado",
            "origem",
            "confianca",
            "ocorrencias",
            "confirmado_em",
            "confirmado_por",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "canonico",
            "texto",
            "texto_normalizado",
            "confirmado_em",
            "confirmado_por",
            "created_at",
            "updated_at",
        ]


# ────────────────────────────────────────────────────────────────────────────
# AliasPeca / AliasMaterial (serializers simplificados)
# ────────────────────────────────────────────────────────────────────────────


class AliasPecaSerializer(serializers.ModelSerializer):
    """Serializer para AliasPeca."""

    canonico_nome = serializers.CharField(source="canonico.nome", read_only=True)

    class Meta:
        model = AliasPeca
        fields = [
            "id",
            "canonico",
            "canonico_nome",
            "texto",
            "texto_normalizado",
            "origem",
            "confianca",
            "ocorrencias",
            "confirmado_em",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "canonico_nome",
            "texto_normalizado",
            "confirmado_em",
            "confirmado_por",
            "created_at",
            "updated_at",
        ]


class AliasMaterialSerializer(serializers.ModelSerializer):
    """Serializer para AliasMaterial."""

    canonico_nome = serializers.CharField(source="canonico.nome", read_only=True)

    class Meta:
        model = AliasMaterial
        fields = [
            "id",
            "canonico",
            "canonico_nome",
            "texto",
            "texto_normalizado",
            "origem",
            "confianca",
            "ocorrencias",
            "confirmado_em",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "canonico_nome",
            "texto_normalizado",
            "confirmado_em",
            "confirmado_por",
            "created_at",
            "updated_at",
        ]


# ────────────────────────────────────────────────────────────────────────────
# Match I/O — endpoint /match/ e /by-gtin/
# ────────────────────────────────────────────────────────────────────────────


class AliasMatchInputSerializer(serializers.Serializer):
    """Input para o endpoint POST /match/."""

    texto = serializers.CharField(
        max_length=300,
        help_text="Denominação livre do item (serviço, peça ou material).",
    )
    top_k = serializers.IntegerField(
        default=5,
        min_value=1,
        max_value=20,
        required=False,
        help_text="Número máximo de resultados (padrão: 5, máximo: 20).",
    )


class AliasMatchResultSerializer(serializers.Serializer):
    """Output de um item de resultado de match."""

    canonico_id = serializers.CharField()
    canonico_nome = serializers.CharField()
    score = serializers.FloatField()
    metodo = serializers.CharField()
    confianca = serializers.CharField()


class InsumoByGtinInputSerializer(serializers.Serializer):
    """Input para o endpoint POST /insumos/by-gtin/."""

    gtin = serializers.CharField(
        max_length=14,
        min_length=8,
        help_text="Código GTIN/EAN da embalagem (8, 12, 13 ou 14 dígitos).",
    )
