from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import AuthenticationForm

from .models import GlobalUser


class EmailLoginForm(AuthenticationForm):
    """Substitui o label 'Email hash' por 'E-mail' no formulário de login do admin."""

    username = forms.CharField(
        label="E-mail",
        widget=forms.EmailInput(attrs={"autofocus": True}),
    )


admin.site.login_form = EmailLoginForm


@admin.register(GlobalUser)
class GlobalUserAdmin(UserAdmin):
    list_display = ["name", "job_title", "is_active", "is_staff"]
    list_filter = ["job_title", "is_active", "is_staff"]
    search_fields = ["name", "email_hash"]
    ordering = ["name"]
    fieldsets = (
        (None, {"fields": ("email_hash", "password")}),
        ("Dados pessoais", {"fields": ("name", "job_title", "keycloak_id")}),
        ("Permissões", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Datas", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    readonly_fields = ["created_at", "updated_at"]
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email_hash", "name", "job_title", "password1", "password2"),
        }),
    )
