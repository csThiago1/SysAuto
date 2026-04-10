"""
Paddock Solutions — Accounting: Sequência de Numeração

Model:
  NumberSequence — controle de numeração sequencial thread-safe por chave
"""
import logging

from django.db import models
from django.utils.translation import gettext_lazy as _

logger = logging.getLogger(__name__)


class NumberSequence(models.Model):
    """
    Sequência de numeração para documentos contábeis.

    Não herda PaddockBaseModel — não precisa de UUID PK nem soft delete.
    Atualizado com select_for_update() para garantir thread-safety.

    Attributes:
        key: Identificador da sequência (ex: 'JE', 'AP', 'AR').
        last_number: Último número gerado.
        updated_at: Timestamp da última atualização.
    """

    key = models.CharField(
        _("Chave"),
        max_length=20,
        unique=True,
        db_index=True,
        help_text="Prefixo da sequência: JE, AP, AR, etc.",
    )
    last_number = models.PositiveIntegerField(_("Último número"), default=0)
    updated_at = models.DateTimeField(_("Atualizado em"), auto_now=True)

    class Meta:
        ordering = ["key"]
        verbose_name = _("Sequência de Numeração")
        verbose_name_plural = _("Sequências de Numeração")

    def __str__(self) -> str:
        return f"{self.key}: {self.last_number}"
