"""
Paddock Solutions — Parts Catalog (SHARED_APP)
Catálogo cross-tenant de peças automotivas com aplicação veicular.
"""

import uuid

from django.db import models


class PartCategory(models.Model):
    """Categoria de peças automotivas — ex: CARROCERIA, ILUMINACAO, MOTOR."""

    code = models.CharField(
        max_length=30,
        unique=True,
        db_index=True,
        verbose_name="Código",
        help_text="Slug uppercase: CARROCERIA, ILUMINACAO, etc.",
    )
    name = models.CharField(max_length=120, verbose_name="Nome")
    description = models.TextField(blank=True, default="", verbose_name="Descrição")
    order = models.PositiveSmallIntegerField(default=100, verbose_name="Ordem")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        app_label = "parts_catalog"
        db_table = "parts_catalog_category"
        ordering = ["order", "name"]
        verbose_name = "Categoria de Peça"
        verbose_name_plural = "Categorias de Peças"

    def __str__(self) -> str:
        return self.name


class PartReference(models.Model):
    """
    Referência canônica de peça automotiva — chave é o part number do fabricante.

    Serve como entidade única no catálogo público que todos os tenants compartilham.
    Cada instância representa uma peça física identificada por manufacturer_code.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    manufacturer_code = models.CharField(
        max_length=60,
        unique=True,
        db_index=True,
        verbose_name="Código do fabricante",
        help_text="Part number único do fabricante (ex: 52058207, 5U0941005D).",
    )
    description = models.CharField(max_length=300, verbose_name="Descrição normalizada")
    description_original = models.CharField(
        max_length=300,
        blank=True,
        default="",
        verbose_name="Descrição original (legado)",
    )
    category = models.ForeignKey(
        PartCategory,
        on_delete=models.PROTECT,
        related_name="parts",
        verbose_name="Categoria",
    )
    ncm = models.CharField(
        max_length=8,
        blank=True,
        default="",
        db_index=True,
        verbose_name="NCM",
        help_text="Código NCM 8 dígitos — obrigatório para NF-e.",
    )
    unit = models.CharField(
        max_length=10,
        default="PC",
        verbose_name="Unidade",
        help_text="PC, UN, LT, JG, KT, etc.",
    )
    ean = models.CharField(
        max_length=14,
        blank=True,
        default="",
        db_index=True,
        verbose_name="EAN/GTIN",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "parts_catalog"
        db_table = "parts_catalog_reference"
        ordering = ["description"]
        verbose_name = "Referência de Peça"
        verbose_name_plural = "Referências de Peças"
        indexes = [
            models.Index(
                fields=["category", "is_active"],
                name="idx_partref_cat_active",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.manufacturer_code} — {self.description}"


class PartApplication(models.Model):
    """
    Aplicação veicular de uma peça — relaciona PartReference a marca/modelo FIPE.

    A combinação (part_ref, make, model, source) é única para evitar duplicatas
    vindas de diferentes origens de dados (seed, OS automático, API externa, manual).
    """

    class Source(models.TextChoices):
        SEED = "seed", "Seed (legado)"
        OS_AUTO = "os_auto", "Automático (OS)"
        API_EXTERNAL = "api_external", "API Externa"
        MANUAL = "manual", "Manual"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    part_ref = models.ForeignKey(
        PartReference,
        on_delete=models.CASCADE,
        related_name="applications",
        verbose_name="Peça",
    )
    make = models.ForeignKey(
        "vehicle_catalog.VehicleMake",
        on_delete=models.CASCADE,
        related_name="part_applications",
        verbose_name="Marca",
    )
    model = models.ForeignKey(
        "vehicle_catalog.VehicleModel",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="part_applications",
        verbose_name="Modelo",
        help_text="Null = compatível com todos os modelos da marca.",
    )
    year_start = models.IntegerField(null=True, blank=True, verbose_name="Ano início")
    year_end = models.IntegerField(null=True, blank=True, verbose_name="Ano fim")
    source = models.CharField(
        max_length=15,
        choices=Source.choices,
        default=Source.MANUAL,
        verbose_name="Origem",
    )
    confidence_score = models.PositiveSmallIntegerField(
        default=50,
        verbose_name="Confiança (%)",
        help_text="0-100. seed=50, api=80, os_auto=90, manual=100.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "parts_catalog"
        db_table = "parts_catalog_application"
        ordering = ["-confidence_score", "make__nome"]
        verbose_name = "Aplicação Veicular"
        verbose_name_plural = "Aplicações Veiculares"
        constraints = [
            models.UniqueConstraint(
                fields=["part_ref", "make", "model", "source"],
                name="uq_part_app_ref_make_model_source",
            ),
        ]

    def __str__(self) -> str:
        model_str = f" {self.model.nome}" if self.model else ""
        year_str = ""
        if self.year_start:
            year_str = f" ({self.year_start}"
            year_str += f"–{self.year_end})" if self.year_end else ")"
        return f"{self.part_ref.manufacturer_code} → {self.make.nome}{model_str}{year_str}"


class PartSupplierRef(models.Model):
    """
    Referência de fornecedor para uma peça — mapeia o código interno do fornecedor
    ao part number canônico do catálogo.

    Um mesmo PartReference pode ter N fornecedores (PMZ, FORTBRAS, etc.) cada um
    com seu próprio código de identificação.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    part_ref = models.ForeignKey(
        PartReference,
        on_delete=models.CASCADE,
        related_name="suppliers",
        verbose_name="Peça",
    )
    supplier_name = models.CharField(
        max_length=200,
        verbose_name="Nome do fornecedor",
        help_text="Nome normalizado (ex: PMZ DISTRIBUIDORA, FORTBRAS).",
    )
    supplier_code = models.CharField(
        max_length=60,
        blank=True,
        default="",
        verbose_name="Código no fornecedor",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "parts_catalog"
        db_table = "parts_catalog_supplier_ref"
        ordering = ["supplier_name"]
        verbose_name = "Fornecedor de Referência"
        verbose_name_plural = "Fornecedores de Referência"
        constraints = [
            models.UniqueConstraint(
                fields=["part_ref", "supplier_name"],
                name="uq_part_supplier_ref_name",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.supplier_name} → {self.part_ref.manufacturer_code}"
