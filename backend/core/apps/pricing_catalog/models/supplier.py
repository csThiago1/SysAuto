"""
Paddock Solutions — Pricing Catalog — Códigos de Fornecedor / Peça
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Pricing_catalog.Fornecedor foi removido em favor de persons.SupplierProfile
(consolidação de pessoas, 2026-06-22). CodigoFornecedorPeca agora aponta
diretamente para persons.Person com role=SUPPLIER.
"""
import logging

from django.db import models

from apps.authentication.models import PaddockBaseModel

from .canonical import PecaCanonica

logger = logging.getLogger(__name__)


class CodigoFornecedorPeca(PaddockBaseModel):
    """
    Código e preço de referência de uma PecaCanonica para um fornecedor (Person).

    Permite que o Motor de Orçamentos consulte o preço de referência
    mais recente de cada fornecedor para uma peça canônica.
    A prioridade define qual fornecedor é sugerido primeiro.
    """

    peca_canonica = models.ForeignKey(
        PecaCanonica,
        on_delete=models.CASCADE,
        related_name="codigos_fornecedor",
        verbose_name="Peça canônica",
    )
    fornecedor = models.ForeignKey(
        "persons.Person",
        on_delete=models.CASCADE,
        related_name="codigos_peca",
        limit_choices_to={"roles__role": "SUPPLIER"},
        verbose_name="Fornecedor",
    )
    sku_fornecedor = models.CharField(
        max_length=60,
        verbose_name="SKU do fornecedor",
    )
    preco_referencia = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Preço de referência (R$)",
    )
    data_referencia = models.DateField(
        null=True,
        blank=True,
        verbose_name="Data do preço de referência",
    )
    prioridade = models.PositiveSmallIntegerField(
        default=100,
        verbose_name="Prioridade",
        help_text="Menor valor = fornecedor preferido para esta peça.",
    )

    class Meta:
        verbose_name = "Código Fornecedor / Peça"
        verbose_name_plural = "Códigos Fornecedor / Peça"
        ordering = ["peca_canonica", "prioridade"]
        unique_together = [("peca_canonica", "fornecedor", "sku_fornecedor")]

    def __str__(self) -> str:
        return f"{self.fornecedor} → {self.peca_canonica} [{self.sku_fornecedor}]"
