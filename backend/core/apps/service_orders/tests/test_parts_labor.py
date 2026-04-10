"""
Testes de integração para peças e serviços de OS — Sprint 10.
Herda de TenantTestCase para isolamento de schema.
"""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class OSPartsTestCase(TenantTestCase):
    """Testes de integração para CRUD de peças (ServiceOrderPart) em OS."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="tech@dscar.com",
            email_hash=_sha256("tech@dscar.com"),
            password="x",
        )
        cls.os = ServiceOrder.objects.create(
            number=9001,
            plate="ABC1234",
            customer_name="Teste",
            status=ServiceOrderStatus.REPAIR,
            created_by=cls.user,
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.client.defaults["SERVER_NAME"] = "dscar.localhost"

    def _parts_url(self, os_id: str | None = None) -> str:
        oid = os_id or str(self.os.id)
        return f"/api/v1/service-orders/{oid}/parts/"

    def _labor_url(self, os_id: str | None = None) -> str:
        oid = os_id or str(self.os.id)
        return f"/api/v1/service-orders/{oid}/labor/"

    # ── Peças ─────────────────────────────────────────────────────────────────

    def test_add_part_returns_201_and_updates_parts_total(self) -> None:
        payload = {
            "description": "Parachoque dianteiro",
            "quantity": "1.00",
            "unit_price": "850.00",
            "discount": "0.00",
        }
        resp = self.client.post(self._parts_url(), payload, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertAlmostEqual(float(resp.data["total"]), 850.0)
        self.os.refresh_from_db()
        self.assertGreaterEqual(self.os.parts_total, Decimal("850.00"))

    def test_add_part_invalid_quantity_returns_400(self) -> None:
        payload = {
            "description": "Peça X",
            "quantity": "-1.00",
            "unit_price": "100.00",
            "discount": "0.00",
        }
        resp = self.client.post(self._parts_url(), payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("quantity", resp.data)

    def test_add_part_zero_quantity_returns_400(self) -> None:
        payload = {
            "description": "Peça zero",
            "quantity": "0.00",
            "unit_price": "100.00",
            "discount": "0.00",
        }
        resp = self.client.post(self._parts_url(), payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("quantity", resp.data)

    def test_add_part_discount_exceeds_total_returns_400(self) -> None:
        payload = {
            "description": "Peça Y",
            "quantity": "1.00",
            "unit_price": "100.00",
            "discount": "150.00",
        }
        resp = self.client.post(self._parts_url(), payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("discount", resp.data)

    def test_delete_part_recalculates_total(self) -> None:
        from apps.service_orders.models import ServiceOrderPart

        os2 = ServiceOrder.objects.create(
            number=9010, plate="DEL0001", customer_name="Delete Test",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        part = ServiceOrderPart.objects.create(
            service_order=os2,
            created_by=self.user,
            description="Peça para deletar",
            quantity=Decimal("1.00"),
            unit_price=Decimal("500.00"),
            discount=Decimal("0.00"),
        )
        os2.refresh_from_db()
        self.assertEqual(os2.parts_total, Decimal("500.00"))

        resp = self.client.delete(f"{self._parts_url(str(os2.id))}{part.id}/")
        self.assertEqual(resp.status_code, 204)
        os2.refresh_from_db()
        self.assertEqual(os2.parts_total, Decimal("0.00"))

    def test_patch_part_updates_total(self) -> None:
        from apps.service_orders.models import ServiceOrderPart

        os3 = ServiceOrder.objects.create(
            number=9011, plate="PAT0001", customer_name="Patch Test",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        part = ServiceOrderPart.objects.create(
            service_order=os3,
            created_by=self.user,
            description="Peça patch",
            quantity=Decimal("1.00"),
            unit_price=Decimal("100.00"),
            discount=Decimal("0.00"),
        )
        resp = self.client.patch(
            f"{self._parts_url(str(os3.id))}{part.id}/",
            {"unit_price": "200.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        os3.refresh_from_db()
        self.assertEqual(os3.parts_total, Decimal("200.00"))

    def test_add_part_to_delivered_os_returns_422(self) -> None:
        delivered_os = ServiceOrder.objects.create(
            number=9002,
            plate="DEL0002",
            customer_name="Entregue",
            status=ServiceOrderStatus.DELIVERED,
            created_by=self.user,
        )
        payload = {
            "description": "Tentativa inválida",
            "quantity": "1.00",
            "unit_price": "100.00",
            "discount": "0.00",
        }
        resp = self.client.post(self._parts_url(str(delivered_os.id)), payload, format="json")
        self.assertEqual(resp.status_code, 422)

    def test_list_parts_returns_all_items(self) -> None:
        from apps.service_orders.models import ServiceOrderPart

        os4 = ServiceOrder.objects.create(
            number=9003, plate="LST0001", customer_name="Lista",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        for i in range(3):
            ServiceOrderPart.objects.create(
                service_order=os4,
                created_by=self.user,
                description=f"Peça {i}",
                quantity=Decimal("1"),
                unit_price=Decimal("10"),
                discount=Decimal("0"),
            )
        resp = self.client.get(self._parts_url(str(os4.id)))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 3)

    # ── Serviços ───────────────────────────────────────────────────────────────

    def test_add_labor_returns_201_and_updates_services_total(self) -> None:
        os5 = ServiceOrder.objects.create(
            number=9004, plate="LAB0001", customer_name="Labor Test",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        payload = {
            "description": "Troca de óleo",
            "quantity": "1.00",
            "unit_price": "120.00",
            "discount": "0.00",
        }
        resp = self.client.post(self._labor_url(str(os5.id)), payload, format="json")
        self.assertEqual(resp.status_code, 201)
        os5.refresh_from_db()
        self.assertEqual(os5.services_total, Decimal("120.00"))

    def test_add_part_with_product_link(self) -> None:
        """
        Verifica que uma peca pode ser criada vinculada a um produto do catalogo,
        que product_id e persistido corretamente e que product_name aparece na resposta
        como campo read-only via SerializerMethodField.
        """
        from apps.inventory.models import Product
        from apps.service_orders.models import ServiceOrderPart

        product = Product.objects.create(
            sku="PARA-001",
            name="Parachoque Dianteiro Universal",
        )

        os_product = ServiceOrder.objects.create(
            number=9020,
            plate="PRD0001",
            customer_name="Teste Produto",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )

        payload = {
            "description": "Parachoque dianteiro",
            "product": str(product.id),
            "quantity": "1.00",
            "unit_price": "950.00",
            "discount": "0.00",
        }
        resp = self.client.post(self._parts_url(str(os_product.id)), payload, format="json")
        self.assertEqual(resp.status_code, 201)

        # product_id persistido corretamente no banco
        part = ServiceOrderPart.objects.get(id=resp.data["id"])
        self.assertEqual(part.product_id, product.id)

        # product_name presente na resposta como campo read-only
        self.assertIn("product_name", resp.data)
        self.assertEqual(resp.data["product_name"], "Parachoque Dianteiro Universal")

    def test_list_labor_returns_all_items(self) -> None:
        from apps.service_orders.models import ServiceOrderLabor

        os6 = ServiceOrder.objects.create(
            number=9005, plate="LST0002", customer_name="Lista Labor",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        for i in range(2):
            ServiceOrderLabor.objects.create(
                service_order=os6,
                created_by=self.user,
                description=f"Serviço {i}",
                quantity=Decimal("1"),
                unit_price=Decimal("50"),
                discount=Decimal("0"),
            )
        resp = self.client.get(self._labor_url(str(os6.id)))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_single_instance_delete_recalculates_totals(self) -> None:
        """TC-SO-02: deletar peça via instância direta (.delete()) recalcula parts_total da OS."""
        from apps.service_orders.models import ServiceOrderPart

        os_del = ServiceOrder.objects.create(
            number=9030,
            plate="SID0001",
            customer_name="Single Instance Delete",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        part_a = ServiceOrderPart.objects.create(
            service_order=os_del,
            created_by=self.user,
            description="Peca A",
            quantity=Decimal("1.00"),
            unit_price=Decimal("300.00"),
            discount=Decimal("0.00"),
        )
        ServiceOrderPart.objects.create(
            service_order=os_del,
            created_by=self.user,
            description="Peca B",
            quantity=Decimal("2.00"),
            unit_price=Decimal("100.00"),
            discount=Decimal("0.00"),
        )
        os_del.refresh_from_db()
        self.assertEqual(os_del.parts_total, Decimal("500.00"))

        # Deletar via instância direta (não via ViewSet) para testar o signal/guard
        part_a.delete()
        os_del.refresh_from_db()
        self.assertEqual(
            os_del.parts_total,
            Decimal("200.00"),
            "parts_total deve ser recalculado para R$200 apos deletar peca_a de R$300",
        )

    def test_bulk_delete_recalculates_totals(self) -> None:
        """QuerySet.delete() em multiplas pecas deve recalcular parts_total via ServiceOrderPartQuerySet."""
        from apps.service_orders.models import ServiceOrderPart

        os_bulk = ServiceOrder.objects.create(
            number=9040,
            plate="BLK0001",
            customer_name="Bulk Delete Test",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        ServiceOrderPart.objects.create(
            service_order=os_bulk,
            created_by=self.user,
            description="Peca Bulk 1",
            quantity=Decimal("1.00"),
            unit_price=Decimal("400.00"),
            discount=Decimal("0.00"),
        )
        ServiceOrderPart.objects.create(
            service_order=os_bulk,
            created_by=self.user,
            description="Peca Bulk 2",
            quantity=Decimal("2.00"),
            unit_price=Decimal("150.00"),
            discount=Decimal("0.00"),
        )
        os_bulk.refresh_from_db()
        self.assertEqual(os_bulk.parts_total, Decimal("700.00"))

        # Bulk delete via QuerySet — Model.delete() nao e chamado pelo Django;
        # ServiceOrderPartQuerySet.delete() garante o recalculo nesse cenario.
        ServiceOrderPart.objects.filter(service_order=os_bulk).delete()

        os_bulk = ServiceOrder.objects.get(id=os_bulk.id)
        self.assertEqual(
            os_bulk.parts_total,
            Decimal("0.00"),
            "parts_total deve ser zerado apos bulk delete de todas as pecas da OS",
        )
