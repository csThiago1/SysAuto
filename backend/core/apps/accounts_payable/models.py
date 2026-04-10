"""
Paddock Solutions — Contas a Pagar

Models:
  Supplier         — Fornecedor
  PayableDocument  — Titulo a pagar (nota fiscal de fornecedor, salario, etc.)
  PayablePayment   — Baixa de pagamento (parcial ou total)
"""
import logging
from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.accounting.models.chart_of_accounts import CostCenter
from apps.authentication.models import GlobalUser, PaddockBaseModel

logger = logging.getLogger(__name__)


class PayableOrigin(models.TextChoices):
    MANUAL = "MAN", "Manual"
    PAYROLL = "FOLHA", "Folha de Pagamento"
    NFE_IN = "NFE_E", "NF-e de Entrada"
    AUTO = "AUTO", "Automatico"


class DocumentStatus(models.TextChoices):
    OPEN = "open", "Em Aberto"
    PARTIAL = "partial", "Parcialmente Pago"
    PAID = "paid", "Pago"
    OVERDUE = "overdue", "Vencido"
    CANCELLED = "cancelled", "Cancelado"


class PaymentMethod(models.TextChoices):
    BANK_TRANSFER = "bank_transfer", "Transferencia Bancaria"
    PIX = "pix", "PIX"
    BOLETO = "boleto", "Boleto"
    CHECK = "check", "Cheque"
    CASH = "cash", "Dinheiro"
    CREDIT_CARD = "credit_card", "Cartao de Credito"
    DEBIT_CARD = "debit_card", "Cartao de Debito"


class Supplier(PaddockBaseModel):
    """Fornecedor cadastrado no sistema."""

    name = models.CharField(_("Nome"), max_length=200, db_index=True)
    cnpj = models.CharField(_("CNPJ"), max_length=14, blank=True, default="")
    cpf = models.CharField(_("CPF"), max_length=11, blank=True, default="")
    email = models.EmailField(_("E-mail"), blank=True, default="")
    phone = models.CharField(_("Telefone"), max_length=20, blank=True, default="")
    contact_name = models.CharField(_("Contato"), max_length=200, blank=True, default="")
    notes = models.TextField(_("Observacoes"), blank=True, default="")

    class Meta:
        ordering = ["name"]
        verbose_name = _("Fornecedor")
        verbose_name_plural = _("Fornecedores")

    def __str__(self) -> str:
        return self.name


class PayableDocument(PaddockBaseModel):
    """Titulo a pagar — representa uma obrigacao de pagamento."""

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="payables",
        verbose_name=_("Fornecedor"),
    )
    description = models.CharField(_("Descricao"), max_length=300)
    document_number = models.CharField(_("No Documento"), max_length=100, blank=True, default="")
    document_date = models.DateField(_("Data do documento"), null=True, blank=True)
    amount = models.DecimalField(_("Valor"), max_digits=18, decimal_places=2)
    amount_paid = models.DecimalField(
        _("Valor pago"),
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    due_date = models.DateField(_("Vencimento"), db_index=True)
    competence_date = models.DateField(_("Competencia"))
    status = models.CharField(
        _("Status"),
        max_length=10,
        choices=DocumentStatus.choices,
        default=DocumentStatus.OPEN,
        db_index=True,
    )
    origin = models.CharField(
        _("Origem"),
        max_length=10,
        choices=PayableOrigin.choices,
        default=PayableOrigin.MANUAL,
    )
    cost_center = models.ForeignKey(
        CostCenter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payables",
        verbose_name=_("Centro de Custo"),
    )
    notes = models.TextField(_("Observacoes"), blank=True, default="")
    cancelled_at = models.DateTimeField(_("Cancelado em"), null=True, blank=True)
    cancelled_by = models.ForeignKey(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_payables",
        verbose_name=_("Cancelado por"),
    )
    cancel_reason = models.CharField(
        _("Motivo do cancelamento"), max_length=200, blank=True, default=""
    )

    class Meta:
        ordering = ["due_date", "-created_at"]
        indexes = [
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["supplier", "status"]),
        ]
        verbose_name = _("Titulo a Pagar")
        verbose_name_plural = _("Titulos a Pagar")

    def __str__(self) -> str:
        return f"{self.description} — {self.supplier.name} — R${self.amount}"

    @property
    def amount_remaining(self) -> Decimal:
        """Saldo restante a pagar."""
        return self.amount - self.amount_paid


class PayablePayment(PaddockBaseModel):
    """Baixa de pagamento — parcial ou total."""

    document = models.ForeignKey(
        PayableDocument,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name=_("Titulo"),
    )
    payment_date = models.DateField(_("Data do pagamento"))
    amount = models.DecimalField(_("Valor pago"), max_digits=18, decimal_places=2)
    payment_method = models.CharField(
        _("Forma de pagamento"),
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK_TRANSFER,
    )
    bank_account = models.CharField(_("Conta bancaria"), max_length=100, blank=True, default="")
    notes = models.TextField(_("Observacoes"), blank=True, default="")
    journal_entry_id = models.UUIDField(_("Lancamento contabil"), null=True, blank=True)

    class Meta:
        ordering = ["-payment_date"]
        verbose_name = _("Pagamento")
        verbose_name_plural = _("Pagamentos")

    def __str__(self) -> str:
        return f"R${self.amount} em {self.payment_date} — {self.document.description}"
