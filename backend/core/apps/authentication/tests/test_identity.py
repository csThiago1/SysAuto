"""
Testes de identidade — /me endpoint, GlobalUser↔UnifiedCustomer signal.
Usar SimpleTestCase pois não requer banco multi-tenant.
"""
import hashlib
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient


class TestPermissions(TestCase):
    """Testa as permission classes RBAC."""

    def _make_request(self, role: str) -> MagicMock:
        """Cria request mock com role no payload JWT."""
        req = MagicMock()
        req.user.is_authenticated = True
        req.auth = {"role": role}
        return req

    def test_consultant_or_above_allows_consultant(self) -> None:
        from apps.authentication.permissions import IsConsultantOrAbove

        perm = IsConsultantOrAbove()
        assert perm.has_permission(self._make_request("CONSULTANT"), MagicMock()) is True

    def test_consultant_or_above_blocks_storekeeper(self) -> None:
        from apps.authentication.permissions import IsConsultantOrAbove

        perm = IsConsultantOrAbove()
        assert perm.has_permission(self._make_request("STOREKEEPER"), MagicMock()) is False

    def test_manager_or_above_allows_admin(self) -> None:
        from apps.authentication.permissions import IsManagerOrAbove

        perm = IsManagerOrAbove()
        assert perm.has_permission(self._make_request("ADMIN"), MagicMock()) is True

    def test_manager_or_above_blocks_consultant(self) -> None:
        from apps.authentication.permissions import IsManagerOrAbove

        perm = IsManagerOrAbove()
        assert perm.has_permission(self._make_request("CONSULTANT"), MagicMock()) is False

    def test_admin_or_above_allows_owner(self) -> None:
        from apps.authentication.permissions import IsAdminOrAbove

        perm = IsAdminOrAbove()
        assert perm.has_permission(self._make_request("OWNER"), MagicMock()) is True

    def test_admin_or_above_blocks_manager(self) -> None:
        from apps.authentication.permissions import IsAdminOrAbove

        perm = IsAdminOrAbove()
        assert perm.has_permission(self._make_request("MANAGER"), MagicMock()) is False

    def test_missing_auth_fallback_to_storekeeper(self) -> None:
        """Sem JWT, role default é STOREKEEPER → bloqueado em IsManagerOrAbove."""
        from apps.authentication.permissions import IsManagerOrAbove

        perm = IsManagerOrAbove()
        req = MagicMock()
        req.user.is_authenticated = True
        req.auth = None
        assert perm.has_permission(req, MagicMock()) is False

    def test_role_hierarchy_full_chain(self) -> None:
        """OWNER passa em todos os níveis."""
        from apps.authentication.permissions import (
            IsAdminOrAbove,
            IsConsultantOrAbove,
            IsManagerOrAbove,
        )

        req = self._make_request("OWNER")
        assert IsConsultantOrAbove().has_permission(req, MagicMock()) is True
        assert IsManagerOrAbove().has_permission(req, MagicMock()) is True
        assert IsAdminOrAbove().has_permission(req, MagicMock()) is True


