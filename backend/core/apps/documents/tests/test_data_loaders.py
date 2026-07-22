"""OSDataLoader — garante que o envelope comum (_base_context) sobrevive
aos updates específicos de cada tipo de documento."""
import hashlib
from decimal import Decimal

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.accounts_receivable.services import ReceivableDocumentService
from apps.authentication.models import GlobalUser
from apps.documents.data_loaders import OSDataLoader
from apps.persons.models import Person, PersonRole
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus

_ENVELOPE_KEYS = {"company", "logo_base64", "logo_black_base64", "order", "location_date"}


class OSDataLoaderEnvelopeTestCase(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "pdf-loader@dscar.com"
        self.user = GlobalUser.objects.create_user(
            email=email,
            email_hash=hashlib.sha256(email.encode()).hexdigest(),
            password="x",
        )
        self.person = Person.objects.create(person_kind="PF", full_name="Cliente PDF Loader")
        PersonRole.objects.create(person=self.person, role="CLIENT")
        self.order = ServiceOrder.objects.create(
            number=9601,
            plate="PDF1L23",
            customer=self.person,
            customer_name=self.person.full_name,
            customer_type="private",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )

    def _assert_envelope(self, data: dict) -> None:
        assert _ENVELOPE_KEYS <= data.keys()
        assert data["order"]["number"] == self.order.number

    def test_load_os_report_keeps_envelope(self) -> None:
        self._assert_envelope(OSDataLoader.load_os_report(self.order.pk))

    def test_load_warranty_keeps_envelope(self) -> None:
        self._assert_envelope(OSDataLoader.load_warranty(self.order.pk))

    def test_load_settlement_keeps_envelope(self) -> None:
        self._assert_envelope(OSDataLoader.load_settlement(self.order.pk))

    def test_load_receipt_keeps_envelope(self) -> None:
        receivable = ReceivableDocumentService.create_receivable(
            customer_id=str(self.person.pk),
            customer_name=self.person.full_name,
            description="OS 9601 — Serviços",
            amount=Decimal("100.00"),
            due_date=timezone.now().date(),
            competence_date=timezone.now().date(),
            origin="NFSE",
            service_order_id=str(self.order.pk),
            user=self.user,
        )
        self._assert_envelope(OSDataLoader.load_receipt(self.order.pk, receivable.pk))
