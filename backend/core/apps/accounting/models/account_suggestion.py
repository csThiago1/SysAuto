"""
Paddock Solutions — Accounting: cache de sugestão de conta contábil.

AccountSuggestionRule mapeia um termo normalizado (ex: "tesoura") para a conta
contábil correspondente. É o que segura o custo da LLM: um termo novo é
classificado uma única vez; a confirmação humana vira regra permanente.
"""

import logging

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class SuggestionSource(models.TextChoices):
    """Origem da regra — define a precedência ao gravar."""

    HUMAN = "H", _("Confirmada por usuário")
    LLM = "L", _("Sugerida por LLM")
    SEED = "S", _("Carga inicial")


class AccountSuggestionRule(PaddockBaseModel):
    """
    Regra determinística: termo normalizado → conta contábil.

    Uma regra HUMAN sobrescreve LLM e SEED; o inverso nunca acontece. O acerto
    do usuário é a última palavra e não é desfeito por chamada futura à LLM.

    Attributes:
        term: Descrição normalizada (ver services.term_normalizer).
        account: Conta contábil sugerida.
        source: Quem criou a regra.
        hits: Quantas vezes a regra já respondeu uma consulta.
    """

    term = models.CharField(
        _("Termo"),
        max_length=120,
        unique=True,
        db_index=True,
        help_text="Descrição normalizada: minúscula, sem acento, sem pontuação.",
    )
    account = models.ForeignKey(
        "accounting.ChartOfAccount",
        on_delete=models.PROTECT,
        related_name="suggestion_rules",
        verbose_name=_("Conta contábil"),
    )
    source = models.CharField(
        _("Origem"),
        max_length=1,
        choices=SuggestionSource.choices,
        default=SuggestionSource.HUMAN,
    )
    hits = models.PositiveIntegerField(_("Acertos"), default=0)

    class Meta:
        ordering = ["term"]
        verbose_name = _("Regra de Sugestão de Conta")
        verbose_name_plural = _("Regras de Sugestão de Conta")
        indexes = [models.Index(fields=["term"])]

    def __str__(self) -> str:
        return f"{self.term} → {self.account.code}"
