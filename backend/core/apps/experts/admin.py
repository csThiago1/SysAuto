from django.contrib import admin

from apps.experts.models import Expert


@admin.register(Expert)
class ExpertAdmin(admin.ModelAdmin):
    list_display = ["name", "registration_number", "phone", "email", "is_active"]
    list_filter = ["is_active", "insurers"]
    search_fields = ["name", "registration_number"]
    filter_horizontal = ["insurers"]
