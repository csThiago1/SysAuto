"""
Testes para o endpoint GET /api/v1/service-orders/vehicle-history/?plate=VHP1234
Herda de TenantTestCase para isolamento de schema.
"""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus

URL = "/api/v1/service-orders/vehicle-history/"


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class VehicleHistoryEndpointTestCase(TenantTestCase):
    """Testes de integração para o endpoint vehicle-history."""

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.user = GlobalUser.objects.create_user(
            email="vh@dscar.com",
            email_hash=_sha256("vh@dscar.com"),
            password="x",
        )
        # OS entregue com totais conhecidos
        cls.os_delivered = ServiceOrder.objects.create(
            number=9201,
            plate="VHP1234",
            customer_name="Cliente Histórico",
            status=ServiceOrderStatus.DELIVERED,
            created_by=cls.user,
            parts_total=Decimal("500.00"),
            services_total=Decimal("300.00"),
            discount_total=Decimal("50.00"),
        )
        # Segunda OS em reparo (não deve entrar no total_spent)
        cls.os_repair = ServiceOrder.objects.create(
            number=9202,
            plate="VHP1234",
            customer_name="Cliente Histórico",
            status=ServiceOrderStatus.REPAIR,
            created_by=cls.user,
            parts_total=Decimal("200.00"),
            services_total=Decimal("100.00"),
            discount_total=Decimal("0.00"),
        )
        # OS de outra placa — não deve aparecer nos resultados de VHP1234
        cls.os_other_plate = ServiceOrder.objects.create(
            number=9203,
            plate="VHP9999",
            customer_name="Outro Veículo",
            status=ServiceOrderStatus.DELIVERED,
            created_by=cls.user,
            parts_total=Decimal("1000.00"),
            services_total=Decimal("500.00"),
            discount_total=Decimal("0.00"),
        )

    def setUp(self) -> None:
        self.client = APIClient()
        # token dict simula o payload JWT com role ADMIN para satisfazer IsConsultantOrAbove
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.client.defaults["SERVER_NAME"] = "tenant.test.com"

    # ── Casos de teste ────────────────────────────────────────────────────────

    def test_requires_plate_param(self) -> None:
        """Sem o parâmetro 'plate', deve retornar 400."""
        resp = self.client.get(URL)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("detail", resp.data)

    def test_returns_os_for_plate(self) -> None:
        """Retorna apenas as OS da placa informada."""
        resp = self.client.get(URL, {"plate": "VHP1234"})
        self.assertEqual(resp.status_code, 200)
        result_ids = [item["id"] for item in resp.data["results"]]
        self.assertIn(str(self.os_delivered.id), result_ids)
        self.assertIn(str(self.os_repair.id), result_ids)
        self.assertNotIn(str(self.os_other_plate.id), result_ids)

    def test_total_spent_only_delivered(self) -> None:
        """total_spent deve agregar somente OS com status DELIVERED."""
        resp = self.client.get(URL, {"plate": "VHP1234"})
        self.assertEqual(resp.status_code, 200)
        # Apenas os_delivered: 500 + 300 - 50 = 750
        expected = Decimal("750.00")
        self.assertEqual(Decimal(resp.data["summary"]["total_spent"]), expected)

    def test_exclude_id(self) -> None:
        """O parâmetro exclude_id deve remover a OS correspondente dos resultados."""
        resp = self.client.get(URL, {"plate": "VHP1234", "exclude_id": str(self.os_repair.id)})
        self.assertEqual(resp.status_code, 200)
        result_ids = [item["id"] for item in resp.data["results"]]
        self.assertNotIn(str(self.os_repair.id), result_ids)
        self.assertIn(str(self.os_delivered.id), result_ids)

    def test_case_insensitive_plate(self) -> None:
        """Busca por placa deve ser case-insensitive."""
        resp_lower = self.client.get(URL, {"plate": "vhp1234"})
        resp_upper = self.client.get(URL, {"plate": "VHP1234"})
        self.assertEqual(resp_lower.status_code, 200)
        self.assertEqual(resp_upper.status_code, 200)
        ids_lower = {item["id"] for item in resp_lower.data["results"]}
        ids_upper = {item["id"] for item in resp_upper.data["results"]}
        self.assertEqual(ids_lower, ids_upper)

    def test_empty_results_for_unknown_plate(self) -> None:
        """Placa desconhecida deve retornar 200 com resultados vazios."""
        resp = self.client.get(URL, {"plate": "ZZZ0000"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["results"], [])
        self.assertEqual(resp.data["summary"]["os_count"], 0)
        self.assertEqual(Decimal(resp.data["summary"]["total_spent"]), Decimal("0"))

    def test_summary_os_count(self) -> None:
        """os_count do resumo deve refletir todas as OS da placa (ativas)."""
        resp = self.client.get(URL, {"plate": "VHP1234"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["summary"]["os_count"], 2)

    def test_unauthenticated_returns_401(self) -> None:
        """Sem autenticação, deve retornar 401."""
        anon = APIClient()
        anon.defaults["SERVER_NAME"] = "tenant.test.com"
        resp = anon.get(URL, {"plate": "VHP1234"})
        self.assertEqual(resp.status_code, 401)

    def test_result_fields_present(self) -> None:
        """Cada item dos resultados deve conter os campos esperados."""
        resp = self.client.get(URL, {"plate": "VHP1234"})
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(len(resp.data["results"]), 0)
        item = resp.data["results"][0]
        for field in (
            "id", "number", "status", "customer_name", "entry_date",
            "delivered_at", "parts_total", "services_total", "discount_total", "total",
        ):
            self.assertIn(field, item, msg=f"Campo '{field}' ausente no resultado")
