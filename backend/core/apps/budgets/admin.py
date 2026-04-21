from django.contrib import admin

from .models import Budget, BudgetVersion, BudgetVersionItem


class BudgetVersionInline(admin.TabularInline):
    model = BudgetVersion
    extra = 0
    readonly_fields = ("version_number", "status", "net_total", "created_at")
    can_delete = False


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ("number", "customer", "vehicle_plate", "created_at", "is_active")
    search_fields = ("number", "vehicle_plate", "customer__full_name")
    list_filter = ("is_active",)
    inlines = [BudgetVersionInline]
    date_hierarchy = "created_at"


@admin.register(BudgetVersion)
class BudgetVersionAdmin(admin.ModelAdmin):
    list_display = ("budget", "version_number", "status", "net_total", "valid_until")
    list_filter = ("status",)
    search_fields = ("budget__number",)


@admin.register(BudgetVersionItem)
class BudgetVersionItemAdmin(admin.ModelAdmin):
    list_display = ("description", "item_type", "quantity", "net_price", "payer_block")
    list_filter = ("item_type", "payer_block", "bucket")
    search_fields = ("description", "external_code")
