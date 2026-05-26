# Parts Catalog — SHARED_APP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `parts_catalog` SHARED_APP that provides a cross-tenant canonical catalog of automotive parts, with vehicle application data that auto-enriches from service orders.

**Architecture:** New Django app in public schema with 4 models: `PartCategory`, `PartReference`, `PartApplication`, `PartSupplierRef`. PartReference uses `manufacturer_code` as unique identifier. PartApplication links parts to `vehicle_catalog.VehicleMake/VehicleModel` via FK. Seed data comes from cleaned legacy spreadsheet (23,859 records). Auto-learning signal fires when OS reaches `delivered` status.

**Tech Stack:** Django 5, DRF, django-tenants (SHARED_APP), PostgreSQL, pytest + factory-boy

---

## File Structure

```
backend/core/apps/parts_catalog/
├── __init__.py
├── apps.py                    # AppConfig (label=parts_catalog)
├── models.py                  # PartCategory, PartReference, PartApplication, PartSupplierRef
├── serializers.py             # DRF serializers (list/detail/search)
├── views.py                   # ReadOnly + Create ViewSets with caching
├── admin.py                   # Django admin for all 4 models
├── urls.py                    # Router registration
├── signals.py                 # Auto-learning signal (OS delivered → PartApplication)
├── management/
│   ├── __init__.py
│   └── commands/
│       ├── __init__.py
│       └── seed_parts_catalog.py  # Seed from catalogo_pecas_limpo.xlsx
├── migrations/
│   ├── __init__.py
│   └── 0001_initial.py        # Auto-generated
└── tests/
    ├── __init__.py
    ├── test_models.py
    ├── test_views.py
    └── factories.py

# Modified files:
backend/core/config/settings/base.py       # Add to SHARED_APPS
backend/core/config/urls.py                 # Add URL route
backend/core/apps/inventory/models_product.py  # Add part_ref FK to ProdutoComercialPeca
```

---

### Task 1: App scaffold + Models

**Files:**
- Create: `backend/core/apps/parts_catalog/__init__.py`
- Create: `backend/core/apps/parts_catalog/apps.py`
- Create: `backend/core/apps/parts_catalog/models.py`
- Create: `backend/core/apps/parts_catalog/migrations/__init__.py`
- Modify: `backend/core/config/settings/base.py:21-46`

- [ ] **Step 1: Create the app directory structure**

```bash
mkdir -p backend/core/apps/parts_catalog/migrations
mkdir -p backend/core/apps/parts_catalog/management/commands
mkdir -p backend/core/apps/parts_catalog/tests
touch backend/core/apps/parts_catalog/__init__.py
touch backend/core/apps/parts_catalog/migrations/__init__.py
touch backend/core/apps/parts_catalog/management/__init__.py
touch backend/core/apps/parts_catalog/management/commands/__init__.py
touch backend/core/apps/parts_catalog/tests/__init__.py
```

- [ ] **Step 2: Create apps.py**

Write `backend/core/apps/parts_catalog/apps.py`:

```python
from django.apps import AppConfig


class PartsCatalogConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.parts_catalog"
    label = "parts_catalog"
    verbose_name = "Catálogo de Peças"

    def ready(self) -> None:
        import apps.parts_catalog.signals  # noqa: F401
```

- [ ] **Step 3: Create models.py**

Write `backend/core/apps/parts_catalog/models.py`:

```python
"""
Paddock Solutions — Parts Catalog (SHARED_APP)
Catálogo cross-tenant de peças automotivas com aplicação veicular.

Complementar ao pricing_catalog.PecaCanonica (tipo genérico de peça para
precificação). PartReference identifica peças pelo código do fabricante
e acumula dados de aplicação veicular automaticamente via OS.
"""

import uuid

from django.db import models


class PartCategory(models.Model):
    """
    Categoria de peça: CARROCERIA, ILUMINACAO, SUSPENSAO, etc.
    Seed: 13 categorias derivadas da limpeza do estoque legado.
    """

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
    Referência canônica de peça por código de fabricante.

    Este é o SKU global compartilhado entre todos os tenants.
    Um ProdutoComercialPeca (tenant) aponta para um PartReference (shared).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    manufacturer_code = models.CharField(
        max_length=60,
        unique=True,
        db_index=True,
        verbose_name="Código do fabricante",
        help_text="Part number único do fabricante (ex: 52058207, 5U0941005D).",
    )
    description = models.CharField(
        max_length=300,
        verbose_name="Descrição normalizada",
    )
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
    Aplicação veicular de uma peça — grafo peça ↔ veículo.

    Pode vir de:
    - seed: limpeza do estoque legado (confidence=50)
    - os_auto: OS entregue associa peça a veículo (confidence=90)
    - api_external: enriquecimento via TecDoc/Fraga/Cilia (confidence=80)
    - manual: cadastro manual pelo operador (confidence=100)
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
    year_start = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="Ano início",
    )
    year_end = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="Ano fim",
    )
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
    Fornecedores conhecidos de uma peça (dados do legado + fontes externas).
    Não é o Fornecedor do tenant — é referência compartilhada.
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
```

