"""Testes para authz.services.user_has_perm."""
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.authz.models import Permission, Role, RolePermission, UserPermission, UserRole
from apps.authz.services import user_has_perm


class UserHasPermTest(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(email="test@x.com", password="pw")
        self.perm, _ = Permission.objects.get_or_create(
            code="budget.approve", defaults={"label": "Aprovar", "module": "budget"}
        )

    def test_userpermission_granted_true_returns_true(self) -> None:
        UserPermission.objects.create(user=self.user, permission=self.perm, granted=True)
        assert user_has_perm(self.user, "budget.approve") is True

    def test_userpermission_granted_false_blocks_even_with_role(self) -> None:
        role, _ = Role.objects.get_or_create(code="MANAGER", defaults={"label": "Gerente"})
        RolePermission.objects.get_or_create(role=role, permission=self.perm)
        UserRole.objects.create(user=self.user, role=role)
        UserPermission.objects.create(user=self.user, permission=self.perm, granted=False)
        assert user_has_perm(self.user, "budget.approve") is False

    def test_role_grants_permission(self) -> None:
        role, _ = Role.objects.get_or_create(code="ADMIN", defaults={"label": "Admin"})
        RolePermission.objects.get_or_create(role=role, permission=self.perm)
        UserRole.objects.create(user=self.user, role=role)
        assert user_has_perm(self.user, "budget.approve") is True

    def test_no_role_no_override_returns_false(self) -> None:
        assert user_has_perm(self.user, "budget.approve") is False

    def test_unknown_perm_code_returns_false(self) -> None:
        assert user_has_perm(self.user, "nonexistent.perm") is False
