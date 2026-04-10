"""
Paddock Solutions — Accounting: Lançamento Contábil

Models:
  JournalEntry     — lançamento contábil com rastreabilidade via GenericFK
  JournalEntryLine — linha do lançamento (partida dobrada)

Regra de ouro: sum(debit) == sum(credit) sempre.
Lançamentos aprovados são IMUTÁVEIS — nunca deletar.
"""
import logging
from decimal import Decimal

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.authentication.models import PaddockBaseModel

from .chart_of_accounts import ChartOfAccount, CostCenter
from .fiscal_period import FiscalPeriod

logger = logging.getLogger(__name__)


class JournalEntryOrigin(models.TextChoices):
    """Origem do lançamento contábil para rastreabilidade e relatórios."""

    MANUAL = "MAN", _("Manual")
    SERVICE_ORDER = "OS", _("Ordem de Serviço")
    NFE = "NFE", _("NF-e Emitida")
    NFCE = "NFCE", _("NFC-e Emitida")
    NFSE = "NFSE", _("NFS-e Emitida")
    NFE_ENTRADA = "NFE_E", _("NF-e Entrada (Compra)")
    BANK_PAYMENT = "PAG", _("Pagamento Bancário")
    BANK_RECEIPT = "REC", _("Recebimento Bancário")
    ASAAS = "ASAAS", _("Asaas (Cobrança)")
    OFX_IMPORT = "OFX", _("Importação OFX")
    PAYROLL = "FOLHA", _("Folha de Pagamento")
    DEPRECIATION = "DEP", _("Depreciação")
    CLOSING = "ENC", _("Encerramento de Período")
    INVENTORY = "EST", _("Ajuste de Estoque")


class JournalEntry(PaddockBaseModel):
    """
    Lançamento contábil — representa uma transação financeira completa.

    Imutável após aprovação: is_approved=True bloqueia edições.
    Estorno cria novo lançamento com linhas D/C invertidas.

    Attributes:
        number: Número sequencial único (ex: JE000001).
        description: Descrição do lançamento.
        competence_date: Data de competência (base para relatórios).
        document_date: Data do documento de origem.
        origin: Origem do lançamento (enum JournalEntryOrigin).
        content_type: Tipo do objeto de origem (GenericFK).
        object_id: ID do objeto de origem (GenericFK).
        source_object: Objeto de origem rastreável (GenericFK).
        is_approved: True se o lançamento foi aprovado (imutável após).
        is_reversed: True se o lançamento foi estornado.
        reversal_entry: Lançamento de estorno vinculado.
        fiscal_period: Período fiscal do lançamento.
        approved_by: Usuário que aprovou o lançamento.
    """

    number = models.CharField(
        _("Número"),
        max_length=20,
        unique=True,
        db_index=True,
    )
    description = models.CharField(_("Descrição"), max_length=500)
    competence_date = models.DateField(_("Data de competência"), db_index=True)
    document_date = models.DateField(_("Data do documento"), null=True, blank=True)
    origin = models.CharField(
        _("Origem"),
        max_length=10,
        choices=JournalEntryOrigin.choices,
        db_index=True,
    )

    # GenericForeignKey para rastreabilidade com qualquer model de origem
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("Tipo do objeto de origem"),
    )
    object_id = models.PositiveIntegerField(
        _("ID do objeto de origem"),
        null=True,
        blank=True,
    )
    source_object = GenericForeignKey("content_type", "object_id")

    # Estado do lançamento
    is_approved = models.BooleanField(
        _("Aprovado"), default=False, db_index=True
    )
    is_reversed = models.BooleanField(_("Estornado"), default=False)
    reversal_entry = models.OneToOneField(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reversed_by",
        verbose_name=_("Lançamento de estorno"),
    )
    fiscal_period = models.ForeignKey(
        FiscalPeriod,
        on_delete=models.PROTECT,
        related_name="journal_entries",
        verbose_name=_("Período fiscal"),
    )
    approved_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approved_journal_entries",
        verbose_name=_("Aprovado por"),
    )

    class Meta:
        ordering = ["-competence_date", "-number"]
        indexes = [
            models.Index(fields=["competence_date"]),
            models.Index(fields=["origin"]),
            models.Index(fields=["fiscal_period"]),
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["is_approved", "competence_date"]),
        ]
        verbose_name = _("Lançamento Contábil")
        verbose_name_plural = _("Lançamentos Contábeis")

    def __str__(self) -> str:
        return f"{self.number} — {self.description} ({self.competence_date})"

    @property
    def total_debit(self) -> Decimal:
        """Soma dos débitos de todas as linhas do lançamento."""
        result = self.lines.aggregate(total=models.Sum("debit_amount"))["total"]
        return result or Decimal("0.00")

    @property
    def total_credit(self) -> Decimal:
        """Soma dos créditos de todas as linhas do lançamento."""
        result = self.lines.aggregate(total=models.Sum("credit_amount"))["total"]
        return result or Decimal("0.00")

    @property
    def is_balanced(self) -> bool:
        """
        Verifica se o lançamento está balanceado.

        Returns:
            True se soma dos débitos == soma dos créditos.
        """
        return self.total_debit == self.total_credit