- [ ] **Step 4: Register in SHARED_APPS**

In `backend/core/config/settings/base.py`, add `"apps.parts_catalog"` to the end of SHARED_APPS list (before the closing `]`), after `"apps.vehicle_catalog"`:

```python
    "apps.vehicle_catalog",
    "apps.parts_catalog",
]
```

- [ ] **Step 5: Create a placeholder signals.py**

Write `backend/core/apps/parts_catalog/signals.py`:

```python
"""
Paddock Solutions — Parts Catalog — Signals
Auto-learning: when OS is delivered, register PartApplication.
Implemented in Task 5.
"""
```

- [ ] **Step 6: Generate and run migration**

```bash
cd backend/core && python manage.py makemigrations parts_catalog
python manage.py migrate_schemas --schema=public
```

- [ ] **Step 7: Commit**

```bash
git add backend/core/apps/parts_catalog/ backend/core/config/settings/base.py
git commit -m "feat(parts_catalog): scaffold SHARED_APP with 4 models

PartCategory, PartReference, PartApplication, PartSupplierRef.
Cross-tenant catalog of auto parts with vehicle application tracking."
```

---

### Task 2: Admin + Serializers + Views + URLs

**Files:**
- Create: `backend/core/apps/parts_catalog/admin.py`
- Create: `backend/core/apps/parts_catalog/serializers.py`
- Create: `backend/core/apps/parts_catalog/views.py`
- Create: `backend/core/apps/parts_catalog/urls.py`
- Modify: `backend/core/config/urls.py:30`

- [ ] **Step 1: Create admin.py**

Write `backend/core/apps/parts_catalog/admin.py`:

```python
from django.contrib import admin

from apps.parts_catalog.models import (
    PartApplication,
    PartCategory,
    PartReference,
    PartSupplierRef,
)


@admin.register(PartCategory)
class PartCategoryAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "order", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["code", "name"]
    ordering = ["order", "name"]


@admin.register(PartReference)
class PartReferenceAdmin(admin.ModelAdmin):
    list_display = [
        "manufacturer_code",
        "description",
        "category",
        "ncm",
        "unit",
        "is_active",
    ]
    list_filter = ["category", "is_active"]
    search_fields = ["manufacturer_code", "description", "ean", "ncm"]
    raw_id_fields = ["category"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(PartApplication)
class PartApplicationAdmin(admin.ModelAdmin):
    list_display = [
        "part_ref",
        "make",
        "model",
        "year_start",
        "year_end",
        "source",
        "confidence_score",
    ]
    list_filter = ["source", "confidence_score", "make"]
    search_fields = [
        "part_ref__manufacturer_code",
        "part_ref__description",
        "make__nome",
        "model__nome",
    ]
    raw_id_fields = ["part_ref", "make", "model"]
    readonly_fields = ["id", "created_at"]


@admin.register(PartSupplierRef)
class PartSupplierRefAdmin(admin.ModelAdmin):
    list_display = ["supplier_name", "part_ref", "supplier_code"]
    search_fields = ["supplier_name", "part_ref__manufacturer_code"]
    raw_id_fields = ["part_ref"]
    readonly_fields = ["id", "created_at"]
```

- [ ] **Step 2: Create serializers.py**

Write `backend/core/apps/parts_catalog/serializers.py`:

