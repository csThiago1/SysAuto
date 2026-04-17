"""
Paddock Solutions — Pricing Catalog — Modelos de Aliases
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Aliases mapeiam denominações variadas (de seguradoras, OS históricas, etc.)
para os canônicos correspondentes. O índice GIN trgm viabiliza fuzzy search.
"""
import logging

from django.contrib.postgres.indexes import GinIndex
from django.db import models

from apps.authentication.models import PaddockBaseModel

from .canonical import MaterialCanonico, PecaCanonica, ServicoCanonico

logger = logging.getLogger(__name__)

ORIGEM_CHOICES = [
    ("import", "Importação"),
    ("manual", "Cadastro manual"),
    ("auto_alta", "Auto — confiança alta"),
    ("auto_media", "Auto — confiança média (revisar)"),
]


class AliasServico(PaddockBaseModel):
    """
    Alias de texto para um ServicoCanonico.

    Armazena denominações alternativas usadas por seguradoras ou extraídas
    de OS históricas. O campo `texto_normalizado` (lowercase, sem acentos)
    é usado no índice GIN para fuzzy search via pg_trgm.
    """

    canonico = models.ForeignKey(
        ServicoCanonico,
        on_delete=models.CASCADE,
        related_name="aliases",
        verbose_name="Serviço canônico",
    )
    texto = models.CharField(max_length=300, verbose_name="Texto original")
    texto_normalizado = models.CharField(
        max_length=300,
        db_index=True,
        verbose_name="Texto normalizado",
        help_text="Lowercase sem acentos — usado para busca fuzzy.",
    )
    origem = models.CharField(
        max_length=20,
        choices=ORIGEM_CHOICES,
        verbose_name="Origem",
    )
    confianca = models.FloatField(
        null=True,
        blank=True,
        verbose_name="Confiança",
        help_text="Score de confiança do mapeamento automático (0.0–1.0).",
    )
    confirmado_em = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Confirmado em",
    )
    confirmado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="aliases_servico_confirmados",
        verbose_name="Confirmado por",
    )
    ocorrencias = models.PositiveIntegerField(
        default=1,
        verbose_name="Ocorrências",
        help_text="Quantas vezes este texto apareceu nas OS.",
    )

    class Meta:
        verbose_name = "Alias de Serviço"
        verbose_name_plural = "Aliases de Serviço"
        ordering = ["-ocorrencias", "texto_normalizado"]
        indexes = [
            models.Index(fields=["texto_normalizado"]),
            GinIndex(
                fields=["texto_normalizado"],
                name="alias_servico_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ]

    def __str__(self) -> str:
        return f'"{self.texto}" → {self.canonico}'


class AliasPeca(PaddockBaseModel):
    """
    Alias de texto para uma PecaCanonica.

    Mesma lógica de AliasServico, aplicada a peças automotivas.
    """

    canonico = models.ForeignKey(
        PecaCanonica,
        on_delete=models.CASCADE,
        related_name="aliases",
        verbose_name="Peça canônica",
    )
    texto = models.CharField(max_length=300, verbose_name="Texto original")
    texto_normalizado = models.CharField(
        max_length=300,
        db_index=True,
        verbose_name="Texto normalizado",
    )
    origem = models.CharField(
        max_length=20,
        choices=ORIGEM_CHOICES,
        verbose_name="Origem",
    )
    confianca = models.FloatField(null=True, blank=True, verbose_name="Confiança")
    confirmado_em = models.DateTimeField(null=True, blank=True, verbose_name="Confirmado em")
    confirmado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="aliases_peca_confirmados",
        verbose_name="Confirmado por",
    )
    ocorrencias = models.PositiveIntegerField(default=1, verbose_name="Ocorrências")

    class Meta:
        verbose_name = "Alias de Peça"
        verbose_name_plural = "Aliases de Peça"
        ordering = ["-ocorrencias", "texto_normalizado"]
        indexes = [
            models.Index(fields=["texto_normalizado"]),
            GinIndex(
                fields=["texto_normalizado"],
                name="alias_peca_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ]

    def __str__(self) -> str:
        return f'"{self.texto}" → {self.canonico}'


class AliasMaterial(PaddockBaseModel):
    """
    Alias de texto para um MaterialCanonico.

    Mesma lógica de AliasServico, aplicada a materiais/insumos.
    """

    canonico = models.ForeignKey(
        MaterialCanonico,
        on_delete=models.CASCADE,
        related_name="aliases",
        verbose_name="Material canônico",
    )
    texto = models.CharField(max_length=300, verbose_name="Texto original")
    texto_normalizado = models.CharField(
        max_length=300,
        db_index=True,
        verbose_name="Texto normalizado",
    )
    origem = models.CharField(
        max_length=20,
        choices=ORIGEM_CHOICES,
        verbose_name="Origem",
    )
    confianca = models.FloatField(null=True, blank=True, verbose_name="Confiança")
    confirmado_em = models.DateTimeField(null=True, blank=True, verbose_name="Confirmado em")
    confirmado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="aliases_material_confirmados",
        verbose_name="Confirmado por",
    )
    ocorrencias = models.PositiveIntegerField(default=1, verbose_name="Ocorrências")

    class Meta:
        verbose_name = "Alias de Material"
        verbose_name_plural = "Aliases de Material"
        ordering = ["-ocorrencias", "texto_normalizado"]
        indexes = [
            models.Index(fields=["texto_normalizado"]),
            GinIndex(
                fields=["texto_normalizado"],
                name="alias_material_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ]

    def __str__(self) -> str:
        return f'"{self.texto}" → {self.canonico}'
