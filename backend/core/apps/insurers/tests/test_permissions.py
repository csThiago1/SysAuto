"""Seguradora: leitura para todos, escrita só ADMIN+, sem DELETE e lista sem cache envenenado."""

import hashlib

from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.insurers.models import Insurer

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
URL = "/api/v1/insurers/"


class InsurerPermissionsTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_settings(CACHES=LOCMEM))
        self.porto = Insurer.objects.get(code="porto")
        self.detail = f"{URL}{self.porto.pk}/"

    def client_as(self, role: str) -> APIClient:
        email = f"{role.lower()}@dscar.com"
        user = GlobalUser.objects.create_user(
            email=email, email_hash=hashlib.sha256(email.encode()).hexdigest(), password="x"
        )
        client = APIClient()
        client.defaults["SERVER_NAME"] = client.defaults["HTTP_HOST"] = self.domain.domain
        client.force_authenticate(user=user, token={"role": role})
        return client

    @staticmethod
    def ids(response: object) -> set[str]:
        data = response.data  # type: ignore[attr-defined]
        rows = data["results"] if isinstance(data, dict) else data
        return {str(r["id"]) for r in rows}

    def test_manager_nao_cria_nem_edita(self) -> None:
        client = self.client_as("MANAGER")
        created = client.post(URL, {"name": "Nova Seg", "cnpj": "33000167000101"}, format="json")
        assert created.status_code == 403
        assert not Insurer.objects.filter(name="Nova Seg").exists()
        patched = client.patch(self.detail, {"is_active": False}, format="json")
        assert patched.status_code == 403
        self.porto.refresh_from_db()
        assert self.porto.is_active is True

    def test_admin_desativa(self) -> None:
        r = self.client_as("ADMIN").patch(self.detail, {"is_active": False}, format="json")
        assert r.status_code == 200, r.data
        self.porto.refresh_from_db()
        assert self.porto.is_active is False

    def test_delete_nao_existe(self) -> None:
        r = self.client_as("OWNER").delete(self.detail)
        assert r.status_code == 405
        assert Insurer.objects.filter(pk=self.porto.pk).exists()

    def test_include_inactive_so_para_admin(self) -> None:
        Insurer.objects.filter(pk=self.porto.pk).update(is_active=False)
        consultant = self.client_as("CONSULTANT").get(URL, {"include_inactive": "true"})
        assert consultant.status_code == 200
        assert str(self.porto.pk) not in self.ids(consultant)
        admin = self.client_as("ADMIN").get(URL, {"include_inactive": "true"})
        assert admin.status_code == 200
        assert str(self.porto.pk) in self.ids(admin)

    def test_busca_nao_envenena_lista_sem_busca(self) -> None:
        client = self.client_as("CONSULTANT")
        busca = client.get(URL, {"search": "porto"})
        assert self.ids(busca) == {str(self.porto.pk)}
        todas = client.get(URL)
        assert len(self.ids(todas)) == Insurer.objects.filter(is_active=True).count() > 1