```python
from rest_framework import serializers

from apps.parts_catalog.models import (
    PartApplication,
    PartCategory,
    PartReference,
    PartSupplierRef,
)


class PartCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PartCategory
        fields = ["id", "code", "name", "description", "order", "is_active"]


class PartSupplierRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartSupplierRef
        fields = ["id", "supplier_name", "supplier_code"]


class PartApplicationSerializer(serializers.ModelSerializer):
    make_nome = serializers.CharField(source="make.nome", read_only=True)
    model_nome = serializers.CharField(
        source="model.nome", read_only=True, default=None
    )

    class Meta:
        model = PartApplication
        fields = [
            "id",
            "make",
            "make_nome",
            "model",
            "model_nome",
            "year_start",
            "year_end",
            "source",
            "confidence_score",
        ]
        read_only_fields = ["id"]


class PartReferenceListSerializer(serializers.ModelSerializer):
    """Serializer leve para listagem."""

    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = PartReference
        fields = [
            "id",
            "manufacturer_code",
            "description",
            "category",
            "category_name",
            "ncm",
            "unit",
            "ean",
            "is_active",
        ]


class PartReferenceDetailSerializer(serializers.ModelSerializer):
    """Serializer completo com aplicações e fornecedores."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    applications = PartApplicationSerializer(many=True, read_only=True)
    suppliers = PartSupplierRefSerializer(many=True, read_only=True)

    class Meta:
        model = PartReference
        fields = [
            "id",
            "manufacturer_code",
            "description",
            "description_original",
            "category",
            "category_name",
            "ncm",
            "unit",
            "ean",
            "is_active",
            "applications",
            "suppliers",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
```

- [ ] **Step 3: Create views.py**

Write `backend/core/apps/parts_catalog/views.py`:

```python
import logging

from django.core.cache import cache
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import IsManagerOrAbove
from apps.parts_catalog.models import (
    PartApplication,
    PartCategory,
    PartReference,
)
from apps.parts_catalog.serializers import (
    PartApplicationSerializer,
    PartCategorySerializer,
    PartReferenceDetailSerializer,
    PartReferenceListSerializer,
)

logger = logging.getLogger(__name__)

CACHE_TTL_CATEGORIES = 3600  # 1h — raramente muda


class PartCategoryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Lista de categorias de peça (cached)."""

    queryset = PartCategory.objects.filter(is_active=True)
    serializer_class = PartCategorySerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        cached = cache.get("parts_catalog:categories")
        if cached is not None:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        cache.set("parts_catalog:categories", response.data, timeout=CACHE_TTL_CATEGORIES)
        return response


class PartReferenceViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Catálogo de peças por código fabricante.

    - list / retrieve / search: qualquer autenticado
    - create / update: MANAGER+
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
        DjangoFilterBackend,
    ]
    search_fields = ["manufacturer_code", "description", "ean"]
    ordering_fields = ["description", "manufacturer_code", "created_at"]
    filterset_fields = ["category", "is_active"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = PartReference.objects.select_related("category")
        if self.action == "list":
            return qs.filter(is_active=True)
        if self.action == "retrieve":
            return qs.prefetch_related(
                "applications__make",
                "applications__model",
                "suppliers",
            )
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PartReferenceDetailSerializer
        return PartReferenceListSerializer


class PartApplicationViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Aplicações veiculares de peças.

    - list: filtrado por part_ref ou make
    - create: MANAGER+ (cadastro manual)
    """

    serializer_class = PartApplicationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["part_ref", "make", "source"]

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return PartApplication.objects.select_related("make", "model")

    def perform_create(self, serializer):
        serializer.save(source="manual", confidence_score=100)
```

- [ ] **Step 4: Create urls.py**

Write `backend/core/apps/parts_catalog/urls.py`:

```python
from rest_framework.routers import DefaultRouter

from apps.parts_catalog.views import (
    PartApplicationViewSet,
    PartCategoryViewSet,
    PartReferenceViewSet,
)

router = DefaultRouter()
router.register(r"categories", PartCategoryViewSet, basename="part-category")
router.register(r"references", PartReferenceViewSet, basename="part-reference")
router.register(r"applications", PartApplicationViewSet, basename="part-application")

urlpatterns = router.urls
```

- [ ] **Step 5: Register URL in config/urls.py**

In `backend/core/config/urls.py`, add after the `vehicle-catalog` line:

