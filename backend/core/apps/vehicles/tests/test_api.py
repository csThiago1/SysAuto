"""API tests para vehicles endpoints."""

import hashlib

from django.db import connection
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.vehicle_catalog.tests.factories import make_catalog
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
        family = make_catalog().modelo.familia
        resp = self.client.post(
            "/api/v1/vehicles/",
            {"plate": "NEW0001", "family": family.id, "chassis": "9BWZZZ377VT004251"},
            format="json",
        )
        assert resp.status_code == 201, resp.data
        assert resp.data["plate"] == "NEW0001" and resp.data["family"] == family.id
        read = self.client.get(f"/api/v1/vehicles/{resp.data['id']}/")
        assert read.data["chassis"] == "9BWZZZ377VT004251"
        assert Vehicle.objects.get(pk=resp.data["id"]).chassis == "9BWZZZ377VT004251"

    def test_chassi_e_renavam_cifrados_no_banco(self) -> None:
        v = Vehicle.objects.create(
            plate="ENC0001", chassis="9BWZZZ377VT004251", renavam="12345678901"
        )
        # Raw SQL só neste teste: lê a coluna gravada sem o ORM decifrar.
        with connection.cursor() as cur:
            cur.execute("SELECT chassis, renavam FROM vehicles_vehicle WHERE id = %s", [v.pk])
            chassis, renavam = cur.fetchone()
        assert chassis and chassis != "9BWZZZ377VT004251"
        assert renavam and renavam != "12345678901"

    def test_create_vehicle_sem_familia_400(self) -> None:
        resp = self.client.post(
            "/api/v1/vehicles/",
            {"plate": "NEW0002", "description": "Honda Civic"},
            format="json",
        )
        assert resp.status_code == 400 and "family" in resp.data
