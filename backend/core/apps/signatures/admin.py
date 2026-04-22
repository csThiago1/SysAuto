from django.contrib import admin

from .models import Signature


@admin.register(Signature)
class SignatureAdmin(admin.ModelAdmin):
    list_display = (
        "signer_name", "document_type", "method",
        "service_order", "budget", "signed_at",
    )
    list_filter = ("document_type", "method")
    search_fields = ("signer_name", "signer_cpf", "signature_hash")
    readonly_fields = (
        "service_order", "budget",
        "document_type", "method",
        "signer_name", "signer_cpf",
        "signature_png_base64", "signature_hash",
        "ip_address", "user_agent",
        "signed_at", "remote_token",
    )
    date_hierarchy = "signed_at"
