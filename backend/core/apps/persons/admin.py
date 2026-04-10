from django.contrib import admin

from .models import Person, PersonAddress, PersonContact, PersonRole


class PersonRoleInline(admin.TabularInline):
    model = PersonRole
    extra = 1


class PersonContactInline(admin.TabularInline):
    model = PersonContact
    extra = 1


class PersonAddressInline(admin.TabularInline):
    model = PersonAddress
    extra = 1


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ["full_name", "person_kind", "document", "is_active", "created_at"]
    list_filter = ["person_kind", "is_active"]
    search_fields = ["full_name", "fantasy_name", "document"]
    inlines = [PersonRoleInline, PersonContactInline, PersonAddressInline]
