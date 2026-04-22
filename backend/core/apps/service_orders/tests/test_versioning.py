"""Tests for ServiceOrderVersion, ServiceOrderVersionItem, ServiceOrderEvent."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
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
