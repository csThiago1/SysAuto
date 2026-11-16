"""Convite de colaborador por link de uso único."""
import datetime

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser, Invite


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
