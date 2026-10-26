"""
Testes do motor de retorno ao cliente.

Cobrem agendamento na entrega, opt-out LGPD, idempotência e disparo.
O push interno é sempre mockado.
"""

import hashlib
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.followups import services
from apps.followups.models import FollowUp, FollowUpChannel, FollowUpRule, FollowUpStatus
from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class FollowUpSchedulingTest(TenantTestCase):
    """Agendamento a partir da entrega da OS."""

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.user = GlobalUser.objects.create_user(
            email="followups@dscar.com",
            email_hash=_sha256("followups@dscar.com"),
            password="x",
        )

    def setUp(self) -> None:
        self.satisfacao = FollowUpRule.objects.create(
            name="Satisfação",
            delay_hours=48,
            channel=FollowUpChannel.TASK,
            message_template="Olá {cliente}, como foi com o {placa}? OS {os}.",
        )
        self.revisao = FollowUpRule.objects.create(
            name="Revisão",
            delay_hours=720,
            channel=FollowUpChannel.TASK,
            message_template="Olá {cliente}, hora da revisão do {placa}.",
        )

    def tearDown(self) -> None:
        FollowUp.objects.all().delete()
        FollowUpRule.objects.all().delete()
        ServiceOrder.objects.all().delete()
        Person.objects.all().delete()

    def _make_order(self, *, opt_out: bool = False, os_type: str = "") -> ServiceOrder:
        person = Person.objects.create(full_name="Cliente Retorno", followup_opt_out=opt_out)
        return ServiceOrder.objects.create(
            number=9401,
            plate="RET1A11",
            customer=person,
            customer_name="Cliente Retorno",
            status=ServiceOrderStatus.DELIVERED,
            os_type=os_type,
            consultant=self.user,
            created_by=self.user,
        )

    # ── Agendamento ───────────────────────────────────────────────────────────

    def test_creates_one_followup_per_active_rule(self) -> None:
        """Entrega gera um retorno por regra ativa, com due_at correto."""
        order = self._make_order()
        now = timezone.now()

        created = services.schedule_for_delivery(str(order.pk), delivered_at=now)

        self.assertEqual(created, 2)
        satisfacao = FollowUp.objects.get(rule=self.satisfacao)
        self.assertAlmostEqual(
            satisfacao.due_at, now + timedelta(hours=48), delta=timedelta(seconds=5)
        )
        self.assertEqual(satisfacao.assigned_to, self.user)
        self.assertEqual(satisfacao.status, FollowUpStatus.SCHEDULED)

    def test_inactive_rule_does_not_schedule(self) -> None:
        """Regra desligada não gera retorno."""
        self.revisao.is_active = False
        self.revisao.save(update_fields=["is_active"])
        order = self._make_order()

        services.schedule_for_delivery(str(order.pk))

        self.assertEqual(FollowUp.objects.count(), 1)
        self.assertEqual(FollowUp.objects.first().rule, self.satisfacao)

    def test_os_type_filter_is_respected(self) -> None:
        """Regra restrita a um os_type ignora OS de outro tipo."""
        self.revisao.os_types = ["funilaria"]
        self.revisao.save(update_fields=["os_types"])
        order = self._make_order(os_type="lavagem")

        services.schedule_for_delivery(str(order.pk))

        self.assertEqual(FollowUp.objects.filter(rule=self.revisao).count(), 0)
        self.assertEqual(FollowUp.objects.filter(rule=self.satisfacao).count(), 1)

    def test_opt_out_blocks_scheduling(self) -> None:
        """Cliente descadastrado (LGPD) não gera nenhum retorno."""
        order = self._make_order(opt_out=True)

        created = services.schedule_for_delivery(str(order.pk))

        self.assertEqual(created, 0)
        self.assertEqual(FollowUp.objects.count(), 0)

    def test_scheduling_is_idempotent(self) -> None:
        """Reexecutar a entrega não duplica retornos."""
        order = self._make_order()

        services.schedule_for_delivery(str(order.pk))
        second = services.schedule_for_delivery(str(order.pk))

        self.assertEqual(second, 0)
        self.assertEqual(FollowUp.objects.count(), 2)

    def test_unknown_order_is_noop(self) -> None:
        """OS inexistente não levanta exceção."""
        self.assertEqual(
            services.schedule_for_delivery("00000000-0000-0000-0000-000000000000"), 0
        )

    # ── Disparo ───────────────────────────────────────────────────────────────

    def test_dispatch_due_only_picks_expired(self) -> None:
        """Só retornos vencidos saem de SCHEDULED."""
        order = self._make_order()
        services.schedule_for_delivery(str(order.pk), delivered_at=timezone.now())

        vencido = FollowUp.objects.get(rule=self.satisfacao)
        vencido.due_at = timezone.now() - timedelta(hours=1)
        vencido.save(update_fields=["due_at"])

        with patch("apps.notifications.services.send_push"):
            dispatched = services.dispatch_due()

        self.assertEqual(dispatched, 1)
        vencido.refresh_from_db()
        self.assertEqual(vencido.status, FollowUpStatus.PENDING)
        self.assertIsNotNone(vencido.dispatched_at)
        self.assertEqual(
            FollowUp.objects.get(rule=self.revisao).status, FollowUpStatus.SCHEDULED
        )

    def test_unimplemented_channel_is_not_dispatched(self) -> None:
        """Canal WhatsApp (fase 2) não marca o retorno como disparado."""
        order = self._make_order()
        followup = FollowUp.objects.create(
            rule=self.satisfacao,
            service_order=order,
            due_at=timezone.now() - timedelta(hours=1),
            channel=FollowUpChannel.WHATSAPP,
            assigned_to=self.user,
        )

        self.assertFalse(services.dispatch(followup))
        followup.refresh_from_db()
        self.assertEqual(followup.status, FollowUpStatus.SCHEDULED)

    def test_opt_out_after_scheduling_skips_dispatch(self) -> None:
        """Descadastro posterior converte o retorno pendente em SKIPPED."""
        order = self._make_order()
        followup = FollowUp.objects.create(
            rule=self.satisfacao,
            service_order=order,
            due_at=timezone.now() - timedelta(hours=1),
            channel=FollowUpChannel.TASK,
            assigned_to=self.user,
        )
        order.customer.followup_opt_out = True
        order.customer.save(update_fields=["followup_opt_out"])
        followup.refresh_from_db()

        self.assertFalse(services.dispatch(followup))
        followup.refresh_from_db()
        self.assertEqual(followup.status, FollowUpStatus.SKIPPED)

    # ── Template ──────────────────────────────────────────────────────────────

    def test_render_fills_placeholders(self) -> None:
        """A mensagem é renderizada com cliente, placa e número da OS."""
        rendered = self.satisfacao.render(customer="Ana", plate="ABC1D23", os_number=9401)
        self.assertIn("Ana", rendered)
        self.assertIn("ABC1D23", rendered)
        self.assertIn("9401", rendered)

    def test_render_survives_bad_template(self) -> None:
        """Placeholder inválido devolve o texto cru em vez de explodir."""
        self.satisfacao.message_template = "Olá {inexistente}"
        rendered = self.satisfacao.render(customer="Ana", plate="X", os_number=1)
        self.assertEqual(rendered, "Olá {inexistente}")
