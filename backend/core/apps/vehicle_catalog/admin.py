from django.contrib import admin

from apps.vehicle_catalog.models import VehicleColor


@admin.register(VehicleColor)
class VehicleColorAdmin(admin.ModelAdmin):
    list_display = ["name", "hex_code"]
    search_fields = ["name"]
