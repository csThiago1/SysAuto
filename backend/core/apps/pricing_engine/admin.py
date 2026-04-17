from django.contrib import admin

from apps.pricing_engine.models import (
    CustoHoraFallback,
    ParametroCustoHora,
    ParametroRateio,
)


@admin.register(ParametroRateio)
class ParametroRateioAdmin(admin.ModelAdmin):
    list_display = ("empresa", "vigente_desde", "vigente_ate", "horas_produtivas_mes", "metodo")
    list_filter = ("empresa", "metodo")
    search_fields = ("empresa__nome",)
    ordering = ("empresa", "-vigente_desde")


@admin.register(ParametroCustoHora)
class ParametroCustoHoraAdmin(admin.ModelAdmin):
    list_display = (
        "empresa",
        "vigente_desde",
        "vigente_ate",
        "provisao_13_ferias",
        "multa_fgts_rescisao",
        "beneficios_por_funcionario",
        "horas_produtivas_mes",
    )
    list_filter = ("empresa",)
    search_fields = ("empresa__nome",)
    ordering = ("empresa", "-vigente_desde")


@admin.register(CustoHoraFallback)
class CustoHoraFallbackAdmin(admin.ModelAdmin):
    list_display = ("empresa", "categoria", "valor_hora", "vigente_desde", "vigente_ate")
    list_filter = ("empresa", "categoria")
    search_fields = ("empresa__nome", "categoria__nome")
    ordering = ("empresa", "categoria", "-vigente_desde")
