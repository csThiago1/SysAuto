"""Tests for Person-based billing recipient resolution."""
import hashlib
from decimal import Decimal

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.accounts_receivable.models import ReceivableDocument
from apps.accounts_receivable.services import (
    ReceivableDocumentService,
    normalize_free_reference_id,
)
from apps.authentication.models import GlobalUser
from apps.insurers.models import Insurer
from apps.persons.models import Person, PersonDocument, PersonRole
from apps.service_orders.billing import BillingService
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class BillingPersonResolutionTestCase(TenantTestCase):
    """Billing must bridge tenant Person records to fiscal/financial references."""

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="billing-person@dscar.com",
            email_hash=_sha256("billing-person@dscar.com"),
            password="x",
        )

    def test_receivable_customer_id_accepts_person_pk_reference(self) -> None:
        """Person integer PKs become deterministic UUID references for AR."""
        person = Person.objects.create(person_kind="PF", full_name="Cliente AR Person")
        PersonRole.objects.create(person=person, role="CLIENT")
        order = ServiceOrder.objects.create(
            number=9401,
            plate="ARP1D23",
            customer=person,
            customer_name=person.full_name,
            customer_type="private",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )

        doc = ReceivableDocumentService.create_receivable(
            customer_id=str(person.pk),
            customer_name=person.full_name,
            description="OS 9401 — Serviços",
            amount=Decimal("100.00"),
            due_date=timezone.now().date(),
            competence_date=timezone.now().date(),
            origin="NFSE",
            service_order_id=str(order.pk),
            user=self.user,
        )

        assert isinstance(doc, ReceivableDocument)
        assert str(doc.customer_id) == normalize_free_reference_id(str(person.pk), kind="customer")

    def test_resolve_insurer_person_matches_cnpj_with_or_without_mask(self) -> None:
        """Insurer fiscal recipient is a Person with role INSURER and matching CNPJ."""
        insurer = Insurer.objects.create(
            name="Porto Seguro Cia Seguros",
            cnpj="61.198.164/0001-60",
        )
        person = Person.objects.create(
            person_kind="PJ",
            full_name="Porto Seguro Cia Seguros",
        )
        PersonRole.objects.create(person=person, role="INSURER")
        PersonDocument.objects.create(
            person=person,
            doc_type="CNPJ",
            value="61198164000160",
            is_primary=True,
        )

        resolved = BillingService._resolve_insurer_person(insurer)

        assert resolved is not None
        assert resolved.pk == person.pk

    def test_preview_splits_insurer_services_parts_and_deductible(self) -> None:
        """Insurer OS billing separates customer deductible from insurer amounts."""
        customer = Person.objects.create(person_kind="PF", full_name="Cliente Segurado")
        PersonRole.objects.create(person=customer, role="CLIENT")
        insurer = Insurer.objects.create(
            name="Azul Seguros S.A.",
            trade_name="Azul Seguros",
            cnpj="33.000.167/0001-01",
        )
        order = ServiceOrder.objects.create(
            number=9402,
            plate="SEG1D23",
            customer=customer,
            customer_name=customer.full_name,
            customer_type="insurer",
            insurer=insurer,
            insured_type="insured",
            deductible_amount=Decimal("300.00"),
            parts_total=Decimal("500.00"),
            services_total=Decimal("1000.00"),
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )

        preview = BillingService.preview(order)
        items_by_category = {item["category"]: item for item in preview["items"]}

        assert preview["insurer_name"] == "Azul Seguros"
        assert items_by_category["deductible"]["recipient_type"] == "customer"
        assert items_by_category["deductible"]["amount"] == "300.00"
        assert items_by_category["services"]["recipient_type"] == "insurer"
        assert items_by_category["services"]["amount"] == "700.00"
        assert items_by_category["parts"]["recipient_type"] == "insurer"
        assert items_by_category["parts"]["amount"] == "500.00"
