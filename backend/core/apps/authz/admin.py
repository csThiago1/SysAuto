from django.contrib import admin

from .models import Permission, Role, RolePermission, UserPermission, UserRole


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "module")
    list_filter = ("module",)
    search_fields = ("code", "label")


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 0


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "permissions_count")
    inlines = [RolePermissionInline]

    def permissions_count(self, obj: Role) -> int:
        return obj.permissions.count()

    permissions_count.short_description = "Permissões"


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role")
    list_filter = ("role",)
    autocomplete_fields = ("user",)


@admin.register(UserPermission)
class UserPermissionAdmin(admin.ModelAdmin):
    list_display = ("user", "permission", "granted")
    list_filter = ("granted", "permission__module")
    autocomplete_fields = ("user",)
