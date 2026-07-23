"""MVP pipeline tests for private and insurer service orders."""
from __future__ import annotations

import uuid
from decimal import Decimal

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.accounts_receivable.models import ReceivableOrigin
from apps.accounts_receivable.services import ReceivableDocumentService
from apps.authentication.models import GlobalUser
from apps.fiscal.models import FiscalDocument
from apps.insurers.models import Insurer
from apps.persons.models import Person, PersonRole, RolePessoa, TipoPessoa
from apps.service_orders.models import (
    OSPhotoFolder,
    ServiceOrder,
    ServiceOrderLabor,
    ServiceOrderPart,
    ServiceOrderPhoto,
    ServiceOrderVersion,
)
from apps.service_orders.services import ServiceOrderService
from apps.signatures.models import Signature


class ServiceOrderMvpPipelineTest(TenantTestCase):
    """Valida fluxos ponta a ponta necessários para o MVP operacional."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.name = "Tenant DS Car MVP"
        tenant.slug = "dscar_mvp"
        tenant.client_slug = "grupo-dscar_mvp"
        return tenant

    @classmethod
    def setup_domain(cls, domain):
        domain.domain = "mvp.paddock.solutions"
        domain.is_primary = True
        return domain

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create(
            email=f"mvp_{uuid.uuid4()}@paddock.solutions",
            name="MVP Tester",
        )
        self.customer = Person.objects.create(
            full_name="Cliente MVP",
            person_kind=TipoPessoa.FISICA,
        )
        PersonRole.objects.create(person=self.customer, role=RolePessoa.CLIENTE)
        self.insurer = Insurer.objects.create(
            name=f"Seguradora MVP {uuid.uuid4()}",
            trade_name="Seguradora MVP",
            code=f"MVP_{uuid.uuid4().hex[:8]}",
            cnpj=f"{uuid.uuid4().int % 10**14:014d}",
        )

    def _create_order(self, **kwargs) -> ServiceOrder:
        data = {
            "customer_id": self.customer.pk,
            "customer_type": "private",
            "plate": "MVP1A23",
            "make": "Toyota",
            "model": "Corolla",
            "year": 2024,
            "color": "Branco",
            "fuel_type": "Flex",
            "mileage_in": 10000,
        }
        data.update(kwargs)
        return ServiceOrderService.create(data=data, created_by_id=str(self.user.id))

    def _transition(self, order: ServiceOrder, status: str, *, force: bool = True) -> ServiceOrder:
        return ServiceOrderService.transition(
            order_id=str(order.id),
            new_status=status,
            changed_by_id=str(self.user.id),
            force=force,
            manager_verified=force,
            justification="Validação MVP",
        )

    def _add_received_part(self, order: ServiceOrder, *, payer: str = "customer") -> ServiceOrderPart:
        return ServiceOrderPart.objects.create(
            service_order=order,
            description="Parachoque dianteiro",
            quantity=Decimal("1"),
            unit_price=Decimal("1200.00"),
            origem="seguradora" if payer == "insurer" else "estoque",
            status_peca="recebida",
            payer=payer,
            source_type="import" if payer == "insurer" else "manual",
            billing_status="pending",
        )

    def _add_labor(self, order: ServiceOrder, *, payer: str = "customer") -> ServiceOrderLabor:
        return ServiceOrderLabor.objects.create(
            service_order=order,
            description="Funilaria",
            quantity=Decimal("2"),
            unit_price=Decimal("150.00"),
            payer=payer,
            source_type="import" if payer == "insurer" else "manual",
            billing_status="pending",
        )

    def _add_signature(self, order: ServiceOrder, document_type: str) -> None:
        Signature.objects.create(
            service_order=order,
            document_type=document_type,
            method="CANVAS_TABLET",
            signer_name="Cliente MVP",
            signature_png_base64="data:image/png;base64,ZmFrZQ==",
            signature_hash="a" * 64,
        )

    def _add_receivable(self, order: ServiceOrder, *, origin: str = ReceivableOrigin.OS) -> None:
        today = timezone.now().date()
        ReceivableDocumentService.create_receivable(
            customer_id=str(order.customer_id),
            customer_name=order.customer_name,
            description=f"OS {order.number} MVP",
            amount=Decimal("1500.00"),
            due_date=today,
            competence_date=today,
            origin=origin,
            service_order_id=str(order.id),
            user=self.user,
        )

    def _add_nfce(self, order: ServiceOrder) -> None:
        FiscalDocument.objects.create(
            service_order=order,
            destinatario=order.customer,
            document_type="nfce",
            status="authorized",
            number=f"{order.number}",
            total_value=Decimal("1500.00"),
        )

    def _run_workshop_until_ready(self, order: ServiceOrder) -> ServiceOrder:
        for target in (
            "waiting_parts",
            "repair",
            "bodywork",
            "painting",
            "assembly",
            "polishing",
            "washing",
            "final_survey",
            "ready",
        ):
            order = self._transition(order, target)
        return order

    def test_private_service_order_can_complete_pipeline(self) -> None:
        order = self._create_order()
        order = self._transition(order, "initial_survey", force=False)
        order = self._transition(order, "budget")
        self._add_received_part(order)
        self._add_labor(order)
        order = self._transition(order, "waiting_auth", force=False)

        self._add_signature(order, "BUDGET_APPROVAL")
        ServiceOrderService.update(
            order_id=str(order.id),
            data={"authorization_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self.assertEqual(order.status, "authorized")
        order = self._run_workshop_until_ready(order)

        ServiceOrderService.update(
            order_id=str(order.id),
            data={"mileage_out": 10200},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self._add_nfce(order)
        self._add_receivable(order, origin=ReceivableOrigin.NFCE)
        self._add_signature(order, "OS_DELIVERY")
        order = self._transition(order, "delivered", force=False)

        self.assertEqual(order.status, "delivered")
        self.assertIsNotNone(order.delivered_at)
        self.assertTrue(order.fiscal_documents.filter(document_type="nfce").exists())

    def test_insurer_service_order_can_complete_pipeline(self) -> None:
        order = self._create_order(
            customer_type="insurer",
            insurer=self.insurer,
            insured_type="insured",
            casualty_number="SIN-MVP-001",
            deductible_amount=Decimal("500.00"),
        )
        order = self._transition(order, "initial_survey", force=False)
        order = self._transition(order, "budget")
        ServiceOrderPhoto.objects.create(
            service_order=order,
            folder=OSPhotoFolder.BUDGETS,
            s3_key=f"tests/{order.id}/orcamento.pdf",
            uploaded_by_id=self.user.id,
        )
        order = self._transition(order, "waiting_auth")
        self._add_received_part(order, payer="insurer")
        self._add_labor(order, payer="insurer")
        ServiceOrderVersion.objects.create(
            service_order=order,
            version_number=1,
            source="cilia",
            status="autorizado",
        )
        ServiceOrderService.update(
            order_id=str(order.id),
            data={"authorization_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self.assertEqual(order.status, "authorized")
        order = self._run_workshop_until_ready(order)

        ServiceOrderService.update(
            order_id=str(order.id),
            data={"mileage_out": 10300},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self._add_receivable(order, origin=ReceivableOrigin.NFE)
        self._add_signature(order, "OS_DELIVERY")
        order = self._transition(order, "delivered", force=False)

        self.assertEqual(order.status, "delivered")
        self.assertFalse(order.fiscal_documents.filter(document_type="nfce").exists())
        self.assertTrue(order.versions.filter(status="autorizado").exists())
