"""
Paddock Solutions — Pricing Catalog — Modelos de Fornecedor
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Representa fornecedores de peças e seus códigos/preços de referência.
"""
import logging

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.authentication.models import PaddockBaseModel

from .canonical import PecaCanonica

logger = logging.getLogger(__name__)


class Fornecedor(PaddockBaseModel):
    """
    Perfil de fornecedor vinculado a uma Person do tenant.

    A entidade Person (apps.persons) centraliza dados de contato e endereço.
    Fornecedor adiciona atributos comerciais específicos.
    """

    pessoa = models.OneToOneField(
        "persons.Person",
        on_delete=models.CASCADE,
        related_name="perfil_fornecedor",
        verbose_name="Pessoa",
    )
    condicoes_pagamento = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Condições de pagamento",
        help_text='Ex: "30/60/90 dias", "À vista 5% desconto".',
    )
    prazo_entrega_dias = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Prazo de entrega (dias)",
    )
    avaliacao = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        verbose_name="Avaliação",
        help_text="Nota de 1 a 5 estrelas.",
    )
    # is_active herdado de PaddockBaseModel

    class Meta:
        verbose_name = "Fornecedor"
        verbose_name_plural = "Fornecedores"
        ordering = ["pessoa__full_name"]

    def __str__(self) -> str:
        return str(self.pessoa)


class CodigoFornecedorPeca(PaddockBaseModel):
    """
    Código e preço de referência de uma PecaCanonica para um Fornecedor.

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
        Fornecedor,
        on_delete=models.CASCADE,
        related_name="codigos_peca",
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
