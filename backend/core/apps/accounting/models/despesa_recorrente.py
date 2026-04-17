"""
Paddock Solutions — Accounting: Despesas Recorrentes

Model:
  DespesaRecorrente — despesa fixa/recorrente por empresa com vigência datada
"""
import logging

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class DespesaRecorrente(PaddockBaseModel):
    """
    Despesa recorrente (fixa) de uma empresa do tenant.

    Representa custos fixos mensais como aluguel, energia, folha administrativa etc.
    Possui vigência datada — `vigente_ate=None` significa "vigente até nova versão".

    Ao consultar despesas vigentes em uma data `d`, use sempre:
        Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=d)

    Attributes:
        empresa: FK para pricing_profile.Empresa (PROTECT).
        tipo: Categoria da despesa (choices).
        descricao: Descrição livre da despesa.
        valor_mensal: Valor mensal em BRL (Decimal, max_digits=12).
        vigente_desde: Data de início da vigência (inclusive).
        vigente_ate: Data de fim da vigência (inclusive). Null = ainda vigente.
        conta_contabil: FK opcional para ChartOfAccount (SET_NULL).
        observacoes: Campo livre para anotações internas.
        is_active: Soft delete herdado de PaddockBaseModel.
    """

    class TipoDespesa(models.TextChoices):
        ALUGUEL = "aluguel", _("Aluguel")
        ENERGIA = "energia", _("Energia elétrica")
        AGUA = "agua", _("Água")
        INTERNET = "internet", _("Internet / Telefonia")
        SOFTWARE = "software", _("Softwares / Licenças")
        FOLHA_ADMIN = "folha_admin", _("Folha administrativa")
        CONTABILIDADE = "contabilidade", _("Contabilidade")
        MARKETING = "marketing", _("Marketing")
        DEPRECIACAO = "depreciacao", _("Depreciação de equipamentos")
        SEGURO = "seguro", _("Seguros")
        LIMPEZA = "limpeza", _("Limpeza / Insumos administrativos")
        OUTROS = "outros", _("Outros")

    empresa = models.ForeignKey(
        "pricing_profile.Empresa",
        on_delete=models.PROTECT,
        related_name="despesas_recorrentes",
        verbose_name=_("Empresa"),
    )
    tipo = models.CharField(
        _("Tipo"),
        max_length=40,
        choices=TipoDespesa.choices,
    )
    descricao = models.CharField(_("Descrição"), max_length=200)
    valor_mensal = models.DecimalField(
        _("Valor mensal"),
        max_digits=12,
        decimal_places=2,
    )
    vigente_desde = models.DateField(_("Vigente desde"))
    vigente_ate = models.DateField(
        _("Vigente até"),
        null=True,
        blank=True,
        help_text=_("Null indica que a despesa está vigente até nova versão."),
    )
    conta_contabil = models.ForeignKey(
        "accounting.ChartOfAccount",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="despesas_recorrentes",
        verbose_name=_("Conta contábil"),
    )
    observacoes = models.TextField(_("Observações"), blank=True)

    class Meta:
        verbose_name = _("Despesa Recorrente")
        verbose_name_plural = _("Despesas Recorrentes")
        ordering = ["-vigente_desde"]
        indexes = [
            models.Index(
                fields=["empresa", "vigente_desde", "vigente_ate"],
                name="acc_despesa_emp_vig_idx",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.get_tipo_display()} – R$ {self.valor_mensal}"
            f" (desde {self.vigente_desde})"
        )
