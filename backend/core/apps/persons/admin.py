"""
Paddock Solutions — Persons Admin
LGPD (Ciclo 06A): PII mascarada no admin — nunca exibir CPF/CNPJ/telefone em plain text.
"""

from django.contrib import admin

from .models import Person, PersonAddress, PersonContact, PersonDocument, PersonRole


class PersonRoleInline(admin.TabularInline):
    model = PersonRole
    extra = 1


class PersonDocumentInline(admin.TabularInline):
    """Exibe documentos com PII mascarada — nunca em plain text."""

    model = PersonDocument
    readonly_fields = [
        "masked_value",
        "doc_type",
        "is_primary",
        "issued_by",
        "issued_at",
        "expires_at",
    ]
    fields = ["doc_type", "masked_value", "is_primary", "issued_by", "issued_at", "expires_at"]
    extra = 0

    def masked_value(self, obj: PersonDocument) -> str:
        """Retorna valor mascarado — exibe apenas os últimos 4 chars."""
        v: str = obj.value or ""
        if len(v) > 4:
            return f"{'*' * (len(v) - 4)}{v[-4:]}"
        return "****"

    masked_value.short_description = "Valor (mascarado)"  # type: ignore[attr-defined]

    def has_add_permission(self, request, obj=None) -> bool:  # type: ignore[override]
        """Apenas superusuários podem adicionar documentos pelo admin."""
        return bool(request.user.is_superuser)

    def has_change_permission(self, request, obj=None) -> bool:  # type: ignore[override]
        """Apenas superusuários podem editar documentos pelo admin."""
        return bool(request.user.is_superuser)


class PersonContactInline(admin.TabularInline):
    """Exibe contatos com value mascarado — nunca exibir email/telefone em plain."""

    model = PersonContact
    readonly_fields = ["masked_value", "contact_type", "is_primary", "label"]
    fields = ["contact_type", "masked_value", "label", "is_primary"]
    extra = 0

    def masked_value(self, obj: PersonContact) -> str:
        """Retorna valor mascarado."""
        v: str = obj.value or ""
        if len(v) > 4:
            return f"{'*' * (len(v) - 4)}{v[-4:]}"
        return "****"

    masked_value.short_description = "Valor (mascarado)"  # type: ignore[attr-defined]

    def has_add_permission(self, request, obj=None) -> bool:  # type: ignore[override]
        return bool(request.user.is_superuser)

    def has_change_permission(self, request, obj=None) -> bool:  # type: ignore[override]
        return bool(request.user.is_superuser)


class PersonAddressInline(admin.TabularInline):
    model = PersonAddress
    extra = 1


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ["full_name", "person_kind", "masked_document", "is_active", "created_at"]
    list_filter = ["person_kind", "is_active"]
    search_fields = ["full_name", "fantasy_name"]
    inlines = [PersonRoleInline, PersonDocumentInline, PersonContactInline, PersonAddressInline]

    # Remover 'document' da exibição direta — nunca exibir CPF/CNPJ em plain
    readonly_fields = ["masked_document", "created_at", "updated_at"]

    def masked_document(self, obj: Person) -> str:
        """Exibe CPF/CNPJ mascarado via PersonDocument (campo legacy removido)."""
        doc = obj.documents.filter(doc_type__in=["CPF", "CNPJ"], is_primary=True).first()
        if not doc:
            doc = obj.documents.filter(doc_type__in=["CPF", "CNPJ"]).first()
        if not doc:
            return "—"
        v: str = doc.value or ""
        if len(v) > 4:
            return f"{'*' * (len(v) - 4)}{v[-4:]}"
        return "****"

    masked_document.short_description = "CPF/CNPJ (mascarado)"  # type: ignore[attr-defined]
