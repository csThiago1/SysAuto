"""
Paddock Solutions — RBAC Permission Classes

Hierarquia: OWNER(5) > ADMIN(4) > MANAGER(3) > CONSULTANT(2) > STOREKEEPER(1)
Role é extraído do JWT payload (request.auth é o dict de claims do token).
"""
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

ROLE_HIERARCHY: dict[str, int] = {
    "STOREKEEPER": 1,
    "CONSULTANT": 2,
    "MANAGER": 3,
    "ADMIN": 4,
    "OWNER": 5,
}


def _get_role(request: Request) -> str:
    """
    Extrai o role do JWT payload.

    Args:
        request: DRF request — request.auth é o dict de claims do JWT.

    Returns:
        Role como string. Fallback para "STOREKEEPER" se ausente.
    """
    if not request.auth:
        return "STOREKEEPER"
    if isinstance(request.auth, dict):
        return str(request.auth.get("role", "STOREKEEPER"))
    return "STOREKEEPER"


def _has_min_role(request: Request, min_role: str) -> bool:
    """Verifica se o usuário tem pelo menos `min_role` na hierarquia."""
    user_level = ROLE_HIERARCHY.get(_get_role(request), 0)
    min_level = ROLE_HIERARCHY.get(min_role, 999)
    return user_level >= min_level


class IsStorekeeperOrAbove(BasePermission):
    """Permite acesso para STOREKEEPER, CONSULTANT, MANAGER, ADMIN ou OWNER."""

    message = "Você precisa ser pelo menos Almoxarife para acessar este recurso."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(request.user and request.user.is_authenticated and _has_min_role(request, "STOREKEEPER"))


class IsConsultantOrAbove(BasePermission):
    """Permite acesso apenas para CONSULTANT, MANAGER, ADMIN ou OWNER."""

    message = "Você precisa ser pelo menos Consultor para acessar este recurso."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(request.user and request.user.is_authenticated and _has_min_role(request, "CONSULTANT"))


class IsManagerOrAbove(BasePermission):
    """Permite acesso apenas para MANAGER, ADMIN ou OWNER."""

    message = "Você precisa ser pelo menos Gerente para acessar este recurso."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(request.user and request.user.is_authenticated and _has_min_role(request, "MANAGER"))


class IsAdminOrAbove(BasePermission):
    """Permite acesso apenas para ADMIN ou OWNER."""

    message = "Você precisa ser Administrador para acessar este recurso."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(request.user and request.user.is_authenticated and _has_min_role(request, "ADMIN"))


def _has_extra_permission(request: Request, perm: str) -> bool:
    """Verifica se o JWT contém a permissão granular ou se o role é MANAGER+."""
    if _has_min_role(request, "MANAGER"):
        return True
    if isinstance(request.auth, dict):
        perms = request.auth.get("extra_permissions", [])
        return perm in perms
    return False


class HasPermission(BasePermission):
    """Permission class genérica para permissões granulares (legado).

    Uso nos ViewSets:
        permission_classes = [IsAuthenticated, HasPermission("can_close_os")]
    """

    def __init__(self, perm: str) -> None:
        self.perm = perm
        self.message = f"Você não tem a permissão '{perm}'."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and _has_extra_permission(request, self.perm)
        )


class PermissionsByActionMixin:
    """ViewSet mixin: aplica permissão diferente para write vs read actions.

    Padrão default: write (create/update/partial_update/destroy) exige
    MANAGER+; read (list/retrieve e qualquer outra action) exige CONSULTANT+.

    Override via class attrs:
        class Foo(PermissionsByActionMixin, ModelViewSet):
            write_permission = IsAdminOrAbove
            read_permission = IsManagerOrAbove
            write_actions = ("create",)  # opcional, default cobre os 4
    """

    write_permission: type[BasePermission]
    read_permission: type[BasePermission]
    write_actions: tuple[str, ...] = ("create", "update", "partial_update", "destroy")

    def get_permissions(self) -> list[BasePermission]:
        from rest_framework.permissions import IsAuthenticated

        write_cls = getattr(self, "write_permission", IsManagerOrAbove)
        read_cls = getattr(self, "read_permission", IsConsultantOrAbove)
        perm_cls = write_cls if self.action in self.write_actions else read_cls
        return [IsAuthenticated(), perm_cls()]


class HasTenantPermission(BasePermission):
    """DRF permission check using tenant permission matrix.

    Resolves permissions via the configurable RBAC matrix:
    role defaults + tenant-level overrides (TenantPermissionOverride).

    Uso nos ViewSets:
        permission_classes = [IsAuthenticated, HasTenantPermission("os.create")]
    """

    def __init__(self, code: str) -> None:
        self.code = code
        self.message = f"Você não tem a permissão '{code}'."

    def has_permission(self, request: Request, view: APIView) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        from .permission_service import has_permission_from_request
        return has_permission_from_request(request, self.code)
