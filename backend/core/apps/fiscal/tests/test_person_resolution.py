"""Tests for resolving fiscal recipients from service orders."""
import hashlib

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.fiscal.services.fiscal_service import FiscalService
from apps.persons.models import Person, PersonRole
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class FiscalPersonResolutionTestCase(TenantTestCase):
    """Fiscal recipient resolution must support the current Person-based OS flow."""

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(
            email="fiscal-resolution@dscar.com",
            email_hash=_sha256("fiscal-resolution@dscar.com"),
            password="x",
        )

    def test_get_person_for_os_uses_customer_person_fk(self) -> None:
        """OS.customer is the canonical recipient for new service orders."""
        person = Person.objects.create(
            person_kind="PF",
            full_name="Cliente Fiscal Person",
        )
        PersonRole.objects.create(person=person, role="CLIENT")
        order = ServiceOrder.objects.create(
            number=9301,
            plate="FIS1D23",
            customer=person,
            customer_name=person.full_name,
            customer_type="private",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )

        resolved = FiscalService._get_person_for_os(order)

        assert resolved.pk == person.pk
