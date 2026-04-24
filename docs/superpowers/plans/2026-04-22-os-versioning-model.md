# OS Versioning Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the immutable OS version/snapshot model (ServiceOrderVersion, ServiceOrderVersionItem, ItemFieldsMixin, ItemOperation, ServiceOrderEvent) + OSEventLogger + updated ServiceOrderService — the backend foundation of the orçamentação module.

**Architecture:** New `apps/items/` app (TENANT_APPS) holds the abstract mixin and reference tables (ItemOperationType, LaborCategory, ItemOperation). `apps/service_orders/` gains the versioning models (ServiceOrderVersion, ServiceOrderVersionItem) and event log (ServiceOrderEvent, ServiceOrderParecer, ImpactAreaLabel), plus `events.py` (OSEventLogger) and new service methods. Existing models and views are NOT removed — new code is additive.

**Tech Stack:** Django 5, DRF, django-tenants, pytest-django (TenantTestCase), factory-boy

**Branch:** `feat/port-worktree-shamir`

---

## File Map

**Create:**
- `backend/core/apps/items/__init__.py`
- `backend/core/apps/items/apps.py`
- `backend/core/apps/items/models.py` — `ItemOperationType`, `LaborCategory`, `ItemOperation`
- `backend/core/apps/items/mixins.py` — `ItemFieldsMixin` (abstract)
- `backend/core/apps/items/migrations/0001_initial.py`
- `backend/core/apps/items/migrations/0002_seed_reference_tables.py` — data migration
- `backend/core/apps/items/tests/__init__.py`
- `backend/core/apps/items/tests/test_item_operation.py`
- `backend/core/apps/service_orders/events.py` — `OSEventLogger`
- `backend/core/apps/service_orders/migrations/0021_versioning_and_events.py`
- `backend/core/apps/service_orders/tests/test_versioning.py`

**Modify:**
- `backend/core/apps/service_orders/models.py` — add `previous_status` to `ServiceOrder`; add `ServiceOrderVersion`, `ServiceOrderVersionItem`, `ServiceOrderEvent`, `ServiceOrderParecer`, `ImpactAreaLabel`
- `backend/core/apps/service_orders/services.py` — add `change_status()`, `create_new_version_from_import()`, `approve_version()`, `_recalculate_version_totals()` to `ServiceOrderService`
- `backend/core/config/settings/base.py` — add `apps.items` to `TENANT_APPS`

---

### Task 1: Create `apps/items/` app — mixin + reference tables

**Files:**
- Create: `backend/core/apps/items/__init__.py`
- Create: `backend/core/apps/items/apps.py`
- Create: `backend/core/apps/items/mixins.py`
- Create: `backend/core/apps/items/models.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/core/apps/items/tests/__init__.py  (empty)

# backend/core/apps/items/tests/test_item_operation.py
import pytest
from django.test import TestCase


class ItemOperationTypeTest(TestCase):
    def test_seed_types_created(self):
        from apps.items.models import ItemOperationType
        self.assertGreaterEqual(ItemOperationType.objects.count(), 7)

    def test_seed_labor_categories_created(self):
        from apps.items.models import LaborCategory
        self.assertGreaterEqual(LaborCategory.objects.count(), 9)

    def test_operation_type_unique_code(self):
        from apps.items.models import ItemOperationType
        from django.db import IntegrityError
        ItemOperationType.objects.create(code="TEST_DUP", label="Test")
        with self.assertRaises(IntegrityError):
            ItemOperationType.objects.create(code="TEST_DUP", label="Another")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.items.tests.test_item_operation -v 2
```

Expected: `ModuleNotFoundError: No module named 'apps.items'`

- [ ] **Step 3: Create the app files**

```python
# backend/core/apps/items/__init__.py
# (empty)

# backend/core/apps/items/apps.py
from django.apps import AppConfig


class ItemsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.items"
    verbose_name = "Items"
```

```python
# backend/core/apps/items/mixins.py
"""
ItemFieldsMixin — abstract mixin compartilhado entre ServiceOrderVersionItem e
BudgetVersionItem (quando app budgets for implementado).
"""
from __future__ import annotations

from decimal import Decimal

from django.db import models


class ItemFieldsMixin(models.Model):
    """Schema comum de item para versões de OS e Orçamento particular."""

    BUCKET_CHOICES = [
        ("IMPACTO", "Impacto"),
        ("SEM_COBERTURA", "Sem Cobertura"),
        ("SOB_ANALISE", "Sob Análise"),
    ]

    PAYER_BLOCK_CHOICES = [
        ("SEGURADORA", "Coberto pela Seguradora"),
        ("COMPLEMENTO_PARTICULAR", "Complemento Particular"),
        ("FRANQUIA", "Franquia"),
        ("PARTICULAR", "Particular"),
    ]

    ITEM_TYPE_CHOICES = [
        ("PART", "Peça"),
        ("SERVICE", "Serviço interno"),
        ("EXTERNAL_SERVICE", "Serviço terceirizado"),
        ("FEE", "Taxa"),
        ("DISCOUNT", "Desconto"),
    ]

    PART_TYPE_CHOICES = [
        ("GENUINA", "Genuína"),
        ("ORIGINAL", "Original"),
        ("OUTRAS_FONTES", "Outras Fontes"),
        ("VERDE", "Verde (reuso)"),
    ]

    SUPPLIER_CHOICES = [
        ("OFICINA", "Oficina"),
        ("SEGURADORA", "Seguradora"),
    ]

    # Classificação
    bucket = models.CharField(
        max_length=20, choices=BUCKET_CHOICES, default="IMPACTO", db_index=True,
    )
    payer_block = models.CharField(
        max_length=30, choices=PAYER_BLOCK_CHOICES, default="PARTICULAR", db_index=True,
    )
    impact_area = models.IntegerField(null=True, blank=True, db_index=True)
    item_type = models.CharField(
        max_length=20, choices=ITEM_TYPE_CHOICES, default="PART",
    )

    # Descrição + códigos
    description = models.CharField(max_length=300)
    external_code = models.CharField(max_length=60, blank=True, default="")

    # Tipo de peça
    part_type = models.CharField(
        max_length=20, choices=PART_TYPE_CHOICES, blank=True, default="",
    )
    supplier = models.CharField(
        max_length=12, choices=SUPPLIER_CHOICES, default="OFICINA",
    )

    # Financeiro
    quantity = models.DecimalField(
        max_digits=10, decimal_places=3, default=Decimal("1"),
    )
    unit_price = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
    )
    unit_cost = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
    )
    discount_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0"),
    )
    net_price = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
    )

    # Flags (espelhadas do PDF Cilia)
    flag_abaixo_padrao = models.BooleanField(default=False)
    flag_acima_padrao = models.BooleanField(default=False)
    flag_inclusao_manual = models.BooleanField(default=False)
    flag_codigo_diferente = models.BooleanField(default=False)
    flag_servico_manual = models.BooleanField(default=False)
    flag_peca_da_conta = models.BooleanField(default=False)

    sort_order = models.IntegerField(default=0)

    class Meta:
        abstract = True
```

```python
# backend/core/apps/items/models.py
"""
Tabelas de referência de itens: operações e categorias de MO.
ItemOperation: operação concreta sobre um item de versão de OS.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import models


class ItemOperationType(models.Model):
    """TROCA / RECUPERACAO / OVERLAP / PINTURA / R_I / MONTAGEM_DESMONTAGEM / DNC."""

    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]

    def __str__(self) -> str:
        return f"{self.code} — {self.label}"


class LaborCategory(models.Model):
    """FUNILARIA / PINTURA / MECANICA / ELETRICA / TAPECARIA / ACABAMENTO / VIDRACARIA / REPARACAO / SERVICOS."""

    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]

    def __str__(self) -> str:
        return f"{self.code} — {self.label}"


class ItemOperation(models.Model):
    """
    Operação aplicada a um item de versão de OS.
    Um item pode ter múltiplas (TROCA + PINTURA + OVERLAP na mesma peça).
    """

    item_so = models.ForeignKey(
        "service_orders.ServiceOrderVersionItem",
        on_delete=models.CASCADE,
        related_name="operations",
    )

    operation_type = models.ForeignKey(
        ItemOperationType, on_delete=models.PROTECT,
    )
    labor_category = models.ForeignKey(
        LaborCategory, on_delete=models.PROTECT,
    )

    hours = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("0"),
    )
    hourly_rate = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0"),
    )
    labor_cost = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"),
        help_text="hours * hourly_rate — calculado pelo Service",
    )

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.operation_type.code} · {self.labor_category.code} · {self.hours}h"
```

