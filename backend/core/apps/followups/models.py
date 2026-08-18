"""
Paddock Solutions — Followups: retornos agendados ao cliente.

FollowUpRule é o que a oficina configura ("48h após entrega → satisfação").
FollowUp é a instância agendada para uma OS específica.

Nenhum dado pessoal é copiado para FollowUp: nome e telefone vêm da OS/Person
na hora de exibir. Menos PII duplicada, menos superfície LGPD.
"""

import logging

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class FollowUpTrigger(models.TextChoices):
    """Evento que dispara o agendamento."""

    OS_DELIVERED = "delivered", _("OS entregue")


class FollowUpChannel(models.TextChoices):
    """Canal de execução do retorno."""

    TASK = "task", _("Tarefa interna")
    WHATSAPP = "whatsapp", _("WhatsApp")  # fase 2 — ainda não implementado


class FollowUpStatus(models.TextChoices):
    """Ciclo de vida do retorno."""

    SCHEDULED = "scheduled", _("Agendado")
    PENDING = "pending", _("Na fila")
    DONE = "done", _("Concluído")
    SKIPPED = "skipped", _("Dispensado")


class FollowUpOutcome(models.TextChoices):
    """Resultado registrado por quem executou o retorno."""

    SATISFIED = "satisfied", _("Cliente satisfeito")
    DISSATISFIED = "dissatisfied", _("Cliente insatisfeito")
    NO_ANSWER = "no_answer", _("Não atendeu")
    SCHEDULED_OS = "scheduled_os", _("Agendou serviço")
    NOT_INTERESTED = "not_interested", _("Sem interesse")


class FollowUpRule(PaddockBaseModel):
    """
    Regra de retorno configurada pela oficina.

    Attributes:
        name: Nome exibido na fila (ex: "Pesquisa de satisfação").
        trigger_event: Evento disparador.
        delay_hours: Horas após o evento até o vencimento.
        channel: Canal de execução.
        message_template: Texto com placeholders {cliente} {placa} {os}.
        link: URL a oferecer (ex: review no Google).
        os_types: Lista de ServiceOrder.os_type aplicáveis; vazio = todos.
    """

    name = models.CharField(_("Nome"), max_length=120)
    trigger_event = models.CharField(
        _("Gatilho"),
        max_length=20,
        choices=FollowUpTrigger.choices,
        default=FollowUpTrigger.OS_DELIVERED,
    )
    delay_hours = models.PositiveIntegerField(
        _("Atraso (horas)"),
        help_text="48 = dois dias após a entrega; 720 = trinta dias.",
    )
    channel = models.CharField(
        _("Canal"),
        max_length=20,
        choices=FollowUpChannel.choices,
        default=FollowUpChannel.TASK,
    )
    message_template = models.TextField(
        _("Mensagem"),
        help_text="Placeholders disponíveis: {cliente}, {placa}, {os}.",
    )
    link = models.URLField(_("Link"), blank=True, default="")
    os_types = models.JSONField(
        _("Tipos de OS"),
        default=list,
        blank=True,
        help_text="Lista de os_type aplicáveis. Vazio = todos.",
    )

    class Meta:
        ordering = ["delay_hours"]
        verbose_name = _("Regra de Retorno")
        verbose_name_plural = _("Regras de Retorno")

    def __str__(self) -> str:
        return f"{self.name} (+{self.delay_hours}h)"

    def render(self, *, customer: str, plate: str, os_number: object) -> str:
        """
        Renderiza a mensagem com os dados da OS.

        Placeholder desconhecido no template não derruba o retorno — o texto
        cru é devolvido e quem executa vê o que foi configurado errado.
        """
        try:
            return self.message_template.format(cliente=customer, placa=plate, os=os_number)
        except (KeyError, IndexError, ValueError):
            logger.warning("Template inválido na regra de retorno %s.", self.pk)
            return self.message_template


class FollowUp(PaddockBaseModel):
    """
    Retorno agendado para uma OS.

    Attributes:
        rule: Regra que o originou.
        service_order: OS de referência.
        due_at: Quando o retorno vence.
        status: Estado no ciclo de vida.
        channel: Canal efetivo (copiado da regra no agendamento).
        assigned_to: Responsável — por padrão o consultor da OS.
        outcome: Resultado registrado na conclusão.
    """

    rule = models.ForeignKey(
        FollowUpRule,
        on_delete=models.PROTECT,
        related_name="followups",
        verbose_name=_("Regra"),
    )
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.CASCADE,
        related_name="followups",
        verbose_name=_("Ordem de serviço"),
    )
    due_at = models.DateTimeField(_("Vence em"), db_index=True)
    status = models.CharField(
        _("Situação"),
        max_length=20,
        choices=FollowUpStatus.choices,
        default=FollowUpStatus.SCHEDULED,
        db_index=True,
    )
    channel = models.CharField(_("Canal"), max_length=20, choices=FollowUpChannel.choices)
    assigned_to = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="followups",
        verbose_name=_("Responsável"),
    )
    dispatched_at = models.DateTimeField(_("Disparado em"), null=True, blank=True)
    completed_at = models.DateTimeField(_("Concluído em"), null=True, blank=True)
    outcome = models.CharField(
        _("Resultado"),
        max_length=20,
        choices=FollowUpOutcome.choices,
        blank=True,
        default="",
    )
    notes = models.TextField(_("Observações"), blank=True, default="")

    class Meta:
        ordering = ["due_at"]
        verbose_name = _("Retorno")
        verbose_name_plural = _("Retornos")
        constraints = [
            # Reexecutar a transição para "entregue" não pode duplicar retorno.
            models.UniqueConstraint(
                fields=["rule", "service_order"], name="followup_unique_rule_per_os"
            )
        ]
        indexes = [models.Index(fields=["status", "due_at"])]

    def __str__(self) -> str:
        return f"{self.rule.name} — OS {self.service_order_id} ({self.status})"
