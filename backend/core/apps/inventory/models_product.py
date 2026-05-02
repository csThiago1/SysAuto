"""
Paddock Solutions — Inventory App — Produto Comercial
WMS Sprint 2 — Task 2.1: Models de classificação e produto comercial

ProdutoComercialPeca: SKU comercial de peça (1:N UnidadeFisica).
ProdutoComercialInsumo: SKU comercial de insumo (1:N LoteInsumo).
TipoPeca, CategoriaProduto, CategoriaInsumo: classificação hierárquica.
PosicaoVeiculo, LadoPeca: TextChoices para posicionamento.

WMS-5: Peças e insumos são modelos SEPARADOS — nunca misturar.
"""
from decimal import Decimal

from django.db import models
from django.db.models import Q
from django.core.validators import MinValueValidator

from apps.authentication.models import PaddockBaseModel


# ---------------------------------------------------------------------------
# Enums de posicionamento
# ---------------------------------------------------------------------------

class PosicaoVeiculo(models.TextChoices):
    """Posição da peça no veículo."""
    DIANTEIRO = "dianteiro", "Dianteiro"
    TRASEIRO = "traseiro", "Traseiro"
    LATERAL_ESQ = "lateral_esq", "Lateral Esquerdo"
    LATERAL_DIR = "lateral_dir", "Lateral Direito"
    SUPERIOR = "superior", "Superior"
    INFERIOR = "inferior", "Inferior"
    NA = "na", "N/A"


class LadoPeca(models.TextChoices):
    """Lado da peça (esquerdo, direito, central)."""
    ESQUERDO = "esquerdo", "Esquerdo"
    DIREITO = "direito", "Direito"
    CENTRAL = "central", "Central"
    NA = "na", "N/A"


# ---------------------------------------------------------------------------
# Classificação — Peças
# ---------------------------------------------------------------------------

class TipoPeca(PaddockBaseModel):
    """
    Tipo/natureza da peça: para-choque, farol, retrovisor, etc.
    Classificação de primeiro nível para peças.
    """
    nome = models.CharField(max_length=120)
    codigo = models.CharField(
        max_length=20,
        help_text="Código curto único (ex: PCHQ, FAROL).",
    )
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_tipo_peca"
        verbose_name = "Tipo de Peça"
        verbose_name_plural = "Tipos de Peça"
        ordering = ["ordem", "nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["codigo"],
                condition=Q(is_active=True),
                name="uq_tipo_peca_codigo_active",
            ),
        ]

    def __str__(self) -> str:
        return self.nome


class CategoriaProduto(PaddockBaseModel):
    """
    Categoria comercial de peça: funilaria, pintura, mecânica, etc.
    Define margem padrão herdada pelo ProdutoComercialPeca.
    """
    nome = models.CharField(max_length=120)
    codigo = models.CharField(
        max_length=20,
        help_text="Código curto único (ex: FUN, PINT).",
    )
    margem_padrao_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Margem padrão (%) para produtos desta categoria.",
    )
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_categoria_produto"
        verbose_name = "Categoria de Produto (Peça)"
        verbose_name_plural = "Categorias de Produto (Peça)"
        ordering = ["ordem", "nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["codigo"],
                condition=Q(is_active=True),
                name="uq_categoria_produto_codigo_active",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.codigo} — {self.nome} ({self.margem_padrao_pct}%)"


# ---------------------------------------------------------------------------
# Classificação — Insumos
# ---------------------------------------------------------------------------

class CategoriaInsumo(PaddockBaseModel):
    """
    Categoria de insumo: tintas, vernizes, abrasivos, adesivos, etc.
    Define margem padrão herdada pelo ProdutoComercialInsumo.
    """
    nome = models.CharField(max_length=120)
    codigo = models.CharField(
        max_length=20,
        help_text="Código curto único (ex: TINT, VERN).",
    )
    margem_padrao_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Margem padrão (%) para insumos desta categoria.",
    )
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_categoria_insumo"
        verbose_name = "Categoria de Insumo"
        verbose_name_plural = "Categorias de Insumo"
        ordering = ["ordem", "nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["codigo"],
                condition=Q(is_active=True),
                name="uq_categoria_insumo_codigo_active",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.codigo} — {self.nome} ({self.margem_padrao_pct}%)"


# ---------------------------------------------------------------------------
# Produto Comercial — Peça
# ---------------------------------------------------------------------------

