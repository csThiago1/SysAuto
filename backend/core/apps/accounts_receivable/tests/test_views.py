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
from typing import Any

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.accounts_receivable.models import ReceivableDocument, ReceivableStatus
from apps.authentication.models import GlobalUser

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


class TestBusinessRuleErrors(ARViewTestCase):
    """Erro de regra do service responde 400 com a mensagem do service, nao 500."""

    def setUp(self) -> None:
        super().setUp()
        self._authenticate_as_manager()

    def _receive(self, doc_id: object, amount: str) -> Any:
        return self.client.post(
            f"{self.DOCUMENTS_URL}{doc_id}/receive/",
            {"receipt_date": str(date.today()), "amount": amount, "payment_method": "pix"},
            format="json",
        )

    def _cancel(self, doc_id: object) -> Any:
        return self.client.post(
            f"{self.DOCUMENTS_URL}{doc_id}/cancel/", {"reason": "Teste"}, format="json"
        )

    def test_receive_above_balance_returns_400(self) -> None:
        """Baixa acima do saldo: 400 com a mensagem na chave amount, em lista."""
        doc = self._make_open_document(amount=Decimal("100.00"))
        response = self._receive(doc.id, "150.00")
        self.assertEqual(response.status_code, 400)
        self.assertIn("excede o saldo", response.data["amount"][0])

    def test_receive_on_received_document_returns_400(self) -> None:
        """Baixa em titulo ja recebido: 400 com a mensagem do service."""
        doc = self._make_open_document(amount=Decimal("100.00"))
        self.assertEqual(self._receive(doc.id, "100.00").status_code, 201)
        response = self._receive(doc.id, "10.00")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], ["Titulo ja esta totalmente recebido."])

    def test_cancel_received_document_returns_400(self) -> None:
        """Cancelar titulo ja recebido: 400 com a mensagem do service."""
        doc = self._make_open_document(amount=Decimal("100.00"))
        self.assertEqual(self._receive(doc.id, "100.00").status_code, 201)
        response = self._cancel(doc.id)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["detail"], ["Nao e possivel cancelar um titulo ja recebido."]
        )

    def test_receive_and_cancel_unknown_id_return_404(self) -> None:
        """Id inexistente ou titulo inativo: 404 nas duas acoes."""
        unknown = uuid.uuid4()
        self.assertEqual(self._receive(unknown, "10.00").status_code, 404)
        self.assertEqual(self._cancel(unknown).status_code, 404)

        inactive = self._make_open_document()
        ReceivableDocument.objects.filter(id=inactive.id).update(is_active=False)
        self.assertEqual(self._receive(inactive.id, "10.00").status_code, 404)
        self.assertEqual(self._cancel(inactive.id).status_code, 404)

    def test_installments_non_numeric_params_return_400(self) -> None:
        """num_parcelas ou interval_days nao numerico: 400, nao 500."""
        payload = {
            "customer_id": str(uuid.uuid4()),
            "customer_name": "Cliente Parcelado",
            "description": "Parcelamento",
            "amount": "300.00",
            "due_date": str(date.today()),
            "competence_date": str(date.today()),
        }
        for extra in (
            {"num_parcelas": "abc"},
            {"interval_days": "x"},
            {"num_parcelas": 2, "interval_days": 0},
            {"num_parcelas": 2, "interval_days": 10000000},
        ):
            response = self.client.post(
                f"{self.DOCUMENTS_URL}installments/", {**payload, **extra}, format="json"
            )
            self.assertEqual(response.status_code, 400, extra)
        self.assertEqual(ReceivableDocument.objects.count(), 0)


