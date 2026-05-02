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
