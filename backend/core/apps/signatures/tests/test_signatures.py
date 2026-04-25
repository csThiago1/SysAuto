"""Tests do app signatures — model, service, API."""
from __future__ import annotations

import base64

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.budgets.services import BudgetService
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder
from apps.signatures.models import Signature
from apps.signatures.services import SignatureService


User = get_user_model()


# PNG de 1×1 pixel (67 bytes) + header + zeros = 150 bytes decodificados, base64 válido
_FAKE_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n" + b"\x00" * 142  # 150 bytes total (PNG signature + zeros)
)
VALID_PNG_B64 = base64.b64encode(_FAKE_PNG_BYTES).decode("ascii")


@pytest.fixture
def person(db):
    return Person.objects.create(full_name="Sig Test", person_type="CLIENT")


@pytest.fixture
def os_instance(person):
    return ServiceOrder.objects.create(
        os_number="OS-SIG-1", customer=person, customer_type="PARTICULAR",
        vehicle_plate="SIG1234", vehicle_description="Test",
    )


@pytest.mark.django_db
class TestSignatureService:

    def test_capture_canvas_creates_signature(self, os_instance):
        sig = SignatureService.capture(
            service_order=os_instance,
            document_type="OS_OPEN",
            method="CANVAS_TABLET",
            signer_name="João Cliente",
            signature_png_base64=VALID_PNG_B64,
        )
        assert sig.pk is not None
        assert sig.service_order == os_instance
        assert sig.document_type == "OS_OPEN"
        assert sig.method == "CANVAS_TABLET"
        assert sig.signer_name == "João Cliente"
        assert len(sig.signature_hash) == 64

    def test_capture_requires_owner(self):
        from rest_framework.exceptions import ValidationError
        with pytest.raises(ValidationError, match="Informe service_order ou budget"):
            SignatureService.capture(
                document_type="OS_OPEN",
                method="CANVAS_TABLET",
                signer_name="X",
                signature_png_base64=VALID_PNG_B64,
            )

    def test_capture_rejects_invalid_base64(self, os_instance):
        from rest_framework.exceptions import ValidationError
        with pytest.raises(ValidationError, match="Base64 inválido"):
            SignatureService.capture(
                service_order=os_instance,
                document_type="OS_OPEN",
                method="CANVAS_TABLET",
                signer_name="X",
                signature_png_base64="not valid base64 !!!",
            )

    def test_capture_rejects_tiny_png(self, os_instance):
        from rest_framework.exceptions import ValidationError
        tiny = base64.b64encode(b"x").decode()
        with pytest.raises(ValidationError, match="muito pequeno"):
            SignatureService.capture(
                service_order=os_instance,
                document_type="OS_OPEN",
                method="CANVAS_TABLET",
                signer_name="X",
                signature_png_base64=tiny,
            )

    def test_capture_emits_event(self, os_instance):
        SignatureService.capture(
            service_order=os_instance,
            document_type="OS_DELIVERY",
            method="CANVAS_TABLET",
            signer_name="Maria",
            signature_png_base64=VALID_PNG_B64,
        )
        events = os_instance.events.filter(event_type="SIGNATURE_CAPTURED")
        assert events.count() == 1
        assert events.first().actor == "Maria"

    def test_verify_integrity_valid(self, os_instance):
        sig = SignatureService.capture(
            service_order=os_instance,
            document_type="OS_OPEN",
            method="CANVAS_TABLET",
            signer_name="João",
            signature_png_base64=VALID_PNG_B64,
        )
        assert SignatureService.verify_integrity(sig) is True

    def test_verify_integrity_fails_when_png_tampered(self, os_instance):
        sig = SignatureService.capture(
            service_order=os_instance,
            document_type="OS_OPEN",
            method="CANVAS_TABLET",
            signer_name="João",
            signature_png_base64=VALID_PNG_B64,
        )
        # Simula tampering direto no DB (bypass service)
        sig.signature_png_base64 = base64.b64encode(b"different" * 20).decode()
        sig.save(update_fields=["signature_png_base64"])
        assert SignatureService.verify_integrity(sig) is False

    def test_capture_for_budget(self, person):
        budget = BudgetService.create(
            customer=person, vehicle_plate="BDG1234",
            vehicle_description="Test", created_by="x",
        )
        sig = SignatureService.capture(
            budget=budget,
            document_type="BUDGET_APPROVAL",
            method="REMOTE_LINK",
            signer_name="Cliente WhatsApp",
            signature_png_base64=VALID_PNG_B64,
        )
        assert sig.budget == budget
        assert sig.service_order is None


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="sig-api", password="s")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestSignatureAPI:

    def test_capture_endpoint_creates_signature(self, auth_client, os_instance):
        resp = auth_client.post(
            "/api/v1/signatures/capture/",
            data={
                "document_type": "OS_OPEN",
                "method": "CANVAS_TABLET",
                "signer_name": "João Cliente",
                "signature_png_base64": VALID_PNG_B64,
                "service_order_id": os_instance.pk,
            },
            format="json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["document_type"] == "OS_OPEN"
        assert data["method"] == "CANVAS_TABLET"
        assert data["signer_name"] == "João Cliente"
        assert data["service_order"] == os_instance.pk
        assert len(data["signature_hash"]) == 64

    def test_capture_validates_required_owner(self, auth_client):
        resp = auth_client.post(
            "/api/v1/signatures/capture/",
            data={
                "document_type": "OS_OPEN",
                "method": "CANVAS_TABLET",
                "signer_name": "X",
                "signature_png_base64": VALID_PNG_B64,
            },
            format="json",
        )
        assert resp.status_code == 400

    def test_capture_requires_auth(self, db, os_instance):
        client = APIClient()
        resp = client.post(
            "/api/v1/signatures/capture/",
            data={
                "document_type": "OS_OPEN",
                "method": "CANVAS_TABLET",
                "signer_name": "X",
                "signature_png_base64": VALID_PNG_B64,
                "service_order_id": os_instance.pk,
            },
            format="json",
        )
        assert resp.status_code == 401

    def test_verify_endpoint(self, auth_client, os_instance):
        sig = SignatureService.capture(
            service_order=os_instance,
            document_type="OS_OPEN",
            method="CANVAS_TABLET",
            signer_name="João",
            signature_png_base64=VALID_PNG_B64,
        )
        resp = auth_client.get(f"/api/v1/signatures/{sig.pk}/verify/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["integrity_valid"] is True

    def test_list_filters_by_service_order(self, auth_client, os_instance, person):
        other_os = ServiceOrder.objects.create(
            os_number="OS-SIG-OTHER", customer=person,
            vehicle_plate="OTHER1", vehicle_description="x",
        )
        SignatureService.capture(
            service_order=os_instance, document_type="OS_OPEN",
            method="CANVAS_TABLET", signer_name="A",
            signature_png_base64=VALID_PNG_B64,
        )
        SignatureService.capture(
            service_order=other_os, document_type="OS_DELIVERY",
            method="CANVAS_TABLET", signer_name="B",
            signature_png_base64=VALID_PNG_B64,
        )
        resp = auth_client.get(
            f"/api/v1/signatures/?service_order={os_instance.pk}",
        )
        assert resp.status_code == 200
        assert resp.json()["count"] == 1
