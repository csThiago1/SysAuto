from django.contrib import admin

from .models import ItemOperation, ItemOperationType, LaborCategory, NumberSequence


@admin.register(ItemOperationType)
class ItemOperationTypeAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "sort_order", "is_active")
    search_fields = ("code", "label")
    list_filter = ("is_active",)


@admin.register(LaborCategory)
class LaborCategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "sort_order", "is_active")
    search_fields = ("code", "label")
    list_filter = ("is_active",)


@admin.register(NumberSequence)
class NumberSequenceAdmin(admin.ModelAdmin):
    list_display = ("sequence_type", "prefix", "next_number", "padding")
    readonly_fields = ("next_number",)


@admin.register(ItemOperation)
class ItemOperationAdmin(admin.ModelAdmin):
    list_display = ("id", "operation_type", "labor_category", "hours", "labor_cost")
    list_filter = ("operation_type", "labor_category")
