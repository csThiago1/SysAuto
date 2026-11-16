"""Convite de colaborador por link de uso único."""
import datetime
import hashlib
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser, Invite
from apps.hr.models import Employee, EmployeeDocument


class TestInviteModel(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.admin = GlobalUser.objects.create_user(email="admin@test.com", name="Admin", password="x")

    def test_issue_stores_only_hash(self) -> None:
        invite, token = Invite.issue("CONSULTANT", "tenant_x", self.admin)
        assert token and token != invite.token_hash
        assert token not in invite.token_hash
        assert Invite.find(token) == invite
        assert Invite.find("x") is None
        assert invite.expires_at - timezone.now() > datetime.timedelta(days=6, hours=23)

    def test_is_usable_false_when_expired_used_or_revoked(self) -> None:
        now = timezone.now()
        for field, value in (
            ("expires_at", now - datetime.timedelta(seconds=1)),
            ("used_at", now),
            ("revoked_at", now),
        ):
            invite, _ = Invite.issue("CONSULTANT", "tenant_x", self.admin)
            assert invite.is_usable
            setattr(invite, field, value)
            assert not invite.is_usable, field


BASE = "/api/v1/auth/invites/"
GOOD = {
    "full_name": "Novo Colaborador",
    "email": " Novo@Teste.com ",
    "cpf": "529.982.247-25",
    "phone": "(92) 99999-0000",
    "password": "Oficina#2026x",
}


class TestInviteEndpoints(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        # Throttle usa o cache real; nos testes ele só atrapalha.
        patcher = patch("apps.authentication.invites.InviteThrottle.allow_request", return_value=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.admin = GlobalUser.objects.create_user(email="admin@test.com", name="Admin", password="x")
        self.client = self._client()
        self.client.force_authenticate(user=self.admin, token={"role": "ADMIN"})
        self.anon = self._client()

    def _client(self) -> APIClient:
        c = APIClient()
        c.defaults["SERVER_NAME"] = self.domain.domain
        c.defaults["HTTP_HOST"] = self.domain.domain
        return c

    def _token(self, role: str = "CONSULTANT") -> str:
        res = self.client.post(BASE, {"role": role}, format="json")
        assert res.status_code == 201, res.data
        return res.data["token"]

    def _accept(self, token: str, **overrides: object):
        return self.anon.post(f"{BASE}token/{token}/accept/", {**GOOD, **overrides}, format="multipart")

    def test_create_requires_admin(self) -> None:
        c = self._client()
        c.force_authenticate(user=self.admin, token={"role": "CONSULTANT"})
        assert c.post(BASE, {"role": "CONSULTANT"}, format="json").status_code == 403

    def test_create_and_list_pending(self) -> None:
        token = self._token()
        assert token
        res = self.client.get(BASE)
        assert res.status_code == 200
        assert len(res.data) == 1 and res.data[0]["role"] == "CONSULTANT"

    def test_revoke_makes_token_410(self) -> None:
        token = self._token()
        invite = Invite.find(token)
        assert self.client.delete(f"{BASE}{invite.pk}/").status_code == 204
        assert self.anon.get(f"{BASE}token/{token}/").status_code == 410
        assert self.client.get(BASE).data == []

    def test_get_token_ok_and_expired_410(self) -> None:
        token = self._token()
        res = self.anon.get(f"{BASE}token/{token}/")
        assert res.status_code == 200 and "role_display" in res.data
        Invite.objects.filter(pk=Invite.find(token).pk).update(expires_at=timezone.now())
        assert self.anon.get(f"{BASE}token/{token}/").status_code == 410
        assert self.anon.get(f"{BASE}token/nao-existe/").status_code == 410

    def test_accept_creates_user_employee_and_login_works(self) -> None:
        token = self._token("CONSULTANT")
        res = self._accept(token)
        assert res.status_code == 201, res.data
        user = GlobalUser.objects.get(email_hash=hashlib.sha256(b"novo@teste.com").hexdigest())
        assert user.role == "CONSULTANT"
        assert user.check_password("Oficina#2026x")
        assert not user.check_password("52998224725")
        emp = Employee.objects.get(user=user)
        assert emp.department == "administrative" and emp.role == "CONSULTANT"
        assert emp.cpf_hash == hashlib.sha256(b"52998224725").hexdigest()
        assert not Invite.find(token).is_usable
        login = self.anon.post(
            "/api/v1/auth/login/", {"email": "novo@teste.com", "password": "Oficina#2026x"}, format="json"
        )
        assert login.status_code == 200, login.data

    def test_accept_twice_returns_410(self) -> None:
        token = self._token()
        assert self._accept(token).status_code == 201
        assert self._accept(token, email="outro@teste.com", cpf="111.444.777-35").status_code == 410

    def test_accept_existing_email_400_and_invite_still_usable(self) -> None:
        token = self._token()
        res = self._accept(token, email="ADMIN@test.com")
        assert res.status_code == 400 and "email" in res.data
        assert Invite.find(token).is_usable

    def test_accept_invalid_cpf_400(self) -> None:
        token = self._token()
        res = self._accept(token, cpf="123.456.789-00")
        assert res.status_code == 400 and "cpf" in res.data
        assert Invite.find(token).is_usable

    def test_accept_weak_password_400(self) -> None:
        res = self._accept(self._token(), password="123")
        assert res.status_code == 400 and "password" in res.data

    def test_accept_with_cnh_creates_document(self) -> None:
        cnh = SimpleUploadedFile("cnh.pdf", b"%PDF-1.4", content_type="application/pdf")
        res = self._accept(self._token(), cnh=cnh)
        assert res.status_code == 201, res.data
        doc = EmployeeDocument.objects.get(document_type="cnh")
        assert doc.file_key.startswith(f"hr/employees/{doc.employee_id}/cnh/")
        assert doc.mime_type == "application/pdf" and doc.file_size == 8

    def test_cnh_wrong_type_or_too_big_400(self) -> None:
        txt = SimpleUploadedFile("cnh.txt", b"x", content_type="text/plain")
        assert self._accept(self._token(), cnh=txt).status_code == 400
        big = SimpleUploadedFile("cnh.pdf", b"0" * (10 * 1024 * 1024 + 1), content_type="application/pdf")
        res = self._accept(self._token(), cnh=big)
        assert res.status_code == 400 and "cnh" in res.data

    def test_storage_failure_rolls_back(self) -> None:
        token = self._token()
        cnh = SimpleUploadedFile("cnh.pdf", b"%PDF-1.4", content_type="application/pdf")
        before = GlobalUser.objects.count()
        with patch("apps.authentication.invites.default_storage.save", side_effect=OSError):
            res = self._accept(token, cnh=cnh)
        assert res.status_code == 503
        assert GlobalUser.objects.count() == before
        assert Invite.find(token).is_usable