class TestUpdateDocument(ARViewTestCase):
    """PUT/PATCH do titulo: so gerente, e so os campos que podem mudar."""

    def test_update_by_consultant_returns_403(self) -> None:
        """CONSULTANT nao edita titulo."""
        self._authenticate_as_consultant()
        doc = self._make_open_document()
        url = f"{self.DOCUMENTS_URL}{doc.id}/"
        self.assertEqual(self.client.patch(url, {"notes": "x"}, format="json").status_code, 403)
        self.assertEqual(self.client.put(url, {"notes": "x"}, format="json").status_code, 403)

    def test_manager_updates_allowed_fields_and_locked_ones_are_ignored(self) -> None:
        """Gerente altera vencimento, descricao e observacao; o resto e ignorado."""
        self._authenticate_as_manager()
        doc = self._make_open_document()
        new_due = date.today() + timedelta(days=45)
        response = self.client.patch(
            f"{self.DOCUMENTS_URL}{doc.id}/",
            {
                "due_date": str(new_due),
                "description": "Nova descricao",
                "notes": "Combinado com o cliente",
                "customer_id": str(uuid.uuid4()),
                "customer_name": "Outro Cliente",
                "origin": "OS",
                "service_order_id": str(uuid.uuid4()),
                "is_active": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        original_customer_id = doc.customer_id
        doc.refresh_from_db()
        self.assertEqual(doc.due_date, new_due)
        self.assertEqual(doc.description, "Nova descricao")
        self.assertEqual(doc.notes, "Combinado com o cliente")
        self.assertEqual(doc.customer_id, original_customer_id)
        self.assertEqual(doc.customer_name, "Cliente View Test")
        self.assertEqual(doc.origin, "MAN")
        self.assertIsNone(doc.service_order_id)
        self.assertTrue(doc.is_active)

    def test_amount_changes_only_on_manual_document_without_receipt(self) -> None:
        """Valor muda em titulo manual sem recebimento; fora disso, 400."""
        self._authenticate_as_manager()

        manual = self._make_open_document(amount=Decimal("900.00"))
        url = f"{self.DOCUMENTS_URL}{manual.id}/"
        self.assertEqual(
            self.client.patch(url, {"amount": "950.00"}, format="json").status_code, 200
        )
        manual.refresh_from_db()
        self.assertEqual(manual.amount, Decimal("950.00"))

        # Vencido com recebimento parcial: ainda editavel, mas o valor nao muda.
        ReceivableDocument.objects.filter(id=manual.id).update(
            status=ReceivableStatus.OVERDUE, amount_received=Decimal("100.00")
        )
        response = self.client.patch(url, {"amount": "500.00"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("amount", response.data)
        # Reenviar o valor atual (formulario inteiro) nao e mudanca.
        self.assertEqual(
            self.client.patch(url, {"amount": "950.00"}, format="json").status_code, 200
        )

        from_os = self._make_open_document(amount=Decimal("900.00"))
        ReceivableDocument.objects.filter(id=from_os.id).update(origin="OS")
        response = self.client.patch(
            f"{self.DOCUMENTS_URL}{from_os.id}/", {"amount": "500.00"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(ReceivableDocument.objects.filter(amount=Decimal("500.00")).count(), 0)

    def test_amount_must_be_positive(self) -> None:
        """Valor zero ou negativo na edicao: 400, como na criacao."""
        self._authenticate_as_manager()
        doc = self._make_open_document(amount=Decimal("900.00"))
        for amount in ("0", "-50.00"):
            response = self.client.patch(
                f"{self.DOCUMENTS_URL}{doc.id}/", {"amount": amount}, format="json"
            )
            self.assertEqual(response.status_code, 400, amount)
        doc.refresh_from_db()
        self.assertEqual(doc.amount, Decimal("900.00"))

    def test_document_from_service_order_keeps_amount_and_description(self) -> None:
        """Franquia do faturamento nasce com origem MAN: a trava e o vinculo com a OS."""
        self._authenticate_as_manager()
        doc = self._make_open_document(amount=Decimal("500.00"))
        ReceivableDocument.objects.filter(id=doc.id).update(service_order_id=uuid.uuid4())
        url = f"{self.DOCUMENTS_URL}{doc.id}/"
        self.assertEqual(self.client.patch(url, {"amount": "1.00"}, format="json").status_code, 400)
        self.assertEqual(
            self.client.patch(url, {"description": "Outra"}, format="json").status_code, 400
        )
        self.assertEqual(self.client.patch(url, {"notes": "ok"}, format="json").status_code, 200)

    def test_cancel_reason_is_not_writable(self) -> None:
        """Motivo de cancelamento so entra pela acao cancel."""
        self._authenticate_as_manager()
        doc = self._make_open_document()
        response = self.client.patch(
            f"{self.DOCUMENTS_URL}{doc.id}/", {"cancel_reason": "forjado"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        doc.refresh_from_db()
        self.assertEqual(doc.cancel_reason, "")
