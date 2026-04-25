"""authz.services — resolução de permissões granulares."""
from django.contrib.auth import get_user_model

from .models import RolePermission, UserPermission


User = get_user_model()


def user_has_perm(user: User, perm_code: str) -> bool:  # type: ignore[valid-type]
    """Resolve permissão com precedência UserPermission > Role > negação.

    1. Se UserPermission explícita existe: retorna `granted` (máxima prioridade).
    2. Se algum Role do usuário tem a permissão: True.
    3. Caso contrário: False.
    """
    override = (
        UserPermission.objects.filter(user=user, permission__code=perm_code)
        .only("granted")
        .first()
    )
    if override is not None:
        return override.granted

    return RolePermission.objects.filter(
        role__user_roles__user=user, permission__code=perm_code,
    ).exists()
