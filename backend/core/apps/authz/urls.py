"""authz URL configuration."""
from rest_framework.routers import SimpleRouter

from .views import PermissionViewSet, RoleViewSet, UserPermissionViewSet, UserRoleViewSet

router = SimpleRouter()
router.register(r"permissions", PermissionViewSet, basename="authz-permission")
router.register(r"roles", RoleViewSet, basename="authz-role")
router.register(r"user-roles", UserRoleViewSet, basename="authz-user-role")
router.register(r"user-permissions", UserPermissionViewSet, basename="authz-user-permission")

urlpatterns = router.urls