class TestPermissionsByActionMixin(SimpleTestCase):
    """Testa o mixin que aplica permissão diferente pra write vs read actions."""

    def _make_viewset(self, action: str, **class_attrs):
        """Instancia um viewset fake com o mixin + action setada."""
        from apps.authentication.permissions import PermissionsByActionMixin

        cls = type("FakeViewSet", (PermissionsByActionMixin,), class_attrs)
        vs = cls()
        vs.action = action
        return vs

    def test_default_write_action_returns_manager_or_above(self) -> None:
        """Default: create/update/partial_update/destroy exigem MANAGER+."""
        from apps.authentication.permissions import IsManagerOrAbove

        for action in ("create", "update", "partial_update", "destroy"):
            vs = self._make_viewset(action)
            perms = vs.get_permissions()
            assert any(isinstance(p, IsManagerOrAbove) for p in perms), (
                f"action={action} deveria ter IsManagerOrAbove"
            )

    def test_default_read_action_returns_consultant_or_above(self) -> None:
        """Default: list/retrieve/qualquer outra action exigem CONSULTANT+."""
        from apps.authentication.permissions import IsConsultantOrAbove

        for action in ("list", "retrieve", "custom_action"):
            vs = self._make_viewset(action)
            perms = vs.get_permissions()
            assert any(isinstance(p, IsConsultantOrAbove) for p in perms), (
                f"action={action} deveria ter IsConsultantOrAbove"
            )

    def test_custom_write_actions_override(self) -> None:
        """write_actions custom troca quais actions são consideradas write."""
        from apps.authentication.permissions import (
            IsConsultantOrAbove,
            IsManagerOrAbove,
        )

        vs = self._make_viewset("approve", write_actions=("approve",))
        assert any(isinstance(p, IsManagerOrAbove) for p in vs.get_permissions())

        # create não é mais write neste caso
        vs = self._make_viewset("create", write_actions=("approve",))
        assert any(isinstance(p, IsConsultantOrAbove) for p in vs.get_permissions())

    def test_custom_write_permission_class(self) -> None:
        """write_permission override troca quem pode escrever."""
        from apps.authentication.permissions import IsAdminOrAbove

        vs = self._make_viewset("create", write_permission=IsAdminOrAbove)
        assert any(isinstance(p, IsAdminOrAbove) for p in vs.get_permissions())

    def test_custom_read_permission_class(self) -> None:
        """read_permission override troca quem pode ler."""
        from apps.authentication.permissions import IsManagerOrAbove

        vs = self._make_viewset("list", read_permission=IsManagerOrAbove)
        assert any(isinstance(p, IsManagerOrAbove) for p in vs.get_permissions())

    def test_isauthenticated_always_included(self) -> None:
        """IsAuthenticated deve estar sempre na lista, independente de action."""
        from rest_framework.permissions import IsAuthenticated

        for action in ("create", "list", "custom"):
            vs = self._make_viewset(action)
            perms = vs.get_permissions()
            assert any(isinstance(p, IsAuthenticated) for p in perms)


class TestHasTenantPermission(SimpleTestCase):
    """HasTenantPermission suporta 2 padrões DRF: instância e factory."""

    def test_instance_pattern_from_get_permissions(self) -> None:
        """`HasTenantPermission("code")` retorna instância com code no self."""
        from apps.authentication.permissions import HasTenantPermission

        perm = HasTenantPermission("compras.view")
        assert perm.code == "compras.view"
        assert hasattr(perm, "has_permission")
        assert "compras.view" in perm.message

    def test_factory_creates_class_with_baked_code(self) -> None:
        """`.factory("code")` retorna subclass com code como class attr."""
        from apps.authentication.permissions import HasTenantPermission

        cls = HasTenantPermission.factory("estoque.move")
        assert isinstance(cls, type)
        assert issubclass(cls, HasTenantPermission)
        assert cls.code == "estoque.move"

    def test_factory_class_instantiates_without_args(self) -> None:
        """Subclass da factory é instanciável sem args — o padrão DRF."""
        from apps.authentication.permissions import HasTenantPermission

        cls = HasTenantPermission.factory("estoque.move")
        instance = cls()  # DRF chama assim em get_permissions default
        assert instance.code == "estoque.move"

    def test_drf_iteration_pattern_works(self) -> None:
        """Simula o loop DRF `[p() for p in permission_classes]`."""
        from rest_framework.permissions import IsAuthenticated

        from apps.authentication.permissions import HasTenantPermission

        permission_classes = [
            IsAuthenticated,
            HasTenantPermission.factory("estoque.move"),
        ]
        # Isso é o que DRF faz em rest_framework/views.py:278
        instances = [p() for p in permission_classes]
        assert isinstance(instances[0], IsAuthenticated)
        assert isinstance(instances[1], HasTenantPermission)
        assert instances[1].code == "estoque.move"
