from django.contrib import admin

from apps.banks.models import Bank


@admin.register(Bank)
class BankAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "is_active"]
    search_fields = ["code", "name"]