```python
    path("api/v1/vehicle-catalog/", include("apps.vehicle_catalog.urls")),
    path("api/v1/parts-catalog/", include("apps.parts_catalog.urls")),
```

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/parts_catalog/admin.py backend/core/apps/parts_catalog/serializers.py backend/core/apps/parts_catalog/views.py backend/core/apps/parts_catalog/urls.py backend/core/config/urls.py
git commit -m "feat(parts_catalog): admin, serializers, views, URL routing

ReadOnly + Create for categories, references, applications.
Cached categories, search by manufacturer_code/description/ean."
```

---

### Task 3: Seed command (legacy data → PartReference)

**Files:**
- Create: `backend/core/apps/parts_catalog/management/commands/seed_parts_catalog.py`
- Input: `data/migrations/catalogo_pecas_limpo.xlsx`

- [ ] **Step 1: Create seed management command**

Write `backend/core/apps/parts_catalog/management/commands/seed_parts_catalog.py`:

```python
"""
Seed do catálogo de peças a partir da planilha limpa do estoque legado.

Uso:
    python manage.py seed_parts_catalog
    python manage.py seed_parts_catalog --dry-run
"""

import logging
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

logger = logging.getLogger(__name__)

XLSX_PATH = Path(__file__).resolve().parents[5] / "data" / "migrations" / "catalogo_pecas_limpo.xlsx"

CATEGORY_SEED = [
    ("CARROCERIA", "Carroceria", 10),
    ("ILUMINACAO", "Iluminação", 20),
    ("SUSPENSAO", "Suspensão", 30),
    ("ARREFECIMENTO_AR", "Arrefecimento / Ar Condicionado", 40),
    ("RODAS_PNEUS", "Rodas e Pneus", 50),
    ("EMBLEMAS_ADESIVOS", "Emblemas e Adesivos", 60),
    ("PINTURA_INSUMOS", "Pintura e Insumos", 70),
    ("MOTOR_TRANSMISSAO", "Motor e Transmissão", 80),
    ("VIDROS", "Vidros", 90),
    ("ELETRICA", "Elétrica", 100),
    ("CONSUMIVEIS", "Consumíveis", 110),
    ("FREIOS", "Freios", 120),
    ("OUTROS", "Outros", 999),
]