- [ ] **Step 4: Add `apps.items` to `TENANT_APPS`**

In `backend/core/config/settings/base.py`, after `"apps.pdf_engine"`:

```python
    "apps.items",
```

- [ ] **Step 5: Create migration 0001_initial**

```python
# backend/core/apps/items/migrations/__init__.py
# (empty)

# backend/core/apps/items/migrations/0001_initial.py
from __future__ import annotations

from decimal import Decimal

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("service_orders", "0020_capacity_models"),
    ]

    operations = [
        migrations.CreateModel(
            name="ItemOperationType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(db_index=True, max_length=40, unique=True)),
                ("label", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.IntegerField(default=0)),
            ],
            options={"ordering": ["sort_order", "code"]},
        ),
        migrations.CreateModel(
            name="LaborCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(db_index=True, max_length=40, unique=True)),
                ("label", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.IntegerField(default=0)),
            ],
            options={"ordering": ["sort_order", "code"]},
        ),
        migrations.CreateModel(
            name="ItemOperation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("hours", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=6)),
                ("hourly_rate", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=10)),
                ("labor_cost", models.DecimalField(decimal_places=2, default=Decimal("0"), help_text="hours * hourly_rate — calculado pelo Service", max_digits=14)),
                ("item_so", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="operations", to="service_orders.serviceorderversionitem")),
                ("operation_type", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="items.itemoperationtype")),
                ("labor_category", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="items.laborcategory")),
            ],
            options={"ordering": ["id"]},
        ),
    ]
```

- [ ] **Step 6: Create data migration for seed data**

```python
# backend/core/apps/items/migrations/0002_seed_reference_tables.py
from __future__ import annotations

from django.db import migrations


OPERATION_TYPES = [
    ("TROCA",                "Troca de peça",           0),
    ("RECUPERACAO",          "Recuperação",             1),
    ("OVERLAP",              "Overlap (sobreposição)",  2),
    ("PINTURA",              "Pintura",                 3),
    ("R_I",                  "Remoção e Instalação",   4),
    ("MONTAGEM_DESMONTAGEM", "Montagem/Desmontagem",   5),
    ("DNC",                  "DNC (Não Cobre)",         6),
]

LABOR_CATEGORIES = [
    ("FUNILARIA",   "Funilaria",            0),
    ("PINTURA",     "Pintura",              1),
    ("MECANICA",    "Mecânica",             2),
    ("ELETRICA",    "Elétrica",             3),
    ("TAPECARIA",   "Tapeçaria",            4),
    ("ACABAMENTO",  "Acabamento",           5),
    ("VIDRACARIA",  "Vidraçaria",           6),
    ("REPARACAO",   "Reparação",            7),
    ("SERVICOS",    "Serviços Gerais",      8),
]


def seed_forward(apps, schema_editor):
    ItemOperationType = apps.get_model("items", "ItemOperationType")
    LaborCategory = apps.get_model("items", "LaborCategory")
    db = schema_editor.connection.alias

    for code, label, order in OPERATION_TYPES:
        ItemOperationType.objects.using(db).get_or_create(
            code=code,
            defaults={"label": label, "sort_order": order},
        )

    for code, label, order in LABOR_CATEGORIES:
        LaborCategory.objects.using(db).get_or_create(
            code=code,
            defaults={"label": label, "sort_order": order},
        )


def seed_backward(apps, schema_editor):
    pass  # Não remove seeds no rollback


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_backward),
    ]
```

- [ ] **Step 7: Run migrations and tests**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py migrate_schemas --executor=multiprocessing 2>&1 | tail -20

docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.items.tests -v 2
```

Expected: `Ran 3 tests in X.Xs — OK`

- [ ] **Step 8: Commit**

```bash
git add backend/core/apps/items/ backend/core/config/settings/base.py
git commit -m "feat(items): new app com ItemOperationType, LaborCategory, ItemOperation e ItemFieldsMixin"
```

---

### Task 2: Add versioning models to `apps/service_orders/`

**Files:**
- Modify: `backend/core/apps/service_orders/models.py`
- Create: `backend/core/apps/service_orders/migrations/0021_versioning_and_events.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/core/apps/service_orders/tests/test_versioning.py
from decimal import Decimal
from django.test import TestCase
from django_tenants.test.cases import TenantTestCase


class ServiceOrderVersionTest(TenantTestCase):
    """Testa criação e unicidade de ServiceOrderVersion."""

    def _make_order(self):
        from apps.service_orders.models import ServiceOrder
        return ServiceOrder.objects.create(
            number=9999,
            customer_name="Cliente Versioning Test",
            plate="TST1234",
        )

    def test_version_created_with_correct_number(self):
        from apps.service_orders.models import ServiceOrderVersion
        os = self._make_order()
        v = ServiceOrderVersion.objects.create(
            service_order=os,
            version_number=1,
            source="manual",
        )
        self.assertEqual(v.version_number, 1)
        self.assertEqual(v.status, "pending")

    def test_version_unique_together(self):
        from apps.service_orders.models import ServiceOrderVersion
        from django.db import IntegrityError
        os = self._make_order()
        ServiceOrderVersion.objects.create(service_order=os, version_number=1, source="manual")
        with self.assertRaises(IntegrityError):
            ServiceOrderVersion.objects.create(service_order=os, version_number=1, source="manual")

    def test_version_item_inherits_fields_mixin(self):
        from apps.service_orders.models import ServiceOrderVersion, ServiceOrderVersionItem
        os = self._make_order()
        v = ServiceOrderVersion.objects.create(service_order=os, version_number=1, source="manual")
        item = ServiceOrderVersionItem.objects.create(
            version=v,
            description="Parachoque dianteiro",
            unit_price=Decimal("1200.00"),
            quantity=Decimal("1"),
            net_price=Decimal("1200.00"),
            payer_block="SEGURADORA",
        )
        self.assertEqual(item.payer_block, "SEGURADORA")
        self.assertEqual(item.bucket, "IMPACTO")

    def test_service_order_event_created(self):
        from apps.service_orders.models import ServiceOrderEvent
        os = self._make_order()
        ev = ServiceOrderEvent.objects.create(
            service_order=os,
            event_type="STATUS_CHANGE",
            actor="Thiago",
            from_state="reception",
            to_state="initial_survey",
        )
        self.assertEqual(ev.event_type, "STATUS_CHANGE")

    def test_previous_status_field_exists(self):
        from apps.service_orders.models import ServiceOrder
        os = self._make_order()
        os.previous_status = "repair"
        os.save(update_fields=["previous_status"])
        os.refresh_from_db()
        self.assertEqual(os.previous_status, "repair")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests.test_versioning -v 2
```

Expected: `FAIL` with `FieldError` or `RelatedObjectDoesNotExist` since `ServiceOrderVersion` doesn't exist yet.

- [ ] **Step 3: Add `previous_status` to `ServiceOrder` and the new models**

At the end of the `ServiceOrder` class body (before `class Meta`), insert:

```python
    # ── Versionamento ─────────────────────────────────────────────────────────
    previous_status = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Status antes de entrar em 'budget' (auto-Kanban). Restaurado ao aprovar versão.",
        verbose_name="Status anterior",
    )
```

After the existing `ServiceOrderActivityLog` class (at the end of the file), append:

```python
# ── Versionamento de OS ─────────────────────────────────────────────────────