class ProdutoComercialPeca(PaddockBaseModel):
    """
    SKU comercial de uma peça.

    Ponte entre o catálogo técnico (PecaCanonica) e a realidade comercial:
    código de fabricante, EAN, preço de venda sugerido, margem, posição no veículo.

    Cada UnidadeFisica pode apontar para um ProdutoComercialPeca.
    """
    sku_interno = models.CharField(
        max_length=40,
        help_text="SKU interno da empresa (ex: PC-001).",
    )
    nome_interno = models.CharField(
        max_length=255,
        help_text="Nome comercial da peça (ex: Para-choque Gol G5 Dianteiro).",
    )
    codigo_fabricante = models.CharField(
        max_length=60, blank=True, default="",
        help_text="Part number do fabricante.",
    )
    codigo_ean = models.CharField(
        max_length=14, blank=True, default="",
        help_text="Código EAN/GTIN (8 ou 13 dígitos).",
    )
    codigo_distribuidor = models.CharField(
        max_length=60, blank=True, default="",
        help_text="Código do distribuidor/atacadista.",
    )
    nome_fabricante = models.CharField(
        max_length=120, blank=True, default="",
        help_text="Nome do fabricante (ex: Volkswagen, Cibie).",
    )

    # Classificação
    tipo_peca = models.ForeignKey(
        TipoPeca,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos",
    )
    posicao_veiculo = models.CharField(
        max_length=20,
        choices=PosicaoVeiculo.choices,
        default=PosicaoVeiculo.NA,
    )
    lado = models.CharField(
        max_length=20,
        choices=LadoPeca.choices,
        default=LadoPeca.NA,
    )
    categoria = models.ForeignKey(
        CategoriaProduto,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos",
    )

    # Vínculo com catálogo técnico (pricing_catalog)
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos_comerciais",
        help_text="Peça canônica do catálogo técnico.",
    )

    # Preço e margem
    preco_venda_sugerido = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Preço de venda sugerido (R$).",
    )
    margem_padrao_pct = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Margem (%) — sobrescreve a da categoria se preenchida.",
    )

    observacoes = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_produto_comercial_peca"
        verbose_name = "Produto Comercial (Peça)"
        verbose_name_plural = "Produtos Comerciais (Peças)"
        constraints = [
            models.UniqueConstraint(
                fields=["sku_interno"],
                condition=Q(is_active=True),
                name="uq_produto_peca_sku_active",
            ),
        ]
        indexes = [
            models.Index(fields=["codigo_ean"], name="idx_prod_peca_ean"),
            models.Index(fields=["codigo_fabricante"], name="idx_prod_peca_fab"),
            models.Index(fields=["peca_canonica"], name="idx_prod_peca_canonica"),
            models.Index(
                fields=["tipo_peca", "posicao_veiculo", "lado"],
                name="idx_prod_peca_tipo_pos_lado",
            ),
        ]

    def __str__(self) -> str:
        return f"[{self.sku_interno}] {self.nome_interno}"


# ---------------------------------------------------------------------------
# Produto Comercial — Insumo
# ---------------------------------------------------------------------------

class ProdutoComercialInsumo(PaddockBaseModel):
    """
    SKU comercial de um insumo.

    Ponte entre o catálogo técnico (MaterialCanonico) e a realidade comercial:
    código de fabricante, EAN, preço de venda sugerido, margem, unidade base.

    Cada LoteInsumo pode apontar para um ProdutoComercialInsumo.
    """
    sku_interno = models.CharField(
        max_length=40,
        help_text="SKU interno da empresa (ex: VN-001).",
    )
    nome_interno = models.CharField(
        max_length=255,
        help_text="Nome comercial do insumo (ex: Verniz PU Lazzuril 900ml).",
    )
    codigo_fabricante = models.CharField(
        max_length=60, blank=True, default="",
        help_text="Part number do fabricante.",
    )
    codigo_ean = models.CharField(
        max_length=14, blank=True, default="",
        help_text="Código EAN/GTIN (8 ou 13 dígitos).",
    )
    nome_fabricante = models.CharField(
        max_length=120, blank=True, default="",
        help_text="Nome do fabricante (ex: Lazzuril, Sikkens).",
    )
    unidade_base = models.CharField(
        max_length=10, default="un",
        help_text="Unidade de medida base (L, ml, kg, un).",
    )

    # Classificação
    categoria_insumo = models.ForeignKey(
        CategoriaInsumo,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos",
    )

    # Vínculo com catálogo técnico (pricing_catalog)
    material_canonico = models.ForeignKey(
        "pricing_catalog.MaterialCanonico",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos_comerciais",
        help_text="Material canônico do catálogo técnico.",
    )

    # Preço e margem
    preco_venda_sugerido = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Preço de venda sugerido (R$).",
    )
    margem_padrao_pct = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Margem (%) — sobrescreve a da categoria se preenchida.",
    )

    observacoes = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_produto_comercial_insumo"
        verbose_name = "Produto Comercial (Insumo)"
        verbose_name_plural = "Produtos Comerciais (Insumos)"
        constraints = [
            models.UniqueConstraint(
                fields=["sku_interno"],
                condition=Q(is_active=True),
                name="uq_produto_insumo_sku_active",
            ),
        ]
        indexes = [
            models.Index(fields=["codigo_ean"], name="idx_prod_insumo_ean"),
            models.Index(fields=["codigo_fabricante"], name="idx_prod_insumo_fab"),
            models.Index(fields=["material_canonico"], name="idx_prod_insumo_canonico"),
        ]

    def __str__(self) -> str:
        return f"[{self.sku_interno}] {self.nome_interno}"