class Command(BaseCommand):
    help = "Seed do catálogo de peças a partir do estoque legado."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Apenas simula, não grava no banco.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        try:
            import pandas as pd
        except ImportError:
            self.stderr.write("pandas é necessário: pip install pandas openpyxl")
            return

        from apps.parts_catalog.models import (
            PartApplication,
            PartCategory,
            PartReference,
            PartSupplierRef,
        )
        from apps.vehicle_catalog.models import VehicleMake, VehicleModel

        if not XLSX_PATH.exists():
            self.stderr.write(f"Arquivo não encontrado: {XLSX_PATH}")
            self.stderr.write("Rode primeiro: python3 data/migrations/limpar_estoque_legado.py")
            return

        # ── 1. Categorias ──
        self.stdout.write("Criando categorias...")
        categories = {}
        for code, name, order in CATEGORY_SEED:
            if dry_run:
                categories[code] = None
                continue
            cat, created = PartCategory.objects.get_or_create(
                code=code,
                defaults={"name": name, "order": order},
            )
            categories[code] = cat
            if created:
                self.stdout.write(f"  + {code}: {name}")

        # ── 2. Ler planilha ──
        self.stdout.write(f"Lendo {XLSX_PATH}...")
        df = pd.read_excel(XLSX_PATH, sheet_name="Catálogo")
        self.stdout.write(f"  {len(df)} registros")

        # Filtrar apenas registros com código fabricante
        df_with_code = df[df["codigo_fabricante"].notna()].copy()
        df_with_code["codigo_fabricante"] = df_with_code["codigo_fabricante"].astype(str).str.strip()
        df_with_code = df_with_code[df_with_code["codigo_fabricante"].str.len() >= 2]
        self.stdout.write(f"  {len(df_with_code)} com código fabricante válido")

        if dry_run:
            self.stdout.write("[DRY RUN] Nada gravado.")
            return

        # ── 3. Build de cache de marcas/modelos FIPE ──
        makes_cache = {}
        for make in VehicleMake.objects.all():
            makes_cache[make.nome.upper()] = make
            makes_cache[make.nome_normalizado.upper()] = make

        models_cache = {}
        for vm in VehicleModel.objects.select_related("marca").all():
            key = (vm.marca_id, vm.nome.upper())
            models_cache[key] = vm
            key_norm = (vm.marca_id, vm.nome_normalizado.upper())
            models_cache[key_norm] = vm

        # ── 4. Inserir PartReferences ──
        self.stdout.write("Inserindo referências...")
        created_count = 0
        skipped_count = 0
        app_count = 0
        supplier_count = 0

        with transaction.atomic():
            for _, row in df_with_code.iterrows():
                code = str(row["codigo_fabricante"]).strip()
                cat_code = str(row.get("categoria", "OUTROS"))
                category = categories.get(cat_code, categories.get("OUTROS"))

                desc = str(row.get("descricao", "")) if pd.notna(row.get("descricao")) else ""
                desc_orig = str(row.get("descricao_original", "")) if pd.notna(row.get("descricao_original")) else ""
                ncm = str(row.get("ncm", "")) if pd.notna(row.get("ncm")) else ""
                unit = str(row.get("unidade", "PC")) if pd.notna(row.get("unidade")) else "PC"
                ean = str(row.get("codigo_barras", "")) if pd.notna(row.get("codigo_barras")) else ""

                ref, created = PartReference.objects.get_or_create(
                    manufacturer_code=code,
                    defaults={
                        "description": desc[:300],
                        "description_original": desc_orig[:300],
                        "category": category,
                        "ncm": ncm[:8],
                        "unit": unit[:10],
                        "ean": ean[:14],
                    },
                )
                if created:
                    created_count += 1
                else:
                    skipped_count += 1
                    continue

                # ── 4a. Aplicação veicular (se disponível) ──
                marca_str = str(row.get("veiculo_marca", "")) if pd.notna(row.get("veiculo_marca")) else ""
                modelo_str = str(row.get("veiculo_modelo", "")) if pd.notna(row.get("veiculo_modelo")) else ""

                if marca_str:
                    make = makes_cache.get(marca_str.upper())
                    if make:
                        model_obj = None
                        if modelo_str:
                            model_obj = models_cache.get(
                                (make.pk, modelo_str.upper())
                            )

                        year_start = None
                        year_end = None
                        if pd.notna(row.get("veiculo_ano_de")):
                            year_start = int(row["veiculo_ano_de"])
                        if pd.notna(row.get("veiculo_ano_ate")):
                            year_end = int(row["veiculo_ano_ate"])

                        PartApplication.objects.get_or_create(
                            part_ref=ref,
                            make=make,
                            model=model_obj,
                            source="seed",
                            defaults={
                                "year_start": year_start,
                                "year_end": year_end,
                                "confidence_score": 50,
                            },
                        )
                        app_count += 1

                # ── 4b. Fornecedores ──
                forn_str = str(row.get("fornecedores", "")) if pd.notna(row.get("fornecedores")) else ""
                if forn_str:
                    for supplier_name in forn_str.split(" | "):
                        supplier_name = supplier_name.strip()
                        if supplier_name:
                            PartSupplierRef.objects.get_or_create(
                                part_ref=ref,
                                supplier_name=supplier_name[:200],
                            )
                            supplier_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seed completo: {created_count} referências criadas, "
            f"{skipped_count} já existiam, "
            f"{app_count} aplicações veiculares, "
            f"{supplier_count} fornecedores"
        ))
```

- [ ] **Step 2: Commit**

```bash
git add backend/core/apps/parts_catalog/management/
git commit -m "feat(parts_catalog): seed command from cleaned legacy spreadsheet

Imports 23k+ PartReferences with categories, vehicle applications,
and supplier references from catalogo_pecas_limpo.xlsx."
```

---

### Task 4: Tests

**Files:**
- Create: `backend/core/apps/parts_catalog/tests/factories.py`
- Create: `backend/core/apps/parts_catalog/tests/test_models.py`
- Create: `backend/core/apps/parts_catalog/tests/test_views.py`

- [ ] **Step 1: Create test factories**

Write `backend/core/apps/parts_catalog/tests/factories.py`:

```python
import factory

