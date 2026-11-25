"""
Paddock Solutions — Accounts Payable — testes da listagem.

Cobre o chao da tela de Contas a Pagar: a busca acha pelo fornecedor, o filtro de
vencimento usa due_date_gte/lte e os totais dos cartoes somam todos os titulos
(nao so a primeira pagina).
"""

import hashlib
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.accounts_payable.models import DocumentStatus, PayableDocument
from apps.authentication.models import GlobalUser
from apps.persons.models import Person, PersonRole, RolePessoa

URL = "/api/v1/accounts-payable/documents/"


class APListTestCase(TenantTestCase):
    """Base: usuario MANAGER autenticado e um fornecedor (Person + role SUPPLIER)."""

    def setUp(self) -> None:
        super().setUp()
        email = "lista-ap@example.com"
        self.user = GlobalUser.objects.create_user(
            email=email,
            password="test123",
            name="Lista AP",
            email_hash=hashlib.sha256(email.encode()).hexdigest(),
        )
        self.supplier = self._supplier("Fornecedor Alfa")
        self.today: date = timezone.localdate()

        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "MANAGER"})

    def _supplier(self, name: str) -> Person:
        person = Person.objects.create(full_name=name)
        PersonRole.objects.create(person=person, role=RolePessoa.FORNECEDOR)
        return person

    def _doc(self, **overrides: Any) -> PayableDocument:
        data: dict[str, Any] = {
            "supplier": self.supplier,
            "description": "Titulo de teste",
            "amount": Decimal("100.00"),
            "due_date": self.today + timedelta(days=10),
            "competence_date": self.today,
            "status": DocumentStatus.OPEN,
            "created_by": self.user,
        }
        data.update(overrides)
        return PayableDocument.objects.create(**data)


class TestListDocuments(APListTestCase):
    """GET /documents/ com busca e filtro de vencimento."""

    def test_search_matches_supplier_name(self) -> None:
        """B2: ?search= acha pelo nome do fornecedor, nao so pela descricao."""
        self._doc(description="Compra de tinta")
        self._doc(supplier=self._supplier("Fornecedor Beta"), description="Resma de papel")
        resp = self.client.get(URL, {"search": "Beta"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["description"], "Resma de papel")

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


class TestSummary(APListTestCase):
    """GET /documents/summary/ — totais dos cartoes."""

    def test_summary_sums_beyond_first_page(self) -> None:
        """B3: totais somados no banco, alem dos 25 titulos da primeira pagina."""
        for _ in range(30):
            self._doc()  # 30 x 100,00 em aberto
        self._doc(amount=Decimal("50.00"), due_date=self.today - timedelta(days=1))
        self._doc(amount=Decimal("70.00"), due_date=self.today)
        self._doc(
            amount=Decimal("200.00"),
            amount_paid=Decimal("200.00"),
            due_date=self.today,
            status=DocumentStatus.PAID,
        )
        self._doc(amount=Decimal("999.00"), status=DocumentStatus.CANCELLED)

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
