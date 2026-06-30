"""authz.views — ViewSets para permissoes e roles granulares + RBAC matrix API."""
import logging

from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes as perm_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permission_service import (
    get_effective_permissions,
    has_permission_from_request,
    invalidate_permission_cache,
)
from apps.authentication.permissions import (
    IsAdminOrAbove,
    IsConsultantOrAbove,
    PermissionsByActionMixin,
)
from apps.authentication.permissions_config import DEFAULT_PERMISSIONS, PERMISSION_CODES

from .models import Permission, Role, TenantPermissionOverride, UserPermission, UserRole
from .serializers import (
    PermissionSerializer,
    RoleSerializer,
    UserPermissionSerializer,
    UserRoleSerializer,
)

logger = logging.getLogger(__name__)


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


class UserRoleViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """Atribui/remove roles de usuários (ADMIN+ para escrita)."""

    queryset = UserRole.objects.select_related("user", "role").all()
    serializer_class = UserRoleSerializer
    write_permission = IsAdminOrAbove


class UserPermissionViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """Overrides individuais de permissão (ADMIN+ para escrita)."""

    queryset = UserPermission.objects.select_related("user", "permission").all()
    serializer_class = UserPermissionSerializer
    write_permission = IsAdminOrAbove


# ── RBAC Matrix API ──────────────────────────────────────────────────────────


@api_view(["GET"])
@perm_classes([IsAuthenticated])
def permission_matrix_view(request: Request) -> Response:
    """GET /api/v1/authz/matrix/ — Full permission matrix for admin UI.

    Returns the complete matrix: for each role, which permissions are
    enabled (considering defaults + tenant overrides).
    Requires admin.permissions permission.
    """
    if not has_permission_from_request(request, "admin.permissions"):
        return Response({"detail": "Sem permissao."}, status=403)

    overrides = TenantPermissionOverride.objects.all()
    override_map: dict[tuple[str, str], bool] = {
        (o.role, o.permission_code): o.allowed for o in overrides
    }

    matrix: dict[str, dict[str, bool]] = {}
    for role, defaults in DEFAULT_PERMISSIONS.items():
        matrix[role] = {}
        for code in PERMISSION_CODES:
            key = (role, code)
            if key in override_map:
                matrix[role][code] = override_map[key]
            else:
                matrix[role][code] = code in defaults

    return Response({"permissions": PERMISSION_CODES, "matrix": matrix})


@api_view(["PUT"])
@perm_classes([IsAuthenticated])
def permission_matrix_update_view(request: Request) -> Response:
    """PUT /api/v1/authz/matrix/update/ — Save permission matrix overrides.

    Body: { "overrides": [{"role": "...", "permission_code": "...", "allowed": true/false}, ...] }
    Only stores overrides that differ from defaults. OWNER is immutable.
    Requires admin.permissions permission.
    """
    if not has_permission_from_request(request, "admin.permissions"):
        return Response({"detail": "Sem permissao."}, status=403)

    overrides_data = request.data.get("overrides", [])

    # Validate all entries
    for item in overrides_data:
        if item.get("role") == "OWNER":
            continue
        perm_code = item.get("permission_code")
        if perm_code not in PERMISSION_CODES:
            return Response(
                {"detail": f"Permissao invalida: {perm_code}"},
                status=400,
            )
        role = item.get("role")
        if role not in DEFAULT_PERMISSIONS:
            return Response(
                {"detail": f"Role invalido: {role}"},
                status=400,
            )

    # Replace all overrides atomically
    TenantPermissionOverride.objects.all().delete()
    created = 0
    for item in overrides_data:
        if item.get("role") == "OWNER":
            continue
        TenantPermissionOverride.objects.create(
            role=item["role"],
            permission_code=item["permission_code"],
            allowed=item["allowed"],
        )
        created += 1

    invalidate_permission_cache()
    logger.info("Permission matrix updated: %d overrides saved", created)
    return Response({"detail": "Permissoes atualizadas."})


@api_view(["GET"])
@perm_classes([IsAuthenticated])
def my_permissions_view(request: Request) -> Response:
    """GET /api/v1/authz/my-permissions/ — Current user's effective permissions.

    Returns the resolved list of permission codes based on role + overrides.
    Any authenticated user can check their own permissions.
    """
    auth = getattr(request, "auth", None)
    role = "STOREKEEPER"
    if isinstance(auth, dict):
        role = str(auth.get("role", "STOREKEEPER"))

    permissions = get_effective_permissions(role)
    return Response({"role": role, "permissions": permissions})
