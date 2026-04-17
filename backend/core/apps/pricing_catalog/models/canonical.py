"""
Paddock Solutions — Pricing Catalog — Modelos Canônicos
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Entidades centrais do catálogo: serviços, materiais e peças na
forma canônica (normalizada), independentes de fornecedor ou tenant.
"""
import logging

from django.db import models
from pgvector.django import VectorField

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class CategoriaServico(PaddockBaseModel):
    """
    Categoria de agrupamento de serviços canônicos.

    Exemplos: Funilaria, Pintura, Mecânica, Elétrica, Polimento, Lavagem.
    """

    codigo = models.SlugField(
        unique=True,
        verbose_name="Código",
        help_text='Slug único, ex: "funilaria", "pintura".',
    )
    nome = models.CharField(max_length=100, verbose_name="Nome")
    ordem = models.PositiveSmallIntegerField(
        default=100,
        verbose_name="Ordem de exibição",
        help_text="Menor valor aparece primeiro.",
    )

    class Meta:
        verbose_name = "Categoria de Serviço"
        verbose_name_plural = "Categorias de Serviço"
        ordering = ["ordem", "nome"]

    def __str__(self) -> str:
        return self.nome


class ServicoCanonico(PaddockBaseModel):
    """
    Serviço na forma canônica (normalizada).

    Representa o serviço independentemente de como cada seguradora ou OS
    o nomeia. O campo `embedding` armazena o vetor semântico usado no
    mapeamento automático de aliases.
    """

    codigo = models.SlugField(
        unique=True,
        db_index=True,
        verbose_name="Código",
        help_text='Slug único, ex: "pintura-para-choque".',
    )
    nome = models.CharField(max_length=200, verbose_name="Nome")
    categoria = models.ForeignKey(
        CategoriaServico,
        on_delete=models.PROTECT,
        related_name="servicos",
        verbose_name="Categoria",
    )
    unidade = models.CharField(
        max_length=20,
        default="un",
        verbose_name="Unidade",
        help_text='Unidade de cobrança: "un", "h", "m2", etc.',
    )
    descricao = models.TextField(blank=True, verbose_name="Descrição")
    aplica_multiplicador_tamanho = models.BooleanField(
        default=False,
        verbose_name="Aplica multiplicador de tamanho",
        help_text=(
            "TRUE para serviços que dependem do tamanho do veículo "
            "(pintura, funilaria, polimento). "
            "FALSE para serviços independentes de tamanho "
            "(elétrica, alinhamento, diagnóstico)."
        ),
    )
    embedding = VectorField(
        dimensions=1024,
        null=True,
        verbose_name="Embedding semântico",
        help_text="Vetor gerado pelo modelo de embeddings para busca por similaridade.",
    )
    # is_active herdado de PaddockBaseModel

    class Meta:
        verbose_name = "Serviço Canônico"
        verbose_name_plural = "Serviços Canônicos"
        ordering = ["categoria", "nome"]

    def __str__(self) -> str:
        return f"{self.categoria} / {self.nome}"


class CategoriaMaoObra(PaddockBaseModel):
    """
    Categoria de mão de obra para estruturar o catálogo técnico.

    Exemplos: Funileiro Sênior, Pintor, Mecânico, Polidor.
    """

    codigo = models.SlugField(
        unique=True,
        verbose_name="Código",
        help_text='Slug único, ex: "funileiro-senior", "pintor".',
    )
    nome = models.CharField(max_length=80, verbose_name="Nome")
    ordem = models.PositiveSmallIntegerField(
        default=100,
        verbose_name="Ordem de exibição",
        help_text="Menor valor aparece primeiro.",
    )

    class Meta:
        verbose_name = "Categoria de Mão de Obra"
        verbose_name_plural = "Categorias de Mão de Obra"
        ordering = ["ordem", "nome"]

    def __str__(self) -> str:
        return self.nome


class MaterialCanonico(PaddockBaseModel):
    """
    Material/insumo na forma canônica.

    Representa o produto independentemente de marca ou fornecedor.
    Cada MaterialCanonico pode ter múltiplos InsumoMaterial associados
    (diferentes SKUs/marcas que atendem a mesma função).
    """

    TIPO_CHOICES = [
        ("consumivel", "Consumível"),
        ("ferramenta", "Ferramenta"),
    ]

    codigo = models.SlugField(
        unique=True,
        verbose_name="Código",
        help_text='Slug único, ex: "tinta-base-1l", "lixa-400".',
    )
    nome = models.CharField(max_length=150, verbose_name="Nome")
    unidade_base = models.CharField(
        max_length=20,
        verbose_name="Unidade base",
        help_text="Unidade de medida principal: L, kg, m, un, m2.",
    )
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default="consumivel",
        verbose_name="Tipo",
    )
    embedding = VectorField(
        dimensions=1024,
        null=True,
        verbose_name="Embedding semântico",
        help_text="Vetor gerado pelo modelo de embeddings para busca por similaridade.",
    )
    # is_active herdado de PaddockBaseModel

    class Meta:
        verbose_name = "Material Canônico"
        verbose_name_plural = "Materiais Canônicos"
        ordering = ["nome"]

    def __str__(self) -> str:
        return f"{self.nome} ({self.unidade_base})"


