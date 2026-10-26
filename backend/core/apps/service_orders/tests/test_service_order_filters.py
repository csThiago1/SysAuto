"""
Testes dos filtros de listagem de OS: ?customer= e ?plate=

Regressão: ambos os parâmetros estavam ausentes de `filterset_fields`, e o
DjangoFilterBackend ignora parâmetros desconhecidos em silêncio — a listagem
devolvia todas as OS da oficina em vez das do cliente/veículo pedido.
"""

import hashlib

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus

URL = "/api/v1/service-orders/"


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class ServiceOrderFilterTestCase(TenantTestCase):
    """Filtros de cliente e placa na listagem de OS."""

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.user = GlobalUser.objects.create_user(
            email="filters@dscar.com",
            email_hash=_sha256("filters@dscar.com"),
            password="x",
        )
        cls.ana = Person.objects.create(full_name="Ana Filtro")
        cls.bruno = Person.objects.create(full_name="Bruno Filtro")

        # Ana: duas OS, duas placas diferentes
        cls.os_ana_1 = ServiceOrder.objects.create(
            number=9301,
            plate="FIL1A11",
            customer=cls.ana,
            customer_name="Ana Filtro",
            status=ServiceOrderStatus.DELIVERED,
            created_by=cls.user,
        )
        cls.os_ana_2 = ServiceOrder.objects.create(
            number=9302,
            plate="FIL2B22",
            customer=cls.ana,
            customer_name="Ana Filtro",
            status=ServiceOrderStatus.REPAIR,
            created_by=cls.user,
        )
        # Bruno: uma OS, reaproveitando a placa da Ana (carro trocou de dono)
        cls.os_bruno = ServiceOrder.objects.create(
            number=9303,
            plate="FIL1A11",
            customer=cls.bruno,
            customer_name="Bruno Filtro",
            status=ServiceOrderStatus.DELIVERED,
            created_by=cls.user,
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.client.defaults["SERVER_NAME"] = "tenant.test.com"

    def _ids(self, response) -> set[str]:  # type: ignore[no-untyped-def]
        results = response.data["results"] if "results" in response.data else response.data
        return {item["id"] for item in results}

    # ── ?customer= ────────────────────────────────────────────────────────────

    def test_filter_by_customer_returns_only_that_customer(self) -> None:
        """?customer= devolve só as OS daquele cliente."""
        resp = self.client.get(URL, {"customer": str(self.ana.id), "page_size": 200})
        self.assertEqual(resp.status_code, 200)
        ids = self._ids(resp)
        self.assertIn(str(self.os_ana_1.id), ids)
        self.assertIn(str(self.os_ana_2.id), ids)
        self.assertNotIn(str(self.os_bruno.id), ids)

    def test_filter_by_customer_ignores_other_customers(self) -> None:
        """O cliente sem OS na placa compartilhada só vê a própria OS."""
        resp = self.client.get(URL, {"customer": str(self.bruno.id), "page_size": 200})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._ids(resp), {str(self.os_bruno.id)})

    # ── ?plate= ───────────────────────────────────────────────────────────────

    def test_filter_by_plate_returns_all_owners(self) -> None:
        """?plate= devolve as OS da placa, de todos os donos."""
        resp = self.client.get(URL, {"plate": "FIL1A11", "page_size": 200})
        self.assertEqual(resp.status_code, 200)
        ids = self._ids(resp)
        self.assertIn(str(self.os_ana_1.id), ids)
        self.assertIn(str(self.os_bruno.id), ids)
        self.assertNotIn(str(self.os_ana_2.id), ids)

    def test_filter_by_plate_is_case_insensitive(self) -> None:
        """?plate__iexact= aceita placa em minúscula."""
        resp = self.client.get(URL, {"plate__iexact": "fil1a11", "page_size": 200})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._ids(resp), {str(self.os_ana_1.id), str(self.os_bruno.id)})

    # ── Combinado ─────────────────────────────────────────────────────────────

    def test_filter_by_customer_and_plate(self) -> None:
        """Cliente + placa juntos restringem à interseção."""
        resp = self.client.get(
            URL,
            {"customer": str(self.ana.id), "plate": "FIL1A11", "page_size": 200},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._ids(resp), {str(self.os_ana_1.id)})
