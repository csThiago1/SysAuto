"""
Testes do fluxo de complemento particular — CRUD e faturamento.
Herda de TenantTestCase para isolamento de schema.
"""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import (
    ServiceOrder,
    ServiceOrderLabor,
    ServiceOrderPart,
    ServiceOrderStatus,
)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class ComplementCRUDTestCase(TenantTestCase):
    """Testes de integração para CRUD de itens do complemento particular."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="complement@dscar.com",
            email_hash=_sha256("complement@dscar.com"),
            password="x",
        )
        cls.os = ServiceOrder.objects.create(
            number=8001,
            plate="CMP1001",
            customer_name="Cliente Complemento",
            status=ServiceOrderStatus.REPAIR,
            created_by=cls.user,
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.client.defaults["SERVER_NAME"] = "dscar.localhost"

    # ── URLs auxiliares ────────────────────────────────────────────────────────

    def _parts_url(self, os_id=None) -> str:
        oid = os_id or str(self.os.id)
        return f"/api/v1/service-orders/{oid}/complement/parts/"

    def _services_url(self, os_id=None) -> str:
        oid = os_id or str(self.os.id)
        return f"/api/v1/service-orders/{oid}/complement/services/"

    def _item_url(self, item_pk, os_id=None) -> str:
        oid = os_id or str(self.os.id)
        return f"/api/v1/service-orders/{oid}/complement/{item_pk}/"

    def _bill_url(self, os_id=None) -> str:
        oid = os_id or str(self.os.id)
        return f"/api/v1/service-orders/{oid}/complement/bill/"

    # ── Adicionar peça complement ──────────────────────────────────────────────

    def test_add_complement_part_returns_201(self) -> None:
        payload = {
            "description": "Polimento cristalizado",
            "quantity": "1.00",
            "unit_price": "350.00",
            "discount": "0.00",
        }
        resp = self.client.post(self._parts_url(), payload, format="json")
        self.assertEqual(resp.status_code, 201)

    def test_add_complement_part_sets_payer_and_source_type(self) -> None:
        payload = {
            "description": "Polimento cristalizado",
            "quantity": "1.00",
            "unit_price": "350.00",
            "discount": "0.00",
        }
        resp = self.client.post(self._parts_url(), payload, format="json")
        self.assertEqual(resp.status_code, 201)
        part = ServiceOrderPart.objects.get(pk=resp.data["id"])
        self.assertEqual(part.payer, "customer")
        self.assertEqual(part.source_type, "complement")
        self.assertEqual(part.billing_status, "pending")

    # ── Adicionar serviço complement ───────────────────────────────────────────

    def test_add_complement_service_returns_201(self) -> None:
        payload = {
            "description": "Película fumê G5",
            "quantity": "1.00",
            "unit_price": "280.00",
            "discount": "0.00",
        }
        resp = self.client.post(self._services_url(), payload, format="json")
        self.assertEqual(resp.status_code, 201)

    def test_add_complement_service_sets_payer_and_source_type(self) -> None:
        payload = {
            "description": "Película fumê G5",
            "quantity": "1.00",
            "unit_price": "280.00",
            "discount": "0.00",
        }
        resp = self.client.post(self._services_url(), payload, format="json")
        self.assertEqual(resp.status_code, 201)
        labor = ServiceOrderLabor.objects.get(pk=resp.data["id"])
        self.assertEqual(labor.payer, "customer")
        self.assertEqual(labor.source_type, "complement")

    # ── Listar itens complement ────────────────────────────────────────────────

    def test_list_complement_parts(self) -> None:
        os_list = ServiceOrder.objects.create(
            number=8002, plate="CMP1002", customer_name="Lista Parts",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        for i in range(2):
            ServiceOrderPart.objects.create(
                service_order=os_list,
                created_by=self.user,
                description=f"Peça complement {i}",
                quantity=Decimal("1"),
                unit_price=Decimal("100"),
                discount=Decimal("0"),
                payer="customer",
                source_type="complement",
            )
        resp = self.client.get(self._parts_url(str(os_list.id)))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_list_complement_services(self) -> None:
        os_list = ServiceOrder.objects.create(
            number=8003, plate="CMP1003", customer_name="Lista Labor",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        ServiceOrderLabor.objects.create(
            service_order=os_list,
            created_by=self.user,
            description="Serviço complement",
            quantity=Decimal("1"),
            unit_price=Decimal("200"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        resp = self.client.get(self._services_url(str(os_list.id)))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)

    # ── Editar item complement ─────────────────────────────────────────────────

    def test_patch_complement_part_returns_200(self) -> None:
        os_patch = ServiceOrder.objects.create(
            number=8004, plate="CMP1004", customer_name="Patch Test",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        part = ServiceOrderPart.objects.create(
            service_order=os_patch,
            created_by=self.user,
            description="Peça editável",
            quantity=Decimal("1"),
            unit_price=Decimal("100"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        resp = self.client.patch(
            self._item_url(str(part.id), str(os_patch.id)),
            {"description": "Peça editada"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

    def test_cannot_edit_billed_part_returns_400(self) -> None:
        os_billed = ServiceOrder.objects.create(
            number=8005, plate="CMP1005", customer_name="Billed Edit",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        part = ServiceOrderPart.objects.create(
            service_order=os_billed,
            created_by=self.user,
            description="Peça faturada",
            quantity=Decimal("1"),
            unit_price=Decimal("100"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
            billing_status="billed",
        )
        resp = self.client.patch(
            self._item_url(str(part.id), str(os_billed.id)),
            {"description": "Tentativa de edição"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_cannot_edit_billed_labor_returns_400(self) -> None:
        os_billed2 = ServiceOrder.objects.create(
            number=8006, plate="CMP1006", customer_name="Billed Labor Edit",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        labor = ServiceOrderLabor.objects.create(
            service_order=os_billed2,
            created_by=self.user,
            description="Serviço faturado",
            quantity=Decimal("1"),
            unit_price=Decimal("200"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
            billing_status="billed",
        )
        resp = self.client.patch(
            self._item_url(str(labor.id), str(os_billed2.id)),
            {"description": "Tentativa de edição"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    # ── Deletar item complement ────────────────────────────────────────────────

    def test_delete_complement_part_returns_204(self) -> None:
        os_del = ServiceOrder.objects.create(
            number=8007, plate="CMP1007", customer_name="Delete Test",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        part = ServiceOrderPart.objects.create(
            service_order=os_del,
            created_by=self.user,
            description="Peça a deletar",
            quantity=Decimal("1"),
            unit_price=Decimal("100"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        resp = self.client.delete(self._item_url(str(part.id), str(os_del.id)))
        self.assertEqual(resp.status_code, 204)

    def test_cannot_delete_billed_part_returns_400(self) -> None:
        os_del2 = ServiceOrder.objects.create(
            number=8008, plate="CMP1008", customer_name="Billed Delete",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        part = ServiceOrderPart.objects.create(
            service_order=os_del2,
            created_by=self.user,
            description="Peça faturada não deletável",
            quantity=Decimal("1"),
            unit_price=Decimal("100"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
            billing_status="billed",
        )
        resp = self.client.delete(self._item_url(str(part.id), str(os_del2.id)))
        self.assertEqual(resp.status_code, 400)

    def test_cannot_delete_billed_labor_returns_400(self) -> None:
        os_del3 = ServiceOrder.objects.create(
            number=8009, plate="CMP1009", customer_name="Billed Labor Delete",
            status=ServiceOrderStatus.REPAIR, created_by=self.user,
        )
        labor = ServiceOrderLabor.objects.create(
            service_order=os_del3,
            created_by=self.user,
            description="Serviço faturado não deletável",
            quantity=Decimal("1"),
            unit_price=Decimal("200"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
            billing_status="billed",
        )
        resp = self.client.delete(self._item_url(str(labor.id), str(os_del3.id)))
        self.assertEqual(resp.status_code, 400)

    def test_item_not_found_returns_404(self) -> None:
        """Item inexistente ou que não pertence ao complemento retorna 404."""
        import uuid
        fake_pk = str(uuid.uuid4())
        resp = self.client.patch(
            self._item_url(fake_pk),
            {"description": "Não existe"},
            format="json",
        )
        self.assertEqual(resp.status_code, 404)


class ComplementBillingTestCase(TenantTestCase):
    """Testes de integração para faturamento do complemento particular."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="billing@dscar.com",
            email_hash=_sha256("billing@dscar.com"),
            password="x",
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.client.defaults["SERVER_NAME"] = "dscar.localhost"

    def _bill_url(self, os_id: str) -> str:
        return f"/api/v1/service-orders/{os_id}/complement/bill/"

    def test_bill_pending_complement_returns_billed_true(self) -> None:
        """Faturar OS com itens pendentes retorna billed=True."""
        os = ServiceOrder.objects.create(
            number=8020,
            plate="BIL1001",
            customer_name="Cliente Faturável",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Polimento",
            quantity=Decimal("1"),
            unit_price=Decimal("350"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        resp = self.client.post(self._bill_url(str(os.id)))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["billed"])

    def test_bill_empty_complement_returns_billed_false(self) -> None:
        """Faturar OS sem itens pendentes de complemento retorna billed=False."""
        os = ServiceOrder.objects.create(
            number=8021,
            plate="BIL1002",
            customer_name="OS Sem Complemento",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        resp = self.client.post(self._bill_url(str(os.id)))
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["billed"])

    def test_bill_marks_items_as_billed(self) -> None:
        """Após faturamento, itens pending devem ter billing_status='billed'."""
        os = ServiceOrder.objects.create(
            number=8022,
            plate="BIL1003",
            customer_name="Cliente Marcação",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        part = ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Pintura extra",
            quantity=Decimal("1"),
            unit_price=Decimal("500"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        labor = ServiceOrderLabor.objects.create(
            service_order=os,
            created_by=self.user,
            description="Polimento",
            quantity=Decimal("1"),
            unit_price=Decimal("200"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
        )
        resp = self.client.post(self._bill_url(str(os.id)))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["billed"])

        part.refresh_from_db()
        labor.refresh_from_db()
        self.assertEqual(part.billing_status, "billed")
        self.assertEqual(labor.billing_status, "billed")

    def test_bill_already_billed_items_not_double_billed(self) -> None:
        """Itens já faturados não são faturados novamente; resultado billed=False se nenhum pendente."""
        os = ServiceOrder.objects.create(
            number=8023,
            plate="BIL1004",
            customer_name="Já Faturado",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        ServiceOrderPart.objects.create(
            service_order=os,
            created_by=self.user,
            description="Peça já faturada",
            quantity=Decimal("1"),
            unit_price=Decimal("300"),
            discount=Decimal("0"),
            payer="customer",
            source_type="complement",
            billing_status="billed",
        )
        resp = self.client.post(self._bill_url(str(os.id)))
        self.assertEqual(resp.status_code, 200)
        # Nenhum item pendente — billed deve ser False
        self.assertFalse(resp.data["billed"])

    def test_unauthenticated_bill_returns_401(self) -> None:
        """Chamada sem autenticação deve retornar 401."""
        os = ServiceOrder.objects.create(
            number=8024,
            plate="BIL1005",
            customer_name="Anon Test",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        anon = APIClient()
        anon.defaults["SERVER_NAME"] = "dscar.localhost"
        resp = anon.post(self._bill_url(str(os.id)))
        self.assertEqual(resp.status_code, 401)