class ServiceOrderVersion(models.Model):
    """
    Snapshot imutável de uma versão da OS.
    v1 inicial, v2+ criadas por novas importações ou complementos.
    Seguradora: espelha external_version "821980.1", "821980.2".
    """

    STATUS_CHOICES = [
        ("pending",    "Pendente"),
        ("approved",   "Aprovada"),
        ("rejected",   "Rejeitada"),
        ("analisado",  "Analisado"),
        ("autorizado", "Autorizado"),
        ("correcao",   "Em Correção"),
        ("em_analise", "Em Análise"),
        ("negado",     "Negado"),
        ("superseded", "Superada"),
    ]

    SOURCE_CHOICES = [
        ("manual",           "Manual"),
        ("budget_approval",  "Da aprovação de Orçamento"),
        ("cilia",            "Cilia API"),
        ("hdi",              "HDI HTML"),
        ("xml_porto",        "XML Porto"),
        ("xml_azul",         "XML Azul"),
        ("xml_itau",         "XML Itaú"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="versions",
    )
    version_number = models.IntegerField(verbose_name="Versão")

    external_version = models.CharField(
        max_length=40, blank=True, default="",
        help_text='Ex: "821980.1" — número externo da seguradora',
    )
    external_numero_vistoria = models.CharField(
        max_length=60, blank=True, default="",
        help_text="XML IFX: 531|2026|226472|0|12290418",
    )
    external_integration_id = models.CharField(
        max_length=40, blank=True, default="",
        help_text="Cilia integration ID ex: 11284203",
    )

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, db_index=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True,
    )

    # Totais cache (recalculados pelo Service)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    net_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    labor_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    parts_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    # Por bloco financeiro
    total_seguradora = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_complemento_particular = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_franquia = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    content_hash = models.CharField(
        max_length=64, blank=True, default="",
        help_text="SHA256 dos itens — dedup de imports repetidos",
    )
    raw_payload_s3_key = models.CharField(
        max_length=500, blank=True, default="",
        help_text="S3 key do payload bruto (se veio de import)",
    )
    import_attempt = models.ForeignKey(
        "cilia.ImportAttempt", on_delete=models.SET_NULL, null=True, blank=True,
    )

    # Tabela de MO vigente no momento da versão
    hourly_rates = models.JSONField(
        default=dict, blank=True,
        help_text='Ex: {"FUNILARIA": 40.00, "PINTURA": 50.00}',
    )
    global_discount_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0"),
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.CharField(max_length=120, blank=True, default="")
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("service_order", "version_number")]
        ordering = ["-version_number"]
        indexes = [
            models.Index(fields=["service_order", "status"], name="sov_os_status_idx"),
        ]
        verbose_name = "Versão de OS"
        verbose_name_plural = "Versões de OS"

    def __str__(self) -> str:
        if self.external_version:
            return f"{self.external_version} — {self.get_status_display()}"
        return f"v{self.version_number} — {self.get_status_display()}"

    @property
    def is_active_version(self) -> bool:
        return self.service_order.versions.order_by("-version_number").first().pk == self.pk


class ServiceOrderVersionItem(ItemFieldsMixin):
    """
    Item de uma versão de OS. Imutável após versão aprovada/autorizada.
    Herda todos os campos de ItemFieldsMixin (bucket, payer_block, flags, etc.).
    """

    version = models.ForeignKey(
        ServiceOrderVersion, on_delete=models.CASCADE, related_name="items",
    )

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Item de Versão de OS"
        verbose_name_plural = "Itens de Versão de OS"


# ── Timeline universal de mutações ──────────────────────────────────────────

class ServiceOrderEvent(models.Model):
    """
    Timeline universal de mutações em uma OS.
    Parallel ao ServiceOrderActivityLog (não substitui ainda — transição gradual).
    Toda mutação via Service deve chamar OSEventLogger.log_event().
    """

    EVENT_TYPES = [
        ("STATUS_CHANGE",      "Mudança de status"),
        ("AUTO_TRANSITION",    "Transição automática"),
        ("VERSION_CREATED",    "Nova versão criada"),
        ("VERSION_APPROVED",   "Versão aprovada"),
        ("VERSION_REJECTED",   "Versão rejeitada"),
        ("ITEM_ADDED",         "Item adicionado"),
        ("ITEM_REMOVED",       "Item removido"),
        ("ITEM_EDITED",        "Item editado"),
        ("IMPORT_RECEIVED",    "Importação recebida"),
        ("PARECER_ADDED",      "Parecer adicionado"),
        ("PHOTO_UPLOADED",     "Foto anexada"),
        ("PHOTO_REMOVED",      "Foto removida (soft)"),
        ("PAYMENT_RECORDED",   "Pagamento registrado"),
        ("FISCAL_ISSUED",      "Nota fiscal emitida"),
        ("SIGNATURE_CAPTURED", "Assinatura capturada"),
        ("BUDGET_LINKED",      "Orçamento aprovado virou OS"),
        ("COMPLEMENT_ADDED",   "Complemento particular adicionado"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="events",
    )
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES, db_index=True)

    actor = models.CharField(max_length=120, blank=True, default="Sistema")
    payload = models.JSONField(default=dict, blank=True)

    from_state = models.CharField(max_length=30, blank=True, default="")
    to_state = models.CharField(max_length=30, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service_order", "-created_at"], name="soe_os_date_idx"),
            models.Index(fields=["event_type", "-created_at"], name="soe_type_date_idx"),
        ]
        verbose_name = "Evento de OS"
        verbose_name_plural = "Eventos de OS"

    def __str__(self) -> str:
        return f"{self.event_type} · {self.service_order_id} · {self.actor}"


class ServiceOrderParecer(models.Model):
    """
    Timeline de workflow entre oficina e seguradora.
    Pode ser importado (Cilia/XML) ou criado internamente.
    """

    PARECER_TYPE_CHOICES = [
        ("CONCORDADO",        "Concordado"),
        ("AUTORIZADO",        "Autorizado"),
        ("CORRECAO",          "Correção"),
        ("NEGADO",            "Negado"),
        ("SEM_COBERTURA",     "Sem Cobertura"),
        ("COMENTARIO_INTERNO", "Comentário Interno"),
    ]

    SOURCE_CHOICES = [
        ("internal",   "Interno DSCar"),
        ("cilia",      "Cilia"),
        ("hdi",        "HDI"),
        ("xml_porto",  "XML Porto"),
        ("xml_azul",   "XML Azul"),
        ("xml_itau",   "XML Itaú"),
    ]

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="pareceres",
    )
    version = models.ForeignKey(
        ServiceOrderVersion, on_delete=models.CASCADE,
        null=True, blank=True, related_name="pareceres",
    )

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    flow_number = models.IntegerField(null=True, blank=True)

    author_external = models.CharField(max_length=120, blank=True, default="")
    author_org = models.CharField(max_length=120, blank=True, default="")
    author_internal = models.CharField(max_length=120, blank=True, default="")

    parecer_type = models.CharField(
        max_length=30, choices=PARECER_TYPE_CHOICES, blank=True, default="",
    )
    body = models.TextField()

    created_at_external = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Parecer de OS"
        verbose_name_plural = "Pareceres de OS"

    def __str__(self) -> str:
        return f"Parecer {self.source} · {self.parecer_type or 'interno'} · OS {self.service_order_id}"


class ImpactAreaLabel(models.Model):
    """Label textual das áreas de impacto (1=Frontal, 2=Lateral direita, …)."""

    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE, related_name="area_labels",
    )
    area_number = models.IntegerField()
    label_text = models.CharField(max_length=100)

    class Meta:
        unique_together = [("service_order", "area_number")]
        verbose_name = "Label de Área de Impacto"
        verbose_name_plural = "Labels de Áreas de Impacto"

    def __str__(self) -> str:
        return f"Área {self.area_number}: {self.label_text}"
```

Also add to the top of `models.py`, after the existing imports:

```python
from decimal import Decimal

from apps.items.mixins import ItemFieldsMixin
```

- [ ] **Step 4: Create migration 0021**

```python
# backend/core/apps/service_orders/migrations/0021_versioning_and_events.py
from __future__ import annotations

