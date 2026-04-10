"""
Paddock Solutions — Accounting: Plano de Contas e Centros de Custo

Models:
  ChartOfAccount — conta contabil com hierarquia em arvore
  CostCenter     — centro de custo para rateio de despesas
"""
import logging
import re

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)

# Regex para validar mascara do codigo contabil: ex. "1", "1.1", "1.1.01", "1.1.01.001"
_CODE_REGEX = re.compile(r"^\d+(\.\d+)*$")


class AccountType(models.TextChoices):
    """Tipo economico da conta contabil."""

    ASSET = "A", _("Ativo")
    LIABILITY = "L", _("Passivo")
    EQUITY = "E", _("Patrimonio Liquido")
    REVENUE = "R", _("Receita")
    COST = "C", _("Custo")
    EXPENSE = "X", _("Despesa")
    OTHER = "O", _("Outras")


class NatureType(models.TextChoices):
    """Natureza do saldo da conta (sentido positivo do saldo)."""

    DEBIT = "D", _("Devedora")
    CREDIT = "C", _("Credora")


class ChartOfAccount(PaddockBaseModel):
    """
    Conta do plano de contas (PCG).

    Hierarquia: cada conta pode ter uma conta pai (sintética).
    Apenas contas analíticas (is_analytical=True) aceitam lançamentos diretos.
    O código segue a máscara: 1.1.01.001 (regex: digits separados por ponto).

    Attributes:
        code: Código único da conta (ex: "4.1.02.001").
        name: Nome da conta.
        parent: Conta pai (sintética) ou None para raízes.
        account_type: Tipo econômico (Ativo, Passivo, etc.).
        nature: Natureza devedora ou credora.
        is_analytical: True = aceita lançamentos diretos.
        level: Nível na hierarquia (1 a 5).
        sped_code: Código referencial SPED ECD.
        accepts_cost_center: Se True, linha de lançamento pode ter CC.
        is_active: Soft delete.
    """

    code = models.CharField(
        _("Código"),
        max_length=30,
        unique=True,
        db_index=True,
    )
    name = models.CharField(_("Nome"), max_length=200)
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="children",
        verbose_name=_("Conta pai"),
    )
    account_type = models.CharField(
        _("Tipo"),
        max_length=1,
        choices=AccountType.choices,
    )
    nature = models.CharField(
        _("Natureza"),
        max_length=1,
        choices=NatureType.choices,
    )
    is_analytical = models.BooleanField(
        _("Analítica"),
        default=False,
        help_text="Contas analíticas aceitam lançamentos diretos.",
    )
    level = models.PositiveSmallIntegerField(
        _("Nível"),
        help_text="Nível na hierarquia (1 a 5).",
    )
    sped_code = models.CharField(
        _("Código SPED ECD"),
        max_length=30,
        blank=True,
        default="",
        help_text="Código referencial SPED ECD para exportação fiscal.",
    )
    accepts_cost_center = models.BooleanField(
        _("Aceita centro de custo"),
        default=False,
    )

    class Meta:
        ordering = ["code"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["account_type", "is_analytical"]),
            models.Index(fields=["parent"]),
        ]
        verbose_name = _("Conta Contábil")
        verbose_name_plural = _("Plano de Contas")

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"

    def clean(self) -> None:
        """
        Valida regras de negócio da conta:
        - Máscara do código: dígitos separados por ponto (ex: 1, 1.1, 1.1.01)
        - Conta sintética não pode receber lançamentos diretos (is_analytical=False).
        """
        if self.code and not _CODE_REGEX.match(self.code):
            raise ValidationError(
                {
                    "code": _(
                        "Código inválido. Use a máscara: 1, 1.1, 1.1.01, 1.1.01.001"
                    )
                }
            )

    def get_full_path(self) -> str:
        """
        Retorna o caminho completo da conta na hierarquia.

        Returns:
            String no formato "1 > 1.1 > 1.1.01 > 1.1.01.001".
        """
        parts: list[str] = [self.code]
        current = self
        while current.parent_id is not None:
            current = current.parent  # type: ignore[assignment]
            parts.insert(0, current.code)
        return " > ".join(parts)

    def save(self, *args: object, **kwargs: object) -> None:
        """Computa nível automaticamente a partir do código antes de salvar."""
        if self.code:
            self.level = len(self.code.split("."))
        self.full_clean()
        super().save(*args, **kwargs)


class CostCenter(PaddockBaseModel):
    """
    Centro de custo para rateio de despesas e receitas.

    Pode ser hierárquico (parent). O campo os_type_code mapeia para
    ServiceOrder.os_type, permitindo derivar o CC automaticamente ao fechar uma OS.

    Attributes:
        code: Código único (ex: "CC-OS", "CC-ADMNV").
        name: Nome do centro de custo.
        parent: Centro de custo pai ou None.
        os_type_code: Código do tipo de OS mapeado para este CC.
        is_active: Soft delete.
    """

    code = models.CharField(_("Código"), max_length=20, unique=True, db_index=True)
    name = models.CharField(_("Nome"), max_length=200)
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="children",
        verbose_name=_("CC pai"),
    )
    os_type_code = models.CharField(
        _("Código tipo OS"),
        max_length=20,
        blank=True,
        default="",
        help_text="Mapeamento para ServiceOrder.os_type.",
    )

    class Meta:
        ordering = ["code"]
        verbose_name = _("Centro de Custo")
        verbose_name_plural = _("Centros de Custo")

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"
