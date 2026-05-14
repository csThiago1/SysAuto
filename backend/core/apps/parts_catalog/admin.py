"""
Paddock Solutions — Parts Catalog Admin
"""
from django.contrib import admin

from apps.parts_catalog.models import (
    PartApplication,
    PartCategory,
    PartReference,
    PartSupplierRef,
)


@admin.register(PartCategory)
class PartCategoryAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "order", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["code", "name"]
    ordering = ["order", "name"]


@admin.register(PartReference)
class PartReferenceAdmin(admin.ModelAdmin):
    list_display = [
        "manufacturer_code",
        "description",
        "category",
        "unit",
        "ncm",
        "ean",
        "is_active",
    ]
    list_filter = ["category", "is_active", "unit"]
    search_fields = ["manufacturer_code", "description", "description_original", "ean"]
    raw_id_fields = ["category"]
    readonly_fields = ["id", "created_at", "updated_at"]
    ordering = ["description"]


@admin.register(PartApplication)
class PartApplicationAdmin(admin.ModelAdmin):
    list_display = [
        "part_ref",
        "make",
        "model",
        "year_start",
        "year_end",
        "source",
        "confidence_score",
        "created_at",
    ]
    list_filter = ["source", "make"]
    search_fields = [
        "part_ref__manufacturer_code",
        "part_ref__description",
        "make__nome",
        "model__nome",
    ]
    raw_id_fields = ["part_ref", "make", "model"]
    readonly_fields = ["id", "created_at"]
    ordering = ["-confidence_score"]


@admin.register(PartSupplierRef)
class PartSupplierRefAdmin(admin.ModelAdmin):
    list_display = ["supplier_name", "supplier_code", "part_ref", "created_at"]
    list_filter = ["supplier_name"]
    search_fields = [
        "supplier_name",
        "supplier_code",
        "part_ref__manufacturer_code",
        "part_ref__description",
    ]
    raw_id_fields = ["part_ref"]
    readonly_fields = ["id", "created_at"]
    ordering = ["supplier_name"]