from apps.parts_catalog.models import (
    PartApplication,
    PartCategory,
    PartReference,
    PartSupplierRef,
)


class PartCategoryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PartCategory
        django_get_or_create = ("code",)

    code = factory.Sequence(lambda n: f"CAT{n:03d}")
    name = factory.LazyAttribute(lambda o: f"Categoria {o.code}")
    order = factory.Sequence(lambda n: n * 10)


class PartReferenceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PartReference
        django_get_or_create = ("manufacturer_code",)

    manufacturer_code = factory.Sequence(lambda n: f"MFG-{n:06d}")
    description = factory.LazyAttribute(lambda o: f"Peça {o.manufacturer_code}")
    category = factory.SubFactory(PartCategoryFactory)
    ncm = "87082999"
    unit = "PC"


class PartApplicationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PartApplication

    part_ref = factory.SubFactory(PartReferenceFactory)
    make = factory.LazyFunction(lambda: _get_or_create_make())
    source = "manual"
    confidence_score = 100


class PartSupplierRefFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PartSupplierRef

    part_ref = factory.SubFactory(PartReferenceFactory)
    supplier_name = factory.Sequence(lambda n: f"Fornecedor {n}")


def _get_or_create_make():
    from apps.vehicle_catalog.models import VehicleMake

    make, _ = VehicleMake.objects.get_or_create(
        fipe_id="59",
        defaults={"nome": "CHEVROLET", "nome_normalizado": "chevrolet"},
    )
    return make
```

- [ ] **Step 2: Create model tests**

Write `backend/core/apps/parts_catalog/tests/test_models.py`:

```python
import pytest
from django.db import IntegrityError

from apps.parts_catalog.tests.factories import (
    PartApplicationFactory,
    PartCategoryFactory,
    PartReferenceFactory,
    PartSupplierRefFactory,
)

pytestmark = pytest.mark.django_db(databases=["default"])


class TestPartCategory:
    def test_create(self):
        cat = PartCategoryFactory(code="CARROCERIA", name="Carroceria")
        assert cat.code == "CARROCERIA"
        assert str(cat) == "Carroceria"

    def test_unique_code(self):
        PartCategoryFactory(code="ILUMINACAO")
        with pytest.raises(IntegrityError):
            PartCategoryFactory.create(code="ILUMINACAO")


class TestPartReference:
    def test_create(self):
        ref = PartReferenceFactory(
            manufacturer_code="52058207",
            description="PARA-CHOQUE DIANTEIRO",
        )
        assert ref.manufacturer_code == "52058207"
        assert "52058207" in str(ref)

    def test_unique_manufacturer_code(self):
        PartReferenceFactory(manufacturer_code="ABC123")
        with pytest.raises(IntegrityError):
            PartReferenceFactory.create(manufacturer_code="ABC123")


class TestPartApplication:
    def test_create(self):
        app = PartApplicationFactory(
            year_start=2020,
            year_end=2024,
            source="seed",
            confidence_score=50,
        )
        assert app.source == "seed"
        assert app.confidence_score == 50
        assert "2020" in str(app)

    def test_unique_constraint(self):
        app = PartApplicationFactory(source="seed")
        with pytest.raises(IntegrityError):
            PartApplicationFactory.create(
                part_ref=app.part_ref,
                make=app.make,
                model=app.model,
                source="seed",
            )


class TestPartSupplierRef:
    def test_create(self):
        supplier = PartSupplierRefFactory(supplier_name="PMZ DISTRIBUIDORA")
        assert "PMZ" in str(supplier)

    def test_unique_constraint(self):
        s = PartSupplierRefFactory(supplier_name="FORTBRAS")
        with pytest.raises(IntegrityError):
            PartSupplierRefFactory.create(
                part_ref=s.part_ref,
                supplier_name="FORTBRAS",
            )
```

- [ ] **Step 3: Create view tests**

Write `backend/core/apps/parts_catalog/tests/test_views.py`:

```python
import pytest
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.parts_catalog.tests.factories import (
    PartCategoryFactory,
    PartReferenceFactory,
    PartSupplierRefFactory,
)

pytestmark = pytest.mark.django_db(databases=["default"])

# Dev JWT helper — same pattern used across the project
AUTH_HEADER = {"HTTP_AUTHORIZATION": "Bearer test-token"}


