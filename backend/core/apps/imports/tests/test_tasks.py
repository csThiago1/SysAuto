"""Testes das Celery tasks do importador Cilia."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
import respx
from httpx import Response

from apps.imports.tasks import poll_cilia_budget, sync_active_cilia_os
from apps.persons.models import Person
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
def setup_cilia(settings):
    settings.CILIA_AUTH_TOKEN = "test"
    settings.CILIA_BASE_URL = "https://test.cilia.local"


@pytest.fixture
def os_seguradora(db):
    person = Person.objects.create(full_name="Poll Test", person_type="CLIENT")
    tokio = Insurer.objects.get(code="tokio")
    return ServiceOrder.objects.create(
        os_number="OS-POLL-1", customer=person, customer_type="SEGURADORA",
        insurer=tokio, casualty_number="406571903",
        external_budget_number="1446508",
        vehicle_plate="TAF8E63", vehicle_description="Sprinter",
        status="repair",
    )


@pytest.mark.django_db
class TestPollCiliaBudget:

    def test_skips_non_seguradora(self, db):
        person = Person.objects.create(full_name="x", person_type="CLIENT")
        os = ServiceOrder.objects.create(
            os_number="OS-POLL-SKIP-1", customer=person, customer_type="PARTICULAR",
            vehicle_plate="X", vehicle_description="y",
        )
        result = poll_cilia_budget(os.pk)
        assert result["action"] == "skipped"
        assert result["reason"] == "not_insurance"

    def test_skips_delivered_os(self, os_seguradora):
        os_seguradora.status = "delivered"
        os_seguradora.save()
        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "skipped"
        assert result["reason"] == "os_closed"

    def test_skips_missing_identifiers(self, os_seguradora):
        os_seguradora.casualty_number = ""
        os_seguradora.save()
        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "skipped"
        assert result["reason"] == "missing_cilia_identifiers"

    def test_skips_no_active_version(self, os_seguradora):
        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "skipped"
        assert result["reason"] == "no_active_version"

    def test_skips_when_cilia_status_refused(self, os_seguradora):
        ServiceOrderVersion.objects.create(
            service_order=os_seguradora, version_number=1,
            source="cilia", status="negado",
            external_version="1446508.1",
            raw_payload={"status": "refused"},
        )
        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "skipped"
        assert result["reason"].startswith("cilia_terminal:refused")

    def test_skips_when_cilia_status_finalized(self, os_seguradora):
        ServiceOrderVersion.objects.create(
            service_order=os_seguradora, version_number=1,
            source="cilia", status="autorizado",
            external_version="1446508.1",
            raw_payload={"status": "finalized"},
        )
        result = poll_cilia_budget(os_seguradora.pk)
        assert result["reason"].startswith("cilia_terminal:finalized")

    def test_returns_os_not_found_for_invalid_id(self, db):
        result = poll_cilia_budget(999999)
        assert result["action"] == "skipped"
        assert result["reason"] == "os_not_found"

    @respx.mock
    def test_404_returns_not_yet(self, setup_cilia, os_seguradora):
        ServiceOrderVersion.objects.create(
            service_order=os_seguradora, version_number=1,
            source="cilia", status="analisado",
            external_version="1446508.1",
            raw_payload={"status": "analyzed"},
        )
        respx.get(CILIA_URL).mock(return_value=Response(404, json={"error": "not found"}))

        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "not_yet"
        assert result["version_number"] == 2

    @respx.mock
    def test_200_creates_version(self, setup_cilia, os_seguradora):
        ServiceOrderVersion.objects.create(
            service_order=os_seguradora, version_number=1,
            source="cilia", status="analisado",
            external_version="1446508.1",
            raw_payload={"status": "analyzed"},
        )
        v2 = _load("cilia_1446508_v2.json")
        respx.get(CILIA_URL).mock(return_value=Response(200, json=v2))

        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "version_created"
        assert "version_created_id" in result


@pytest.mark.django_db
class TestSyncActiveCiliaOS:

    def test_schedules_only_eligible_os(self, db):
        tokio = Insurer.objects.get(code="tokio")
        person = Person.objects.create(full_name="x", person_type="CLIENT")

        # Elegível
        os1 = ServiceOrder.objects.create(
            os_number="OS-SYNC-1", customer=person, customer_type="SEGURADORA",
            insurer=tokio, casualty_number="111", external_budget_number="222",
            vehicle_plate="A", vehicle_description="x", status="repair",
        )
        # Inelegível — delivered
        ServiceOrder.objects.create(
            os_number="OS-SYNC-2", customer=person, customer_type="SEGURADORA",
            insurer=tokio, casualty_number="333", external_budget_number="444",
            vehicle_plate="B", vehicle_description="y", status="delivered",
        )
        # Inelegível — particular
        ServiceOrder.objects.create(
            os_number="OS-SYNC-3", customer=person, customer_type="PARTICULAR",
            vehicle_plate="C", vehicle_description="z",
        )
        # Inelegível — sem identifiers
        ServiceOrder.objects.create(
            os_number="OS-SYNC-4", customer=person, customer_type="SEGURADORA",
            insurer=tokio, casualty_number="", external_budget_number="",
            vehicle_plate="D", vehicle_description="w",
        )

        with patch("apps.imports.tasks.poll_cilia_budget.delay") as mock_delay:
            result = sync_active_cilia_os()

        assert result["scheduled"] == 1
        mock_delay.assert_called_once_with(os1.pk)

    def test_returns_zero_when_no_os(self, db):
        with patch("apps.imports.tasks.poll_cilia_budget.delay") as mock_delay:
            result = sync_active_cilia_os()
        assert result["scheduled"] == 0
        mock_delay.assert_not_called()
