from django.contrib import admin

from apps.insurers.models import Insurer


@admin.register(Insurer)
class InsurerAdmin(admin.ModelAdmin):
    list_display = ["name", "trade_name", "cnpj", "abbreviation", "brand_color", "uses_cilia", "is_active"]
    list_filter = ["is_active", "uses_cilia"]
    search_fields = ["name", "trade_name", "cnpj"]
