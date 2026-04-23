"""Testes para VehicleService.lookup_plate."""
from unittest.mock import MagicMock, patch

from django.test import override_settings
from django_tenants.test.cases import TenantTestCase

from apps.vehicles.models import Vehicle
from apps.vehicles.services import VehicleService


class LookupPlateTest(TenantTestCase):

    def test_plate_found_in_db_returns_immediately(self) -> None:
        """Placa existente na base → retorna sem chamar API."""
        Vehicle.objects.create(plate="ABC1D23", description="Fiat Uno", is_active=True)
        with patch("apps.vehicles.services.httpx.get") as mock_get:
            result = VehicleService.lookup_plate("ABC1D23")
        mock_get.assert_not_called()
        assert result is not None
        assert result["source"] == "db"
        assert result["plate"] == "ABC1D23"

    def test_plate_normalized_before_lookup(self) -> None:
        """Placa com hífen e minúscula → normalizada antes de buscar."""
        Vehicle.objects.create(plate="ABC1D23", description="Fiat Uno", is_active=True)
        with patch("apps.vehicles.services.httpx.get"):
            result = VehicleService.lookup_plate("abc-1d23")
        assert result is not None
        assert result["plate"] == "ABC1D23"

    @override_settings(
        APIPLACAS_TOKEN="test-token",
        APIPLACAS_URL="https://apiplacas.com.br/api/v1/placa",
    )
    def test_api_called_on_miss_persists_vehicle(self) -> None:
        """Placa não encontrada na base → chama API, persiste, retorna source='api'."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "placa": "XYZ9876",
            "marca": "TOYOTA",
            "modelo": "Corolla",
            "ano": "2022/2023",
            "cor": "Branco",
            "renavam": "12345678901",
            "chassi": "ABC123DEF456GHI78",
            "codigoFipe": "005004-4",
        }
        with patch("apps.vehicles.services.httpx.get", return_value=mock_response):
            result = VehicleService.lookup_plate("XYZ9876")
        assert result is not None
        assert result["source"] == "api"
        assert result["plate"] == "XYZ9876"
        assert Vehicle.objects.filter(plate="XYZ9876").exists()

    @override_settings(
        APIPLACAS_TOKEN="test-token",
        APIPLACAS_URL="https://apiplacas.com.br/api/v1/placa",
    )
    def test_api_failure_returns_none(self) -> None:
        """API externa falha → retorna None sem propagar exceção."""
        with patch("apps.vehicles.services.httpx.get", side_effect=Exception("timeout")):
            result = VehicleService.lookup_plate("ERR0001")
        assert result is None

    def test_existing_plate_not_duplicated(self) -> None:
        """Placa já na base não gera duplicata mesmo se API retornar dados."""
        Vehicle.objects.create(plate="DUP1234", description="Honda Civic", is_active=True)
        with patch("apps.vehicles.services.httpx.get") as mock_get:
            VehicleService.lookup_plate("DUP1234")
        mock_get.assert_not_called()
        assert Vehicle.objects.filter(plate="DUP1234").count() == 1
