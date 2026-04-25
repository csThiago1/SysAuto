"""Tests for ServiceOrderVersion, ServiceOrderVersionItem, ServiceOrderEvent."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.test import TestCase
from django_tenants.test.cases import TenantTestCase


class ServiceOrderVersionModelTest(TenantTestCase):

    def _make_order(self, number: int = 9999) -> "ServiceOrder":
        from apps.service_orders.models import ServiceOrder
        return ServiceOrder.objects.create(
            number=number,
            customer_name="Versioning Test",
            plate="TST1234",
        )

    def test_version_created_with_correct_number(self) -> None:
        from apps.service_orders.models import ServiceOrderVersion
        os = self._make_order()
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="manual",
        )
        self.assertEqual(v.version_number, 1)
        self.assertEqual(v.status, "pending")

    def test_version_unique_together(self) -> None:
        from apps.service_orders.models import ServiceOrderVersion
        from django.db import IntegrityError
        os = self._make_order(9998)
        ServiceOrderVersion.objects.create(service_order=os, version_number=1, source="manual")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ServiceOrderVersion.objects.create(service_order=os, version_number=1, source="manual")

    def test_version_item_inherits_mixin_fields(self) -> None:
        from apps.service_orders.models import ServiceOrderVersion, ServiceOrderVersionItem
        os = self._make_order(9997)
        v = ServiceOrderVersion.objects.create(service_order=os, version_number=1, source="manual")
        item = ServiceOrderVersionItem.objects.create(
            version=v,
            description="Parachoque dianteiro",
            unit_price=Decimal("1200.00"),
            quantity=Decimal("1"),
            net_price=Decimal("1200.00"),
            payer_block="SEGURADORA",
        )
        self.assertEqual(item.payer_block, "SEGURADORA")
        self.assertEqual(item.bucket, "IMPACTO")
        self.assertFalse(item.flag_abaixo_padrao)

    def test_service_order_event_created(self) -> None:
        from apps.service_orders.models import ServiceOrderEvent
        os = self._make_order(9996)
        ev = ServiceOrderEvent.objects.create(
            service_order=os,
            event_type="STATUS_CHANGE",
            actor="Thiago",
            from_state="reception",
            to_state="initial_survey",
        )
        self.assertEqual(ev.event_type, "STATUS_CHANGE")
        self.assertEqual(ev.actor, "Thiago")

    def test_previous_status_field_exists(self) -> None:
        from apps.service_orders.models import ServiceOrder
        os = self._make_order(9995)
        os.previous_status = "repair"
        os.save(update_fields=["previous_status"])
        os.refresh_from_db()
        self.assertEqual(os.previous_status, "repair")

    def test_three_financial_blocks_default_zero(self) -> None:
        from apps.service_orders.models import ServiceOrderVersion
        os = self._make_order(9994)
        v = ServiceOrderVersion.objects.create(service_order=os, version_number=1, source="cilia")
        self.assertEqual(v.total_seguradora, Decimal("0"))
        self.assertEqual(v.total_complemento_particular, Decimal("0"))
        self.assertEqual(v.total_franquia, Decimal("0"))

    def test_parecer_created(self) -> None:
        from apps.service_orders.models import ServiceOrderParecer
        os = self._make_order(9993)
        p = ServiceOrderParecer.objects.create(
            service_order=os,
            source="cilia",
            parecer_type="AUTORIZADO",
            body="Autorizado conforme vistoria.",
        )
        self.assertEqual(p.parecer_type, "AUTORIZADO")

    def test_impact_area_label_unique(self) -> None:
        from apps.service_orders.models import ImpactAreaLabel
        from django.db import IntegrityError
        os = self._make_order(9992)
        ImpactAreaLabel.objects.create(service_order=os, area_number=1, label_text="Frontal")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ImpactAreaLabel.objects.create(service_order=os, area_number=1, label_text="Outra")

    def test_is_active_version_property(self) -> None:
        from apps.service_orders.models import ServiceOrderVersion
        os = self._make_order(9991)
        v1 = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="manual"
        )
        self.assertTrue(v1.is_active_version)
        v2 = ServiceOrderVersion.objects.create(
            service_order=os, version_number=2, source="manual"
        )
        self.assertFalse(v1.is_active_version)
        self.assertTrue(v2.is_active_version)


class OSEventLoggerTest(TenantTestCase):
    def _make_order(self):
        from apps.service_orders.models import ServiceOrder
        return ServiceOrder.objects.create(number=8888, customer_name="Logger Test", plate="LGG9999")

    def test_log_event_creates_record(self):
        from apps.service_orders.events import OSEventLogger
        from apps.service_orders.models import ServiceOrderEvent
        os = self._make_order()
        OSEventLogger.log_event(
            os, "STATUS_CHANGE",
            actor="Thiago",
            from_state="reception",
            to_state="initial_survey",
        )
        ev = ServiceOrderEvent.objects.get(service_order=os)
        self.assertEqual(ev.event_type, "STATUS_CHANGE")
        self.assertEqual(ev.actor, "Thiago")
        self.assertEqual(ev.from_state, "reception")
        self.assertEqual(ev.to_state, "initial_survey")

    def test_log_event_with_payload(self):
        from apps.service_orders.events import OSEventLogger
        from apps.service_orders.models import ServiceOrderEvent
        os = self._make_order()
        OSEventLogger.log_event(
            os, "IMPORT_RECEIVED",
            payload={"source": "cilia", "version": "821980.1"},
        )
        ev = ServiceOrderEvent.objects.get(service_order=os, event_type="IMPORT_RECEIVED")
        self.assertEqual(ev.payload["source"], "cilia")

    def test_log_event_does_not_raise_on_error(self):
        """Logger nunca interrompe o fluxo principal."""
        from apps.service_orders.events import OSEventLogger
        # Passa OS inválido (id=None) — deve logar sem explodir
        class FakeOS:
            pk = None
            id = None
        try:
            OSEventLogger.log_event(FakeOS(), "STATUS_CHANGE", swallow_errors=True)
        except Exception:
            self.fail("OSEventLogger não deve propagar exceções quando swallow_errors=True")


class ServiceOrderServiceVersioningTest(TenantTestCase):

    def _make_order(self, status: str = "repair") -> "ServiceOrder":
        from apps.service_orders.models import ServiceOrder
        return ServiceOrder.objects.create(
            number=7777, customer_name="Versioning Svc Test", plate="SVC0001",
            status=status,
        )

    def test_change_status_valid_transition(self) -> None:
        from apps.service_orders.services import ServiceOrderService
        os = self._make_order(status="reception")
        updated = ServiceOrderService.change_status(
            service_order=os, new_status="initial_survey", changed_by="Thiago",
        )
        self.assertEqual(updated.status, "initial_survey")

    def test_change_status_invalid_raises(self) -> None:
        from apps.service_orders.services import ServiceOrderService
        from rest_framework.exceptions import ValidationError
        os = self._make_order(status="reception")
        with self.assertRaises(ValidationError):
            ServiceOrderService.change_status(service_order=os, new_status="delivered")

    def test_change_status_to_budget_saves_previous(self) -> None:
        from apps.service_orders.services import ServiceOrderService
        os = self._make_order(status="repair")
        ServiceOrderService.change_status(service_order=os, new_status="budget")
        os.refresh_from_db()
        self.assertEqual(os.previous_status, "repair")

    def test_change_status_logs_event(self) -> None:
        from apps.service_orders.services import ServiceOrderService
        from apps.service_orders.models import ServiceOrderEvent
        os = self._make_order(status="reception")
        ServiceOrderService.change_status(
            service_order=os, new_status="initial_survey", changed_by="Thiago",
        )
        ev = ServiceOrderEvent.objects.get(service_order=os, event_type="STATUS_CHANGE")
        self.assertEqual(ev.from_state, "reception")
        self.assertEqual(ev.to_state, "initial_survey")

    def test_approve_version_returns_to_previous_status(self) -> None:
        from apps.service_orders.services import ServiceOrderService
        from apps.service_orders.models import ServiceOrder, ServiceOrderVersion
        os = ServiceOrder.objects.create(
            number=7778, customer_name="Versioning Svc Test Ins", plate="SVC0002",
            status="budget", customer_type="insurer", previous_status="repair",
        )
        version = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia", status="analisado",
        )
        ServiceOrderService.approve_version(version=version, approved_by="Thiago")
        os.refresh_from_db()
        self.assertEqual(os.status, "repair")
        version.refresh_from_db()
        self.assertEqual(version.status, "autorizado")


class ValidTransitionsTest(TestCase):
    def test_repair_can_go_to_budget(self) -> None:
        from apps.service_orders.models import VALID_TRANSITIONS
        self.assertIn("budget", VALID_TRANSITIONS["repair"])

    def test_bodywork_can_go_to_budget(self) -> None:
        from apps.service_orders.models import VALID_TRANSITIONS
        self.assertIn("budget", VALID_TRANSITIONS["bodywork"])

    def test_painting_can_go_to_budget(self) -> None:
        from apps.service_orders.models import VALID_TRANSITIONS
        self.assertIn("budget", VALID_TRANSITIONS["painting"])

    def test_budget_can_go_to_waiting_parts(self) -> None:
        from apps.service_orders.models import VALID_TRANSITIONS
        self.assertIn("waiting_parts", VALID_TRANSITIONS["budget"])

    def test_budget_can_go_to_repair(self) -> None:
        from apps.service_orders.models import VALID_TRANSITIONS
        self.assertIn("repair", VALID_TRANSITIONS["budget"])


class ServiceOrderVersionAPITest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        from rest_framework.test import APIClient
        from apps.authentication.models import GlobalUser
        self.client = APIClient()
        # Route requests to the test tenant schema via DevTenantMiddleware
        self.client.defaults["HTTP_X_TENANT_DOMAIN"] = self.domain.domain
        self.user = GlobalUser.objects.create_user(
            email="api_test@test.com", password="test123",
        )
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})

    def _make_order(self) -> "ServiceOrder":
        from apps.service_orders.models import ServiceOrder
        return ServiceOrder.objects.create(
            number=6666, customer_name="API Test", plate="API0001",
        )

    def test_list_versions_empty(self) -> None:
        os = self._make_order()
        resp = self.client.get(f"/api/v1/service-orders/{os.pk}/versions/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["results"], [])

    def test_list_events(self) -> None:
        from apps.service_orders.events import OSEventLogger
        os = self._make_order()
        OSEventLogger.log_event(os, "STATUS_CHANGE", actor="Thiago")
        resp = self.client.get(f"/api/v1/service-orders/{os.pk}/events/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_approve_version_action(self) -> None:
        from apps.service_orders.models import ServiceOrderVersion, ServiceOrder
        os = self._make_order()
        os.customer_type = "insurer"
        os.status = "budget"
        os.previous_status = "repair"
        os.save(update_fields=["customer_type", "status", "previous_status"])
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia", status="analisado",
        )
        resp = self.client.post(f"/api/v1/service-orders/versions/{v.pk}/approve/")
        self.assertEqual(resp.status_code, 200)
        v.refresh_from_db()
        self.assertEqual(v.status, "autorizado")
