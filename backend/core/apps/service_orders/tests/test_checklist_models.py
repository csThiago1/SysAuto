"""Testes dos models do checklist de entrada 3D — unicidade e trava."""

import hashlib

from django.db import IntegrityError, transaction
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.service_orders.checklist_constants import PANEL_KEYS
from apps.service_orders.models import (
    ChecklistDamage,
    EntryChecklist,
    ServiceOrder,
    ServiceOrderStatus,
)


class ChecklistModelsTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "checklist@dscar.com"
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        self.user = GlobalUser.objects.filter(email_hash=email_hash).first()
        if self.user is None:
            self.user = GlobalUser.objects.create_user(
                email=email, email_hash=email_hash, password="x"
            )
        self.order = ServiceOrder.objects.create(
            number=9960,
            plate="CHK0A11",
            customer_name="Cliente Checklist",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
        )

    def _damage(self, number: int) -> ChecklistDamage:
        return ChecklistDamage.objects.create(
            service_order=self.order,
            number=number,
            panel_key="porta_diant_e",
            damage_type="amassado",
            severity="leve",
        )

    def test_damage_number_unique_per_os(self) -> None:
        self._damage(1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self._damage(1)

    def test_entry_checklist_unique_per_os_and_type(self) -> None:
        EntryChecklist.objects.create(service_order=self.order, checklist_type="entrada")
        with self.assertRaises(IntegrityError), transaction.atomic():
            EntryChecklist.objects.create(service_order=self.order, checklist_type="entrada")

    def test_is_locked_follows_finalized_at(self) -> None:
        checklist = EntryChecklist.objects.create(service_order=self.order)
        self.assertFalse(checklist.is_locked)
        checklist.finalized_at = timezone.now()
        checklist.save()
        checklist.refresh_from_db()
        self.assertTrue(checklist.is_locked)

    def test_panel_keys_count(self) -> None:
        self.assertEqual(len(PANEL_KEYS), 32)
        self.assertIn("cacamba", PANEL_KEYS)
