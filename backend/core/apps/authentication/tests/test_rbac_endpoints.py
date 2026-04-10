"""
Testes de RBAC — verifica que endpoints rejeitam roles insuficientes.
Usa mocks para evitar dependência de banco.
"""
from unittest.mock import MagicMock, patch

from django.test import RequestFactory, TestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory


class TestStaffDetailRBAC(TestCase):
    """Verifica que StaffDetailView exige IsManagerOrAbove."""

    def _make_user(self, role: str) -> MagicMock:
        user = MagicMock()
        user.is_authenticated = True
        user.is_active = True
        return user

    def test_storekeeper_cannot_patch_job_title(self) -> None:
        from apps.authentication.permissions import IsManagerOrAbove

        perm = IsManagerOrAbove()
        req = MagicMock()
        req.user.is_authenticated = True
        req.auth = {"role": "STOREKEEPER"}
        assert perm.has_permission(req, MagicMock()) is False

    def test_manager_can_patch_job_title(self) -> None:
        from apps.authentication.permissions import IsManagerOrAbove

        perm = IsManagerOrAbove()
        req = MagicMock()
        req.user.is_authenticated = True
        req.auth = {"role": "MANAGER"}
        assert perm.has_permission(req, MagicMock()) is True


class TestHRPermissions(TestCase):
    """Verifica permissões específicas do módulo HR."""

    def _perm_request(self, role: str) -> MagicMock:
        req = MagicMock()
        req.user.is_authenticated = True
        req.auth = {"role": role}
        return req

    def test_consultant_can_read_employees(self) -> None:
        from apps.authentication.permissions import IsConsultantOrAbove

        perm = IsConsultantOrAbove()
        assert perm.has_permission(self._perm_request("CONSULTANT"), MagicMock()) is True

    def test_storekeeper_cannot_read_employees(self) -> None:
        from apps.authentication.permissions import IsConsultantOrAbove

        perm = IsConsultantOrAbove()
        assert perm.has_permission(self._perm_request("STOREKEEPER"), MagicMock()) is False

    def test_consultant_cannot_close_payslip(self) -> None:
        from apps.authentication.permissions import IsManagerOrAbove

        perm = IsManagerOrAbove()
        assert perm.has_permission(self._perm_request("CONSULTANT"), MagicMock()) is False

    def test_manager_can_close_payslip(self) -> None:
        from apps.authentication.permissions import IsManagerOrAbove

        perm = IsManagerOrAbove()
        assert perm.has_permission(self._perm_request("MANAGER"), MagicMock()) is True

    def test_admin_can_do_everything(self) -> None:
        from apps.authentication.permissions import (
            IsAdminOrAbove,
            IsConsultantOrAbove,
            IsManagerOrAbove,
        )

        req = self._perm_request("ADMIN")
        assert IsConsultantOrAbove().has_permission(req, MagicMock()) is True
        assert IsManagerOrAbove().has_permission(req, MagicMock()) is True
        assert IsAdminOrAbove().has_permission(req, MagicMock()) is True
