"""Ticket assinado de curta duração para abrir o websocket."""

import hashlib
import time
from unittest import mock

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.realtime.tickets import make_ticket, read_ticket

URL = "/api/v1/realtime/ticket/"


def test_ticket_ida_e_volta() -> None:
    assert read_ticket(make_ticket("u1", "tenant_dscar")) == ("u1", "tenant_dscar")


def test_ticket_vencido() -> None:
    t = make_ticket("u1", "tenant_dscar")
    with mock.patch("django.core.signing.time.time", return_value=time.time() + 61):
        assert read_ticket(t) is None


def test_ticket_forjado() -> None:
    t = make_ticket("u1", "tenant_dscar")
    assert read_ticket("lixo") is None
    assert read_ticket(t[:-2] + "xx") is None


class TicketEndpointTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "rt@dscar.com"
        self.user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain

    def test_endpoint_devolve_ticket_do_tenant(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        r = self.client.get(URL)
        assert r.status_code == 200
        assert read_ticket(r.data["ticket"]) == (str(self.user.pk), self.tenant.schema_name)

    def test_endpoint_sem_login_401(self) -> None:
        assert self.client.get(URL).status_code == 401
