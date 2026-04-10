from django.contrib import admin

from .models import ServiceOrder, ServiceOrderPhoto, StatusTransitionLog


class ServiceOrderPhotoInline(admin.TabularInline):
    model = ServiceOrderPhoto
    extra = 1


class StatusTransitionLogInline(admin.TabularInline):
    model = StatusTransitionLog
    extra = 0
    readonly_fields = ["from_status", "to_status", "triggered_by_field", "changed_by", "created_at"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ServiceOrder)
class ServiceOrderAdmin(admin.ModelAdmin):
    list_display = [
        "number",
        "customer_name",
        "plate",
        "make",
        "model",
        "status",
        "opened_at",
    ]
    list_filter = ["status", "os_type", "customer_type", "opened_at"]
    search_fields = ["number", "customer_name", "plate", "description"]
    readonly_fields = ["number", "opened_at", "updated_at", "total"]
    inlines = [ServiceOrderPhotoInline, StatusTransitionLogInline]
    
    fieldsets = (
        ("Informações Gerais", {
            "fields": ("number", "status", "os_type", "description")
        }),
        ("Cliente (Pessoa)", {
            "fields": ("customer", "customer_name", "customer_type")
        }),
        ("Veículo", {
            "fields": ("plate", "make", "model", "year", "color", "chassis")
        }),
        ("Responsáveis", {
            "fields": ("consultant", "insurer", "expert", "created_by")
        }),
        ("Datas", {
            "fields": (
                "entry_date", 
                "authorization_date", 
                "final_survey_date", 
                "client_delivery_date",
                "estimated_delivery_date"
            )
        }),
        ("Financeiro", {
            "fields": ("total", "budget", "franchise_value")
        }),
        ("Auditoria", {
            "fields": ("opened_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )

@admin.register(StatusTransitionLog)
class StatusTransitionLogAdmin(admin.ModelAdmin):
    list_display = ["service_order", "from_status", "to_status", "changed_by", "created_at"]
    list_filter = ["to_status", "created_at"]
    search_fields = ["service_order__number", "service_order__plate"]
    readonly_fields = ["service_order", "from_status", "to_status", "triggered_by_field", "changed_by", "created_at"]

    def has_add_permission(self, request):
        return False

@admin.register(ServiceOrderPhoto)
class ServiceOrderPhotoAdmin(admin.ModelAdmin):
    list_display = ["service_order", "folder", "caption", "uploaded_at", "is_active"]
    list_filter = ["folder", "is_active", "uploaded_at"]
    search_fields = ["service_order__number", "s3_key"]
