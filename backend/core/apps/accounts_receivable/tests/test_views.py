"""
Paddock Solutions — Accounts Receivable View Tests — Sprint 14

Testes de API para o ViewSet de Contas a Receber.
Usa TenantTestCase + APIClient com force_authenticate.
Role e injetado via request.auth (dict) para acionar o RBAC corretamente.
"""
import hashlib
import uuid
from datetime import date, timedelta
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.accounts_receivable.models import ReceivableDocument, ReceivableStatus


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_user(email: str, name: str = "Test User") -> GlobalUser:
    """Cria GlobalUser com email_hash calculado."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email, password="test123", name=name, email_hash=email_hash
    )


# ── Base ──────────────────────────────────────────────────────────────────────


class ARViewTestCase(TenantTestCase):
    """Base: TenantTestCase + APIClient com dominio do tenant de teste."""

    DOCUMENTS_URL = "/api/v1/accounts-receivable/documents/"

    def setUp(self) -> None:
        super().setUp()
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain

        self.admin_user = make_user("admin@dscar.com", "Admin")
        self.consultant_user = make_user("consultant@dscar.com", "Consultor")

    def _authenticate_as_manager(self) -> None:
        """Autentica como MANAGER — role minimo para cancelar e receber."""
        self.client.force_authenticate(
            user=self.admin_user,
            token={"role": "MANAGER"},
        )

    def _authenticate_as_consultant(self) -> None:
        """Autentica como CONSULTANT — abaixo de MANAGER."""
        self.client.force_authenticate(
            user=self.consultant_user,
            token={"role": "CONSULTANT"},
        )

    def _make_open_document(
        self,
        amount: Decimal = Decimal("900.00"),
    ) -> ReceivableDocument:
        """Cria ReceivableDocument em aberto diretamente via ORM."""
        return ReceivableDocument.objects.create(
            customer_id=uuid.uuid4(),
            customer_name="Cliente View Test",
            description="Titulo para teste de view",
            amount=amount,
            due_date=date.today() + timedelta(days=30),
            competence_date=date.today(),
            status=ReceivableStatus.OPEN,
            created_by=self.admin_user,
        )


# ── Testes ────────────────────────────────────────────────────────────────────


class TestListDocuments(ARViewTestCase):
    """Testes de listagem de titulos a receber."""

    def test_list_returns_paginated_200(self) -> None:
        """TC-AR-V-01: GET /documents/ deve retornar 200 com lista paginada."""
        self._authenticate_as_manager()
        for i in range(3):
            ReceivableDocument.objects.create(
                customer_id=uuid.uuid4(),
                customer_name=f"Cliente {i}",
                description=f"Titulo {i}",
                amount=Decimal("100.00"),
                due_date=date.today() + timedelta(days=10),
                competence_date=date.today(),
                status=ReceivableStatus.OPEN,
                created_by=self.admin_user,
            )
        response = self.client.get(self.DOCUMENTS_URL)
        self.assertEqual(response.status_code, 200)
        # DRF DefaultRouter com paginacao retorna 'results'
        self.assertIn("results", response.data)
        self.assertGreaterEqual(len(response.data["results"]), 3)


class TestCancelAction(ARViewTestCase):
    """Testes da action POST /documents/{id}/cancel/."""

    def test_cancel_without_reason_returns_400(self) -> None:
        """TC-AR-V-02: cancelar titulo sem enviar reason deve retornar 400."""
        self._authenticate_as_manager()
        doc = self._make_open_document()
        url = f"{self.DOCUMENTS_URL}{doc.id}/cancel/"
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("reason", response.data)

    def test_cancel_by_consultant_returns_403(self) -> None:
        """TC-AR-V-03: CONSULTANT nao tem permissao para cancelar — deve retornar 403."""
        self._authenticate_as_consultant()
        doc = self._make_open_document()
        url = f"{self.DOCUMENTS_URL}{doc.id}/cancel/"
        response = self.client.post(url, {"reason": "Tentativa nao autorizada"}, format="json")
        self.assertEqual(response.status_code, 403)


class TestReceiveAction(ARViewTestCase):
    """Testes da action POST /documents/{id}/receive/."""

    def test_receive_with_valid_data_returns_201(self) -> None:
        """TC-AR-V-04: registrar recebimento com dados validos deve retornar 201."""
        self._authenticate_as_manager()
        doc = self._make_open_document(amount=Decimal("500.00"))
        url = f"{self.DOCUMENTS_URL}{doc.id}/receive/"
        payload = {
            "receipt_date": str(date.today()),
            "amount": "500.00",
            "payment_method": "pix",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data["amount"]), Decimal("500.00"))

    def test_receive_by_consultant_returns_403(self) -> None:
        """TC-AR-V-05: CONSULTANT nao tem permissao para registrar recebimento — deve retornar 403."""
        self._authenticate_as_consultant()
        doc = self._make_open_document()
        url = f"{self.DOCUMENTS_URL}{doc.id}/receive/"
        payload = {
            "receipt_date": str(date.today()),
            "amount": "100.00",
            "payment_method": "pix",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 403)


class TestRetrieveDocument(ARViewTestCase):
    """Testes de detalhe de titulo a receber."""

    def test_retrieve_returns_200_with_correct_fields(self) -> None:
        """TC-AR-V-06: GET /documents/{id}/ deve retornar 200 com campos corretos."""
        self._authenticate_as_manager()
        doc = self._make_open_document(amount=Decimal("750.00"))
        url = f"{self.DOCUMENTS_URL}{doc.id}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(doc.id))
        self.assertEqual(Decimal(response.data["amount"]), Decimal("750.00"))
        self.assertEqual(response.data["status"], ReceivableStatus.OPEN)
        self.assertIn("customer_name", response.data)
        self.assertIn("amount_remaining", response.data)
        self.assertIn("receipts", response.data)
