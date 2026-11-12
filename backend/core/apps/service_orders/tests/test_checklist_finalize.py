"""Testes de finalizar (PDF + trava) e reabrir (versões) o checklist de entrada 3D."""

import hashlib
from unittest.mock import patch

from django.template.loader import render_to_string
from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.documents.models import DocumentGeneration
from apps.service_orders.checklist_constants import EXTERIOR_STOPS
from apps.service_orders.models import (
    ChecklistDamage,
    EntryChecklist,
    EntryChecklistVersion,
    ServiceOrder,
    ServiceOrderActivityLog,
    ServiceOrderPhoto,
    ServiceOrderStatus,
)

IN_MEMORY_STORAGE = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
PNG = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGAA"
    "AAAEAAH2FzhVAAAAAElFTkSuQmCC"
)
SNAPSHOTS = {"front34": PNG, "rear34": PNG, "left": PNG, "right": PNG}


@override_settings(STORAGES=IN_MEMORY_STORAGE)
class ChecklistFinalizeAPITest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "checklist-finalize@dscar.com"
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        self.user = GlobalUser.objects.filter(email_hash=email_hash).first()
        if self.user is None:
            self.user = GlobalUser.objects.create_user(
                email=email, email_hash=email_hash, password="x"
            )
        self.order = ServiceOrder.objects.create(
            number=9981,
            plate="CHK0D44",
            customer_name="Cliente Checklist Final",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
        )
        self.checklist = EntryChecklist.objects.create(
            service_order=self.order,
            body_type="sedan",
            stops_done={stop: "sem_dano" for stop in EXTERIOR_STOPS},
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self._auth("ADMIN")
        self.url = f"/api/v1/service-orders/{self.order.id}/checklist/entrada/"

    def _auth(self, role: str) -> None:
        self.client.force_authenticate(user=self.user, token={"role": role})

    def _damage(self, with_photo: bool = True) -> ChecklistDamage:
        damage = ChecklistDamage.objects.create(
            service_order=self.order,
            number=1,
            panel_key="capo",
            damage_type="risco",
            severity="grave",
            relation="sinistro",
        )
        if with_photo:
            photo = ServiceOrderPhoto.objects.create(
                service_order=self.order,
                folder="checklist_entrada",
                checklist_type="entrada",
                s3_key="service_orders/x/checklist_entrada/capo.jpg",
                uploaded_by_id=self.user.id,
            )
            damage.photos.add(photo)
        return damage

    def _finalize(self, snapshots: dict[str, str] = SNAPSHOTS, **extra: str):  # noqa: ANN202
        return self.client.post(
            f"{self.url}finalize/", {"snapshots": snapshots, **extra}, format="json"
        )

    def test_finalize_prints_model_credit(self) -> None:
        credit = "Polo · Ddiaz Design · CC BY-NC-SA 4.0"
        response = self._finalize(model_credit=credit)
        assert response.status_code == 200, response.content
        self.checklist.refresh_from_db()
        html = render_to_string(
            "pdf_engine/checklist_entrada.html", self.checklist.pdf.data_snapshot
        )
        assert f"Modelo 3D: {credit}" in html

    def test_finalize_without_credit_prints_no_credit_line(self) -> None:
        assert self._finalize().status_code == 200
        self.checklist.refresh_from_db()
        html = render_to_string(
            "pdf_engine/checklist_entrada.html", self.checklist.pdf.data_snapshot
        )
        assert "Modelo 3D:" not in html

    def test_finalize_rejects_long_model_credit(self) -> None:
        response = self._finalize(model_credit="x" * 301)
        assert response.status_code == 400, response.content
        assert "model_credit" in response.json()

    def test_finalize_requires_all_exterior_stops(self) -> None:
        stops = dict(self.checklist.stops_done)
        del stops["teto"]
        EntryChecklist.objects.filter(pk=self.checklist.pk).update(stops_done=stops)
        response = self._finalize()
        assert response.status_code == 400, response.content
        assert "stop:teto" in response.json()["missing"]

    def test_finalize_requires_photo_per_damage(self) -> None:
        self._damage(with_photo=False)
        response = self._finalize()
        assert response.status_code == 400, response.content
        assert "damage:1:photo" in response.json()["missing"]

    def test_finalize_rejects_missing_snapshot(self) -> None:
        snapshots = {k: v for k, v in SNAPSHOTS.items() if k != "rear34"}
        response = self._finalize(snapshots)
        assert response.status_code == 400, response.content
        assert "snapshot:rear34" in response.json()["missing"]

    def test_finalize_locks_and_creates_pdf(self) -> None:
        self._damage()
        response = self._finalize()
        assert response.status_code == 200, response.content
        self.checklist.refresh_from_db()
        assert self.checklist.finalized_at is not None
        assert self.checklist.finalized_by_id == self.user.id
        assert self.checklist.pdf.document_type == "checklist_entrada"
        assert DocumentGeneration.objects.filter(document_type="checklist_entrada").count() == 1
        assert len(self.checklist.pdf_sha256) == 64
        assert self.checklist.signature_status == "pendente"
        assert response.json()["pdf_url"] is not None
        damages = self.checklist.pdf.data_snapshot["damages"]
        assert damages[0]["number"] == 1
        assert damages[0]["panel"] == "Capô"
        assert ServiceOrderActivityLog.objects.filter(
            service_order=self.order, activity_type="checklist_finalized"
        ).exists()
        # Travado: segunda finalização é 409.
        assert self._finalize().status_code == 409

    def test_finalize_rejects_non_pdf_render(self) -> None:
        # Fallback do WeasyPrint devolve HTML: não pode travar com hash de HTML.
        with patch("apps.documents.pdf_service._html_to_pdf", return_value=b"<html></html>"):
            response = self._finalize()
        assert response.status_code == 503, response.content
        self.checklist.refresh_from_db()
        assert self.checklist.finalized_at is None
        assert self.checklist.pdf_id is None
        assert not DocumentGeneration.objects.filter(document_type="checklist_entrada").exists()

    def test_reopen_requires_manager(self) -> None:
        self._finalize()
        self._auth("CONSULTANT")
        response = self.client.post(f"{self.url}reopen/", {"reason": "Dano novo"}, format="json")
        assert response.status_code == 403, response.content

    def test_reopen_requires_reason(self) -> None:
        self._finalize()
        response = self.client.post(f"{self.url}reopen/", {"reason": "  "}, format="json")
        assert response.status_code == 400, response.content

    def test_reopen_keeps_previous_version(self) -> None:
        assert self._finalize().status_code == 200
        self.checklist.refresh_from_db()
        first_pdf_id = self.checklist.pdf_id
        response = self.client.post(f"{self.url}reopen/", {"reason": "Dano novo"}, format="json")
        assert response.status_code == 200, response.content
        assert EntryChecklistVersion.objects.count() == 1
        version = EntryChecklistVersion.objects.get()
        assert version.version == 1
        assert version.pdf_id == first_pdf_id
        assert version.reopened_reason == "Dano novo"
        self.checklist.refresh_from_db()
        assert self.checklist.version == 2
        assert self.checklist.is_locked is False
        assert self.checklist.signature_status == "pendente"
        assert self.checklist.pdf_id is None
        assert ServiceOrderActivityLog.objects.filter(
            service_order=self.order, activity_type="checklist_reopened"
        ).exists()

    def test_generic_generate_endpoint_rejects_checklist_entrada(self) -> None:
        self._auth("CONSULTANT")
        resp = self.client.post(
            f"/api/v1/documents/os/{self.order.id}/generate/",
            {"document_type": "checklist_entrada", "data": {"damages": []}},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("document_type", resp.data)
        self.assertFalse(
            DocumentGeneration.objects.filter(
                service_order=self.order, document_type="checklist_entrada"
            ).exists()
        )
