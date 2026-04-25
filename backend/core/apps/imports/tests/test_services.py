"""Testes para ImportService (via apps.imports)."""
import sys
import types
from unittest.mock import MagicMock, patch

from django_tenants.test.cases import TenantTestCase

# ImportService é re-exportado de apps.cilia.dtos
from apps.imports.services import ImportService

# A implementação real usa apps.cilia.models.ImportAttempt internamente
from apps.cilia.models import ImportAttempt as CiliaImportAttempt
from apps.cilia.client import CiliaClient, CiliaError


def _make_cilia_client_module() -> types.ModuleType:
    """Cria um módulo falso que expõe CiliaClient e CiliaError."""
    mod = types.ModuleType("apps.cilia.sources.cilia_client")
    mod.CiliaClient = CiliaClient  # type: ignore[attr-defined]
    mod.CiliaError = CiliaError    # type: ignore[attr-defined]
    return mod


class FetchCiliaBudgetTest(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        # Injeta o módulo falso antes de qualquer chamada ao ImportService
        # pois dtos.py faz: from .sources.cilia_client import CiliaClient, CiliaError
        sys.modules.setdefault(
            "apps.cilia.sources.cilia_client", _make_cilia_client_module()
        )

    def test_fetch_creates_attempt_with_parsed_ok_true(self) -> None:
        from apps.service_orders.models import ServiceOrder, ServiceOrderVersion
        from apps.imports.models import ImportAttempt as ImportsImportAttempt
        import apps.cilia.models as cilia_models

        mock_parsed = MagicMock()
        mock_parsed.raw_hash = "abc123_unique_test1"
        mock_parsed.casualty_number = "SIN-001"
        mock_parsed.external_budget_number = "ORC-001"
        mock_parsed.insurer_code = ""
        mock_parsed.external_version_id = None
        mock_parsed.segurado_name = "José"
        mock_parsed.segurado_phone = ""
        mock_parsed.vehicle_plate = "TST0001"
        mock_parsed.vehicle_description = "Honda Civic"
        mock_parsed.franchise_amount = 0
        mock_parsed.items = []
        mock_parsed.pareceres = []
        mock_parsed.raw_payload = {}
        mock_parsed.source = "cilia"
        mock_parsed.external_version = ""
        mock_parsed.external_numero_vistoria = ""
        mock_parsed.external_integration_id = ""
        mock_parsed.external_status = "analisado"
        mock_parsed.hourly_rates = {}
        mock_parsed.global_discount_pct = 0

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.data = {"dummy": True}
        mock_response.duration_ms = 100

        mock_client_instance = MagicMock()
        mock_client_instance.get_budget.return_value = mock_response

        # _persist_cilia_budget precisa retornar instâncias reais de Django
        # porque fetch_cilia_budget faz: attempt.service_order = os_instance
        real_os = ServiceOrder.objects.create(
            number=9001,
            customer_name="Test Customer",
            plate="TST0099",
        )

        # ServiceOrderVersion precisa de OS e version_number
        real_version = ServiceOrderVersion.objects.create(
            service_order=real_os,
            version_number=1,
        )

        # dtos.py usa cilia.ImportAttempt que não tem version_created.
        # Substituímos temporariamente pelo imports.ImportAttempt que tem.
        original_cilia_attempt = cilia_models.ImportAttempt
        try:
            cilia_models.ImportAttempt = ImportsImportAttempt  # type: ignore[attr-defined]
            with patch("apps.cilia.sources.cilia_client.CiliaClient", return_value=mock_client_instance), \
                 patch("apps.cilia.sources.cilia_parser.CiliaParser") as MockParser, \
                 patch.object(ImportService, "_persist_cilia_budget", return_value=(real_os, real_version)):
                MockParser.parse.return_value = mock_parsed

                attempt = ImportService.fetch_cilia_budget(
                    casualty_number="SIN-001",
                    budget_number="ORC-001",
                    version_number=1,
                )
        finally:
            cilia_models.ImportAttempt = original_cilia_attempt  # type: ignore[attr-defined]

        assert attempt.parsed_ok is True

    def test_network_error_creates_attempt_with_parsed_ok_false(self) -> None:
        mock_client_instance = MagicMock()
        mock_client_instance.get_budget.side_effect = CiliaError("timeout")

        with patch("apps.cilia.sources.cilia_client.CiliaClient", return_value=mock_client_instance):
            attempt = ImportService.fetch_cilia_budget(
                casualty_number="SIN-002",
                budget_number="ORC-002",
            )

        assert attempt.parsed_ok is False
        assert attempt.error_type == "NetworkError"
        assert "timeout" in attempt.error_message

    def test_duplicate_hash_sets_duplicate_of(self) -> None:
        # A implementação usa apps.cilia.models.ImportAttempt para dedup
        original = CiliaImportAttempt.objects.create(
            source="cilia",
            trigger="user_requested",
            parsed_ok=True,
            raw_hash="duphash123",
        )

        mock_parsed = MagicMock()
        mock_parsed.raw_hash = "duphash123"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.data = {}
        mock_response.duration_ms = 50

        mock_client_instance = MagicMock()
        mock_client_instance.get_budget.return_value = mock_response

        with patch("apps.cilia.sources.cilia_client.CiliaClient", return_value=mock_client_instance), \
             patch("apps.cilia.sources.cilia_parser.CiliaParser") as MockParser:
            MockParser.parse.return_value = mock_parsed

            attempt = ImportService.fetch_cilia_budget(
                casualty_number="SIN-003",
                budget_number="ORC-003",
            )

        assert attempt.duplicate_of_id == original.pk
        assert attempt.parsed_ok is False
        assert attempt.error_type == "Duplicate"

    def test_os_without_casualty_number_skipped_by_poll_task(self) -> None:
        from apps.imports.tasks import poll_cilia_budget
        from apps.service_orders.models import ServiceOrder

        os_instance = ServiceOrder.objects.create(
            number=5001,
            customer_name="Sem Sinistro",
            plate="TST0002",
        )
        with patch("apps.imports.tasks.ImportService") as MockService:
            poll_cilia_budget(service_order_id=os_instance.pk)
        MockService.fetch_cilia_budget.assert_not_called()
