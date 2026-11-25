"""
Paddock Solutions — Accounts Receivable — testes da listagem.

Cobre o chao da tela de Contas a Receber: a busca acha pelo cliente, o filtro de
vencimento usa due_date_gte/lte e os totais dos cartoes somam todos os titulos
(nao so a primeira pagina).
"""

import hashlib
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.accounts_receivable.models import ReceivableDocument, ReceivableStatus
from apps.authentication.models import GlobalUser

URL = "/api/v1/accounts-receivable/documents/"


class ARListTestCase(TenantTestCase):
    """Base: usuario MANAGER autenticado."""

    def setUp(self) -> None:
        super().setUp()
        email = "lista-ar@example.com"
        self.user = GlobalUser.objects.create_user(
            email=email,
            password="test123",
            name="Lista AR",
            email_hash=hashlib.sha256(email.encode()).hexdigest(),
        )
        self.today: date = timezone.localdate()

        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "MANAGER"})

    def _doc(self, **overrides: Any) -> ReceivableDocument:
        data: dict[str, Any] = {
            "customer_id": uuid.uuid4(),
            "customer_name": "Cliente Alfa",
            "description": "Titulo de teste",
            "amount": Decimal("100.00"),
            "due_date": self.today + timedelta(days=10),
            "competence_date": self.today,
            "status": ReceivableStatus.OPEN,
            "created_by": self.user,
        }
        data.update(overrides)
        return ReceivableDocument.objects.create(**data)


class TestListDocuments(ARListTestCase):
    """GET /documents/ com busca e filtro de vencimento."""

    def test_search_matches_customer_name(self) -> None:
        """B2: ?search= acha pelo nome do cliente, nao so pela descricao."""
        self._doc(description="Funilaria porta")
        self._doc(customer_name="Cliente Beta", description="Pintura capo")
        resp = self.client.get(URL, {"search": "Beta"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["customer_name"], "Cliente Beta")

    def test_due_date_filter_params(self) -> None:
        """B1: contrato do filtro de vencimento — due_date_gte / due_date_lte."""
        self._doc(description="Vence logo", due_date=self.today + timedelta(days=5))
        self._doc(description="Vence depois", due_date=self.today + timedelta(days=40))
        resp = self.client.get(
            URL,
            {
                "due_date_gte": str(self.today + timedelta(days=30)),
                "due_date_lte": str(self.today + timedelta(days=60)),
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["description"], "Vence depois")


class TestSummary(ARListTestCase):
    """GET /documents/summary/ — totais dos cartoes."""

    def test_summary_sums_beyond_first_page(self) -> None:
        """B3: totais somados no banco, alem dos 25 titulos da primeira pagina."""
        for _ in range(30):
            self._doc()  # 30 x 100,00 em aberto
        self._doc(amount=Decimal("50.00"), due_date=self.today - timedelta(days=1))
        self._doc(amount=Decimal("70.00"), due_date=self.today)
        self._doc(
            amount=Decimal("200.00"),
            amount_received=Decimal("200.00"),
            due_date=self.today,
            status=ReceivableStatus.RECEIVED,
        )
        self._doc(amount=Decimal("999.00"), status=ReceivableStatus.CANCELLED)

        resp = self.client.get(f"{URL}summary/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Decimal(resp.data["total_open"]), Decimal("3120.00"))
        self.assertEqual(Decimal(resp.data["total_overdue"]), Decimal("50.00"))
        self.assertEqual(Decimal(resp.data["settled_this_month"]), Decimal("200.00"))
        self.assertEqual(Decimal(resp.data["due_today"]), Decimal("70.00"))

    def test_summary_without_documents_returns_zeros(self) -> None:
        """B3: sem titulos, os quatro totais vem como "0.00" (nunca null)."""
        resp = self.client.get(f"{URL}summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            resp.data,
            {
                "total_open": "0.00",
                "total_overdue": "0.00",
                "settled_this_month": "0.00",
                "due_today": "0.00",
            },
        )
