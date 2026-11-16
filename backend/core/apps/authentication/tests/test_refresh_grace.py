"""Refresh com tolerância de rotação: renovações simultâneas com o mesmo token passam."""

import datetime
from unittest.mock import patch

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser, RefreshToken

LOGIN = "/api/v1/auth/login/"
REFRESH = "/api/v1/auth/refresh/"


class TestRefreshGrace(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        patcher = patch(
            "apps.authentication.views.AuthRateThrottle.allow_request",
            return_value=True,
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        GlobalUser.objects.create_user(email="ana@test.com", name="Ana", password="senha-forte-1")
        self.c = APIClient()
        self.c.defaults["SERVER_NAME"] = self.domain.domain
        self.c.defaults["HTTP_HOST"] = self.domain.domain

    def _refresh_inicial(self) -> str:
        r = self.c.post(LOGIN, {"email": "ana@test.com", "password": "senha-forte-1"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["refresh"]

    def test_mesmo_token_renova_duas_vezes_dentro_da_janela(self) -> None:
        rt = self._refresh_inicial()
        a = self.c.post(REFRESH, {"refresh_token": rt}, format="json")
        b = self.c.post(REFRESH, {"refresh_token": rt}, format="json")
        self.assertEqual(a.status_code, 200, a.content)
        self.assertEqual(b.status_code, 200, b.content)
        # o par novo continua renovando (sessão rolante)
        c = self.c.post(REFRESH, {"refresh_token": a.json()["refresh"]}, format="json")
        self.assertEqual(c.status_code, 200, c.content)

    def test_token_usado_expira_depois_da_janela(self) -> None:
        rt = self._refresh_inicial()
        self.assertEqual(self.c.post(REFRESH, {"refresh_token": rt}, format="json").status_code, 200)
        passado = datetime.datetime.now(tz=datetime.timezone.utc) - datetime.timedelta(seconds=1)
        RefreshToken.objects.filter(expires_at__lt=passado + datetime.timedelta(minutes=5)).update(
            expires_at=passado
        )
        self.assertEqual(self.c.post(REFRESH, {"refresh_token": rt}, format="json").status_code, 401)

    def test_revogado_no_logout_nao_renova(self) -> None:
        rt = self._refresh_inicial()
        RefreshToken.objects.update(is_revoked=True)
        self.assertEqual(self.c.post(REFRESH, {"refresh_token": rt}, format="json").status_code, 401)
