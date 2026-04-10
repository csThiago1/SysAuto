"""
Paddock Solutions — Accounts Payable View Tests — Sprint 14

Testes de API para os ViewSets de Contas a Pagar.
Usa TenantTestCase + APIClient com force_authenticate.
Role é injetado via request.auth (dict) para acionar o RBAC corretamente.
"""
import hashlib
from datetime import date, timedelta
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.accounts_payable.models import DocumentStatus, PayableDocument, Supplier


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_user(email: str, name: str = "Test User") -> GlobalUser:
    """Cria GlobalUser com email_hash calculado."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email, password="test123", name=name, email_hash=email_hash
    )


# ── Base ──────────────────────────────────────────────────────────────────────


class APViewTestCase(TenantTestCase):
    """Base: TenantTestCase + APIClient com domínio do tenant de teste."""

    DOCUMENTS_URL = "/api/v1/accounts-payable/documents/"

    def setUp(self) -> None:
        super().setUp()
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain

        self.admin_user = make_user("admin@dscar.com", "Admin")
        self.consultant_user = make_user("consultant@dscar.com", "Consultor")

        self.supplier = Supplier.objects.create(
            name="Fornecedor View Test",
            created_by=self.admin_user,
        )

    def _authenticate_as_manager(self) -> None:
        """Autentica como MANAGER — role mínimo para cancelar."""
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
        amount: Decimal = Decimal("800.00"),
    ) -> PayableDocument:
        """Cria PayableDocument em aberto diretamente via ORM."""
        return PayableDocument.objects.create(
            supplier=self.supplier,
            description="Titulo para teste de view",
            amount=amount,
            due_date=date.today() + timedelta(days=30),
            competence_date=date.today(),
            status=DocumentStatus.OPEN,
            created_by=self.admin_user,
        )


# ── Testes ────────────────────────────────────────────────────────────────────


class TestCancelAction(APViewTestCase):
    """Testes da action POST /documents/{id}/cancel/."""

    def test_cancel_without_reason_returns_400(self) -> None:
        """TC-AP-12: cancelar título sem enviar reason deve retornar 400."""
        self._authenticate_as_manager()
        doc = self._make_open_document()
        url = f"{self.DOCUMENTS_URL}{doc.id}/cancel/"
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("reason", response.data)

    def test_cancel_with_empty_reason_returns_400(self) -> None:
        """TC-AP-12b: cancelar com reason vazio deve retornar 400."""
        self._authenticate_as_manager()
        doc = self._make_open_document()
        url = f"{self.DOCUMENTS_URL}{doc.id}/cancel/"
        response = self.client.post(url, {"reason": ""}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("reason", response.data)

    def test_cancel_by_consultant_returns_403(self) -> None:
        """TC-AP-13: CONSULTANT não tem permissão para cancelar — deve retornar 403."""
        self._authenticate_as_consultant()
        doc = self._make_open_document()
        url = f"{self.DOCUMENTS_URL}{doc.id}/cancel/"
        response = self.client.post(url, {"reason": "Tentativa não autorizada"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_cancel_by_manager_with_valid_reason_returns_200(self) -> None:
        """TC-AP-13b: MANAGER com reason válido deve cancelar e retornar 200."""
        self._authenticate_as_manager()
        doc = self._make_open_document()
        url = f"{self.DOCUMENTS_URL}{doc.id}/cancel/"
        response = self.client.post(url, {"reason": "Nota duplicada"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], DocumentStatus.CANCELLED)


class TestPayAction(APViewTestCase):
    """Testes da action POST /documents/{id}/pay/."""

    def test_record_payment_with_valid_data_returns_201(self) -> None:
        """TC-AP-14: baixa com dados válidos deve retornar 201 e o registro criado."""
        self._authenticate_as_manager()
        doc = self._make_open_document(amount=Decimal("1000.00"))
        url = f"{self.DOCUMENTS_URL}{doc.id}/pay/"
        payload = {
            "payment_date": str(date.today()),
            "amount": "500.00",
            "payment_method": "pix",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data["amount"]), Decimal("500.00"))

    def test_record_payment_without_amount_returns_400(self) -> None:
        """TC-AP-14b: baixa sem campo amount deve retornar 400."""
        self._authenticate_as_manager()
        doc = self._make_open_document()
        url = f"{self.DOCUMENTS_URL}{doc.id}/pay/"
        payload = {"payment_date": str(date.today())}
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_record_payment_exceeding_balance_returns_400(self) -> None:
        """TC-AP-14c: baixa acima do saldo restante deve retornar 400."""
        self._authenticate_as_manager()
        doc = self._make_open_document(amount=Decimal("200.00"))
        url = f"{self.DOCUMENTS_URL}{doc.id}/pay/"
        payload = {
            "payment_date": str(date.today()),
            "amount": "999.00",
            "payment_method": "cash",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 400)


class TestListDocuments(APViewTestCase):
    """Testes de listagem de títulos a pagar."""

    def test_list_returns_paginated_200(self) -> None:
        """TC-AP-15: GET /documents/ deve retornar 200 com lista paginada."""
        self._authenticate_as_manager()
        for i in range(3):
            PayableDocument.objects.create(
                supplier=self.supplier,
                description=f"Titulo {i}",
                amount=Decimal("100.00"),
                due_date=date.today() + timedelta(days=10),
                competence_date=date.today(),
                status=DocumentStatus.OPEN,
                created_by=self.admin_user,
            )
        response = self.client.get(self.DOCUMENTS_URL)
        self.assertEqual(response.status_code, 200)
        # DRF DefaultRouter com paginação retorna 'results'
        self.assertIn("results", response.data)
        self.assertGreaterEqual(len(response.data["results"]), 3)

    def test_list_unauthenticated_returns_401(self) -> None:
        """TC-AP-15b: listagem sem autenticação deve retornar 401."""
        anon = APIClient()
        anon.defaults["SERVER_NAME"] = self.domain.domain
        response = anon.get(self.DOCUMENTS_URL)
        self.assertEqual(response.status_code, 401)
