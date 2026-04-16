"""
Paddock Solutions — Vehicle Catalog Tests: FIPE Sync Tasks

Testa as tasks Celery de sincronização com a API FIPE.
Usa unittest.mock para isolar httpx — sem chamadas reais à rede.
"""
import logging
from unittest.mock import MagicMock, patch

import httpx
from django.test import TestCase

from apps.vehicle_catalog.models import VehicleMake, VehicleModel

logger = logging.getLogger(__name__)


class TestTaskSyncFipeMakes(TestCase):
    """Testa task_sync_fipe_makes — sincronização de marcas."""

    @patch("apps.vehicle_catalog.tasks.httpx.Client")
    def test_sync_fipe_makes_cria_vehicle_make(
        self, mock_httpx_client_cls: MagicMock
    ) -> None:
        """Mock httpx: verifica que cria VehicleMake com nome_normalizado."""
        from apps.vehicle_catalog.tasks import task_sync_fipe_makes

        # Monta o mock do contexto httpx.Client
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = [
            {"code": "59", "name": "Honda"},
            {"code": "22", "name": "Volkswagen"},
        ]
        mock_client_instance = MagicMock()
        mock_client_instance.get.return_value = mock_response
        mock_httpx_client_cls.return_value.__enter__.return_value = (
            mock_client_instance
        )

        # Remove registros anteriores para garantir estado limpo
        VehicleMake.objects.filter(fipe_id__in=["59", "22"]).delete()

        # Chama a task diretamente (sem Celery broker)
        result = task_sync_fipe_makes.run()

        self.assertIn("created", result)
        self.assertEqual(result["created"], 2)

        # Verifica que os registros foram criados com nome_normalizado
        honda = VehicleMake.objects.get(fipe_id="59")
        self.assertEqual(honda.nome, "Honda")
        self.assertIsNotNone(honda.nome_normalizado)
        self.assertEqual(honda.nome_normalizado, "honda")

        vw = VehicleMake.objects.get(fipe_id="22")
        self.assertEqual(vw.nome, "Volkswagen")
        self.assertEqual(vw.nome_normalizado, "volkswagen")

    @patch("apps.vehicle_catalog.tasks.httpx.Client")
    def test_sync_fipe_makes_atualiza_registro_existente(
        self, mock_httpx_client_cls: MagicMock
    ) -> None:
        """Update_or_create: marca existente é atualizada (não duplicada)."""
        from apps.vehicle_catalog.tasks import task_sync_fipe_makes

        # Cria registro existente
        VehicleMake.objects.update_or_create(
            fipe_id="59",
            defaults={"nome": "Honda Antigo", "nome_normalizado": "honda antigo"},
        )

        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = [
            {"code": "59", "name": "Honda"},
        ]
        mock_client_instance = MagicMock()
        mock_client_instance.get.return_value = mock_response
        mock_httpx_client_cls.return_value.__enter__.return_value = (
            mock_client_instance
        )

        result = task_sync_fipe_makes.run()

        # Atualizado, não criado
        self.assertEqual(result["updated"], 1)
        self.assertEqual(result["created"], 0)

        # Nome atualizado
        honda = VehicleMake.objects.get(fipe_id="59")
        self.assertEqual(honda.nome, "Honda")

    @patch("apps.vehicle_catalog.tasks.httpx.Client")
    def test_sync_fipe_makes_ignora_entradas_sem_code_ou_nome(
        self, mock_httpx_client_cls: MagicMock
    ) -> None:
        """Entradas sem 'code' ou sem 'name' devem ser ignoradas."""
        from apps.vehicle_catalog.tasks import task_sync_fipe_makes

        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = [
            {"code": "", "name": "Sem Code"},
            {"code": "99", "name": ""},
            {"name": "Sem Code Key"},
        ]
        mock_client_instance = MagicMock()
        mock_client_instance.get.return_value = mock_response
        mock_httpx_client_cls.return_value.__enter__.return_value = (
            mock_client_instance
        )

        result = task_sync_fipe_makes.run()

        self.assertEqual(result["created"], 0)
        self.assertEqual(result["updated"], 0)

    @patch("apps.vehicle_catalog.tasks.httpx.Client")
    def test_sync_fipe_makes_retry_em_erro_http(
        self, mock_httpx_client_cls: MagicMock
    ) -> None:
        """httpx.HTTPError deve disparar self.retry na task."""
        from apps.vehicle_catalog.tasks import task_sync_fipe_makes

        mock_client_instance = MagicMock()
        mock_client_instance.get.side_effect = httpx.RequestError(
            "Connection refused"
        )
        mock_httpx_client_cls.return_value.__enter__.return_value = (
            mock_client_instance
        )

        # Simula o contexto de execução Celery com self.retry mockado
        task_instance = task_sync_fipe_makes
        mock_retry = MagicMock(side_effect=Exception("retry called"))

        with patch.object(task_instance, "retry", mock_retry):
            with self.assertRaises(Exception) as ctx:
                task_instance.run()

        self.assertIn("retry called", str(ctx.exception))
        mock_retry.assert_called_once()

    @patch("apps.vehicle_catalog.tasks.httpx.Client")
    def test_sync_fipe_makes_retry_em_http_status_error(
        self, mock_httpx_client_cls: MagicMock
    ) -> None:
        """raise_for_status com 5xx deve disparar self.retry."""
        from apps.vehicle_catalog.tasks import task_sync_fipe_makes

        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500 Internal Server Error",
            request=MagicMock(),
            response=MagicMock(),
        )
        mock_client_instance = MagicMock()
        mock_client_instance.get.return_value = mock_response
        mock_httpx_client_cls.return_value.__enter__.return_value = (
            mock_client_instance
        )

        task_instance = task_sync_fipe_makes
        mock_retry = MagicMock(side_effect=Exception("retry called"))

        with patch.object(task_instance, "retry", mock_retry):
            with self.assertRaises(Exception) as ctx:
                task_instance.run()

        self.assertIn("retry called", str(ctx.exception))
        mock_retry.assert_called_once()


