"""
Admin do app pricing_tech — fichas técnicas de serviços.
"""
from django.contrib import admin

from .models import FichaTecnicaInsumo, FichaTecnicaMaoObra, FichaTecnicaServico


class FichaTecnicaMaoObraInline(admin.TabularInline):
    model = FichaTecnicaMaoObra
    extra = 0
    fields = ("categoria", "horas", "afetada_por_tamanho", "observacao")


class FichaTecnicaInsumoInline(admin.TabularInline):
    model = FichaTecnicaInsumo
    extra = 0
    fields = ("material_canonico", "quantidade", "unidade", "afetado_por_tamanho", "observacao")


@admin.register(FichaTecnicaServico)
class FichaTecnicaServicoAdmin(admin.ModelAdmin):
    list_display = ("__str__", "servico", "versao", "tipo_pintura", "is_active", "criada_em")
    list_filter = ("is_active", "tipo_pintura", "servico")
    search_fields = ("servico__nome",)
    readonly_fields = ("criada_em", "criada_por")
    inlines = [FichaTecnicaMaoObraInline, FichaTecnicaInsumoInline]


@admin.register(FichaTecnicaMaoObra)
class FichaTecnicaMaoObraAdmin(admin.ModelAdmin):
    list_display = ("__str__", "ficha", "categoria", "horas", "afetada_por_tamanho")
    list_filter = ("afetada_por_tamanho", "categoria")
    search_fields = ("ficha__servico__nome", "categoria__nome")


@admin.register(FichaTecnicaInsumo)
class FichaTecnicaInsumoAdmin(admin.ModelAdmin):
    list_display = ("__str__", "ficha", "material_canonico", "quantidade", "unidade", "afetado_por_tamanho")
    list_filter = ("afetado_por_tamanho",)
    search_fields = ("ficha__servico__nome", "material_canonico__nome")
