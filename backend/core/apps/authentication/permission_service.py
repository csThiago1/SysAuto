"""
Paddock Solutions — Permission Service

Resolve effective permissions for a user based on:
1. Role default permissions (from permissions_config.py)
2. Tenant-level overrides (TenantPermissionOverride in authz app)

OWNER role always gets all permissions (cannot be overridden).
Results are cached per schema+role for 5 minutes.
"""
import logging
from typing import TYPE_CHECKING

from django.core.cache import cache

from .permissions_config import DEFAULT_PERMISSIONS, PERMISSION_CODES

if TYPE_CHECKING:
    from .models import GlobalUser

logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 min


def get_effective_permissions(role: str) -> list[str]:
    """Get all permission codes for a role in the current tenant.

    Args:
        role: The role code (OWNER, ADMIN, MANAGER, CONSULTANT, STOREKEEPER).

    Returns:
        List of permission code strings.
    """
    # OWNER always gets everything, no overrides
    if role == "OWNER":
        return list(PERMISSION_CODES.keys())

    defaults = set(DEFAULT_PERMISSIONS.get(role, []))

    # Try to get tenant overrides from authz.TenantPermissionOverride
    try:
        from django.db import connection
        schema = connection.schema_name
        cache_key = f"perms:{schema}:{role}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        from apps.authz.models import TenantPermissionOverride
        overrides = TenantPermissionOverride.objects.filter(
            role=role,
        ).values_list("permission_code", "allowed")

        for code, allowed in overrides:
            if allowed:
                defaults.add(code)
            else:
                defaults.discard(code)

        result = sorted(defaults)
        cache.set(cache_key, result, CACHE_TTL)
        return result
    except Exception:
        logger.debug("Could not load tenant overrides, using defaults for role=%s", role)
        return sorted(defaults)


def get_user_permissions(user: "GlobalUser", role: str | None = None) -> list[str]:
    """Get all permission codes for a specific user.

    Resolves: role defaults + tenant overrides.
    If role is not provided, falls back to STOREKEEPER.

    Args:
        user: GlobalUser instance.
        role: Optional role override (e.g. from JWT claims).

    Returns:
        List of permission code strings.
    """
    if role is None:
        role = "STOREKEEPER"
    return get_effective_permissions(role)


def has_permission(role: str, permission_code: str) -> bool:
    """Check if a role has a specific permission in the current tenant.

    Args:
        role: Role code string.
        permission_code: Permission code to check (e.g. 'os.create').

    Returns:
        True if the role has the permission.
    """
    return permission_code in get_effective_permissions(role)


def has_permission_from_request(request: "object", permission_code: str) -> bool:
    """Check permission using DRF request object (extracts role from JWT).

    Args:
        request: DRF Request object with .auth dict containing 'role'.
        permission_code: Permission code to check.

    Returns:
        True if the user's role has the permission.
    """
    auth = getattr(request, "auth", None)
    if isinstance(auth, dict):
        role = str(auth.get("role", "STOREKEEPER"))
    else:
        role = "STOREKEEPER"
    return has_permission(role, permission_code)


def invalidate_permission_cache(role: str | None = None) -> None:
    """Invalidate cached permissions after matrix update.

    Args:
        role: If provided, invalidate only this role. Otherwise, invalidate all.
    """
    try:
        from django.db import connection
        schema = connection.schema_name
        if role:
            cache.delete(f"perms:{schema}:{role}")
        else:
            for r in DEFAULT_PERMISSIONS:
                cache.delete(f"perms:{schema}:{r}")
    except Exception:
        logger.debug("Could not invalidate permission cache")
