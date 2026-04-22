"""Integration tests do `ImportService.fetch_cilia_budget`.

Usa respx pra stub HTTP + fixtures reais de prod. Valida pipeline completo:
HTTP → parse → dedup → persist → eventos.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
import respx
from httpx import ConnectError, Response

from apps.imports.models import ImportAttempt
from apps.imports.services import ImportService
from apps.imports.sources.cilia_client import CiliaClient
from apps.service_orders.models import Insurer, ServiceOrder, ServiceOrderVersion


FIXTURES_DIR = Path(__file__).parent / "fixtures"

CILIA_URL = (
    "https://test.cilia.local/api/integration/insurer_budgets/"
    "by_casualty_number_and_budget_number"
)


def _load(name: str) -> dict:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


@pytest.fixture
def cilia_client(settings):
    settings.CILIA_AUTH_TOKEN = "test-token"
    settings.CILIA_BASE_URL = "https://test.cilia.local"
    return CiliaClient()


@pytest.fixture
def tokio_insurer(db):
    return Insurer.objects.get(code="tokio")


@pytest.mark.django_db
class TestImportFromCiliaSuccess:

    @respx.mock
    def test_creates_os_and_version_v2(self, cilia_client, tokio_insurer):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(CILIA_URL).mock(return_value=Response(200, json=v2))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="406571903",
            budget_number=1446508,
            version_number=2,
            client=cilia_client,
        )

        assert attempt.parsed_ok is True
        assert attempt.http_status == 200
        assert attempt.service_order is not None
        assert attempt.version_created is not None

        os = attempt.service_order
        assert os.customer_type == "SEGURADORA"
        assert os.casualty_number == "406571903"
        assert os.insurer == tokio_insurer
        assert os.vehicle_plate == "TAF8E63"

        v = attempt.version_created
        assert v.external_version == "1446508.2"
        assert v.external_budget_id == 17732641
        assert v.external_version_id == 30629056
        assert v.external_flow_number == 2
        assert v.items.count() == 3  # 2 peças + 1 serviço manual

    @respx.mock
    def test_preserves_raw_payload_and_reports(self, cilia_client, tokio_insurer):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(CILIA_URL).mock(return_value=Response(200, json=v2))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )

        v = attempt.version_created
        assert v.raw_payload is not None
        assert v.raw_payload["budget_version_id"] == 30629056
        assert v.report_pdf_base64 != ""
        assert v.report_html_base64 != ""

    @respx.mock
    def test_creates_parecer_from_conclusion(self, cilia_client, tokio_insurer):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(CILIA_URL).mock(return_value=Response(200, json=v2))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )

        pareceres = attempt.service_order.pareceres.all()
        assert pareceres.count() == 1
        p = pareceres.first()
        assert p.source == "cilia"
        assert p.parecer_type == "AUTORIZADO"
        assert p.flow_number == 2

    @respx.mock
    def test_emits_events(self, cilia_client, tokio_insurer):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(CILIA_URL).mock(return_value=Response(200, json=v2))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )

        events = attempt.service_order.events.all()
        assert events.filter(event_type="VERSION_CREATED").exists()
        assert events.filter(event_type="IMPORT_RECEIVED").exists()

    @respx.mock
    def test_second_call_with_same_version_dedup(self, cilia_client, tokio_insurer):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(CILIA_URL).mock(return_value=Response(200, json=v2))

        a1 = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )
        a2 = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )

        assert a1.parsed_ok is True
        assert a2.parsed_ok is False
        assert a2.duplicate_of == a1
        assert a2.error_type == "Duplicate"
        assert ServiceOrderVersion.objects.filter(
            external_version_id=30629056,
        ).count() == 1  # não duplicou no banco

    @respx.mock
    def test_v1_then_v2_creates_two_versions(self, cilia_client, tokio_insurer):
        v1 = _load("cilia_1446508_v1.json")
        v2 = _load("cilia_1446508_v2.json")

        respx.get(CILIA_URL).mock(side_effect=[
            Response(200, json=v1),
            Response(200, json=v2),
        ])

        a1 = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=1,
            client=cilia_client,
        )
        a2 = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )

        assert a1.service_order == a2.service_order  # mesma OS reutilizada
        assert a1.version_created.version_number == 1
        assert a2.version_created.version_number == 2
        assert a1.version_created.pk != a2.version_created.pk
        assert a1.version_created.external_flow_number == 1
        assert a2.version_created.external_flow_number == 2


@pytest.mark.django_db
class TestImportFromCiliaErrors:

    @respx.mock
    def test_404_version_not_found(self, cilia_client, tokio_insurer):
        respx.get(CILIA_URL).mock(
            return_value=Response(404, json={"error": "Versão não encontrada"}),
        )

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="X", budget_number=1, version_number=999,
            client=cilia_client,
        )

        assert attempt.parsed_ok is False
        assert attempt.http_status == 404
        assert attempt.error_type == "NotFound"
        assert attempt.service_order is None
        assert attempt.version_created is None

    @respx.mock
    def test_401_auth_error(self, cilia_client, tokio_insurer):
        respx.get(CILIA_URL).mock(
            return_value=Response(401, json={"error": "token inválido"}),
        )

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="X", budget_number=1, client=cilia_client,
        )

        assert attempt.parsed_ok is False
        assert attempt.error_type == "AuthError"

    @respx.mock
    def test_network_error(self, cilia_client, tokio_insurer):
        respx.get(CILIA_URL).mock(side_effect=ConnectError("connection refused"))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="X", budget_number=1, client=cilia_client,
        )

        assert attempt.parsed_ok is False
        assert attempt.error_type == "NetworkError"
        assert attempt.http_status is None

    @respx.mock
    def test_insurer_not_in_catalog_fails(self, cilia_client, db):
        """Se trade Cilia não bate com nenhum código no catálogo → PersistError.

        Insurer tokio é seedado, mas injetamos um payload onde o trade é
        'Desconhecida' pra forçar insurer_code="" e falha no lookup.
        """
        # Altera o trade no payload pra um valor não-mapeado
        v2 = _load("cilia_1446508_v2.json")
        v2["insurer"]["trade"] = "Seguradora Desconhecida SA"
        respx.get(CILIA_URL).mock(return_value=Response(200, json=v2))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="X-ORFA", budget_number=1, version_number=2,
            client=cilia_client,
        )

        assert attempt.parsed_ok is False
        assert attempt.error_type == "PersistError"
        assert "Insurer" in attempt.error_message or "catálogo" in attempt.error_message
