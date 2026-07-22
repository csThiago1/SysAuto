from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.banks.models import Bank


class TestBanksEndpoint(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        Bank.objects.create(code="001", name="Banco do Brasil")

    def test_list_any_authenticated_user(self):
        consultant = GlobalUser.objects.create_user(
            email="consultant@test.com", name="Consultor", password="test"
        )
        self.client.force_authenticate(user=consultant, token={"role": "CONSULTANT"})
        response = self.client.get("/api/v1/banks/")
        assert response.status_code == 200, response.data
        assert response.data["results"][0]["code"] == "001"

    def test_create_requires_manager(self):
        consultant = GlobalUser.objects.create_user(
            email="consultant2@test.com", name="Consultor", password="test"
        )
        self.client.force_authenticate(user=consultant, token={"role": "CONSULTANT"})
        response = self.client.post(
            "/api/v1/banks/", {"code": "237", "name": "Bradesco"}, format="json"
        )
        assert response.status_code == 403

    def test_create_as_manager(self):
        manager = GlobalUser.objects.create_user(
            email="manager@test.com", name="Gerente", password="test"
        )
        self.client.force_authenticate(user=manager, token={"role": "MANAGER"})
        response = self.client.post(
            "/api/v1/banks/", {"code": "237", "name": "Bradesco"}, format="json"
        )
        assert response.status_code == 201, response.data
        assert Bank.objects.filter(code="237").exists()
