"""
Paddock Solutions — Quotes Admin
Motor de Orçamentos (MO) — Sprint MO-7
"""
from django.contrib import admin

from apps.quotes.models import AreaImpacto, Orcamento, OrcamentoIntervencao, OrcamentoItemAdicional


class AreaImpactoInline(admin.TabularInline):
    model = AreaImpacto
    extra = 0
    readonly_fields = ("created_at",)


class OrcamentoIntervencaoInline(admin.TabularInline):
    model = OrcamentoIntervencao
    extra = 0
    readonly_fields = ("snapshot", "created_at")
    fields = (
        "area_impacto", "peca_canonica", "acao", "qualificador_peca",
        "fornecimento", "quantidade", "preco_total", "status", "snapshot",
    )


class OrcamentoItemAdicionalInline(admin.TabularInline):
    model = OrcamentoItemAdicional
    extra = 0
    readonly_fields = ("snapshot", "created_at")
    fields = ("service_catalog", "quantidade", "preco_unitario", "preco_total", "status", "snapshot")


@admin.register(Orcamento)
class OrcamentoAdmin(admin.ModelAdmin):
    list_display = ("numero", "versao", "status", "empresa", "customer", "total", "created_at")
    list_filter = ("status", "tipo_responsabilidade")
    search_fields = ("numero", "veiculo_placa", "veiculo_modelo")
    readonly_fields = (
        "numero", "versao", "enquadramento_snapshot",
        "subtotal", "total", "created_at", "updated_at",
    )
    inlines = [AreaImpactoInline, OrcamentoIntervencaoInline, OrcamentoItemAdicionalInline]


@admin.register(AreaImpacto)
class AreaImpactoAdmin(admin.ModelAdmin):
    list_display = ("titulo", "orcamento", "status", "ordem")
    list_filter = ("status",)
    search_fields = ("titulo", "orcamento__numero")


@admin.register(OrcamentoIntervencao)
class OrcamentoIntervencaoAdmin(admin.ModelAdmin):
    list_display = ("orcamento", "peca_canonica", "acao", "status", "preco_total")
    list_filter = ("acao", "status", "fornecimento")
    search_fields = ("orcamento__numero", "codigo_peca")
    readonly_fields = ("snapshot",)


@admin.register(OrcamentoItemAdicional)
class OrcamentoItemAdicionalAdmin(admin.ModelAdmin):
    list_display = ("orcamento", "service_catalog", "quantidade", "preco_total", "status")
    list_filter = ("status",)
    readonly_fields = ("snapshot",)
