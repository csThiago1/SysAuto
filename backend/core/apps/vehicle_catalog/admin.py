from django.contrib import admin

from apps.vehicle_catalog.models import (
    VehicleColor,
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
    list_display = ["nome", "fipe_id", "nome_normalizado"]
    search_fields = ["nome", "fipe_id", "nome_normalizado"]
    ordering = ["nome"]


@admin.register(VehicleModel)
class VehicleModelAdmin(admin.ModelAdmin):
    list_display = ["nome", "fipe_id", "marca"]
    search_fields = ["nome", "fipe_id"]
    list_filter = ["marca"]
    raw_id_fields = ["marca"]


@admin.register(VehicleYearVersion)
class VehicleYearVersionAdmin(admin.ModelAdmin):
    list_display = ["descricao", "ano", "combustivel", "modelo", "codigo_fipe"]
    search_fields = ["descricao", "codigo_fipe"]
    list_filter = ["combustivel", "ano"]
    raw_id_fields = ["modelo"]
