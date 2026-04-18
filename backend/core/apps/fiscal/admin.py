"""
Paddock Solutions — Fiscal Admin
MO-5: NF-e de entrada
"""
from django.contrib import admin

from apps.fiscal.models import FiscalDocument, NFeEntrada, NFeEntradaItem


@admin.register(FiscalDocument)
class FiscalDocumentAdmin(admin.ModelAdmin):
    list_display = ("document_type", "number", "status", "total_value", "environment", "authorized_at")
    list_filter = ("document_type", "status", "environment")
    search_fields = ("key", "number")
    readonly_fields = ("authorized_at", "cancelled_at", "created_at", "updated_at")


class NFeEntradaItemInline(admin.TabularInline):
    model = NFeEntradaItem
    extra = 0
    readonly_fields = ("status_reconciliacao",)
    fields = (
        "numero_item", "descricao_original", "codigo_produto_nf",
        "unidade_compra", "quantidade", "valor_unitario_com_tributos",
        "valor_total_com_tributos", "fator_conversao",
        "peca_canonica", "material_canonico", "status_reconciliacao",
    )


@admin.register(NFeEntrada)
class NFeEntradaAdmin(admin.ModelAdmin):
    list_display = ("numero", "serie", "emitente_nome", "data_emissao", "valor_total", "status", "estoque_gerado")
    list_filter = ("status", "estoque_gerado")
    search_fields = ("chave_acesso", "numero", "emitente_cnpj", "emitente_nome")
    readonly_fields = ("estoque_gerado", "created_at", "updated_at")
    inlines = [NFeEntradaItemInline]
