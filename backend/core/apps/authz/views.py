"""authz.views — ViewSets para permissões e roles granulares."""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import IsAdminOrAbove, IsConsultantOrAbove

from .models import Permission, Role, UserPermission, UserRole
from .serializers import (
    PermissionSerializer,
    RoleSerializer,
    UserPermissionSerializer,
    UserRoleSerializer,
)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista permissões do catálogo (CONSULTANT+)."""

    queryset = Permission.objects.all().order_by("module", "code")
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista roles do catálogo (CONSULTANT+)."""

    queryset = Role.objects.all().order_by("code")
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]


class UserRoleViewSet(viewsets.ModelViewSet):
    """Atribui/remove roles de usuários (ADMIN+ para escrita)."""

    queryset = UserRole.objects.select_related("user", "role").all()
    serializer_class = UserRoleSerializer

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]


class UserPermissionViewSet(viewsets.ModelViewSet):
    """Overrides individuais de permissão (ADMIN+ para escrita)."""

    queryset = UserPermission.objects.select_related("user", "permission").all()
    serializer_class = UserPermissionSerializer

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]
