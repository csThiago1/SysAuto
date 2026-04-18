"""
Paddock Solutions — Inventory Admin
MO-5: estoque físico + etiquetagem
"""
from django.contrib import admin

from apps.inventory.models import (
    ConsumoInsumo,
    EtiquetaImpressa,
    ImpressoraEtiqueta,
    LoteInsumo,
    UnidadeFisica,
)


@admin.register(UnidadeFisica)
class UnidadeFisicaAdmin(admin.ModelAdmin):
    list_display = ("codigo_barras", "peca_canonica", "valor_nf", "status", "ordem_servico", "localizacao")
    list_filter = ("status",)
    search_fields = ("codigo_barras", "numero_serie")
    readonly_fields = ("codigo_barras", "created_at", "updated_at")


@admin.register(LoteInsumo)
class LoteInsumoAdmin(admin.ModelAdmin):
    list_display = ("codigo_barras", "material_canonico", "saldo", "unidade_compra", "valor_unitario_base", "validade")
    list_filter = ("material_canonico",)
    search_fields = ("codigo_barras",)
    readonly_fields = ("codigo_barras", "valor_unitario_base", "created_at", "updated_at")


@admin.register(ConsumoInsumo)
class ConsumoInsumoAdmin(admin.ModelAdmin):
    """Read-only: auditoria."""
    list_display = ("lote", "ordem_servico", "quantidade_base", "valor_unitario_na_baixa", "created_at")
    readonly_fields = ("lote", "ordem_servico", "quantidade_base", "valor_unitario_na_baixa", "criado_por", "created_at")

    def has_add_permission(self, request):  # type: ignore[override]
        return False

    def has_change_permission(self, request, obj=None):  # type: ignore[override]
        return False


@admin.register(ImpressoraEtiqueta)
class ImpressoraEtiquetaAdmin(admin.ModelAdmin):
    list_display = ("nome", "modelo", "endpoint", "largura_mm", "altura_mm", "is_active")
    list_filter = ("modelo", "is_active")


@admin.register(EtiquetaImpressa)
class EtiquetaImpressaAdmin(admin.ModelAdmin):
    """Read-only: auditoria."""
    list_display = ("unidade_fisica", "lote_insumo", "impressora", "impressa_por", "created_at")
    readonly_fields = ("unidade_fisica", "lote_insumo", "impressora", "zpl_payload", "impressa_por", "created_at")

    def has_add_permission(self, request):  # type: ignore[override]
        return False

    def has_change_permission(self, request, obj=None):  # type: ignore[override]
        return False
