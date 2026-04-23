"""API tests para vehicles endpoints."""
import hashlib

from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.vehicles.models import Vehicle


def make_user(email: str, password: str = "pw") -> GlobalUser:
    """Cria GlobalUser com email_hash calculado."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email,
        password=password,
        email_hash=email_hash,
    )


class VehicleAPITestCase(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user("api@v.com")
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})

    def test_list_vehicles_returns_200(self) -> None:
        Vehicle.objects.create(plate="TST0001", description="Fiat Uno")
        resp = self.client.get("/api/v1/vehicles/")
        assert resp.status_code == 200
        assert "results" in resp.data

    def test_create_vehicle_as_manager(self) -> None:
        resp = self.client.post(
            "/api/v1/vehicles/",
            {"plate": "NEW0001", "description": "Honda Civic"},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["plate"] == "NEW0001"

    def test_lookup_plate_found_in_db(self) -> None:
        Vehicle.objects.create(plate="LOOK001", description="Ford Ka", is_active=True)
        resp = self.client.get("/api/v1/vehicles/lookup/?plate=LOOK001")
        assert resp.status_code == 200
        assert resp.data["plate"] == "LOOK001"
        assert resp.data["source"] == "db"

    @override_settings(APIPLACAS_TOKEN="", APIPLACAS_URL="")
    def test_lookup_plate_not_found_returns_404(self) -> None:
        """Sem token configurado → retorna 404 (lookup retorna None)."""
        resp = self.client.get("/api/v1/vehicles/lookup/?plate=NOTFOUND")
        assert resp.status_code == 404
