from django.contrib import admin

from apps.vehicle_catalog.models import (
    VehicleColor,
    VehicleFamily,
    VehicleFamilyRule,
    VehicleMake,
    VehicleModel,
    VehicleYearVersion,
)


@admin.register(VehicleColor)
class VehicleColorAdmin(admin.ModelAdmin):
    list_display = ["name", "hex_code"]
    search_fields = ["name"]


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
