"""
Testes de identidade — /me endpoint, GlobalUser↔UnifiedCustomer signal.
Usar SimpleTestCase pois não requer banco multi-tenant.
"""
import hashlib
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
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
