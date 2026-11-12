"""
Testes do retorno "Oferecer orçamento particular" (dano pré-existente).

A regra-semente vem da data migration; os testes usam a regra real do banco.
"""

import hashlib

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.followups import services
from apps.followups.models import FollowUp, FollowUpOutcome, FollowUpStatus, FollowUpTrigger
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class PreExistingDamageFollowUpTest(TenantTestCase):
    """Um retorno por OS, atualizado a cada cruzamento, nunca duplicado."""

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.user = GlobalUser.objects.create_user(
            email="preexist@dscar.com",
            email_hash=_sha256("preexist@dscar.com"),
            password="x",
        )

    def _make_order(self, *, opt_out: bool = False) -> ServiceOrder:
        person = Person.objects.create(full_name="Cliente Dano", followup_opt_out=opt_out)
        return ServiceOrder.objects.create(
            number=9501,
            plate="DAN1A11",
            customer=person,
            customer_name="Cliente Dano",
            consultant=self.user,
            created_by=self.user,
        )

    def test_creates_one_followup_per_os(self) -> None:
        order = self._make_order()

        services.upsert_pre_existing_damage(order, ["Porta dianteira esquerda"])
        followup = services.upsert_pre_existing_damage(order, ["Capô", "Para-lama direito"])

        self.assertEqual(FollowUp.objects.count(), 1)
        self.assertIsNotNone(followup)
        self.assertIn("Capô", followup.notes)
        self.assertNotIn("Porta dianteira esquerda", followup.notes)
        self.assertEqual(followup.rule.trigger_event, FollowUpTrigger.PRE_EXISTING_DAMAGE)
        self.assertEqual(followup.rule.name, "Oferecer orçamento particular")

    def test_empty_list_skips_pending(self) -> None:
        order = self._make_order()
        services.upsert_pre_existing_damage(order, ["Capô"])

        result = services.upsert_pre_existing_damage(order, [])

        self.assertIsNone(result)
        self.assertEqual(FollowUp.objects.get().status, FollowUpStatus.SKIPPED)

    def test_auto_skipped_reopens_for_dispatch(self) -> None:
        order = self._make_order()
        services.upsert_pre_existing_damage(order, ["Capô"])
        FollowUp.objects.update(status=FollowUpStatus.PENDING, dispatched_at=timezone.now())
        services.upsert_pre_existing_damage(order, [])

        followup = services.upsert_pre_existing_damage(order, ["Teto"])

        # Volta para a fila: o dispatch_due manda o push de novo e passa para pending.
        followup.refresh_from_db()
        self.assertEqual(followup.status, FollowUpStatus.SCHEDULED)
        self.assertIsNone(followup.dispatched_at)
        self.assertIsNone(followup.completed_at)
        self.assertLessEqual(followup.due_at, timezone.now())
        self.assertIn("Teto", followup.notes)

    def test_done_keeps_consultant_notes(self) -> None:
        order = self._make_order()
        services.upsert_pre_existing_damage(order, ["Capô"])
        FollowUp.objects.update(
            status=FollowUpStatus.DONE,
            outcome=FollowUpOutcome.NOT_INTERESTED,
            notes="Cliente recusou, valor alto",
            completed_at=timezone.now(),
        )

        services.upsert_pre_existing_damage(order, ["Capô", "Teto"])

        followup = FollowUp.objects.get()
        self.assertEqual(followup.status, FollowUpStatus.DONE)
        self.assertEqual(followup.notes, "Cliente recusou, valor alto")

    def test_manual_skip_is_not_reopened(self) -> None:
        order = self._make_order()
        services.upsert_pre_existing_damage(order, ["Capô"])
        # Mesmo efeito do POST /followups/{id}/skip/.
        FollowUp.objects.update(
            status=FollowUpStatus.SKIPPED,
            notes="Cliente não quer orçamento particular",
            completed_at=timezone.now(),
        )

        services.upsert_pre_existing_damage(order, ["Teto"])

        followup = FollowUp.objects.get()
        self.assertEqual(followup.status, FollowUpStatus.SKIPPED)
        self.assertEqual(followup.notes, "Cliente não quer orçamento particular")

    def test_assigned_to_consultant(self) -> None:
        order = self._make_order()

        followup = services.upsert_pre_existing_damage(order, ["Capô"])

        self.assertEqual(followup.assigned_to, order.consultant)

    def test_opt_out_creates_nothing(self) -> None:
        order = self._make_order(opt_out=True)

        self.assertIsNone(services.upsert_pre_existing_damage(order, ["Capô"]))
        self.assertEqual(FollowUp.objects.count(), 0)
