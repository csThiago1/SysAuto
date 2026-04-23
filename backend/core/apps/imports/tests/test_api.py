"""API tests para imports endpoints."""
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.imports.models import ImportAttempt


class ImportAPITest(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(email="imp@x.com", password="pw")
        self.client = APIClient()
        self.client.defaults["HTTP_X_TENANT_DOMAIN"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "MANAGER"})

    def test_list_attempts_returns_200(self) -> None:
        ImportAttempt.objects.create(source="cilia", trigger="polling")
        resp = self.client.get("/api/v1/imports/attempts/")
        assert resp.status_code == 200
        assert len(resp.data["results"]) == 1

    def test_list_attempts_as_consultant(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "CONSULTANT"})
        resp = self.client.get("/api/v1/imports/attempts/")
        assert resp.status_code == 200

    def test_filter_attempts_by_source(self) -> None:
        ImportAttempt.objects.create(source="cilia", trigger="polling")
        ImportAttempt.objects.create(source="xml_porto", trigger="upload_manual")
        resp = self.client.get("/api/v1/imports/attempts/?source=cilia")
        assert resp.status_code == 200
        assert len(resp.data["results"]) == 1
        assert resp.data["results"][0]["source"] == "cilia"

    def test_fetch_cilia_as_consultant_forbidden(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "CONSULTANT"})
        resp = self.client.post(
            "/api/v1/imports/attempts/cilia/fetch/",
            {"casualty_number": "SIN-001", "budget_number": "ORC-001"},
            format="json",
        )
        assert resp.status_code == 403
