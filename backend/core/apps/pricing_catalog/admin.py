"""
Paddock Solutions — Pricing Catalog Admin
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico
"""
import logging

from django.contrib import admin

from .models import (
    AliasMaterial,
    AliasPeca,
    AliasServico,
    CategoriaMaoObra,
    CategoriaServico,
    CompatibilidadePeca,
    CodigoFornecedorPeca,
    Fornecedor,
    InsumoMaterial,
    MaterialCanonico,
    PecaCanonica,
    ServicoCanonico,
)

logger = logging.getLogger(__name__)

# ─── Canônicos ────────────────────────────────────────────────────────────────


@admin.register(CategoriaServico)
class CategoriaServicoAdmin(admin.ModelAdmin):
    list_display = ["nome", "codigo", "ordem", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["nome", "codigo"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    ordering = ["ordem", "nome"]


@admin.register(ServicoCanonico)
class ServicoCanonicoAdmin(admin.ModelAdmin):
    list_display = [
        "nome",
        "codigo",
        "categoria",
        "unidade",
        "aplica_multiplicador_tamanho",
        "is_active",
    ]
    list_filter = ["is_active", "categoria", "aplica_multiplicador_tamanho"]
    search_fields = ["nome", "codigo"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by", "embedding"]
    autocomplete_fields = ["categoria"]
    ordering = ["categoria", "nome"]


@admin.register(CategoriaMaoObra)
class CategoriaMaoObraAdmin(admin.ModelAdmin):
    list_display = ["nome", "codigo", "ordem", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["nome", "codigo"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    ordering = ["ordem", "nome"]


@admin.register(MaterialCanonico)
class MaterialCanonicoAdmin(admin.ModelAdmin):
    list_display = ["nome", "codigo", "unidade_base", "tipo", "is_active"]
    list_filter = ["is_active", "tipo"]
    search_fields = ["nome", "codigo"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by", "embedding"]
    ordering = ["nome"]


@admin.register(InsumoMaterial)
class InsumoMaterialAdmin(admin.ModelAdmin):
    list_display = [
        "sku_interno",
        "descricao",
        "marca",
        "material_canonico",
        "unidade_compra",
        "fator_conversao",
        "is_active",
    ]
    list_filter = ["is_active", "marca"]
    search_fields = ["sku_interno", "descricao", "gtin", "marca"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    autocomplete_fields = ["material_canonico"]
    ordering = ["material_canonico", "descricao"]


@admin.register(PecaCanonica)
class PecaCanonicoAdmin(admin.ModelAdmin):
    list_display = ["nome", "codigo", "tipo_peca", "is_active"]
    list_filter = ["is_active", "tipo_peca"]
    search_fields = ["nome", "codigo"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by", "embedding"]
    ordering = ["nome"]


@admin.register(CompatibilidadePeca)
class CompatibilidadePecaAdmin(admin.ModelAdmin):
    list_display = ["peca", "marca", "modelo", "ano_inicio", "ano_fim", "is_active"]
    list_filter = ["is_active", "marca"]
    search_fields = ["peca__nome", "marca", "modelo"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    autocomplete_fields = ["peca"]
    ordering = ["peca", "marca", "modelo"]


# ─── Fornecedores ─────────────────────────────────────────────────────────────


@admin.register(Fornecedor)
class FornecedorAdmin(admin.ModelAdmin):
    list_display = [
        "pessoa",
        "prazo_entrega_dias",
        "avaliacao",
        "is_active",
    ]
    list_filter = ["is_active", "avaliacao"]
    search_fields = ["pessoa__full_name"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    ordering = ["pessoa__full_name"]


@admin.register(CodigoFornecedorPeca)
class CodigoFornecedorPecaAdmin(admin.ModelAdmin):
    list_display = [
        "peca_canonica",
        "fornecedor",
        "sku_fornecedor",
        "preco_referencia",
        "data_referencia",
        "prioridade",
        "is_active",
    ]
    list_filter = ["is_active", "fornecedor"]
    search_fields = ["sku_fornecedor", "peca_canonica__nome", "fornecedor__pessoa__full_name"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    autocomplete_fields = ["peca_canonica", "fornecedor"]
    ordering = ["peca_canonica", "prioridade"]


# ─── Aliases ──────────────────────────────────────────────────────────────────


@admin.register(AliasServico)
class AliasServicoAdmin(admin.ModelAdmin):
    list_display = [
        "texto",
        "canonico",
        "origem",
        "confianca",
        "ocorrencias",
        "confirmado_em",
        "is_active",
    ]
    list_filter = ["is_active", "origem"]
    search_fields = ["texto", "texto_normalizado", "canonico__nome"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    autocomplete_fields = ["canonico"]
    ordering = ["-ocorrencias"]


@admin.register(AliasPeca)
class AliasPecaAdmin(admin.ModelAdmin):
    list_display = [
        "texto",
        "canonico",
        "origem",
        "confianca",
        "ocorrencias",
        "confirmado_em",
        "is_active",
    ]
    list_filter = ["is_active", "origem"]
    search_fields = ["texto", "texto_normalizado", "canonico__nome"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    autocomplete_fields = ["canonico"]
    ordering = ["-ocorrencias"]


@admin.register(AliasMaterial)
class AliasMaterialAdmin(admin.ModelAdmin):
    list_display = [
        "texto",
        "canonico",
        "origem",
        "confianca",
        "ocorrencias",
        "confirmado_em",
        "is_active",
    ]
    list_filter = ["is_active", "origem"]
    search_fields = ["texto", "texto_normalizado", "canonico__nome"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    autocomplete_fields = ["canonico"]
    ordering = ["-ocorrencias"]
