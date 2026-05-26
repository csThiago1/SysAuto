"""authz URL configuration."""
from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    PermissionViewSet,
    RoleViewSet,
    UserPermissionViewSet,
    UserRoleViewSet,
    my_permissions_view,
    permission_matrix_update_view,
    permission_matrix_view,
)

router = SimpleRouter()
router.register(r"permissions", PermissionViewSet, basename="authz-permission")
router.register(r"roles", RoleViewSet, basename="authz-role")
router.register(r"user-roles", UserRoleViewSet, basename="authz-user-role")
router.register(r"user-permissions", UserPermissionViewSet, basename="authz-user-permission")

urlpatterns = [
    path("matrix/", permission_matrix_view, name="authz-matrix"),
    path("matrix/update/", permission_matrix_update_view, name="authz-matrix-update"),
    path("my-permissions/", my_permissions_view, name="authz-my-permissions"),
] + router.urls
