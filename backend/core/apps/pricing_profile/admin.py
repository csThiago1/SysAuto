"""
Paddock Solutions — Pricing Profile Admin
Motor de Orçamentos (MO) — Perfil Veicular
"""
import logging

from django.contrib import admin

from .models import (
    CategoriaTamanho,
    Empresa,
    EnquadramentoVeiculo,
    SegmentoVeicular,
    TipoPintura,
)

logger = logging.getLogger(__name__)


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ["nome_fantasia", "razao_social", "cnpj", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["nome_fantasia", "razao_social", "cnpj"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    ordering = ["nome_fantasia"]


@admin.register(SegmentoVeicular)
class SegmentoVeicularAdmin(admin.ModelAdmin):
    list_display = [
        "nome",
        "codigo",
        "ordem",
        "fator_responsabilidade",
        "is_active",
    ]
    list_filter = ["is_active"]
    search_fields = ["nome", "codigo"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    ordering = ["ordem"]


@admin.register(CategoriaTamanho)
class CategoriaTamanhoAdmin(admin.ModelAdmin):
    list_display = [
        "nome",
        "codigo",
        "ordem",
        "multiplicador_insumos",
        "multiplicador_horas",
        "is_active",
    ]
    list_filter = ["is_active"]
    search_fields = ["nome", "codigo"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    ordering = ["ordem"]


@admin.register(TipoPintura)
class TipoPinturaAdmin(admin.ModelAdmin):
    list_display = ["nome", "codigo", "complexidade", "is_active"]
    list_filter = ["is_active", "complexidade"]
    search_fields = ["nome", "codigo"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    ordering = ["complexidade"]


@admin.register(EnquadramentoVeiculo)
class EnquadramentoVeiculoAdmin(admin.ModelAdmin):
    list_display = [
        "marca",
        "modelo",
        "ano_inicio",
        "ano_fim",
        "segmento",
        "tamanho",
        "tipo_pintura_default",
        "prioridade",
        "is_active",
    ]
    list_filter = ["is_active", "segmento", "tamanho", "tipo_pintura_default"]
    search_fields = ["marca", "modelo"]
    readonly_fields = ["id", "created_at", "updated_at", "created_by"]
    ordering = ["prioridade", "marca", "modelo"]
    autocomplete_fields = ["segmento", "tamanho", "tipo_pintura_default"]