class JournalEntryLine(models.Model):
    """
    Linha de lançamento contábil — partida simples (débito OU crédito).

    Não herda PaddockBaseModel — linhas não têm soft delete.
    Constraint: debit_amount > 0 XOR credit_amount > 0.

    Attributes:
        entry: Lançamento ao qual a linha pertence.
        account: Conta analítica (apenas contas com is_analytical=True).
        cost_center: Centro de custo opcional.
        debit_amount: Valor a débito (0 se crédito).
        credit_amount: Valor a crédito (0 se débito).
        description: Descrição complementar da linha.
        document_number: Número do documento de referência.
    """

    entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.CASCADE,
        related_name="lines",
        verbose_name=_("Lançamento"),
    )
    account = models.ForeignKey(
        ChartOfAccount,
        on_delete=models.PROTECT,
        related_name="journal_lines",
        limit_choices_to={"is_analytical": True},
        verbose_name=_("Conta"),
    )
    cost_center = models.ForeignKey(
        CostCenter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="journal_lines",
        verbose_name=_("Centro de custo"),
    )
    debit_amount = models.DecimalField(
        _("Débito"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    credit_amount = models.DecimalField(
        _("Crédito"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    description = models.CharField(_("Descrição"), max_length=300, blank=True, default="")
    document_number = models.CharField(
        _("Número do documento"), max_length=100, blank=True, default=""
    )

    class Meta:
        indexes = [
            models.Index(fields=["account", "entry"]),
            models.Index(fields=["cost_center"]),
        ]
        verbose_name = _("Linha de Lançamento")
        verbose_name_plural = _("Linhas de Lançamento")

    def __str__(self) -> str:
        return f"D:{self.debit_amount} C:{self.credit_amount} — {self.account}"

    def clean(self) -> None:
        """
        Valida a linha do lançamento:
        - Não pode ter débito E crédito simultaneamente.
        - Não pode ter ambos os valores zerados.
        - A conta deve ser analítica.
        """
        # Converte para Decimal antes de comparar — o campo pode ainda ser str
        # quando clean() é chamado antes de salvar (e.g., em testes unitários).
        from decimal import Decimal, InvalidOperation

        try:
            debit = Decimal(str(self.debit_amount or 0))
            credit = Decimal(str(self.credit_amount or 0))
        except InvalidOperation:
            raise ValidationError(_("Valores monetários inválidos."))

        has_debit = debit > 0
        has_credit = credit > 0

        if has_debit and has_credit:
            raise ValidationError(
                _("Linha não pode ter débito e crédito simultaneamente.")
            )
        if not has_debit and not has_credit:
            raise ValidationError(
                _("Linha deve ter débito OU crédito com valor positivo.")
            )
        if self.account_id and not self.account.is_analytical:
            raise ValidationError(
                {"account": _("Apenas contas analíticas aceitam lançamentos.")}
            )
