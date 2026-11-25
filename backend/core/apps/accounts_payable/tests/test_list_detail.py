"""
Contas a Pagar com fornecedor em persons.Person: listagem, detalhe e filtro.

Person so tem full_name; ler `.name` derrubava a listagem com 500.
"""

import hashlib
from datetime import date, timedelta
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.accounts_payable.models import PayableDocument
from apps.authentication.models import GlobalUser
from apps.persons.models import Person, PersonRole, RolePessoa

URL = "/api/v1/accounts-payable/documents/"


class TestPayableListDetail(TenantTestCase):
    """GET de titulos a pagar devolve o nome do fornecedor (Person.full_name)."""

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="contas-pagar@dscar.com",
            email_hash=hashlib.sha256(b"contas-pagar@dscar.com").hexdigest(),
            password="x",
        )
        self.supplier = self._supplier("Papelaria Central")
        self.doc = self._doc(self.supplier, "Resma A4")

        self.client = APIClient()
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.client.defaults["SERVER_NAME"] = "tenant.test.com"

    def _supplier(self, full_name: str) -> Person:
        person = Person.objects.create(full_name=full_name)
        PersonRole.objects.create(person=person, role=RolePessoa.FORNECEDOR)
        return person

    def _doc(self, supplier: Person, description: str) -> PayableDocument:
        today = date.today()
        return PayableDocument.objects.create(
            supplier=supplier,
            description=description,
            amount=Decimal("150.00"),
            due_date=today + timedelta(days=30),
            competence_date=today,
            created_by=self.user,
        )

    def test_list_returns_supplier_name(self) -> None:
        """A listagem responde 200 e traz o nome do fornecedor."""
        resp = self.client.get(URL)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["results"][0]["supplier_name"], "Papelaria Central")

    def test_detail_returns_supplier_name(self) -> None:
        """O detalhe traz supplier_name (antes o campo era omitido em silencio)."""
        resp = self.client.get(f"{URL}{self.doc.id}/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["supplier_name"], "Papelaria Central")

    def test_str_uses_full_name(self) -> None:
        """__str__ do titulo (usado no admin) nao quebra."""
        self.assertIn("Papelaria Central", str(self.doc))

    def test_filter_by_supplier_id(self) -> None:
        """?supplier=<id inteiro de Person> filtra em vez de devolver 400."""
        other = self._supplier("Auto Pecas Norte")
        self._doc(other, "Filtro de oleo")
        resp = self.client.get(URL, {"supplier": self.supplier.id})
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual([row["id"] for row in resp.data["results"]], [str(self.doc.id)])