class InsumoMaterial(PaddockBaseModel):
    """
    SKU específico de um MaterialCanonico.

    Representa uma apresentação de compra concreta (ex: Tinta Base Sikkens
    galão 3.6L) vinculada ao material canônico correspondente.
    O fator_conversao permite converter entre unidade_compra e unidade_base.
    """

    material_canonico = models.ForeignKey(
        MaterialCanonico,
        on_delete=models.PROTECT,
        related_name="insumos",
        verbose_name="Material canônico",
    )
    sku_interno = models.CharField(
        max_length=60,
        unique=True,
        verbose_name="SKU interno",
    )
    gtin = models.CharField(
        max_length=14,
        blank=True,
        db_index=True,
        verbose_name="GTIN/EAN",
    )
    descricao = models.CharField(max_length=200, verbose_name="Descrição")
    marca = models.CharField(max_length=60, blank=True, verbose_name="Marca")
    unidade_compra = models.CharField(
        max_length=20,
        verbose_name="Unidade de compra",
        help_text="Ex: galão, caixa, rolo.",
    )
    fator_conversao = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        verbose_name="Fator de conversão",
        help_text=(
            "Quantas unidades_base vêm em uma unidade_compra. "
            "Ex: galão 3.6L → 3.6 se unidade_base=L."
        ),
    )
    # is_active herdado de PaddockBaseModel

    class Meta:
        verbose_name = "Insumo / Material"
        verbose_name_plural = "Insumos / Materiais"
        ordering = ["material_canonico", "descricao"]

    def __str__(self) -> str:
        return f"{self.sku_interno} — {self.descricao}"


class PecaCanonica(PaddockBaseModel):
    """
    Peça automotiva na forma canônica.

    Representa a peça independentemente de marca/fornecedor.
    O campo `tipo_peca` classifica a qualidade/procedência.
    O campo `embedding` viabiliza mapeamento semântico de aliases.
    """

    TIPO_PECA_CHOICES = [
        ("genuina", "Genuína"),
        ("original", "Original"),
        ("paralela", "Paralela"),
        ("usada", "Usada"),
        ("recondicionada", "Recondicionada"),
    ]

    codigo = models.SlugField(
        unique=True,
        db_index=True,
        verbose_name="Código",
        help_text='Slug único, ex: "para-choque-dianteiro-corolla-2020".',
    )
    nome = models.CharField(max_length=200, verbose_name="Nome")
    tipo_peca = models.CharField(
        max_length=20,
        choices=TIPO_PECA_CHOICES,
        default="paralela",
        verbose_name="Tipo de peça",
    )
    embedding = VectorField(
        dimensions=1024,
        null=True,
        verbose_name="Embedding semântico",
        help_text="Vetor gerado pelo modelo de embeddings para busca por similaridade.",
    )
    # is_active herdado de PaddockBaseModel

    class Meta:
        verbose_name = "Peça Canônica"
        verbose_name_plural = "Peças Canônicas"
        ordering = ["nome"]

    def __str__(self) -> str:
        return f"{self.nome} ({self.get_tipo_peca_display()})"


class CompatibilidadePeca(PaddockBaseModel):
    """
    Compatibilidade de uma PecaCanonica com marca/modelo/ano de veículo.

    Permite filtrar peças disponíveis para o veículo da OS.
    """

    peca = models.ForeignKey(
        PecaCanonica,
        on_delete=models.CASCADE,
        related_name="compatibilidades",
        verbose_name="Peça",
    )
    marca = models.CharField(max_length=60, verbose_name="Marca")
    modelo = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Modelo",
        help_text="Deixar em branco para compatibilidade com toda a marca.",
    )
    ano_inicio = models.IntegerField(verbose_name="Ano início")
    ano_fim = models.IntegerField(verbose_name="Ano fim")

    class Meta:
        verbose_name = "Compatibilidade de Peça"
        verbose_name_plural = "Compatibilidades de Peças"
        ordering = ["peca", "marca", "modelo"]
        indexes = [
            models.Index(fields=["marca", "modelo", "ano_inicio", "ano_fim"]),
        ]

    def __str__(self) -> str:
        modelo_str = f" {self.modelo}" if self.modelo else ""
        return f"{self.peca} — {self.marca}{modelo_str} ({self.ano_inicio}–{self.ano_fim})"
