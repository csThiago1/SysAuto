"""
Paddock Solutions — Contas a Receber

Models:
  ReceivableDocument  — Titulo a receber (OS, NF-e emitida, manual, etc.)
  ReceivableReceipt   — Baixa de recebimento (parcial ou total)
"""
import logging
from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.accounting.models.chart_of_accounts import CostCenter
from apps.authentication.models import GlobalUser, PaddockBaseModel

# Reutiliza PaymentMethod do modulo AP para evitar duplicacao
from apps.accounts_payable.models import PaymentMethod  # noqa: F401

logger = logging.getLogger(__name__)


class ReceivableOrigin(models.TextChoices):
    MANUAL = "MAN", "Manual"
    OS = "OS", "Ordem de Servico"
    NFE = "NFE", "NF-e Emitida"
    NFCE = "NFCE", "NFC-e Emitida"
    NFSE = "NFSE", "NFS-e Emitida"


class ReceivableStatus(models.TextChoices):
    OPEN = "open", "Em Aberto"
    PARTIAL = "partial", "Parcialmente Recebido"
    RECEIVED = "received", "Recebido"
    OVERDUE = "overdue", "Vencido"
    CANCELLED = "cancelled", "Cancelado"


class ReceivableDocument(PaddockBaseModel):
    """
    Titulo a receber — representa um direito de recebimento.

    customer_id e service_order_id sao referencias livres (sem FK cross-schema)
    seguindo o padrao do projeto para evitar joins entre schemas de tenants.
    customer_name e desnormalizado para performance em listagens.
    """

    # Referencia ao cliente — sem FK (cross-schema)
    customer_id = models.UUIDField(_("ID do cliente"), db_index=True)
    customer_name = models.CharField(_("Nome do cliente"), max_length=200)

    description = models.CharField(_("Descricao"), max_length=300)
    document_number = models.CharField(_("No Documento"), max_length=100, blank=True, default="")
    document_date = models.DateField(_("Data do documento"), null=True, blank=True)
    amount = models.DecimalField(_("Valor"), max_digits=18, decimal_places=2)
    amount_received = models.DecimalField(
        _("Valor recebido"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    due_date = models.DateField(_("Vencimento"), db_index=True)
    competence_date = models.DateField(_("Competencia"))
    status = models.CharField(
        _("Status"),
        max_length=10,
        choices=ReceivableStatus.choices,
        default=ReceivableStatus.OPEN,
        db_index=True,
    )
    origin = models.CharField(
        _("Origem"),
        max_length=10,
        choices=ReceivableOrigin.choices,
        default=ReceivableOrigin.MANUAL,
    )
    # Referencia a OS — sem FK (cross-schema)
    service_order_id = models.UUIDField(
        _("ID da OS"), null=True, blank=True, db_index=True
    )
    cost_center = models.ForeignKey(
        CostCenter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receivables",
        verbose_name=_("Centro de Custo"),
    )
    notes = models.TextField(_("Observacoes"), blank=True, default="")
    cancelled_at = models.DateTimeField(_("Cancelado em"), null=True, blank=True)
    cancelled_by = models.ForeignKey(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_receivables",
        verbose_name=_("Cancelado por"),
    )
    cancel_reason = models.CharField(
        _("Motivo do cancelamento"), max_length=200, blank=True, default=""
    )

    class Meta:
        ordering = ["due_date", "-created_at"]
        indexes = [
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["customer_id", "status"]),
        ]
        verbose_name = _("Titulo a Receber")
        verbose_name_plural = _("Titulos a Receber")

    def __str__(self) -> str:
        return f"{self.description} — {self.customer_name} — R${self.amount}"

    @property
    def amount_remaining(self) -> Decimal:
        """Saldo restante a receber."""
        return self.amount - self.amount_received


class ReceivableReceipt(PaddockBaseModel):
    """Baixa de recebimento — parcial ou total."""

    document = models.ForeignKey(
        ReceivableDocument,
        on_delete=models.PROTECT,
        related_name="receipts",
        verbose_name=_("Titulo"),
    )
    receipt_date = models.DateField(_("Data do recebimento"))
    amount = models.DecimalField(_("Valor recebido"), max_digits=18, decimal_places=2)
    payment_method = models.CharField(
        _("Forma de pagamento"),
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.PIX,
    )
    bank_account = models.CharField(_("Conta bancaria"), max_length=100, blank=True, default="")
    notes = models.TextField(_("Observacoes"), blank=True, default="")
    journal_entry_id = models.UUIDField(_("Lancamento contabil"), null=True, blank=True)

    class Meta:
        ordering = ["-receipt_date"]
        verbose_name = _("Recebimento")
        verbose_name_plural = _("Recebimentos")

    def __str__(self) -> str:
        return f"R${self.amount} em {self.receipt_date} — {self.document.description}"
