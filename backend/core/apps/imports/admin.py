from django.contrib import admin

from .models import ImportAttempt


@admin.register(ImportAttempt)
class ImportAttemptAdmin(admin.ModelAdmin):
    list_display = (
        "source", "casualty_number", "budget_number", "version_number",
        "http_status", "parsed_ok", "service_order", "created_at",
    )
    list_filter = ("source", "trigger", "parsed_ok", "http_status")
    search_fields = ("casualty_number", "budget_number")
    readonly_fields = (
        "source", "trigger", "casualty_number", "budget_number", "version_number",
        "http_status", "raw_hash", "raw_payload", "error_message", "error_type",
        "service_order", "version_created", "duplicate_of", "duration_ms",
        "created_at", "created_by",
    )
    date_hierarchy = "created_at"
