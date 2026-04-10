"""
Paddock Solutions — Accounting: Exercício e Período Fiscal

Models:
  FiscalYear   — exercício contábil anual
  FiscalPeriod — período mensal (ou ajuste 13°) dentro do exercício
"""
import logging

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class FiscalYear(PaddockBaseModel):
    """
    Exercício fiscal anual.

    Após is_closed=True nenhum período pode receber novos lançamentos.

    Attributes:
        year: Ano do exercício (único).
        start_date: Data de início (geralmente 01/01).
        end_date: Data de encerramento (geralmente 31/12).
        is_closed: True se o exercício foi encerrado.
        closed_at: Momento do encerramento.
        closed_by: Usuário que encerrou o exercício.
    """

    year = models.PositiveSmallIntegerField(_("Ano"), unique=True, db_index=True)
    start_date = models.DateField(_("Data início"))
    end_date = models.DateField(_("Data fim"))
    is_closed = models.BooleanField(_("Encerrado"), default=False, db_index=True)
    closed_at = models.DateTimeField(_("Encerrado em"), null=True, blank=True)
    closed_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="closed_fiscal_years",
        verbose_name=_("Encerrado por"),
    )

    class Meta:
        ordering = ["-year"]
        verbose_name = _("Exercício Fiscal")
        verbose_name_plural = _("Exercícios Fiscais")

    def __str__(self) -> str:
        status = "Encerrado" if self.is_closed else "Aberto"
        return f"Exercício {self.year} ({status})"

    def can_add_periods(self) -> bool:
        """
        Verifica se é possível adicionar períodos ao exercício.

        Returns:
            True se o exercício estiver aberto.
        """
        return not self.is_closed


class FiscalPeriod(PaddockBaseModel):
    """
    Período contábil — geralmente mensal (1 a 12) ou ajuste (13).

    Lançamentos só podem ser postados em períodos abertos (can_post() == True).

    Attributes:
        fiscal_year: Exercício ao qual pertence o período.
        number: Número do período (1-12, ou 13 para ajuste).
        start_date: Data de início do período.
        end_date: Data de encerramento do período.
        is_closed: True se o período foi fechado.
        is_adjustment: True se é o período de ajuste anual (13°).
    """

    fiscal_year = models.ForeignKey(
        FiscalYear,
        on_delete=models.PROTECT,
        related_name="periods",
        verbose_name=_("Exercício"),
    )
    number = models.PositiveSmallIntegerField(
        _("Número"),
        help_text="1-12 (mensal) ou 13 (ajuste anual).",
    )
    start_date = models.DateField(_("Data início"))
    end_date = models.DateField(_("Data fim"))
    is_closed = models.BooleanField(_("Fechado"), default=False, db_index=True)
    is_adjustment = models.BooleanField(
        _("Período de ajuste"),
        default=False,
        help_text="13° período anual de ajuste.",
    )

    class Meta:
        ordering = ["fiscal_year", "number"]
        unique_together = [["fiscal_year", "number"]]
        verbose_name = _("Período Fiscal")
        verbose_name_plural = _("Períodos Fiscais")

    def __str__(self) -> str:
        label = "Ajuste" if self.is_adjustment else f"Mês {self.number:02d}"
        return f"{self.fiscal_year.year}/{label}"

    def can_post(self) -> bool:
        """
        Verifica se é possível postar lançamentos no período.

        Returns:
            True se o período e o exercício estiverem abertos.
        """
        return not self.is_closed and not self.fiscal_year.is_closed
