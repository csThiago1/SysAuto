"""Testes da assinatura do checklist de entrada: presencial (iPad) e link remoto (WhatsApp)."""

import base64
import datetime
import hashlib

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import override_settings
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.documents.models import DocumentGeneration
from apps.persons.models import Person, PersonContact
from apps.service_orders.models import (
    EntryChecklist,
    ServiceOrder,
    ServiceOrderActivityLog,
    ServiceOrderStatus,
)
from apps.signatures.models import Signature

# Capture exige base64 válido com >= 100 bytes.
SIGNATURE_PNG = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\0" * 120).decode()
PDF_SHA = "ab" * 32


class ChecklistSignatureAPITest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "checklist-signature@dscar.com"
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        self.user = GlobalUser.objects.filter(email_hash=email_hash).first()
        if self.user is None:
            self.user = GlobalUser.objects.create_user(
                email=email, email_hash=email_hash, password="x"
            )
        self.customer = Person.objects.create(person_kind="PF", full_name="Cliente Assinatura")
        self.order = ServiceOrder.objects.create(
            number=9982,
            plate="SIG0A11",
            make="Fiat",
            model="Argo",
            customer=self.customer,
            customer_name="Cliente Assinatura",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
        )
        # Finalizado direto no banco: o PDF real é coberto em test_checklist_finalize.
        self.checklist = EntryChecklist.objects.create(
            service_order=self.order,
            body_type="sedan",
            finalized_at=timezone.now(),
            finalized_by=self.user,
            pdf_sha256=PDF_SHA,
        )
        self.client = self._client()
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.public = self._client()
        self.url = f"/api/v1/service-orders/{self.order.id}/checklist/entrada/"

    def _client(self) -> APIClient:
        client = APIClient()
        client.defaults["SERVER_NAME"] = self.domain.domain
        client.defaults["HTTP_HOST"] = self.domain.domain
        return client

    def _sign(self):  # noqa: ANN202
        return self.client.post(
            f"{self.url}sign/",
            {"signer_name": "Cliente Assinatura", "signature_png_base64": SIGNATURE_PNG},
            format="json",
        )

    def _send_remote(self) -> str:
        response = self.client.post(f"{self.url}send-remote/", format="json")
        assert response.status_code == 200, response.content
        return response.json()["url"].rsplit("/", 1)[1]

    def _confirm(self, token: str, **headers: str):  # noqa: ANN202
        return self.public.post(
            f"/api/v1/public/checklist-confirm/{token}/",
            {"signer_name": "Cliente Remoto"},
            format="json",
            **headers,
        )

    # O POST chega pelo proxy do Next: o IP do aparelho vem no X-Client-IP,
    # aceito só com o segredo do proxy (senão qualquer um forjaria a evidência).
    PROXIED = {
        "HTTP_X_PROXY_SECRET": "segredo-proxy",
        "HTTP_X_CLIENT_IP": "203.0.113.7",
        "HTTP_USER_AGENT": "Mozilla/5.0 (iPhone)",
    }

    @override_settings(PROXY_SHARED_SECRET="segredo-proxy")
    def test_remote_confirm_records_device_ip_and_ua_from_proxy(self) -> None:
        response = self._confirm(self._send_remote(), **self.PROXIED)
        assert response.status_code == 200, response.content
        self.checklist.refresh_from_db()
        assert self.checklist.signature.ip_address == "203.0.113.7"
        assert self.checklist.signature.user_agent == "Mozilla/5.0 (iPhone)"

    @override_settings(PROXY_SHARED_SECRET="segredo-proxy")
    def test_remote_confirm_ignores_client_ip_without_proxy_secret(self) -> None:
        headers = {**self.PROXIED, "HTTP_X_PROXY_SECRET": "chute"}
        assert self._confirm(self._send_remote(), **headers).status_code == 200
        self.checklist.refresh_from_db()
        assert self.checklist.signature.ip_address == "127.0.0.1"

    @override_settings(PROXY_SHARED_SECRET="")
    def test_remote_confirm_ignores_client_ip_when_secret_unset(self) -> None:
        headers = {**self.PROXIED, "HTTP_X_PROXY_SECRET": ""}
        assert self._confirm(self._send_remote(), **headers).status_code == 200
        self.checklist.refresh_from_db()
        assert self.checklist.signature.ip_address == "127.0.0.1"

    @override_settings(PROXY_SHARED_SECRET="segredo-proxy")
    def test_remote_confirm_invalid_client_ip_falls_back(self) -> None:
        headers = {**self.PROXIED, "HTTP_X_CLIENT_IP": "nao-e-ip"}
        assert self._confirm(self._send_remote(), **headers).status_code == 200
        self.checklist.refresh_from_db()
        assert self.checklist.signature.ip_address == "127.0.0.1"

    def test_sign_requires_finalized(self) -> None:
        EntryChecklist.objects.filter(pk=self.checklist.pk).update(finalized_at=None)
        response = self._sign()
        assert response.status_code == 400, response.content
        assert Signature.objects.count() == 0

    @override_settings(PROXY_SHARED_SECRET="segredo-proxy")
    def test_presencial_records_device_ip_from_proxy(self) -> None:
        response = self.client.post(
            f"{self.url}sign/",
            {"signer_name": "Cliente Assinatura", "signature_png_base64": SIGNATURE_PNG},
            format="json",
            **self.PROXIED,
        )
        assert response.status_code == 200, response.content
        self.checklist.refresh_from_db()
        assert self.checklist.signature.ip_address == "203.0.113.7"

    def test_presencial_sets_status(self) -> None:
        response = self._sign()
        assert response.status_code == 200, response.content
        self.checklist.refresh_from_db()
        assert self.checklist.signature_status == "presencial"
        assert self.checklist.signature.method == "CANVAS_TABLET"
        assert self.checklist.signature.document_type == "VISTORIA_ENTRADA"
        assert ServiceOrderActivityLog.objects.filter(
            service_order=self.order, activity_type="checklist_signed"
        ).exists()

    def test_remote_link_flow(self) -> None:
        token = self._send_remote()
        get = self.public.get(f"/api/v1/public/checklist-confirm/{token}/")
        assert get.status_code == 200, get.content
        assert get.json()["placa"] == "SIG0A11"
        assert get.json()["version"] == 1
        response = self._confirm(token)
        assert response.status_code == 200, response.content
        self.checklist.refresh_from_db()
        assert self.checklist.signature_status == "remoto"
        signature = self.checklist.signature
        assert signature.method == "REMOTE_LINK"
        assert signature.signature_png_base64 == ""
        assert "sha256" in signature.notes
        assert PDF_SHA in signature.notes
        assert ServiceOrderActivityLog.objects.filter(
            service_order=self.order, activity_type="checklist_signed"
        ).exists()

    def test_remote_link_expired_is_410(self) -> None:
        token = self._send_remote()
        EntryChecklist.objects.filter(pk=self.checklist.pk).update(
            remote_expires_at=timezone.now() - datetime.timedelta(minutes=1)
        )
        response = self._confirm(token)
        assert response.status_code == 410, response.content
        assert response.json()["code"] == "link_expired"
        assert Signature.objects.count() == 0

    def test_remote_link_single_use_is_410(self) -> None:
        token = self._send_remote()
        assert self._confirm(token).status_code == 200
        response = self._confirm(token)
        assert response.status_code == 410, response.content
        assert Signature.objects.count() == 1

    def test_reopen_invalidates_remote_link(self) -> None:
        token = self._send_remote()
        reopen = self.client.post(f"{self.url}reopen/", {"reason": "Dano novo"}, format="json")
        assert reopen.status_code == 200, reopen.content
        assert self._confirm(token).status_code == 404

    def _attach_pdf(self) -> None:
        key = default_storage.save("tests/checklist-signature.pdf", ContentFile(b"%PDF-1.4 teste"))
        self.addCleanup(default_storage.delete, key)
        self.checklist.pdf = DocumentGeneration.objects.create(
            document_type="checklist_entrada",
            service_order=self.order,
            data_snapshot={},
            s3_key=key,
            generated_by=self.user,
        )
        self.checklist.save(update_fields=["pdf"])

    def test_public_pdf_streams_while_valid(self) -> None:
        self._attach_pdf()
        token = self._send_remote()
        response = self.public.get(f"/api/v1/public/checklist-confirm/{token}/pdf/")
        assert response.status_code == 200
        assert response["Content-Type"] == "application/pdf"
        assert response["Content-Disposition"].startswith("inline")
        assert response["Cache-Control"] == "no-store"
        assert b"".join(response.streaming_content) == b"%PDF-1.4 teste"

    def test_public_pdf_410_after_confirm(self) -> None:
        self._attach_pdf()
        token = self._send_remote()
        assert self._confirm(token).status_code == 200
        response = self.public.get(f"/api/v1/public/checklist-confirm/{token}/pdf/")
        assert response.status_code == 410, response.content

    def test_public_json_has_no_storage_url(self) -> None:
        self._attach_pdf()
        token = self._send_remote()
        data = self.public.get(f"/api/v1/public/checklist-confirm/{token}/").json()
        assert data["pdf_url"] == f"/api/v1/public/checklist-confirm/{token}/pdf/"
        assert default_storage.url(self.checklist.pdf.s3_key) not in str(data)

    def test_whatsapp_url_without_contact(self) -> None:
        response = self.client.post(f"{self.url}send-remote/", format="json")
        assert response.status_code == 200, response.content
        assert response.json()["whatsapp_url"].startswith("https://wa.me/?text=")

    def test_whatsapp_url_uses_primary_whatsapp_contact(self) -> None:
        PersonContact.objects.create(
            person=self.customer, contact_type="WHATSAPP", value="(92) 98888-0000"
        )
        PersonContact.objects.create(
            person=self.customer, contact_type="WHATSAPP", value="(92) 99999-1111", is_primary=True
        )
        with self.settings(FRONTEND_URL="https://erp.test"):
            response = self.client.post(f"{self.url}send-remote/", format="json")
        data = response.json()
        assert data["url"].startswith("https://erp.test/confirmar-checklist/")
        assert data["whatsapp_url"].startswith("https://wa.me/5592999991111?text=")
        assert "SIG0A11" in data["whatsapp_url"]