class TestTaskSyncFipeModels(TestCase):
    """Testa task_sync_fipe_models — sincronização de modelos por marca."""

    def setUp(self) -> None:
        super().setUp()
        # Cria marca base para os testes de modelos
        self.honda, _ = VehicleMake.objects.update_or_create(
            fipe_id="59",
            defaults={"nome": "Honda", "nome_normalizado": "honda"},
        )

    @patch("apps.vehicle_catalog.tasks.httpx.Client")
    def test_sync_fipe_models_cria_vehicle_model(
        self, mock_httpx_client_cls: MagicMock
    ) -> None:
        """Sincroniza modelos de uma marca e cria VehicleModel com nome_normalizado."""
        from apps.vehicle_catalog.tasks import task_sync_fipe_models

        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "models": [
                {"code": "1", "name": "Civic"},
                {"code": "2", "name": "Fit"},
            ]
        }
        mock_client_instance = MagicMock()
        mock_client_instance.get.return_value = mock_response
        mock_httpx_client_cls.return_value.__enter__.return_value = (
            mock_client_instance
        )

        # Remove modelos anteriores para estado limpo
        VehicleModel.objects.filter(marca=self.honda).delete()

        result = task_sync_fipe_models.run(make_fipe_id="59")

        self.assertEqual(result["created"], 2)
        self.assertTrue(
            VehicleModel.objects.filter(marca=self.honda, fipe_id="1").exists()
        )
        civic = VehicleModel.objects.get(marca=self.honda, fipe_id="1")
        self.assertEqual(civic.nome, "Civic")
        self.assertEqual(civic.nome_normalizado, "civic")

    @patch("apps.vehicle_catalog.tasks.httpx.Client")
    def test_sync_fipe_models_marca_inexistente_retorna_zero(
        self, mock_httpx_client_cls: MagicMock
    ) -> None:
        """Marca não encontrada no DB → retorna zero sem chamar httpx."""
        from apps.vehicle_catalog.tasks import task_sync_fipe_models

        result = task_sync_fipe_models.run(make_fipe_id="999999")

        self.assertEqual(result["created"], 0)
        self.assertEqual(result["updated"], 0)
        mock_httpx_client_cls.assert_not_called()

    @patch("apps.vehicle_catalog.tasks.httpx.Client")
    def test_sync_fipe_models_retry_em_erro_http(
        self, mock_httpx_client_cls: MagicMock
    ) -> None:
        """httpx.HTTPError deve disparar self.retry."""
        from apps.vehicle_catalog.tasks import task_sync_fipe_models

        mock_client_instance = MagicMock()
        mock_client_instance.get.side_effect = httpx.RequestError("timeout")
        mock_httpx_client_cls.return_value.__enter__.return_value = (
            mock_client_instance
        )

        task_instance = task_sync_fipe_models
        mock_retry = MagicMock(side_effect=Exception("retry called"))

        with patch.object(task_instance, "retry", mock_retry):
            with self.assertRaises(Exception) as ctx:
                task_instance.run(make_fipe_id="59")

        self.assertIn("retry called", str(ctx.exception))
        mock_retry.assert_called_once()
