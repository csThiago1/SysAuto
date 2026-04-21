from django.contrib import admin

from .models import (
    ImpactAreaLabel,
    Insurer,
    ServiceOrder,
    ServiceOrderEvent,
    ServiceOrderParecer,
    ServiceOrderStatusHistory,
    ServiceOrderVersion,
    ServiceOrderVersionItem,
)


@admin.register(Insurer)
class InsurerAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "import_source", "is_active")
    list_filter = ("import_source", "is_active")
    search_fields = ("code", "name", "cnpj")


class ServiceOrderVersionInline(admin.TabularInline):
    model = ServiceOrderVersion
    extra = 0
    readonly_fields = (
        "version_number",
        "status",
        "source",
        "external_version",
        "net_total",
        "created_at",
    )
    can_delete = False


@admin.register(ServiceOrder)
class ServiceOrderAdmin(admin.ModelAdmin):
    list_display = (
        "os_number",
        "customer_type",
        "customer",
        "vehicle_plate",
        "status",
        "insurer",
    )
    list_filter = ("customer_type", "status", "insurer")
    search_fields = (
        "os_number",
        "vehicle_plate",
        "casualty_number",
        "customer__full_name",
    )
    date_hierarchy = "created_at"
    inlines = [ServiceOrderVersionInline]


@admin.register(ServiceOrderVersion)
class ServiceOrderVersionAdmin(admin.ModelAdmin):
    list_display = (
        "service_order",
        "version_number",
        "external_version",
        "status",
        "source",
        "net_total",
    )
    list_filter = ("status", "source")
    search_fields = ("external_version", "service_order__os_number")


@admin.register(ServiceOrderVersionItem)
class ServiceOrderVersionItemAdmin(admin.ModelAdmin):
    list_display = ("description", "item_type", "payer_block", "quantity", "net_price")
    list_filter = ("item_type", "payer_block", "bucket")
    search_fields = ("description", "external_code")


@admin.register(ServiceOrderEvent)
class ServiceOrderEventAdmin(admin.ModelAdmin):
    list_display = (
        "service_order",
        "event_type",
        "actor",
        "from_state",
        "to_state",
        "created_at",
    )
    list_filter = ("event_type",)
    search_fields = ("service_order__os_number",)
    date_hierarchy = "created_at"
    readonly_fields = (
        "service_order",
        "event_type",
        "actor",
        "payload",
        "from_state",
        "to_state",
        "created_at",
    )


@admin.register(ServiceOrderParecer)
class ServiceOrderParecerAdmin(admin.ModelAdmin):
    list_display = (
        "service_order",
        "source",
        "parecer_type",
        "author_external",
        "created_at",
    )
    list_filter = ("source", "parecer_type")
    search_fields = ("service_order__os_number", "body")


@admin.register(ImpactAreaLabel)
class ImpactAreaLabelAdmin(admin.ModelAdmin):
    list_display = ("service_order", "area_number", "label_text")
    search_fields = ("service_order__os_number", "label_text")


@admin.register(ServiceOrderStatusHistory)
class ServiceOrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "service_order",
        "from_status",
        "to_status",
        "changed_by",
        "changed_at",
    )
    readonly_fields = (
        "service_order",
        "from_status",
        "to_status",
        "changed_by",
        "notes",
        "changed_at",
    )
    list_filter = ("from_status", "to_status")
