"""API tests para authz endpoints."""
import hashlib

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.authz.models import Permission, Role, UserRole


def make_user(email: str, password: str = "pw") -> GlobalUser:
    """Cria GlobalUser com email_hash calculado."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email,
        password=password,
        email_hash=email_hash,
    )


class AuthzAPITestCase(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user("api@x.com")
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        # token dict simula JWT claims — role ADMIN permite escrita
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})

    def test_list_permissions_returns_200(self) -> None:
        resp = self.client.get("/api/v1/authz/permissions/")
        assert resp.status_code == 200
        assert "results" in resp.data

    def test_list_roles_returns_200(self) -> None:
        resp = self.client.get("/api/v1/authz/roles/")
        assert resp.status_code == 200
        assert "results" in resp.data

    def test_create_user_role_as_admin(self) -> None:
        role = Role.objects.get_or_create(code="CONSULTANT", defaults={"label": "Consultor"})[0]
        user2 = make_user("u2@x.com")
        resp = self.client.post("/api/v1/authz/user-roles/", {"user": user2.id, "role": role.id}, format="json")
        assert resp.status_code == 201

    def test_create_user_role_as_consultant_forbidden(self) -> None:
        # CONSULTANT role is below ADMIN — write to user-roles/ must return 403
        low_priv_user = make_user("storekeeper@x.com")
        low_client = APIClient()
        low_client.defaults["SERVER_NAME"] = self.domain.domain
        low_client.defaults["HTTP_HOST"] = self.domain.domain
        # Sem role no token → _get_role → CONSULTANT < ADMIN → 403
        low_client.force_authenticate(user=low_priv_user, token={"role": "CONSULTANT"})
        role = Role.objects.get_or_create(code="MECHANIC", defaults={"label": "Mecânico"})[0]
        resp = low_client.post("/api/v1/authz/user-roles/", {"user": low_priv_user.id, "role": role.id}, format="json")
        assert resp.status_code == 403

    def test_create_user_permission_as_admin(self) -> None:
        perm = Permission.objects.get_or_create(code="os.cancel", defaults={"label": "Cancelar", "module": "os"})[0]
        resp = self.client.post(
            "/api/v1/authz/user-permissions/",
            {"user": self.user.id, "permission": perm.id, "granted": True},
            format="json",
        )
        assert resp.status_code == 201
