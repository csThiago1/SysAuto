"""Integration tests do `ImportService.import_xml_ifx`."""
from __future__ import annotations

from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.imports.models import ImportAttempt
from apps.imports.services import ImportService
from apps.service_orders.models import Insurer, ServiceOrder


FIXTURES_DIR = Path(__file__).parent / "fixtures"

User = get_user_model()


def _load_xml(name: str) -> bytes:
    return (FIXTURES_DIR / name).read_bytes()


@pytest.fixture
def porto_insurer(db):
    return Insurer.objects.get(code="porto")


@pytest.mark.django_db
class TestImportXmlIfxService:

    def test_imports_honda_fit_creates_os_and_version(self, porto_insurer):
        xml = _load_xml("xml_ifx_honda_fit.xml")

        attempt = ImportService.import_xml_ifx(
            xml_bytes=xml, insurer_code="porto", created_by="alice",
        )

        assert attempt.parsed_ok is True
        assert attempt.service_order is not None
        assert attempt.version_created is not None

        os = attempt.service_order
        assert os.customer_type == "SEGURADORA"
        assert os.insurer == porto_insurer
        assert os.casualty_number == "5312026226472"
        assert os.vehicle_plate == "QZP8B26"

        v = attempt.version_created
        assert v.items.count() == 9  # 1 trocada + 3 recuperadas + 1 overlap + 4 svcs

    def test_dedup_second_upload_same_xml(self, porto_insurer):
        xml = _load_xml("xml_ifx_honda_fit.xml")

        a1 = ImportService.import_xml_ifx(xml_bytes=xml, insurer_code="porto")
        a2 = ImportService.import_xml_ifx(xml_bytes=xml, insurer_code="porto")

        assert a1.parsed_ok is True
        assert a2.parsed_ok is False
        assert a2.duplicate_of == a1
        assert a2.error_type == "Duplicate"

    def test_invalid_xml_returns_parse_error(self, porto_insurer):
        attempt = ImportService.import_xml_ifx(
            xml_bytes=b"<not valid xml",
            insurer_code="porto",
        )
        assert attempt.parsed_ok is False
        assert attempt.error_type == "ParseError"

    def test_insurer_not_in_catalog_fails(self, db):
        """Se 'allianz' não está seedado, deve falhar (PersistError)."""
        xml = _load_xml("xml_ifx_honda_fit.xml")
        # Remove allianz do catálogo se por acaso existir
        Insurer.objects.filter(code="allianz_unknown").delete()

        attempt = ImportService.import_xml_ifx(
            xml_bytes=xml, insurer_code="allianz_unknown",
        )
        assert attempt.parsed_ok is False
        # PersistError porque Insurer.code não existe no catálogo
        assert attempt.error_type == "PersistError"

    def test_emits_events_on_success(self, porto_insurer):
        xml = _load_xml("xml_ifx_honda_fit.xml")
        attempt = ImportService.import_xml_ifx(xml_bytes=xml, insurer_code="porto")

        os = attempt.service_order
        assert os.events.filter(event_type="VERSION_CREATED").exists()
        assert os.events.filter(event_type="IMPORT_RECEIVED").exists()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="xml-api", password="s")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestXmlIfxEndpoint:

    def test_upload_xml_creates_os(self, auth_client, porto_insurer):
        from django.core.files.uploadedfile import SimpleUploadedFile

        xml_bytes = _load_xml("xml_ifx_honda_fit.xml")
        uploaded = SimpleUploadedFile(
            "xml_ifx_honda_fit.xml",
            xml_bytes,
            content_type="application/xml",
        )

        resp = auth_client.post(
            "/api/v1/imports/attempts/xml/upload/",
            data={"file": uploaded, "insurer_code": "porto"},
            format="multipart",
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["parsed_ok"] is True
        assert data["source"] == "xml_porto"
        assert data["service_order"] is not None

    def test_upload_validates_insurer_code(self, auth_client, porto_insurer):
        from django.core.files.uploadedfile import SimpleUploadedFile
        xml_bytes = _load_xml("xml_ifx_honda_fit.xml")
        uploaded = SimpleUploadedFile("f.xml", xml_bytes, content_type="application/xml")

        resp = auth_client.post(
            "/api/v1/imports/attempts/xml/upload/",
            data={"file": uploaded, "insurer_code": "DESCONHECIDA"},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_upload_requires_auth(self, db, porto_insurer):
        from django.core.files.uploadedfile import SimpleUploadedFile
        xml_bytes = _load_xml("xml_ifx_honda_fit.xml")
        uploaded = SimpleUploadedFile("f.xml", xml_bytes, content_type="application/xml")

        client = APIClient()
        resp = client.post(
            "/api/v1/imports/attempts/xml/upload/",
            data={"file": uploaded, "insurer_code": "porto"},
            format="multipart",
        )
        assert resp.status_code == 401
