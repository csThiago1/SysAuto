"""
Paddock Solutions — Service Orders Integration Tests
Sprint OS-001 — Testes de integração (persistência, transições e auto-incremento de tenant).
"""
import pytest
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, StatusTransitionLog
from apps.tenants.models import Company, Domain

class ServiceOrderIntegrationTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.name = "Tenant DS Car Integração"
        tenant.slug = "dscar_test"
        tenant.client_slug = "grupo-dscar_test"
        return tenant

    @classmethod
    def setup_domain(cls, domain, tenant):
        domain.domain = "test.paddock.solutions"
        domain.tenant = tenant
        domain.is_primary = True
        return domain

    def setUp(self):
        super().setUp()
        self.user = GlobalUser.objects.create(
            email="os_integration@paddock.solutions",
            first_name="Test",
            last_name="User",
        )

    def test_auto_increment_number_per_tenant(self):
        """O número (number) da OS deve ser auto-incrementado per-tenant na base."""
        # Não passamos 'number', ele é gerado no ServiceOrder.save() via Signals ou overriden save
        os1 = ServiceOrder.objects.create(
            plate="ABC1234",
            make="Honda",
            model="Civic",
        )
        self.assertIsNotNone(os1.number)

        os2 = ServiceOrder.objects.create(
            plate="ABC1235",
            make="Honda",
            model="HR-V",
        )
        self.assertGreater(os2.number, os1.number)
        self.assertEqual(os2.number, os1.number + 1)

    def test_auto_transition_on_save(self):
        """Salvar uma OS preenchendo um campo gatilho deve alterar o status e gerar log."""
        os = ServiceOrder.objects.create(
            plate="ABC1234",
            make="VW",
            model="Golf",
            status="reception",
        )
        initial_status = os.status

        # Update entry_date (which triggers 'initial_survey' globally/on wait stage)
        os.entry_date = "2026-04-02T10:00:00Z"
        os.save()

        # Reload for safety
        os.refresh_from_db()
        
        # Test if status actually transitioned
        self.assertEqual(os.status, "initial_survey")

        # Verify a transition log was created
        logs = StatusTransitionLog.objects.filter(service_order=os).order_by("-created_at")
        self.assertTrue(logs.exists())
        log = logs.first()
        self.assertEqual(log.from_status, "reception")
        self.assertEqual(log.to_status, "initial_survey")
        self.assertEqual(log.triggered_by_field, "entry_date")

    def test_manual_status_transition_generates_log(self):
        """Mudar o status manualmente deve gerar um log correto."""
        os = ServiceOrder.objects.create(
            plate="XYZ9876",
            make="Fiat",
            status="initial_survey",
        )

        os.status = "budget"
        os.save()

        os.refresh_from_db()
        self.assertEqual(os.status, "budget")

        # Verifica log
        log = StatusTransitionLog.objects.filter(service_order=os).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.from_status, "initial_survey")
        self.assertEqual(log.to_status, "budget")
        self.assertEqual(log.triggered_by_field, "")
