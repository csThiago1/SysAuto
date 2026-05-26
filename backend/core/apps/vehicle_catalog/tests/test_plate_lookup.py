"""Tests for vehicle_catalog plate lookup endpoint."""
import hashlib

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.vehicle_catalog.models import PlateCache, VehicleMake, VehicleModel, VehicleYearVersion
from apps.vehicles.models import Vehicle


def make_user(email: str) -> GlobalUser:
    """Create a test user with the required LGPD hash."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(email=email, password="pw", email_hash=email_hash)


class PlateLookupEndpointTestCase(TenantTestCase):
    """Endpoint tests for DB-first and cache responses."""

    def setUp(self) -> None:
        super().setUp()
        self.user = make_user("plate@dscar.com")
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})

    def test_cache_hit_preserves_provider_metadata(self) -> None:
        """Cache hit returns fipe, restriction and logo metadata from raw response."""
        PlateCache.objects.create(
            plate="CCH1D23",
            make="Volkswagen",
            model="Gol",
            version="Comfortline",
            engine="1.6",
            year=2020,
            color="Branca",
            fuel_type="Flex",
            raw_response={
                "MARCA": "VW",
                "MODELO": "GOL 1.6 FLEX",
                "anoModelo": 2020,
                "cor": "BRANCA",
                "situacao": "Sem restrição",
                "codigoSituacao": 0,
                "logo": "https://example.test/vw.png",
                "fipe": {
                    "dados": [
                        {
                            "texto_marca": "VW - Volkswagen",
                            "texto_valor": "R$ 35.000,00",
                        },
                    ],
                },
            },
        )

        response = self.client.get("/api/v1/vehicle-catalog/plate/CCH1D23/")

        assert response.status_code == 200
        assert response.data["cached"] is True
        assert response.data["source"] == "cache"
        assert response.data["fipe_value"] == 35000.0
        assert response.data["situation"] == "Sem restrição"
        assert response.data["situation_code"] == 0
        assert response.data["make_logo"] == "https://example.test/vw.png"

    def test_existing_vehicle_with_fipe_version_uses_description(self) -> None:
        """DB-first response uses VehicleYearVersion.descricao as version label."""
        make = VehicleMake.objects.create(fipe_id="59", nome="Honda", nome_normalizado="honda")
        model = VehicleModel.objects.create(
            marca=make,
            fipe_id="1",
            nome="Civic",
            nome_normalizado="civic",
        )
        version = VehicleYearVersion.objects.create(
            modelo=model,
            fipe_id="2020-1",
            ano=2020,
            combustivel="flex",
            descricao="EXL 2.0 Flex",
            codigo_fipe="001234-5",
        )
        Vehicle.objects.create(
            plate="DBV1D23",
            version=version,
            color="Prata",
            year_manufacture=2020,
        )

        response = self.client.get("/api/v1/vehicle-catalog/plate/DBV1D23/")

        assert response.status_code == 200
        assert response.data["source"] == "db"
        assert response.data["make"] == "Honda"
        assert response.data["model"] == "Civic"
        assert response.data["version"] == "EXL 2.0 Flex"
