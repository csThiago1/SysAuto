"""Tests dos endpoints REST do app imports."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
import respx
from django.contrib.auth import get_user_model
from httpx import Response
from rest_framework.test import APIClient

from apps.imports.models import ImportAttempt


FIXTURES_DIR = Path(__file__).parent / "fixtures"

CILIA_URL = (
    "https://test.cilia.local/api/integration/insurer_budgets/"
    "by_casualty_number_and_budget_number"
)


def _load(name: str) -> dict:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


User = get_user_model()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="import-api", password="s")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def setup_cilia(settings):
    settings.CILIA_AUTH_TOKEN = "test"
    settings.CILIA_BASE_URL = "https://test.cilia.local"


@pytest.mark.django_db
class TestFetchCiliaEndpoint:

    @respx.mock
    def test_fetch_v2_creates_attempt_and_os(self, auth_client, setup_cilia):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(CILIA_URL).mock(return_value=Response(200, json=v2))

        resp = auth_client.post(
            "/api/v1/imports/attempts/cilia/fetch/",
            data={
                "casualty_number": "406571903",
                "budget_number": "1446508",
                "version_number": 2,
            },
            format="json",
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["parsed_ok"] is True
        assert data["http_status"] == 200
        assert data["service_order"] is not None
        assert data["version_created"] is not None
        assert data["source"] == "cilia"
        assert data["trigger"] == "user_requested"

    @respx.mock
    def test_fetch_404_returns_attempt_with_not_found(self, auth_client, setup_cilia):
        respx.get(CILIA_URL).mock(return_value=Response(404, json={"error": "nope"}))

        resp = auth_client.post(
            "/api/v1/imports/attempts/cilia/fetch/",
            data={"casualty_number": "X", "budget_number": "1", "version_number": 99},
            format="json",
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["parsed_ok"] is False
        assert data["http_status"] == 404
        assert data["error_type"] == "NotFound"

    def test_requires_auth(self, db, setup_cilia):
        client = APIClient()
        resp = client.post(
            "/api/v1/imports/attempts/cilia/fetch/",
            data={"casualty_number": "X", "budget_number": "1"},
            format="json",
        )
        assert resp.status_code == 401

    def test_validates_required_fields(self, auth_client, setup_cilia):
        resp = auth_client.post(
            "/api/v1/imports/attempts/cilia/fetch/",
            data={"casualty_number": "X"},  # falta budget_number
            format="json",
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestListAttemptsEndpoint:

    def test_list_returns_paginated(self, auth_client):
        for i in range(3):
            ImportAttempt.objects.create(
                source="cilia", trigger="polling",
                casualty_number=f"C{i}", budget_number="1", version_number=1,
                parsed_ok=True,
            )
        resp = auth_client.get("/api/v1/imports/attempts/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 3
        assert len(data["results"]) == 3

    def test_filter_by_parsed_ok(self, auth_client):
        ImportAttempt.objects.create(
            source="cilia", trigger="polling",
            casualty_number="OK", parsed_ok=True,
        )
        ImportAttempt.objects.create(
            source="cilia", trigger="polling",
            casualty_number="FAIL", parsed_ok=False,
        )
        resp = auth_client.get("/api/v1/imports/attempts/?parsed_ok=true")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["results"][0]["casualty_number"] == "OK"

    def test_filter_by_casualty_number(self, auth_client):
        ImportAttempt.objects.create(
            source="cilia", trigger="polling", casualty_number="111",
        )
        ImportAttempt.objects.create(
            source="cilia", trigger="polling", casualty_number="222",
        )
        resp = auth_client.get("/api/v1/imports/attempts/?casualty_number=111")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