@pytest.fixture
def api_client(settings):
    """Client autenticado com dev-credentials."""
    settings.DEV_AUTH_ENABLED = True
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer dev-admin-token")
    return client


@override_settings(DEV_AUTH_ENABLED=True)
class TestPartCategoryEndpoint:
    def test_list_categories(self, api_client):
        PartCategoryFactory(code="CARROCERIA", name="Carroceria")
        PartCategoryFactory(code="VIDROS", name="Vidros")

        resp = api_client.get("/api/v1/parts-catalog/categories/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) >= 2


@override_settings(DEV_AUTH_ENABLED=True)
class TestPartReferenceEndpoint:
    def test_list_references(self, api_client):
        cat = PartCategoryFactory(code="CARROCERIA")
        PartReferenceFactory(
            manufacturer_code="52058207",
            description="PARA-CHOQUE DIANTEIRO",
            category=cat,
        )

        resp = api_client.get("/api/v1/parts-catalog/references/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["results"][0]["manufacturer_code"] == "52058207"

    def test_search_by_code(self, api_client):
        cat = PartCategoryFactory(code="ILUMINACAO")
        PartReferenceFactory(
            manufacturer_code="921011S000",
            description="FAROL DIANTEIRO",
            category=cat,
        )

        resp = api_client.get("/api/v1/parts-catalog/references/?search=921011S000")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["results"]) == 1

    def test_retrieve_with_applications(self, api_client):
        ref = PartReferenceFactory(manufacturer_code="TEST001")
        PartSupplierRefFactory(part_ref=ref, supplier_name="PMZ")

        resp = api_client.get(f"/api/v1/parts-catalog/references/{ref.id}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["manufacturer_code"] == "TEST001"
        assert len(resp.data["suppliers"]) == 1

    def test_filter_by_category(self, api_client):
        cat1 = PartCategoryFactory(code="CARROCERIA")
        cat2 = PartCategoryFactory(code="VIDROS")
        PartReferenceFactory(category=cat1)
        PartReferenceFactory(category=cat2)

        resp = api_client.get(
            f"/api/v1/parts-catalog/references/?category={cat1.pk}"
        )
        assert resp.status_code == status.HTTP_200_OK
        assert all(r["category"] == cat1.pk for r in resp.data["results"])
```

- [ ] **Step 4: Run tests**

```bash
cd backend/core && python -m pytest apps/parts_catalog/tests/ -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/parts_catalog/tests/
git commit -m "test(parts_catalog): model + view tests with factories

Covers uniqueness constraints, CRUD endpoints, search, filtering."
```

---

### Task 5: Auto-learning signal (OS delivered → PartApplication)

**Files:**
- Modify: `backend/core/apps/parts_catalog/signals.py`

- [ ] **Step 1: Implement the signal**

Write `backend/core/apps/parts_catalog/signals.py`:

```python
"""
Paddock Solutions — Parts Catalog — Auto-Learning Signal

When a ServiceOrder transitions to 'delivered', iterate its parts and
register PartApplication entries linking manufacturer_code → vehicle.

This runs in the TENANT schema context. PartApplication lives in the
PUBLIC schema — django-tenants handles cross-schema FK transparently.
"""

import logging

from django.db import connection
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="service_orders.ServiceOrder")
def register_part_applications(sender, instance, **kwargs):
    """
    Auto-learn: when OS is delivered, register which parts were used
    on which vehicle into the shared parts_catalog.
    """
    if instance.status != "delivered":
        return

    # Only process if vehicle info is available
    vehicle_make_name = getattr(instance, "vehicle_make", None)
    vehicle_model_name = getattr(instance, "vehicle_model", None)
    vehicle_year = getattr(instance, "vehicle_year", None)

    if not vehicle_make_name:
        return

    # Lazy imports — avoid circular imports and only load when needed
    from apps.parts_catalog.models import PartApplication, PartReference
    from apps.vehicle_catalog.models import VehicleMake, VehicleModel

    # Resolve VehicleMake
    make = VehicleMake.objects.filter(nome__iexact=vehicle_make_name).first()
    if not make:
        make = VehicleMake.objects.filter(
            nome_normalizado__iexact=vehicle_make_name.lower()
        ).first()
    if not make:
        logger.debug(
            "parts_catalog: marca '%s' não encontrada no vehicle_catalog",
            vehicle_make_name,
        )
        return

    # Resolve VehicleModel (optional)
    model_obj = None
    if vehicle_model_name:
        model_obj = VehicleModel.objects.filter(
            marca=make,
            nome__iexact=vehicle_model_name,
        ).first()
        if not model_obj:
            model_obj = VehicleModel.objects.filter(
                marca=make,
                nome_normalizado__iexact=vehicle_model_name.lower(),
            ).first()

    # Process each part with a manufacturer code
    parts = instance.parts.filter(part_number__gt="").exclude(part_number__isnull=True)
    registered = 0

    for part in parts:
        code = part.part_number.strip()
        if len(code) < 2:
            continue

        ref = PartReference.objects.filter(manufacturer_code=code).first()
        if not ref:
            continue

        _, created = PartApplication.objects.get_or_create(
            part_ref=ref,
            make=make,
            model=model_obj,
            source=PartApplication.Source.OS_AUTO,
            defaults={
                "year_start": vehicle_year,
                "year_end": vehicle_year,
                "confidence_score": 90,
            },
        )
        if created:
            registered += 1

    if registered:
        logger.info(
            "parts_catalog: OS %s delivered — %d aplicações registradas "
            "(%s %s %s)",
            instance.pk,
            registered,
            vehicle_make_name,
            vehicle_model_name or "",
            vehicle_year or "",
        )
```

- [ ] **Step 2: Commit**

```bash
git add backend/core/apps/parts_catalog/signals.py
git commit -m "feat(parts_catalog): auto-learning signal on OS delivered

When a ServiceOrder reaches 'delivered', registers PartApplication
entries linking each part's manufacturer_code to the OS vehicle."
```

---

### Task 6: Add part_ref FK to ProdutoComercialPeca

**Files:**
- Modify: `backend/core/apps/inventory/models_product.py`

- [ ] **Step 1: Add the FK field**

In `backend/core/apps/inventory/models_product.py`, in the `ProdutoComercialPeca` class, after the `peca_canonica` field, add:

```python
    # Vínculo com catálogo compartilhado (cross-tenant)
    part_ref = models.ForeignKey(
        "parts_catalog.PartReference",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos_comerciais",
        help_text="Referência no catálogo shared de peças (cross-tenant).",
    )
```

- [ ] **Step 2: Generate and run migration**

```bash
cd backend/core && python manage.py makemigrations inventory
python manage.py migrate_schemas
```

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/inventory/models_product.py backend/core/apps/inventory/migrations/
git commit -m "feat(inventory): add part_ref FK to ProdutoComercialPeca

Links tenant-specific commercial products to the shared
parts_catalog.PartReference for cross-tenant catalog data."
```

---

### Task 7: Run seed and verify

- [ ] **Step 1: Run the seed command**

```bash
cd backend/core && python manage.py seed_parts_catalog
```

Expected output similar to:
```
Criando categorias...
  + CARROCERIA: Carroceria
  + ILUMINACAO: Iluminação
  ...
Lendo .../catalogo_pecas_limpo.xlsx...
  23859 registros
  19730 com código fabricante válido
Inserindo referências...
Seed completo: ~19730 referências criadas, 0 já existiam, ~N aplicações veiculares, ~M fornecedores
```

- [ ] **Step 2: Verify via API**

```bash
# Categories
curl -s http://localhost:8000/api/v1/parts-catalog/categories/ -H "Authorization: Bearer dev" | python -m json.tool | head -20

# Search a part
curl -s "http://localhost:8000/api/v1/parts-catalog/references/?search=FAROL" -H "Authorization: Bearer dev" | python -m json.tool | head -30

# Part detail with applications
curl -s "http://localhost:8000/api/v1/parts-catalog/references/<uuid>/" -H "Authorization: Bearer dev" | python -m json.tool
```

- [ ] **Step 3: Verify via Django admin**

Open `http://localhost:8000/admin/parts_catalog/` and check:
- 13 categories
- ~19k+ part references
- Part applications (for those with vehicle data)
- Supplier references

- [ ] **Step 4: Commit (if any fixes needed)**

```bash
git add -A && git commit -m "fix(parts_catalog): seed adjustments after verification"
```
