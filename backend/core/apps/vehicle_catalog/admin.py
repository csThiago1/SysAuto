from django.contrib import admin
from django.db.models import QuerySet
from django.http import HttpRequest

from apps.vehicle_catalog.models import (
    VehicleAlias,
    VehicleFamily,
    VehicleFamilyRule,
    VehicleMake,
    VehicleModel,
    VehicleYearVersion,
)


@admin.register(VehicleMake)
class VehicleMakeAdmin(admin.ModelAdmin):
    list_display = ["nome", "tipo", "display_name", "nome_normalizado", "is_active"]
    search_fields = ["nome", "fipe_id", "nome_normalizado"]
    list_filter = ["tipo", "is_active"]
    ordering = ["nome"]


@admin.register(VehicleFamily)
class VehicleFamilyAdmin(admin.ModelAdmin):
    list_display = ["nome", "make", "is_active"]
    search_fields = ["nome"]
    list_filter = ["make__tipo", "is_active"]
    raw_id_fields = ["make"]


@admin.register(VehicleFamilyRule)
class VehicleFamilyRuleAdmin(admin.ModelAdmin):
    list_display = ["marca_nome_normalizado", "padrao", "familia", "is_active"]
    list_editable = ["padrao", "familia", "is_active"]
    search_fields = ["marca_nome_normalizado", "padrao", "familia"]
    list_filter = ["tipo", "is_active"]


@admin.register(VehicleModel)
class VehicleModelAdmin(admin.ModelAdmin):
    list_display = ["nome", "codigo_fipe", "tipo", "marca", "familia", "is_active"]
    search_fields = ["nome", "codigo_fipe"]
    list_filter = ["tipo", "is_active"]
    raw_id_fields = ["marca", "familia"]


@admin.register(VehicleYearVersion)
class VehicleYearVersionAdmin(admin.ModelAdmin):
    list_display = ["descricao", "ano", "combustivel", "modelo", "codigo_fipe", "is_active"]
    search_fields = ["descricao", "codigo_fipe"]
    list_filter = ["modelo__tipo", "combustivel", "zero_km", "is_active"]
    raw_id_fields = ["modelo"]


@admin.register(VehicleAlias)
class VehicleAliasAdmin(admin.ModelAdmin):
    list_display = ["raw_key", "source", "version", "family", "confirmacoes", "aprovado"]
    search_fields = ["raw_key"]
    list_filter = ["source", "aprovado"]
    raw_id_fields = ["version", "family"]
    list_select_related = ["version__modelo__marca", "family__make"]
    actions = ["aprovar"]

    @admin.action(description="Aprovar regras selecionadas")
    def aprovar(self, request: HttpRequest, queryset: QuerySet[VehicleAlias]) -> None:
        self.message_user(request, f"{queryset.update(aprovado=True)} regra(s) aprovada(s).")
