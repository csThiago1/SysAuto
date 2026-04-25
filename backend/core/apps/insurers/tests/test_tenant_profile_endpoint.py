from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient
from apps.authentication.models import GlobalUser
from apps.insurers.models import Insurer, InsurerTenantProfile


class TestInsurerTenantProfileEndpoint(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="admin@test.com", name="Admin", password="test"
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user)
        self.insurer = Insurer.objects.create(
            name="Porto Seguro", cnpj="61198164000160"
        )

    def test_get_profile_sem_dados_retorna_defaults(self):
        response = self.client.get(f"/api/v1/insurers/{self.insurer.id}/tenant_profile/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.data}"
        assert response.data["sla_dias_uteis"] is None
        assert response.data["contact_sinistro_nome"] == ""

    def test_put_cria_profile(self):
        payload = {
            "contact_sinistro_nome": "Ana Sinistros",
            "contact_sinistro_phone": "(92) 99999-0000",
            "sla_dias_uteis": 3,
        }
        response = self.client.put(
            f"/api/v1/insurers/{self.insurer.id}/tenant_profile/",
            payload, format="json"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.data}"
        profile = InsurerTenantProfile.objects.get(insurer=self.insurer)
        assert profile.sla_dias_uteis == 3

    def test_put_atualiza_profile_existente(self):
        InsurerTenantProfile.objects.create(insurer=self.insurer, sla_dias_uteis=5)
        payload = {"sla_dias_uteis": 10}
        self.client.put(
            f"/api/v1/insurers/{self.insurer.id}/tenant_profile/",
            payload, format="json"
        )
        profile = InsurerTenantProfile.objects.get(insurer=self.insurer)
        assert profile.sla_dias_uteis == 10
