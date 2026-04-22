import pytest
from django.contrib.auth import get_user_model

from apps.authz.models import Permission, Role, UserRole, UserPermission
from apps.authz.services import user_has_perm


User = get_user_model()


@pytest.mark.django_db
class TestSeeds:
    def test_core_permissions_exist(self):
        expected = {
            "budget.create", "budget.edit_own", "budget.edit_any",
            "budget.approve", "budget.clone",
            "os.create", "os.edit", "os.change_status", "os.delete",
            "os.import_insurance", "os.view_cost_margin",
            "payment.create", "payment.view",
            "fiscal.issue_nfse", "fiscal.issue_nfe",
            "photo.upload", "photo.delete",
            "pareceres.reply_external",
        }
        codes = set(Permission.objects.values_list("code", flat=True))
        missing = expected - codes
        assert not missing, f"Permissões faltando: {missing}"

    def test_core_roles_exist(self):
        expected = {"OWNER", "ADMIN", "MANAGER", "CONSULTANT", "MECHANIC", "FINANCIAL"}
        codes = set(Role.objects.values_list("code", flat=True))
        assert expected.issubset(codes)

    def test_owner_has_all_permissions(self):
        owner = Role.objects.get(code="OWNER")
        all_perms_count = Permission.objects.count()
        assert owner.permissions.count() == all_perms_count

    def test_mechanic_cannot_approve_budget(self):
        mechanic = Role.objects.get(code="MECHANIC")
        assert not mechanic.permissions.filter(code="budget.approve").exists()


@pytest.mark.django_db
class TestUserHasPerm:
    def _make_user_with_role(self, role_code: str):
        user = User.objects.create_user(username="alice", password="pass12345")
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
        return user

    def test_role_grants_permission(self):
        user = self._make_user_with_role("CONSULTANT")
        assert user_has_perm(user, "budget.create") is True

    def test_role_without_permission_returns_false(self):
        user = self._make_user_with_role("MECHANIC")
        assert user_has_perm(user, "fiscal.issue_nfse") is False

    def test_user_permission_override_grants(self):
        user = self._make_user_with_role("MECHANIC")
        perm = Permission.objects.get(code="fiscal.issue_nfse")
        UserPermission.objects.create(user=user, permission=perm, granted=True)
        assert user_has_perm(user, "fiscal.issue_nfse") is True

    def test_user_permission_override_denies(self):
        user = self._make_user_with_role("OWNER")
        perm = Permission.objects.get(code="os.delete")
        UserPermission.objects.create(user=user, permission=perm, granted=False)
        assert user_has_perm(user, "os.delete") is False
