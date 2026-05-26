"""
Paddock Solutions — Service Orders Integration Tests
Sprint OS-001 — Testes de integração (persistência, transições e auto-incremento de tenant).
"""
import uuid

from django.core.exceptions import ValidationError
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.persons.models import Person, PersonRole, RolePessoa, TipoPessoa
from apps.service_orders.models import ServiceOrder, StatusTransitionLog
from apps.service_orders.services import ServiceOrderService

class ServiceOrderIntegrationTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.name = "Tenant DS Car Integração"
        tenant.slug = "dscar_test"
        tenant.client_slug = "grupo-dscar_test"
        return tenant

    @classmethod
    def setup_domain(cls, domain):
        domain.domain = "test.paddock.solutions"
        domain.is_primary = True
        return domain

    def setUp(self):
        super().setUp()
        self.user = GlobalUser.objects.create(
            email=f"os_integration_{uuid.uuid4()}@paddock.solutions",
            name="Test User",
        )
        self.customer = Person.objects.create(
            full_name="Cliente Integração",
            person_kind=TipoPessoa.FISICA,
        )
        PersonRole.objects.create(person=self.customer, role=RolePessoa.CLIENTE)

    def _create_order(self, **kwargs) -> ServiceOrder:
        data = {
            "customer_id": self.customer.pk,
            "customer_type": "private",
            "plate": "ABC1234",
            "make": "Honda",
            "model": "Civic",
        }
        data.update(kwargs)
        return ServiceOrderService.create(data=data, created_by_id=str(self.user.id))

    def test_auto_increment_number_per_tenant(self):
        """O número (number) da OS deve ser auto-incrementado per-tenant no service."""
        os1 = self._create_order(
            plate="ABC1234",
            make="Honda",
            model="Civic",
        )
        self.assertIsNotNone(os1.number)

        os2 = self._create_order(
            plate="ABC1235",
            make="Honda",
            model="HR-V",
        )
        self.assertGreater(os2.number, os1.number)
        self.assertEqual(os2.number, os1.number + 1)

    def test_scheduling_date_auto_transition_via_service_update(self):
        """Atualizar um campo gatilho via service deve alterar o status e gerar log."""
        os = self._create_order(
            plate="ABC1234",
            make="VW",
            model="Golf",
            status="reception",
        )

        ServiceOrderService.update(
            order_id=str(os.id),
            data={"scheduling_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )

        os.refresh_from_db()
        self.assertEqual(os.status, "initial_survey")

        logs = StatusTransitionLog.objects.filter(service_order=os).order_by("-created_at")
        self.assertTrue(logs.exists())
        log = logs.first()
        self.assertEqual(log.from_status, "reception")
        self.assertEqual(log.to_status, "initial_survey")
        self.assertEqual(log.triggered_by_field, "scheduling_date")

    def test_manual_status_transition_generates_log(self):
        """Transição manual via service deve gerar um log correto."""
        os = self._create_order(
            plate="XYZ9876",
            make="Fiat",
            status="initial_survey",
            entry_date=timezone.now(),
        )

        ServiceOrderService.transition(
            order_id=str(os.id),
            new_status="budget",
            changed_by_id=str(self.user.id),
            force=True,
            justification="Teste de integração",
        )

        os.refresh_from_db()
        self.assertEqual(os.status, "budget")

        log = StatusTransitionLog.objects.filter(service_order=os).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.from_status, "initial_survey")
        self.assertEqual(log.to_status, "budget")
        self.assertEqual(log.triggered_by_field, "")

    def test_status_transition_log_is_immutable(self):
        """StatusTransitionLog não deve aceitar edição após criação."""
        os = self._create_order(
            plate="LOG1234",
            make="Honda",
            status="reception",
        )
        log = StatusTransitionLog.objects.create(
            service_order=os,
            from_status="reception",
            to_status="initial_survey",
            triggered_by_field="scheduling_date",
            changed_by=self.user,
        )

        log.triggered_by_field = "manual_edit"
        with self.assertRaises(ValidationError):
            log.save()