from decimal import Decimal

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0020_capacity_models"),
        ("cilia", "0002_import_attempt"),
        ("items", "0001_initial"),
    ]

    operations = [
        # 1. previous_status em ServiceOrder
        migrations.AddField(
            model_name="serviceorder",
            name="previous_status",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Status antes de entrar em 'budget' (auto-Kanban). Restaurado ao aprovar versão.",
                max_length=20,
                verbose_name="Status anterior",
            ),
        ),

        # 2. ServiceOrderVersion
        migrations.CreateModel(
            name="ServiceOrderVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version_number", models.IntegerField(verbose_name="Versão")),
                ("external_version", models.CharField(blank=True, default="", max_length=40)),
                ("external_numero_vistoria", models.CharField(blank=True, default="", max_length=60)),
                ("external_integration_id", models.CharField(blank=True, default="", max_length=40)),
                ("source", models.CharField(choices=[("manual", "Manual"), ("budget_approval", "Da aprovação de Orçamento"), ("cilia", "Cilia API"), ("hdi", "HDI HTML"), ("xml_porto", "XML Porto"), ("xml_azul", "XML Azul"), ("xml_itau", "XML Itaú")], db_index=True, max_length=20)),
                ("status", models.CharField(choices=[("pending", "Pendente"), ("approved", "Aprovada"), ("rejected", "Rejeitada"), ("analisado", "Analisado"), ("autorizado", "Autorizado"), ("correcao", "Em Correção"), ("em_analise", "Em Análise"), ("negado", "Negado"), ("superseded", "Superada")], db_index=True, default="pending", max_length=20)),
                ("subtotal", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("discount_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("net_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("labor_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("parts_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("total_seguradora", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("total_complemento_particular", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("total_franquia", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("content_hash", models.CharField(blank=True, default="", max_length=64)),
                ("raw_payload_s3_key", models.CharField(blank=True, default="", max_length=500)),
                ("hourly_rates", models.JSONField(blank=True, default=dict)),
                ("global_discount_pct", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=5)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("created_by", models.CharField(blank=True, default="", max_length=120)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("service_order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="versions", to="service_orders.serviceorder")),
                ("import_attempt", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="cilia.importattempt")),
            ],
            options={"verbose_name": "Versão de OS", "verbose_name_plural": "Versões de OS", "ordering": ["-version_number"]},
        ),
        migrations.AddConstraint(
            model_name="serviceorderversion",
            constraint=models.UniqueConstraint(
                fields=["service_order", "version_number"],
                name="sov_unique_version",
            ),
        ),
        migrations.AddIndex(
            model_name="serviceorderversion",
            index=models.Index(fields=["service_order", "status"], name="sov_os_status_idx"),
        ),

        # 3. ServiceOrderVersionItem
        migrations.CreateModel(
            name="ServiceOrderVersionItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("bucket", models.CharField(choices=[("IMPACTO", "Impacto"), ("SEM_COBERTURA", "Sem Cobertura"), ("SOB_ANALISE", "Sob Análise")], db_index=True, default="IMPACTO", max_length=20)),
                ("payer_block", models.CharField(choices=[("SEGURADORA", "Coberto pela Seguradora"), ("COMPLEMENTO_PARTICULAR", "Complemento Particular"), ("FRANQUIA", "Franquia"), ("PARTICULAR", "Particular")], db_index=True, default="PARTICULAR", max_length=30)),
                ("impact_area", models.IntegerField(blank=True, db_index=True, null=True)),
                ("item_type", models.CharField(choices=[("PART", "Peça"), ("SERVICE", "Serviço interno"), ("EXTERNAL_SERVICE", "Serviço terceirizado"), ("FEE", "Taxa"), ("DISCOUNT", "Desconto")], default="PART", max_length=20)),
                ("description", models.CharField(max_length=300)),
                ("external_code", models.CharField(blank=True, default="", max_length=60)),
                ("part_type", models.CharField(blank=True, choices=[("GENUINA", "Genuína"), ("ORIGINAL", "Original"), ("OUTRAS_FONTES", "Outras Fontes"), ("VERDE", "Verde (reuso)")], default="", max_length=20)),
                ("supplier", models.CharField(choices=[("OFICINA", "Oficina"), ("SEGURADORA", "Seguradora")], default="OFICINA", max_length=12)),
                ("quantity", models.DecimalField(decimal_places=3, default=Decimal("1"), max_digits=10)),
                ("unit_price", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("unit_cost", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("discount_pct", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=5)),
                ("net_price", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("flag_abaixo_padrao", models.BooleanField(default=False)),
                ("flag_acima_padrao", models.BooleanField(default=False)),
                ("flag_inclusao_manual", models.BooleanField(default=False)),
                ("flag_codigo_diferente", models.BooleanField(default=False)),
                ("flag_servico_manual", models.BooleanField(default=False)),
                ("flag_peca_da_conta", models.BooleanField(default=False)),
                ("sort_order", models.IntegerField(default=0)),
                ("version", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="service_orders.serviceorderversion")),
            ],
            options={"verbose_name": "Item de Versão de OS", "verbose_name_plural": "Itens de Versão de OS", "ordering": ["sort_order", "id"]},
        ),

        # 4. ServiceOrderEvent
        migrations.CreateModel(
            name="ServiceOrderEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(choices=[("STATUS_CHANGE", "Mudança de status"), ("AUTO_TRANSITION", "Transição automática"), ("VERSION_CREATED", "Nova versão criada"), ("VERSION_APPROVED", "Versão aprovada"), ("VERSION_REJECTED", "Versão rejeitada"), ("ITEM_ADDED", "Item adicionado"), ("ITEM_REMOVED", "Item removido"), ("ITEM_EDITED", "Item editado"), ("IMPORT_RECEIVED", "Importação recebida"), ("PARECER_ADDED", "Parecer adicionado"), ("PHOTO_UPLOADED", "Foto anexada"), ("PHOTO_REMOVED", "Foto removida (soft)"), ("PAYMENT_RECORDED", "Pagamento registrado"), ("FISCAL_ISSUED", "Nota fiscal emitida"), ("SIGNATURE_CAPTURED", "Assinatura capturada"), ("BUDGET_LINKED", "Orçamento aprovado virou OS"), ("COMPLEMENT_ADDED", "Complemento particular adicionado")], db_index=True, max_length=30)),
                ("actor", models.CharField(blank=True, default="Sistema", max_length=120)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("from_state", models.CharField(blank=True, default="", max_length=30)),
                ("to_state", models.CharField(blank=True, default="", max_length=30)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("service_order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="service_orders.serviceorder")),
            ],
            options={"verbose_name": "Evento de OS", "verbose_name_plural": "Eventos de OS", "ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="serviceorderevent",
            index=models.Index(fields=["service_order", "-created_at"], name="soe_os_date_idx"),
        ),
        migrations.AddIndex(
            model_name="serviceorderevent",
            index=models.Index(fields=["event_type", "-created_at"], name="soe_type_date_idx"),
        ),

        # 5. ServiceOrderParecer
        migrations.CreateModel(
            name="ServiceOrderParecer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source", models.CharField(choices=[("internal", "Interno DSCar"), ("cilia", "Cilia"), ("hdi", "HDI"), ("xml_porto", "XML Porto"), ("xml_azul", "XML Azul"), ("xml_itau", "XML Itaú")], max_length=20)),
                ("flow_number", models.IntegerField(blank=True, null=True)),
                ("author_external", models.CharField(blank=True, default="", max_length=120)),
                ("author_org", models.CharField(blank=True, default="", max_length=120)),
                ("author_internal", models.CharField(blank=True, default="", max_length=120)),
                ("parecer_type", models.CharField(blank=True, choices=[("CONCORDADO", "Concordado"), ("AUTORIZADO", "Autorizado"), ("CORRECAO", "Correção"), ("NEGADO", "Negado"), ("SEM_COBERTURA", "Sem Cobertura"), ("COMENTARIO_INTERNO", "Comentário Interno")], default="", max_length=30)),
                ("body", models.TextField()),
                ("created_at_external", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("service_order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pareceres", to="service_orders.serviceorder")),
                ("version", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="pareceres", to="service_orders.serviceorderversion")),
            ],
            options={"verbose_name": "Parecer de OS", "verbose_name_plural": "Pareceres de OS", "ordering": ["-created_at"]},
        ),

        # 6. ImpactAreaLabel
        migrations.CreateModel(
            name="ImpactAreaLabel",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("area_number", models.IntegerField()),
                ("label_text", models.CharField(max_length=100)),
                ("service_order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="area_labels", to="service_orders.serviceorder")),
            ],
            options={"unique_together": {("service_order", "area_number")}, "verbose_name": "Label de Área de Impacto", "verbose_name_plural": "Labels de Áreas de Impacto"},
        ),
    ]
```

- [ ] **Step 5: Run migration and tests**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py migrate_schemas --executor=multiprocessing 2>&1 | tail -20

docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests.test_versioning -v 2
```

Expected: `Ran 5 tests in X.Xs — OK`

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/service_orders/models.py \
        backend/core/apps/service_orders/migrations/0021_versioning_and_events.py
git commit -m "feat(service_orders): adiciona ServiceOrderVersion, ServiceOrderVersionItem, ServiceOrderEvent, ServiceOrderParecer, ImpactAreaLabel"
```

---

### Task 3: OSEventLogger (`events.py`)

**Files:**
- Create: `backend/core/apps/service_orders/events.py`

- [ ] **Step 1: Write the failing test**

Add to `test_versioning.py`:

```python
class OSEventLoggerTest(TenantTestCase):
    def _make_order(self):
        from apps.service_orders.models import ServiceOrder
        return ServiceOrder.objects.create(number=8888, customer_name="Logger Test", plate="LGG9999")

    def test_log_event_creates_record(self):
        from apps.service_orders.events import OSEventLogger
        from apps.service_orders.models import ServiceOrderEvent
        os = self._make_order()
        OSEventLogger.log_event(
            os, "STATUS_CHANGE",
            actor="Thiago",
            from_state="reception",
            to_state="initial_survey",
        )
        ev = ServiceOrderEvent.objects.get(service_order=os)
        self.assertEqual(ev.event_type, "STATUS_CHANGE")
        self.assertEqual(ev.actor, "Thiago")
        self.assertEqual(ev.from_state, "reception")
        self.assertEqual(ev.to_state, "initial_survey")

    def test_log_event_with_payload(self):
        from apps.service_orders.events import OSEventLogger
        from apps.service_orders.models import ServiceOrderEvent
        os = self._make_order()
        OSEventLogger.log_event(
            os, "IMPORT_RECEIVED",
            payload={"source": "cilia", "version": "821980.1"},
        )
        ev = ServiceOrderEvent.objects.get(service_order=os, event_type="IMPORT_RECEIVED")
        self.assertEqual(ev.payload["source"], "cilia")

    def test_log_event_does_not_raise_on_error(self):
        """Logger nunca interrompe o fluxo principal."""
        from apps.service_orders.events import OSEventLogger
        # Passa OS inválido (id=None) — deve logar sem explodir
        class FakeOS:
            pk = None
            id = None
        try:
            OSEventLogger.log_event(FakeOS(), "STATUS_CHANGE", swallow_errors=True)
        except Exception:
            self.fail("OSEventLogger não deve propagar exceções quando swallow_errors=True")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests.test_versioning.OSEventLoggerTest -v 2
```

Expected: `ModuleNotFoundError: No module named 'apps.service_orders.events'`

- [ ] **Step 3: Implement `events.py`**

```python
# backend/core/apps/service_orders/events.py
"""
OSEventLogger — helper cross-cutting para logar eventos na timeline da OS.
Chamado por ServiceOrderService e outros services. Nunca interrompe o fluxo principal.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class OSEventLogger:
    """Registra eventos imutáveis na timeline de uma OS (ServiceOrderEvent)."""

    @classmethod
    def log_event(
        cls,
        service_order: Any,
        event_type: str,
        *,
        actor: str = "Sistema",
        payload: dict[str, Any] | None = None,
        from_state: str = "",
        to_state: str = "",
        swallow_errors: bool = False,
    ) -> None:
        """
        Persiste um ServiceOrderEvent.

        Args:
            service_order: Instância de ServiceOrder (ou objeto com .pk).
            event_type: Um dos EVENT_TYPES definidos em ServiceOrderEvent.
            actor: Nome do usuário ou sistema que gerou o evento.
            payload: Dict com detalhes adicionais do evento.
            from_state: Estado anterior (status changes).
            to_state: Estado novo (status changes).
            swallow_errors: Se True, captura exceções sem propagar (uso em contextos críticos).
        """
        try:
            from apps.service_orders.models import ServiceOrderEvent

            ServiceOrderEvent.objects.create(
                service_order_id=service_order.pk,
                event_type=event_type,
                actor=actor,
                payload=payload or {},
                from_state=from_state,
                to_state=to_state,
            )
        except Exception as exc:
            logger.error(
                "OSEventLogger falhou ao registrar evento %s para OS %s: %s",
                event_type,
                getattr(service_order, "pk", "?"),
                exc,
            )
            if not swallow_errors:
                raise
```

- [ ] **Step 4: Run test to verify it passes**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests.test_versioning.OSEventLoggerTest -v 2
```

Expected: `Ran 3 tests in X.Xs — OK`

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/service_orders/events.py \
        backend/core/apps/service_orders/tests/test_versioning.py
git commit -m "feat(service_orders): adiciona OSEventLogger em events.py"
```

---

### Task 4: New service methods — `change_status`, `create_new_version_from_import`, `approve_version`

**Files:**
- Modify: `backend/core/apps/service_orders/services.py`

- [ ] **Step 1: Write the failing tests**

Add to `test_versioning.py`:

```python
class ServiceOrderServiceVersioningTest(TenantTestCase):

    def _make_order(self, status="repair"):
        from apps.service_orders.models import ServiceOrder
        return ServiceOrder.objects.create(
            number=7777, customer_name="Versioning Svc Test", plate="SVC0001",
            status=status,
        )

    def _make_parsed_budget(self, source="cilia", ext_version="821980.1"):
        from apps.cilia.dtos import ParsedBudget
        return ParsedBudget(
            source=source,
            external_version=ext_version,
            external_numero_vistoria="",
            external_integration_id="12345",
            external_status="analisado",
            raw_hash="abc123",
            global_discount_pct=0,
            hourly_rates={},
            items=[],
            pareceres=[],
        )

    def test_change_status_valid_transition(self):
        from apps.service_orders.services import ServiceOrderService
        from apps.service_orders.models import ServiceOrder
        os = self._make_order(status="reception")
        updated = ServiceOrderService.change_status(
            service_order=os, new_status="initial_survey", changed_by="Thiago",
        )
        self.assertEqual(updated.status, "initial_survey")

    def test_change_status_invalid_raises(self):
        from apps.service_orders.services import ServiceOrderService
        from rest_framework.exceptions import ValidationError
        os = self._make_order(status="reception")
        with self.assertRaises(ValidationError):
            ServiceOrderService.change_status(service_order=os, new_status="delivered")

    def test_change_status_to_budget_saves_previous(self):
        from apps.service_orders.services import ServiceOrderService
        os = self._make_order(status="repair")
        ServiceOrderService.change_status(service_order=os, new_status="budget")
        os.refresh_from_db()
        self.assertEqual(os.previous_status, "repair")

    def test_change_status_logs_event(self):
        from apps.service_orders.services import ServiceOrderService
        from apps.service_orders.models import ServiceOrderEvent
        os = self._make_order(status="reception")
        ServiceOrderService.change_status(service_order=os, new_status="initial_survey", changed_by="Thiago")
        ev = ServiceOrderEvent.objects.get(service_order=os, event_type="STATUS_CHANGE")
        self.assertEqual(ev.from_state, "reception")
        self.assertEqual(ev.to_state, "initial_survey")

    def test_approve_version_returns_to_previous_status(self):
        from apps.service_orders.services import ServiceOrderService
        from apps.service_orders.models import ServiceOrderVersion
        os = self._make_order(status="repair")
        # Simula: OS entrou em budget vinda de repair
        os.previous_status = "repair"
        os.status = "budget"
        os.save(update_fields=["status", "previous_status"])
        version = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia", status="analisado",
        )
        ServiceOrderService.approve_version(version=version, approved_by="Thiago")
        os.refresh_from_db()
        self.assertEqual(os.status, "repair")
        version.refresh_from_db()
        self.assertEqual(version.status, "autorizado")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests.test_versioning.ServiceOrderServiceVersioningTest -v 2
```

Expected: `AttributeError: type object 'ServiceOrderService' has no attribute 'change_status'`

- [ ] **Step 3: Add new methods to `ServiceOrderService`**

Add to `backend/core/apps/service_orders/services.py`, after the existing `transition()` method:

```python
    # ── Novos métodos de versionamento ────────────────────────────────────────

    @classmethod
    @transaction.atomic
    def change_status(
        cls,
        *,
        service_order: "ServiceOrder",
        new_status: str,
        changed_by: str = "Sistema",
        notes: str = "",
        is_auto: bool = False,
    ) -> "ServiceOrder":
        """
        Muda status com validação de transição (nova API — paralela ao transition()).
        Salva previous_status ao entrar em 'budget'.
        Loga ServiceOrderEvent.

        Raises:
            ValidationError: Transição inválida.
        """
        from apps.service_orders.models import ServiceOrder, VALID_TRANSITIONS
        from apps.service_orders.events import OSEventLogger

        current = service_order.status
        allowed = VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise ValidationError({
                "status": (
                    f"Transição inválida: {current} → {new_status}. "
                    f"Permitidas: {allowed}"
                )
            })

        if new_status == "budget":
            service_order.previous_status = current

        service_order.status = new_status
        service_order.save(update_fields=["status", "previous_status", "updated_at"])

        event_type = "AUTO_TRANSITION" if is_auto else "STATUS_CHANGE"
        OSEventLogger.log_event(
            service_order,
            event_type,
            actor=changed_by,
            from_state=current,
            to_state=new_status,
            payload={"notes": notes},
            swallow_errors=True,
        )
        return service_order

    @classmethod
    @transaction.atomic
    def create_new_version_from_import(
        cls,
        *,
        service_order: "ServiceOrder",
        parsed_budget: Any,
        import_attempt: Any,
    ) -> "ServiceOrderVersion":
        """
        Chamado pelos importadores (Cilia, XML) ao receber nova versão de orçamento.
        Cria ServiceOrderVersion + itens + pausa OS em 'budget'.

        Args:
            service_order: OS destino.
            parsed_budget: ParsedBudget (apps.cilia.dtos).
            import_attempt: ImportAttempt já salvo.
        """
        from apps.service_orders.models import ServiceOrderVersion
        from apps.service_orders.events import OSEventLogger

        active = service_order.versions.order_by("-version_number").first()
        next_num = (active.version_number if active else 0) + 1

        version = ServiceOrderVersion.objects.create(
            service_order=service_order,
            version_number=next_num,
            source=parsed_budget.source,
            external_version=getattr(parsed_budget, "external_version", ""),
            external_numero_vistoria=getattr(parsed_budget, "external_numero_vistoria", ""),
            external_integration_id=getattr(parsed_budget, "external_integration_id", ""),
            status=getattr(parsed_budget, "external_status", None) or "analisado",
            content_hash=getattr(parsed_budget, "raw_hash", ""),
            raw_payload_s3_key=getattr(import_attempt, "raw_payload_s3_key", ""),
            import_attempt=import_attempt,
            hourly_rates=getattr(parsed_budget, "hourly_rates", {}),
            global_discount_pct=getattr(parsed_budget, "global_discount_pct", Decimal("0")),
        )

        # Persistir itens (se ImportService disponível)
        try:
            from apps.cilia.services import ImportService
            ImportService.persist_items(parsed_budget=parsed_budget, version=version)
        except (ImportError, AttributeError):
            logger.warning(
                "ImportService.persist_items indisponível — versão criada sem itens (OS #%s v%d)",
                service_order.pk, next_num,
            )

        OSEventLogger.log_event(
            service_order, "VERSION_CREATED",
            actor="Sistema",
            payload={
                "version_number": next_num,
                "source": parsed_budget.source,
                "external_version": getattr(parsed_budget, "external_version", ""),
            },
            swallow_errors=True,
        )
        OSEventLogger.log_event(
            service_order, "IMPORT_RECEIVED",
            actor="Sistema",
            payload={"source": parsed_budget.source, "attempt_id": getattr(import_attempt, "pk", None)},
            swallow_errors=True,
        )

        # Auto-transição para 'budget' (pausa) se não estava lá nem em estado terminal
        terminal = {"reception", "delivered", "cancelled"}
        if service_order.status != "budget" and service_order.status not in terminal:
            cls.change_status(
                service_order=service_order,
                new_status="budget",
                changed_by="Sistema",
                notes=f"Nova versão importada: {version.external_version or version.version_number}",
                is_auto=True,
            )

        return version

    @classmethod
    @transaction.atomic
    def approve_version(
        cls,
        *,
        version: "ServiceOrderVersion",
        approved_by: str,
    ) -> "ServiceOrderVersion":
        """
        Aprova uma versão de OS.
        - Marca como 'autorizado' (seguradora) ou 'approved' (particular).
        - Marca outras versões como 'superseded'.
        - Se OS está em 'budget' e tinha previous_status, retorna ao previous_status.
        """
        from django.utils import timezone
        from apps.service_orders.events import OSEventLogger

        os = version.service_order
        version.status = "autorizado" if os.customer_type == "insurer" else "approved"
        version.approved_at = timezone.now()
        version.save(update_fields=["status", "approved_at"])

        # Supersede todas as outras
        os.versions.exclude(pk=version.pk).exclude(
            status__in=["approved", "rejected", "autorizado", "negado"]
        ).update(status="superseded")

        OSEventLogger.log_event(
            os, "VERSION_APPROVED",
            actor=approved_by,
            payload={"version_number": version.version_number, "source": version.source},
            swallow_errors=True,
        )

        # Auto-retorno ao previous_status se OS está pausada em 'budget'
        if os.status == "budget" and os.previous_status:
            cls.change_status(
                service_order=os,
                new_status=os.previous_status,
                changed_by="Sistema",
                notes="Auto: versão aprovada, retomando estado anterior",
                is_auto=True,
            )

        return version

    @classmethod
    def recalculate_version_totals(cls, version: "ServiceOrderVersion") -> None:
        """
        Recalcula os totais de uma ServiceOrderVersion a partir dos itens e operações.
        Atualiza subtotal, discount_total, net_total, labor_total, parts_total
        e os 3 blocos financeiros (total_seguradora, total_complemento_particular, total_franquia).
        """
        from decimal import Decimal as D
        from django.db.models import Sum

        items = version.items.all().prefetch_related("operations")

        labor = D("0")
        parts = D("0")
        subtotal = D("0")
        discount = D("0")

        total_seguradora = D("0")
        total_complemento = D("0")
        total_franquia = D("0")
        total_particular = D("0")

        for item in items:
            item_net = item.net_price
            item_gross = item.unit_price * item.quantity
            item_discount = item_gross - item_net
            discount += item_discount

            if item.item_type == "PART":
                parts += item_net
            subtotal += item_net

            for op in item.operations.all():
                labor += op.labor_cost

            if item.payer_block == "SEGURADORA":
                total_seguradora += item_net
            elif item.payer_block == "COMPLEMENTO_PARTICULAR":
                total_complemento += item_net
            elif item.payer_block == "FRANQUIA":
                total_franquia += item_net
            else:
                total_particular += item_net

        version.labor_total = labor
        version.parts_total = parts
        version.subtotal = subtotal + labor
        version.discount_total = discount
        version.net_total = version.subtotal - discount
        version.total_seguradora = total_seguradora
        version.total_complemento_particular = total_complemento
        version.total_franquia = total_franquia
        version.save(update_fields=[
            "labor_total", "parts_total", "subtotal", "discount_total", "net_total",
            "total_seguradora", "total_complemento_particular", "total_franquia",
        ])
```

Also add this import at the top of `services.py` (it should already have `from decimal import Decimal` and `from typing import Any`):

```python
from decimal import Decimal
from typing import Any
```

- [ ] **Step 4: Run tests**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests.test_versioning -v 2
```

Expected: `Ran 11 tests in X.Xs — OK`

- [ ] **Step 5: Also run existing service_orders tests to ensure no regression**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests -v 1
```

Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/service_orders/services.py \
        backend/core/apps/service_orders/tests/test_versioning.py
git commit -m "feat(service_orders): adiciona change_status, create_new_version_from_import, approve_version, recalculate_version_totals"
```

---

### Task 5: Update `VALID_TRANSITIONS` to support budget re-entry from repair stages

**Files:**
- Modify: `backend/core/apps/service_orders/models.py`

The spec adds `"budget"` as a valid transition from repair stages so OS can be paused when a new version arrives mid-repair.

- [ ] **Step 1: Write the failing test**

Add to `test_versioning.py`:

```python
class ValidTransitionsTest(TestCase):
    def test_repair_can_go_to_budget(self):
        from apps.service_orders.models import VALID_TRANSITIONS
        self.assertIn("budget", VALID_TRANSITIONS["repair"])

    def test_bodywork_can_go_to_budget(self):
        from apps.service_orders.models import VALID_TRANSITIONS
        self.assertIn("budget", VALID_TRANSITIONS["bodywork"])

    def test_painting_can_go_to_budget(self):
        from apps.service_orders.models import VALID_TRANSITIONS
        self.assertIn("budget", VALID_TRANSITIONS["painting"])

    def test_budget_can_go_to_waiting_parts(self):
        from apps.service_orders.models import VALID_TRANSITIONS
        self.assertIn("waiting_parts", VALID_TRANSITIONS["budget"])

    def test_budget_can_go_to_repair(self):
        from apps.service_orders.models import VALID_TRANSITIONS
        self.assertIn("repair", VALID_TRANSITIONS["budget"])
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests.test_versioning.ValidTransitionsTest -v 2
```

Expected: `FAIL` — `budget` not yet in repair transitions.

- [ ] **Step 3: Update `VALID_TRANSITIONS` in `models.py`**

Replace the existing `VALID_TRANSITIONS` dict in `models.py`:

```python
VALID_TRANSITIONS: dict[str, list[str]] = {
    ServiceOrderStatus.RECEPTION:      [ServiceOrderStatus.INITIAL_SURVEY, ServiceOrderStatus.CANCELLED],
    ServiceOrderStatus.INITIAL_SURVEY: [ServiceOrderStatus.BUDGET, ServiceOrderStatus.WAITING_AUTH],
    ServiceOrderStatus.BUDGET:         [ServiceOrderStatus.WAITING_PARTS, ServiceOrderStatus.REPAIR, ServiceOrderStatus.WAITING_AUTH],
    ServiceOrderStatus.WAITING_AUTH:   [ServiceOrderStatus.AUTHORIZED, ServiceOrderStatus.CANCELLED],
    ServiceOrderStatus.AUTHORIZED:     [ServiceOrderStatus.WAITING_PARTS, ServiceOrderStatus.REPAIR],
    ServiceOrderStatus.WAITING_PARTS:  [ServiceOrderStatus.REPAIR],
    ServiceOrderStatus.REPAIR:         [ServiceOrderStatus.MECHANIC, ServiceOrderStatus.BODYWORK, ServiceOrderStatus.POLISHING, ServiceOrderStatus.BUDGET],
    ServiceOrderStatus.MECHANIC:       [ServiceOrderStatus.BODYWORK, ServiceOrderStatus.POLISHING, ServiceOrderStatus.BUDGET],
    ServiceOrderStatus.BODYWORK:       [ServiceOrderStatus.PAINTING, ServiceOrderStatus.BUDGET],
    ServiceOrderStatus.PAINTING:       [ServiceOrderStatus.ASSEMBLY, ServiceOrderStatus.BUDGET],
    ServiceOrderStatus.ASSEMBLY:       [ServiceOrderStatus.POLISHING, ServiceOrderStatus.BUDGET],
    ServiceOrderStatus.POLISHING:      [ServiceOrderStatus.WASHING, ServiceOrderStatus.BUDGET],
    ServiceOrderStatus.WASHING:        [ServiceOrderStatus.FINAL_SURVEY, ServiceOrderStatus.BUDGET],
    ServiceOrderStatus.FINAL_SURVEY:   [ServiceOrderStatus.READY],
    ServiceOrderStatus.READY:          [ServiceOrderStatus.DELIVERED],
    ServiceOrderStatus.DELIVERED:      [],
    ServiceOrderStatus.CANCELLED:      [],
}
```

Also update `packages/types/src/service-order.types.ts` to mirror:

```typescript
export const VALID_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  reception:      ["initial_survey", "cancelled"],
  initial_survey: ["budget", "waiting_auth"],
  budget:         ["waiting_parts", "repair", "waiting_auth"],
  waiting_auth:   ["authorized", "cancelled"],
  authorized:     ["waiting_parts", "repair"],
  waiting_parts:  ["repair"],
  repair:         ["mechanic", "bodywork", "polishing", "budget"],
  mechanic:       ["bodywork", "polishing", "budget"],
  bodywork:       ["painting", "budget"],
  painting:       ["assembly", "budget"],
  assembly:       ["polishing", "budget"],
  polishing:      ["washing", "budget"],
  washing:        ["final_survey", "budget"],
  final_survey:   ["ready"],
  ready:          ["delivered"],
  delivered:      [],
  cancelled:      [],
}
```

- [ ] **Step 4: Run tests**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests.test_versioning.ValidTransitionsTest -v 2

docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests -v 1
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/service_orders/models.py \
        packages/types/src/service-order.types.ts
git commit -m "feat(service_orders): atualiza VALID_TRANSITIONS para suportar re-entrada em budget nos stages de reparo"
```

---

### Task 6: REST API endpoints for versions and events

**Files:**
- Modify: `backend/core/apps/service_orders/serializers.py`
- Modify: `backend/core/apps/service_orders/views.py`
- Modify: `backend/core/apps/service_orders/urls.py`

- [ ] **Step 1: Write the failing test**

Add to `test_versioning.py`:

```python
class ServiceOrderVersionAPITest(TenantTestCase):
    def setUp(self):
        super().setUp()
        from rest_framework.test import APIClient
        from apps.authentication.models import GlobalUser
        self.client = APIClient()
        self.user = GlobalUser.objects.create_user(
            email="api_test@test.com", password="test123",
        )
        self.client.force_authenticate(user=self.user)

    def _make_order(self):
        from apps.service_orders.models import ServiceOrder
        return ServiceOrder.objects.create(
            number=6666, customer_name="API Test", plate="API0001",
        )

    def test_list_versions_empty(self):
        os = self._make_order()
        resp = self.client.get(f"/api/v1/service-orders/{os.pk}/versions/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["results"], [])

    def test_list_events(self):
        from apps.service_orders.events import OSEventLogger
        os = self._make_order()
        OSEventLogger.log_event(os, "STATUS_CHANGE", actor="Thiago")
        resp = self.client.get(f"/api/v1/service-orders/{os.pk}/events/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_approve_version_action(self):
        from apps.service_orders.models import ServiceOrderVersion, ServiceOrder
        os = self._make_order()
        os.status = "budget"
        os.previous_status = "repair"
        os.save()
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1, source="cilia", status="analisado",
        )
        resp = self.client.post(f"/api/v1/service-orders/versions/{v.pk}/approve/")
        self.assertEqual(resp.status_code, 200)
        v.refresh_from_db()
        self.assertEqual(v.status, "autorizado")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests.test_versioning.ServiceOrderVersionAPITest -v 2
```

Expected: `404` or `AttributeError` — endpoints don't exist yet.

- [ ] **Step 3: Add serializers**

Add to `backend/core/apps/service_orders/serializers.py`:

```python
from apps.service_orders.models import (
    ServiceOrderVersion, ServiceOrderVersionItem, ServiceOrderEvent,
    ServiceOrderParecer,
)


class ServiceOrderVersionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderVersionItem
        fields = [
            "id", "version",
            "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order",
        ]
        read_only_fields = fields


class ServiceOrderVersionSerializer(serializers.ModelSerializer):
    items = ServiceOrderVersionItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrderVersion
        fields = [
            "id", "service_order", "version_number",
            "external_version", "external_numero_vistoria", "external_integration_id",
            "source", "status", "status_display",
            "subtotal", "discount_total", "net_total",
            "labor_total", "parts_total",
            "total_seguradora", "total_complemento_particular", "total_franquia",
            "content_hash", "hourly_rates", "global_discount_pct",
            "created_at", "created_by", "approved_at",
            "items",
        ]
        read_only_fields = fields


class ServiceOrderEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderEvent
        fields = [
            "id", "service_order", "event_type",
            "actor", "payload", "from_state", "to_state", "created_at",
        ]
        read_only_fields = fields


class ServiceOrderParecerSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderParecer
        fields = [
            "id", "service_order", "version",
            "source", "flow_number",
            "author_external", "author_org", "author_internal",
            "parecer_type", "body",
            "created_at_external", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
```

- [ ] **Step 4: Add ViewSets**

Add to `backend/core/apps/service_orders/views.py`:

```python
from apps.service_orders.models import ServiceOrderVersion, ServiceOrderEvent, ServiceOrderParecer
from apps.service_orders.serializers import (
    ServiceOrderVersionSerializer, ServiceOrderEventSerializer,
    ServiceOrderParecerSerializer,
)


class ServiceOrderVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista/detalhe de versões de OS + action approve."""

    permission_classes = [IsAuthenticated]
    serializer_class = ServiceOrderVersionSerializer

    def get_queryset(self):
        return (
            ServiceOrderVersion.objects
            .select_related("service_order", "import_attempt")
            .prefetch_related("items")
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Aprova a versão e retorna OS ao status anterior se pausada em budget."""
        from apps.service_orders.services import ServiceOrderService
        from apps.authentication.permissions import IsConsultantOrAbove

        version = self.get_object()
        actor = getattr(request.user, "get_full_name", lambda: request.user.email)()
        updated = ServiceOrderService.approve_version(version=version, approved_by=actor or "Usuário")
        return Response(ServiceOrderVersionSerializer(updated).data)


class ServiceOrderEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Timeline de eventos de OS (somente leitura)."""

    permission_classes = [IsAuthenticated]
    serializer_class = ServiceOrderEventSerializer

    def get_queryset(self):
        return ServiceOrderEvent.objects.select_related("service_order")


class ServiceOrderParecerViewSet(viewsets.ModelViewSet):
    """CRUD de pareceres (internos). Pareceres importados são read-only."""

    permission_classes = [IsAuthenticated]
    serializer_class = ServiceOrderParecerSerializer

    def get_queryset(self):
        return ServiceOrderParecer.objects.select_related("service_order", "version")

    def get_permissions(self) -> list:
        from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
        if self.action in ("destroy",):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]
```

Also add the nested `versions` and `events` actions to the existing `ServiceOrderViewSet`:

```python
    @action(detail=True, methods=["get"], url_path="versions")
    def versions(self, request, pk=None):
        """Lista versões de uma OS específica."""
        os = self.get_object()
        qs = os.versions.prefetch_related("items").order_by("-version_number")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                ServiceOrderVersionSerializer(page, many=True).data
            )
        return Response(ServiceOrderVersionSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"], url_path="events")
    def events(self, request, pk=None):
        """Lista timeline de eventos de uma OS específica."""
        os = self.get_object()
        qs = os.events.order_by("-created_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                ServiceOrderEventSerializer(page, many=True).data
            )
        return Response(ServiceOrderEventSerializer(qs, many=True).data)
```

- [ ] **Step 5: Register routes in `urls.py`**

Add to `backend/core/apps/service_orders/urls.py`:

```python
from .views import (
    CalendarView, DashboardStatsView, HolidayViewSet,
    ServiceCatalogViewSet, ServiceOrderViewSet, VehicleHistoryView,
    ServiceOrderVersionViewSet, ServiceOrderEventViewSet, ServiceOrderParecerViewSet,
)

versions_router = SimpleRouter()
versions_router.register(r"", ServiceOrderVersionViewSet, basename="service-order-version")

events_router = SimpleRouter()
events_router.register(r"", ServiceOrderEventViewSet, basename="service-order-event")

pareceres_router = SimpleRouter()
pareceres_router.register(r"", ServiceOrderParecerViewSet, basename="service-order-parecer")
```

And add to `urlpatterns` (before `path("", include(router.urls))`):

```python
    path("versions/", include(versions_router.urls)),
    path("events/", include(events_router.urls)),
    path("pareceres/", include(pareceres_router.urls)),
```

- [ ] **Step 6: Run tests**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests.test_versioning.ServiceOrderVersionAPITest -v 2

docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders.tests -v 1
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add backend/core/apps/service_orders/serializers.py \
        backend/core/apps/service_orders/views.py \
        backend/core/apps/service_orders/urls.py \
        backend/core/apps/service_orders/tests/test_versioning.py
git commit -m "feat(service_orders): API endpoints para versions, events, pareceres"
```

---

### Task 7: Final integration test + push

- [ ] **Step 1: Run full test suite for affected apps**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py test apps.service_orders apps.items apps.cilia apps.signatures -v 1
```

Expected: All existing tests pass + new versioning tests pass.

- [ ] **Step 2: Check for Django system check errors**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py check --deploy 2>&1 | grep -v "WARNINGS"
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 3: Verify migrations are consistent**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django \
  python manage.py migrate_schemas --check 2>&1 | tail -5
```

Expected: No pending migrations.

- [ ] **Step 4: Final commit + push**

```bash
git add -A
git commit -m "test(service_orders): suite de integração do módulo de versionamento" || true
git push origin feat/port-worktree-shamir
```

---

## Self-Review

### Spec coverage

| Spec §5 requirement | Task that implements it |
|---|---|
| `ServiceOrderVersion` model | Task 2 |
| `ServiceOrderVersionItem` (ItemFieldsMixin) | Task 2 |
| `ItemOperationType`, `LaborCategory` | Task 1 |
| `ItemOperation` (multi-op per item) | Task 1 |
| `ServiceOrderEvent` (universal timeline) | Task 2 |
| `ServiceOrderParecer` | Task 2 |
| `ImpactAreaLabel` | Task 2 |
| 3 financial blocks (total_seguradora etc.) | Task 2 |
| `previous_status` em ServiceOrder | Task 2 |
| Seeds de operation_types e labor_categories | Task 1 |

| Spec §6 requirement | Task that implements it |
|---|---|
| `OSEventLogger.log_event()` | Task 3 |
| `change_status()` com validação | Task 4 |
| `create_new_version_from_import()` + auto-Kanban | Task 4 |
| `approve_version()` + retorno ao previous_status | Task 4 |
| `recalculate_version_totals()` com 3 blocos | Task 4 |
| Auto-transição para budget ao importar | Task 4 |
| VALID_TRANSITIONS com re-entrada em budget | Task 5 |

| Spec §8 requirement | Task that implements it |
|---|---|
| `GET /api/v1/service-orders/{id}/versions/` | Task 6 |
| `GET /api/v1/service-orders/{id}/events/` | Task 6 |
| `POST /api/v1/service-orders/versions/{id}/approve/` | Task 6 |
| `GET/POST /api/v1/service-orders/pareceres/` | Task 6 |

**Not in scope (follow-up plans):**
- `BudgetVersionItem` (aguarda app `budgets/`)
- XOR constraint em `ItemOperation` (aguarda `item_budget` FK)
- `recalculate_version_totals` chamado automaticamente via signal
- Frontend de gerenciamento de versões
- `_can_deliver()` (trava NFS-e) — depends on apps.fiscal

### Placeholder scan
No placeholders found — all steps have actual code.

### Type consistency
- `ServiceOrderVersion.import_attempt` → FK to `cilia.ImportAttempt` — `cilia/migrations/0002_import_attempt.py` exists (ported earlier this session). ✓
- `ItemOperation.item_so` → FK to `service_orders.ServiceOrderVersionItem` — created in Task 2 migration before Task 1 migration runs. Check: `items/0001_initial` depends on `service_orders/0020` and `service_orders/0021` would be created separately. **Attention:** `items/0001_initial` references `ServiceOrderVersionItem` which is created in `service_orders/0021_versioning_and_events`. The dependency chain must be: `service_orders/0021` → `items/0001`. Update the dependency in `items/0001_initial.py` to `("service_orders", "0021_versioning_and_events")`.
- `OSEventLogger.log_event(swallow_errors=True)` used in all service calls — ensures service pipeline is never interrupted by logger failures. ✓
- `change_status()` VALID_TRANSITIONS lookup uses the dict from `models.py` — imported inside the method to avoid circular imports (same pattern as existing `transition()` method). ✓
