"""
Paddock Solutions — HR Admin
"""
import logging

from django.contrib import admin

from .models import Employee, EmployeeDocument, SalaryHistory

logger = logging.getLogger(__name__)


class EmployeeDocumentInline(admin.TabularInline):
    model = EmployeeDocument
    extra = 0
    readonly_fields = ["file_key", "file_name", "file_size", "created_at"]
    fields = [
        "document_type",
        "file_name",
        "file_size",
        "issue_date",
        "expiry_date",
        "is_active",
        "created_at",
    ]
    show_change_link = True


class SalaryHistoryInline(admin.TabularInline):
    model = SalaryHistory
    extra = 0
    readonly_fields = [
        "previous_salary",
        "new_salary",
        "effective_date",
        "authorized_by",
        "created_at",
    ]
    can_delete = False

    def has_add_permission(self, request: object, obj: object = None) -> bool:  # type: ignore[override]
        return False


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = [
        "registration_number",
        "user",
        "department",
        "position",
        "status",
        "hire_date",
        "is_active",
    ]
    list_filter = ["status", "department", "contract_type", "is_active"]
    search_fields = ["registration_number", "user__name"]
    inlines = [EmployeeDocumentInline, SalaryHistoryInline]
    readonly_fields = ["cpf_hash", "created_at", "updated_at"]
    raw_id_fields = ["user"]
    fieldsets = (
        (
            "Vínculo",
            {
                "fields": (
                    "user",
                    "department",
                    "position",
                    "registration_number",
                    "contract_type",
                    "status",
                    "hire_date",
                    "termination_date",
                )
            },
        ),
        (
            "Dados Pessoais (LGPD)",
            {
                "fields": (
                    "cpf_hash",
                    "rg_issuer",
                    "birth_date",
                    "marital_status",
                    "education_level",
                    "nationality",
                    "emergency_contact_name",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Endereço",
            {
                "fields": (
                    "address_street",
                    "address_number",
                    "address_complement",
                    "address_neighborhood",
                    "address_city",
                    "address_state",
                    "address_zip",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Remuneração",
            {
                "fields": (
                    "base_salary",
                    "pix_key_type",
                    "weekly_hours",
                    "work_schedule",
                )
            },
        ),
        (
            "Metadados",
            {
                "fields": ("legacy_databox_id", "is_active", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(admin.ModelAdmin):
    list_display = ["employee", "document_type", "file_name", "expiry_date", "is_active"]
    list_filter = ["document_type", "is_active"]
    readonly_fields = ["file_key", "created_at"]
    raw_id_fields = ["employee"]


@admin.register(SalaryHistory)
class SalaryHistoryAdmin(admin.ModelAdmin):
    list_display = [
        "employee",
        "previous_salary",
        "new_salary",
        "effective_date",
        "authorized_by",
        "created_at",
    ]
    list_filter = ["effective_date"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields = ["employee", "authorized_by"]

    def has_delete_permission(self, request: object, obj: object = None) -> bool:  # type: ignore[override]
        return False
