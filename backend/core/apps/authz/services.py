from django.contrib.auth import get_user_model

from .models import RolePermission, UserPermission


User = get_user_model()


def user_has_perm(user: User, perm_code: str) -> bool:
    """Resolve permissão com precedência UserPermission > Role > negação.

    - Se há UserPermission explícita: usa o valor de `granted`.
    - Se não, checa se algum Role do usuário tem a permissão.
    """

    override = UserPermission.objects.filter(
        user=user, permission__code=perm_code,
    ).only("granted").first()
    if override is not None:
        return override.granted

    return RolePermission.objects.filter(
        role__user_roles__user=user, permission__code=perm_code,
    ).exists()
