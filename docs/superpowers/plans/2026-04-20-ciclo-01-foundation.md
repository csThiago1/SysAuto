# Ciclo 01 — Foundation · Módulo de Orçamentação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar toda a fundação de dados do novo módulo de orçamentação — models, migrations, seeds, numeração atômica, tabelas de referência — sem nenhuma regra de negócio/API ainda.

**Architecture:** 3 apps Django novos (`items`, `budgets`, `authz`) + evolução dos apps `service_orders` existente. Tabelas de referência extensíveis, snapshots versionados imutáveis, numeração contínua global. Os services/APIs/UI vêm nos ciclos seguintes.

**Tech Stack:** Django 5, PostgreSQL 16, pytest-django, factory-boy, django-filter.

**Referência de design:** [`docs/superpowers/specs/2026-04-20-modulo-orcamentacao-design.md`](../specs/2026-04-20-modulo-orcamentacao-design.md) — §5 (Modelo de dados), §14.2 (NumberSequence), §16 (Migração).

**Out of scope deste ciclo** (vai pros próximos):
- Services de negócio (Ciclo 2)
- ViewSets / serializers / endpoints (Ciclo 3)
- Importadores (Ciclo 4)
- PDF, fotos, assinatura, fiscal, permissões (Ciclo 5)

---

## Estrutura de arquivos deste ciclo

| Arquivo | Responsabilidade |
|---|---|
| `backend/core/requirements.txt` | + pytest-django, factory-boy, freezegun |
| `backend/core/config/settings.py` | + 3 apps ao `INSTALLED_APPS`; config pytest |
| `backend/core/pytest.ini` | pytest-django config |
| `backend/core/conftest.py` | fixtures globais |
| `backend/core/apps/items/__init__.py` | app novo |
| `backend/core/apps/items/apps.py` | AppConfig |
| `backend/core/apps/items/models.py` | `ItemOperationType`, `LaborCategory`, `ItemOperation`, `NumberSequence`, `Part` (stub) |
| `backend/core/apps/items/mixins.py` | `ItemFieldsMixin` abstract |
| `backend/core/apps/items/services.py` | `NumberAllocator` |
| `backend/core/apps/items/migrations/0001_initial.py` | tabelas iniciais |
| `backend/core/apps/items/migrations/0002_seed_ref_tables.py` | seed operations + labor cats + number seq |
| `backend/core/apps/items/tests/test_number_allocator.py` | testes de alocação atômica |
| `backend/core/apps/items/tests/test_ref_tables.py` | seeds carregados |
| `backend/core/apps/authz/__init__.py` | app novo |
| `backend/core/apps/authz/models.py` | `Permission`, `Role`, `RolePermission`, `UserRole`, `UserPermission` |
| `backend/core/apps/authz/services.py` | `user_has_perm()` helper |
| `backend/core/apps/authz/migrations/0001_initial.py` | |
| `backend/core/apps/authz/migrations/0002_seed_roles.py` | seed roles + perms |
| `backend/core/apps/authz/tests/test_permissions.py` | |
| `backend/core/apps/budgets/__init__.py` | app novo |
| `backend/core/apps/budgets/models.py` | `Budget`, `BudgetVersion`, `BudgetVersionItem` |
| `backend/core/apps/budgets/migrations/0001_initial.py` | |
| `backend/core/apps/budgets/tests/test_models.py` | |
| `backend/core/apps/service_orders/models.py` | EVOLVE: `Insurer`, `ServiceOrder` (+campos), `ServiceOrderVersion`, `ServiceOrderVersionItem`, `ServiceOrderEvent`, `ServiceOrderParecer`, `ImpactAreaLabel` |
| `backend/core/apps/service_orders/migrations/0002_insurer_version_model.py` | evolução schema |
| `backend/core/apps/service_orders/migrations/0003_migrate_status_history.py` | data migration Events |
| `backend/core/apps/service_orders/migrations/0004_create_v1_for_existing_os.py` | data migration v1 |
| `backend/core/apps/service_orders/tests/test_models.py` | |
| `backend/core/apps/service_orders/tests/test_data_migration.py` | |

**Ordem de execução das tasks:** estritamente sequencial — migrações dependem umas das outras.

---

## Task 1: Setup pytest + dependências de teste

**Files:**
- Modify: `backend/core/requirements.txt`
- Create: `backend/core/pytest.ini`
- Create: `backend/core/conftest.py`

- [ ] **Step 1.1: Adicionar dependências de teste**

Edit `backend/core/requirements.txt`:

```txt
# Backend Core — ERP DS Car · Paddock Solutions
# Instalar: pip install -r requirements.txt

# Framework
django>=5.0,<6.0
djangorestframework>=3.15,<4.0

# Auth JWT
djangorestframework-simplejwt>=5.3,<6.0

# Filtros e busca
django-filter>=24.0,<25.0

# CORS
django-cors-headers>=4.3,<5.0

# PostgreSQL
psycopg[binary]>=3.1,<4.0

# HTTP client (lookup de placa + WhatsApp)
httpx>=0.27,<1.0

# Utilitários
python-dotenv>=1.0,<2.0

# Testes
pytest>=8.0,<9.0
pytest-django>=4.8,<5.0
pytest-cov>=5.0,<6.0
factory-boy>=3.3,<4.0
freezegun>=1.5,<2.0
```

- [ ] **Step 1.2: Configurar pytest**

Create `backend/core/pytest.ini`:

```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -ra --tb=short --strict-markers
testpaths = apps
markers =
    slow: testes lentos que podem ser pulados com -m "not slow"
    integration: testes de integração com banco real
```

- [ ] **Step 1.3: Criar conftest global**

Create `backend/core/conftest.py`:

```python
import pytest
from django.core.management import call_command


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    """Garante que seeds de data migrations estão aplicadas."""
    with django_db_blocker.unblock():
        # Migrations já rodam via pytest-django; nada extra por enquanto
        pass


@pytest.fixture
def db_access(db):
    """Alias mais semântico do fixture 'db'."""
    return db
```

- [ ] **Step 1.4: Instalar e validar**

Run:
```bash
cd backend/core
pip install -r requirements.txt
pytest --collect-only
```

Expected: sem erros de importação; mostra "collected 0 items" (ainda não temos testes).

- [ ] **Step 1.5: Commit**

```bash
git add backend/core/requirements.txt backend/core/pytest.ini backend/core/conftest.py
git commit -m "chore(test): setup pytest-django e factory-boy"
```

---

## Task 2: Criar app `items` com `ItemOperationType` + `LaborCategory`

**Files:**
- Create: `backend/core/apps/items/__init__.py`
- Create: `backend/core/apps/items/apps.py`
- Create: `backend/core/apps/items/models.py`
- Create: `backend/core/apps/items/tests/__init__.py`
- Create: `backend/core/apps/items/tests/test_ref_tables.py`
- Modify: `backend/core/config/settings.py`

- [ ] **Step 2.1: Criar estrutura do app**

```bash
mkdir -p backend/core/apps/items/tests
mkdir -p backend/core/apps/items/migrations
touch backend/core/apps/items/__init__.py
touch backend/core/apps/items/tests/__init__.py
touch backend/core/apps/items/migrations/__init__.py
```

- [ ] **Step 2.2: AppConfig**

Create `backend/core/apps/items/apps.py`:

```python
from django.apps import AppConfig


class ItemsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.items"
    verbose_name = "Itens e Catálogos"
```

- [ ] **Step 2.3: Registrar app**

Edit `backend/core/config/settings.py` — localize `INSTALLED_APPS` e adicione `"apps.items"`:

```python
INSTALLED_APPS = [
    # ... apps Django e terceiros existentes
    "apps.persons",
    "apps.vehicles",
    "apps.service_orders",
    "apps.items",  # ← NOVO
]
```

- [ ] **Step 2.4: Criar models básicos de referência**

Create `backend/core/apps/items/models.py`:

```python
from django.db import models


class ItemOperationType(models.Model):
    """Tipo de operação aplicada a um item: TROCA / RECUPERACAO / OVERLAP / PINTURA / R_I / MONTAGEM_DESMONTAGEM / DNC.

    Extensível via admin sem migration.
    """

    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]
        verbose_name = "Tipo de Operação"
        verbose_name_plural = "Tipos de Operação"

    def __str__(self) -> str:
        return f"{self.code} — {self.label}"


class LaborCategory(models.Model):
    """Categoria de mão-de-obra: FUNILARIA / PINTURA / MECANICA / ELETRICA / TAPECARIA / ACABAMENTO / VIDRACARIA / REPARACAO / SERVICOS.

    Extensível via admin sem migration.
    """

    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]
        verbose_name = "Categoria de MO"
        verbose_name_plural = "Categorias de MO"

    def __str__(self) -> str:
        return f"{self.code} — {self.label}"
```

- [ ] **Step 2.5: Gerar migration inicial**

Run:
```bash
cd backend/core
python manage.py makemigrations items
```

Expected: cria `apps/items/migrations/0001_initial.py`.

- [ ] **Step 2.6: Criar data migration com seed**

Create `backend/core/apps/items/migrations/0002_seed_ref_tables.py`:

```python
from django.db import migrations


OPERATION_TYPES = [
    ("TROCA", "Troca", "Peça substituída por nova.", 10),
    ("RECUPERACAO", "Recuperação", "Peça reparada/recuperada, não substituída.", 20),
    ("OVERLAP", "Overlap", "Peça sob influência; apenas tempo de desmontagem/montagem.", 30),
    ("R_I", "Remoção & Instalação", "Remove e reinstala sem substituir.", 40),
    ("PINTURA", "Pintura", "Somente pintura aplicada à peça.", 50),
    ("MONTAGEM_DESMONTAGEM", "Montagem/Desmontagem", "Operação auxiliar de montagem ou desmontagem.", 60),
    ("DNC", "Dano Não Coberto", "Item identificado como não coberto pelo sinistro.", 70),
]


LABOR_CATEGORIES = [
    ("FUNILARIA", "Funilaria", "", 10),
    ("PINTURA", "Pintura", "", 20),
    ("MECANICA", "Mecânica", "", 30),
    ("ELETRICA", "Elétrica", "", 40),
    ("TAPECARIA", "Tapeçaria", "", 50),
    ("ACABAMENTO", "Acabamento", "", 60),
    ("VIDRACARIA", "Vidraçaria", "", 70),
    ("REPARACAO", "Reparação", "MO de reparação (valor/hora diferenciado no Cilia).", 80),
    ("SERVICOS", "Serviços", "Agrupamento Cilia para serviços avulsos.", 90),
]


def seed_operation_types(apps, schema_editor):
    ItemOperationType = apps.get_model("items", "ItemOperationType")
    for code, label, desc, order in OPERATION_TYPES:
        ItemOperationType.objects.get_or_create(
            code=code,
            defaults={"label": label, "description": desc, "sort_order": order},
        )


def seed_labor_categories(apps, schema_editor):
    LaborCategory = apps.get_model("items", "LaborCategory")
    for code, label, desc, order in LABOR_CATEGORIES:
        LaborCategory.objects.get_or_create(
            code=code,
            defaults={"label": label, "description": desc, "sort_order": order},
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_operation_types, noop_reverse),
        migrations.RunPython(seed_labor_categories, noop_reverse),
    ]
```

- [ ] **Step 2.7: Escrever teste dos seeds (falhando)**

Create `backend/core/apps/items/tests/test_ref_tables.py`:

```python
import pytest
from apps.items.models import ItemOperationType, LaborCategory


@pytest.mark.django_db
class TestOperationTypesSeed:
    def test_has_all_expected_codes(self):
        expected = {"TROCA", "RECUPERACAO", "OVERLAP", "R_I", "PINTURA",
                    "MONTAGEM_DESMONTAGEM", "DNC"}
        codes = set(ItemOperationType.objects.values_list("code", flat=True))
        assert expected.issubset(codes)

    def test_all_active(self):
        assert ItemOperationType.objects.filter(is_active=False).count() == 0

    def test_str(self):
        op = ItemOperationType.objects.get(code="TROCA")
        assert str(op) == "TROCA — Troca"


@pytest.mark.django_db
class TestLaborCategoriesSeed:
    def test_has_all_expected_codes(self):
        expected = {"FUNILARIA", "PINTURA", "MECANICA", "ELETRICA", "TAPECARIA",
                    "ACABAMENTO", "VIDRACARIA", "REPARACAO", "SERVICOS"}
        codes = set(LaborCategory.objects.values_list("code", flat=True))
        assert expected.issubset(codes)
```

- [ ] **Step 2.8: Rodar migrations + testes**

Run:
```bash
cd backend/core
python manage.py migrate
pytest apps/items/tests/test_ref_tables.py -v
```

Expected: migrations aplicam sem erro; 3 testes PASS.

- [ ] **Step 2.9: Commit**

```bash
git add backend/core/apps/items/ backend/core/config/settings.py
git commit -m "feat(items): criar tabelas de referência ItemOperationType + LaborCategory com seeds"
```

---

## Task 3: `NumberSequence` + `NumberAllocator` (alocação atômica)

**Files:**
- Modify: `backend/core/apps/items/models.py`
- Create: `backend/core/apps/items/services.py`
- Modify: `backend/core/apps/items/migrations/0002_seed_ref_tables.py` (adicionar seed sequences)
- Create: `backend/core/apps/items/tests/test_number_allocator.py`

- [ ] **Step 3.1: Escrever teste falhando**

Create `backend/core/apps/items/tests/test_number_allocator.py`:

```python
import pytest
from concurrent.futures import ThreadPoolExecutor
from django.db import connection

from apps.items.services import NumberAllocator
from apps.items.models import NumberSequence


@pytest.mark.django_db
class TestNumberAllocator:

    def test_allocates_from_seed(self):
        # Seed de migration cria BUDGET com prefix OR- e SERVICE_ORDER com prefix OS-
        first = NumberAllocator.allocate("BUDGET")
        second = NumberAllocator.allocate("BUDGET")
        assert first == "OR-000001"
        assert second == "OR-000002"

    def test_different_sequences_independent(self):
        b1 = NumberAllocator.allocate("BUDGET")
        os1 = NumberAllocator.allocate("SERVICE_ORDER")
        b2 = NumberAllocator.allocate("BUDGET")
        os2 = NumberAllocator.allocate("SERVICE_ORDER")

        assert b1.startswith("OR-")
        assert os1.startswith("OS-")
        # números internos avançam independentemente
        assert int(b1.split("-")[1]) + 1 == int(b2.split("-")[1])
        assert int(os1.split("-")[1]) + 1 == int(os2.split("-")[1])

    def test_raises_on_unknown_type(self):
        with pytest.raises(NumberSequence.DoesNotExist):
            NumberAllocator.allocate("DOES_NOT_EXIST")

    def test_padding_respected(self):
        n = NumberAllocator.allocate("BUDGET")
        # Formato OR-NNNNNN (6 dígitos padding)
        numeric_part = n.split("-")[1]
        assert len(numeric_part) == 6
        assert numeric_part.lstrip("0") != ""
```

- [ ] **Step 3.2: Rodar teste pra ver falhando**

Run:
```bash
pytest apps/items/tests/test_number_allocator.py -v
```

Expected: FAIL — `NumberSequence` / `NumberAllocator` não existem.

- [ ] **Step 3.3: Adicionar `NumberSequence` ao models.py**

Edit `backend/core/apps/items/models.py` — **adicionar** no final:

```python
class NumberSequence(models.Model):
    """Sequência contínua pra numeração global (OR-NNNNNN, OS-NNNNNN)."""

    SEQ_TYPES = [
        ("BUDGET", "Orçamento Particular"),
        ("SERVICE_ORDER", "Ordem de Serviço"),
    ]

    sequence_type = models.CharField(max_length=20, choices=SEQ_TYPES, unique=True)
    prefix = models.CharField(max_length=10)
    padding = models.IntegerField(default=6)
    next_number = models.IntegerField(default=1)

    class Meta:
        verbose_name = "Sequência de Numeração"
        verbose_name_plural = "Sequências de Numeração"

    def __str__(self) -> str:
        return f"{self.sequence_type} @ {self.next_number}"
```

- [ ] **Step 3.4: Criar `NumberAllocator` service**

Create `backend/core/apps/items/services.py`:

```python
from django.db import transaction

from .models import NumberSequence


class NumberAllocator:
    """Aloca números sequenciais atômicos (SELECT FOR UPDATE)."""

    @classmethod
    @transaction.atomic
    def allocate(cls, sequence_type: str) -> str:
        """Retorna próximo número formatado (ex: 'OR-000042').

        Raises:
            NumberSequence.DoesNotExist: se sequence_type desconhecido.
        """
        seq = NumberSequence.objects.select_for_update().get(sequence_type=sequence_type)
        number = seq.next_number
        seq.next_number += 1
        seq.save(update_fields=["next_number"])
        return f"{seq.prefix}{number:0{seq.padding}d}"
```

- [ ] **Step 3.5: Gerar migration do `NumberSequence`**

Run:
```bash
python manage.py makemigrations items --name add_number_sequence
```

Expected: cria `apps/items/migrations/0003_add_number_sequence.py`.

- [ ] **Step 3.6: Criar seed da NumberSequence**

Create `backend/core/apps/items/migrations/0004_seed_number_sequences.py`:

```python
from django.db import migrations


def seed_sequences(apps, schema_editor):
    NumberSequence = apps.get_model("items", "NumberSequence")
    NumberSequence.objects.get_or_create(
        sequence_type="BUDGET",
        defaults={"prefix": "OR-", "padding": 6, "next_number": 1},
    )
    NumberSequence.objects.get_or_create(
        sequence_type="SERVICE_ORDER",
        defaults={"prefix": "OS-", "padding": 6, "next_number": 1},
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("items", "0003_add_number_sequence"),
    ]

    operations = [
        migrations.RunPython(seed_sequences, noop_reverse),
    ]
```

- [ ] **Step 3.7: Rodar migrations + testes**

Run:
```bash
python manage.py migrate
pytest apps/items/tests/test_number_allocator.py -v
```

Expected: 4 testes PASS.

- [ ] **Step 3.8: Commit**

```bash
git add backend/core/apps/items/
git commit -m "feat(items): NumberSequence + NumberAllocator atômico com SELECT FOR UPDATE"
```

---

## Task 4: `ItemFieldsMixin` (schema compartilhado de item)

**Files:**
- Create: `backend/core/apps/items/mixins.py`
- Create: `backend/core/apps/items/tests/test_mixin.py`

- [ ] **Step 4.1: Criar mixin abstract**

Create `backend/core/apps/items/mixins.py`:

```python
from decimal import Decimal

from django.db import models


class ItemFieldsMixin(models.Model):
    """Schema comum de item (usado por BudgetVersionItem e ServiceOrderVersionItem).

    Abstract — herdar e adicionar FK `version` pro parent apropriado.
    """

    BUCKET_CHOICES = [
        ("IMPACTO", "Impacto"),
        ("SEM_COBERTURA", "Sem Cobertura"),
        ("SOB_ANALISE", "Sob Análise"),
    ]

    PAYER_BLOCK_CHOICES = [
        ("SEGURADORA", "Coberto pela Seguradora"),
        ("COMPLEMENTO_PARTICULAR", "Complemento Particular"),
        ("FRANQUIA", "Franquia"),
        ("PARTICULAR", "Particular (OS particular inteira)"),
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
    bucket = models.CharField(max_length=20, choices=BUCKET_CHOICES, default="IMPACTO", db_index=True)
    payer_block = models.CharField(
        max_length=30, choices=PAYER_BLOCK_CHOICES, default="PARTICULAR", db_index=True,
    )
    impact_area = models.IntegerField(null=True, blank=True, db_index=True)
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES, default="PART")

    # Descrição + códigos
    description = models.CharField(max_length=300)
    external_code = models.CharField(max_length=60, blank=True, default="")
    # FK `internal_part` adicionada em evolução futura (Part model fica stub no Ciclo 1)

    # Tipo de peça / fornecimento
    part_type = models.CharField(max_length=20, choices=PART_TYPE_CHOICES, blank=True, default="")
    supplier = models.CharField(max_length=12, choices=SUPPLIER_CHOICES, default="OFICINA")

    # Financeiro
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=Decimal("1"))
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    net_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    # Flags
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

- [ ] **Step 4.2: Teste do mixin (usando herdeiro dummy nos testes)**

Create `backend/core/apps/items/tests/test_mixin.py`:

```python
from apps.items.mixins import ItemFieldsMixin


class TestItemFieldsMixin:

    def test_is_abstract(self):
        assert ItemFieldsMixin._meta.abstract is True

    def test_choices_are_present(self):
        assert ("PART", "Peça") in ItemFieldsMixin.ITEM_TYPE_CHOICES
        assert ("IMPACTO", "Impacto") in ItemFieldsMixin.BUCKET_CHOICES
        assert ("COMPLEMENTO_PARTICULAR", "Complemento Particular") in ItemFieldsMixin.PAYER_BLOCK_CHOICES
```

- [ ] **Step 4.3: Rodar testes**

Run:
```bash
pytest apps/items/tests/test_mixin.py -v
```

Expected: 2 testes PASS.

- [ ] **Step 4.4: Commit**

```bash
git add backend/core/apps/items/mixins.py backend/core/apps/items/tests/test_mixin.py
git commit -m "feat(items): ItemFieldsMixin abstract com schema comum de item"
```

---

## Task 5: Criar app `authz` com models de Role/Permission

**Files:**
- Create: `backend/core/apps/authz/__init__.py`
- Create: `backend/core/apps/authz/apps.py`
- Create: `backend/core/apps/authz/models.py`
- Create: `backend/core/apps/authz/services.py`
- Create: `backend/core/apps/authz/tests/__init__.py`
- Create: `backend/core/apps/authz/tests/test_permissions.py`
- Modify: `backend/core/config/settings.py`

- [ ] **Step 5.1: Estrutura do app**

```bash
mkdir -p backend/core/apps/authz/tests backend/core/apps/authz/migrations
touch backend/core/apps/authz/__init__.py
touch backend/core/apps/authz/tests/__init__.py
touch backend/core/apps/authz/migrations/__init__.py
```

- [ ] **Step 5.2: AppConfig**

Create `backend/core/apps/authz/apps.py`:

```python
from django.apps import AppConfig


class AuthzConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.authz"
    verbose_name = "Autorização (Roles & Permissions)"
```

- [ ] **Step 5.3: Registrar no settings**

Edit `backend/core/config/settings.py` — adicionar em `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ...
    "apps.items",
    "apps.authz",  # ← NOVO
]
```

- [ ] **Step 5.4: Models**

Create `backend/core/apps/authz/models.py`:

```python
from django.conf import settings
from django.db import models


class Permission(models.Model):
    """Catálogo de permissões granulares (ex: 'budget.approve', 'os.import_insurance')."""

    code = models.CharField(max_length=60, unique=True, db_index=True)
    label = models.CharField(max_length=200)
    module = models.CharField(max_length=40, db_index=True)

    class Meta:
        ordering = ["module", "code"]

    def __str__(self) -> str:
        return self.code


class Role(models.Model):
    """Role agrupando permissões (OWNER, ADMIN, MANAGER, CONSULTANT, MECHANIC, FINANCIAL)."""

    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    permissions = models.ManyToManyField(Permission, through="RolePermission", related_name="roles")

    def __str__(self) -> str:
        return self.code


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = [("role", "permission")]


class UserRole(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")

    class Meta:
        unique_together = [("user", "role")]


class UserPermission(models.Model):
    """Override individual: usuário ganha/perde permissão específica (precedência sobre Role)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    granted = models.BooleanField(default=True)

    class Meta:
        unique_together = [("user", "permission")]
```

- [ ] **Step 5.5: Service `user_has_perm`**

Create `backend/core/apps/authz/services.py`:

```python
from django.contrib.auth import get_user_model

from .models import RolePermission, UserPermission


User = get_user_model()


def user_has_perm(user: User, perm_code: str) -> bool:
    """Resolve permissão com precedência UserPermission > Role > negação.

    - Se há UserPermission explícita: usa o valor de `granted`.
    - Se não, checa se algum Role do usuário tem a permissão.
    """

    override = UserPermission.objects.filter(
        user=user, permission__code=perm_code,
    ).only("granted").first()
    if override is not None:
        return override.granted

    return RolePermission.objects.filter(
        role__user_roles__user=user, permission__code=perm_code,
    ).exists()
```

- [ ] **Step 5.6: Migration**

Run:
```bash
python manage.py makemigrations authz
```

Expected: cria `apps/authz/migrations/0001_initial.py`.

- [ ] **Step 5.7: Rodar migrations**

Run:
```bash
python manage.py migrate authz
```

- [ ] **Step 5.8: Commit parcial**

```bash
git add backend/core/apps/authz/ backend/core/config/settings.py
git commit -m "feat(authz): app authz com Role/Permission/RolePermission/UserRole/UserPermission"
```

---

## Task 6: Seed de Roles + Permissions

**Files:**
- Create: `backend/core/apps/authz/migrations/0002_seed_roles.py`
- Create: `backend/core/apps/authz/tests/test_permissions.py`

- [ ] **Step 6.1: Escrever testes falhando (pre-seed)**

Create `backend/core/apps/authz/tests/test_permissions.py`:

```python
import pytest
from django.contrib.auth import get_user_model

from apps.authz.models import Permission, Role, UserRole, UserPermission
from apps.authz.services import user_has_perm


User = get_user_model()


@pytest.mark.django_db
class TestSeeds:
    def test_core_permissions_exist(self):
        expected = {
            "budget.create", "budget.edit_own", "budget.edit_any",
            "budget.approve", "budget.clone",
            "os.create", "os.edit", "os.change_status", "os.delete",
            "os.import_insurance", "os.view_cost_margin",
            "payment.create", "payment.view",
            "fiscal.issue_nfse", "fiscal.issue_nfe",
            "photo.upload", "photo.delete",
            "pareceres.reply_external",
        }
        codes = set(Permission.objects.values_list("code", flat=True))
        missing = expected - codes
        assert not missing, f"Permissões faltando: {missing}"

    def test_core_roles_exist(self):
        expected = {"OWNER", "ADMIN", "MANAGER", "CONSULTANT", "MECHANIC", "FINANCIAL"}
        codes = set(Role.objects.values_list("code", flat=True))
        assert expected.issubset(codes)

    def test_owner_has_all_permissions(self):
        owner = Role.objects.get(code="OWNER")
        all_perms_count = Permission.objects.count()
        assert owner.permissions.count() == all_perms_count

    def test_mechanic_cannot_approve_budget(self):
        mechanic = Role.objects.get(code="MECHANIC")
        assert not mechanic.permissions.filter(code="budget.approve").exists()


@pytest.mark.django_db
class TestUserHasPerm:
    def _make_user_with_role(self, role_code: str):
        user = User.objects.create_user(username="alice", password="pass12345")
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
        return user

    def test_role_grants_permission(self):
        user = self._make_user_with_role("CONSULTANT")
        assert user_has_perm(user, "budget.create") is True

    def test_role_without_permission_returns_false(self):
        user = self._make_user_with_role("MECHANIC")
        assert user_has_perm(user, "fiscal.issue_nfse") is False

    def test_user_permission_override_grants(self):
        user = self._make_user_with_role("MECHANIC")
        perm = Permission.objects.get(code="fiscal.issue_nfse")
        UserPermission.objects.create(user=user, permission=perm, granted=True)
        assert user_has_perm(user, "fiscal.issue_nfse") is True

    def test_user_permission_override_denies(self):
        user = self._make_user_with_role("OWNER")
        perm = Permission.objects.get(code="os.delete")
        UserPermission.objects.create(user=user, permission=perm, granted=False)
        assert user_has_perm(user, "os.delete") is False
```

- [ ] **Step 6.2: Rodar teste — confirma falha**

Run:
```bash
pytest apps/authz/tests/test_permissions.py -v
```

Expected: FAIL — seed não existe.

- [ ] **Step 6.3: Criar data migration com seeds**

Create `backend/core/apps/authz/migrations/0002_seed_roles.py`:

```python
from django.db import migrations


PERMISSIONS = [
    # module, code, label
    ("budget", "budget.create", "Criar orçamento particular"),
    ("budget", "budget.edit_own", "Editar orçamentos próprios"),
    ("budget", "budget.edit_any", "Editar qualquer orçamento"),
    ("budget", "budget.approve", "Marcar orçamento como aprovado"),
    ("budget", "budget.clone", "Clonar orçamento arquivado"),

    ("os", "os.create", "Criar OS"),
    ("os", "os.edit", "Editar OS"),
    ("os", "os.change_status", "Mover OS no Kanban"),
    ("os", "os.delete", "Excluir OS (soft delete)"),
    ("os", "os.import_insurance", "Importar orçamento de seguradora"),
    ("os", "os.view_cost_margin", "Ver custo/margem"),

    ("payment", "payment.create", "Registrar pagamento"),
    ("payment", "payment.view", "Ver pagamentos"),

    ("fiscal", "fiscal.issue_nfse", "Emitir NFS-e"),
    ("fiscal", "fiscal.issue_nfe", "Emitir NFe"),

    ("photo", "photo.upload", "Subir foto"),
    ("photo", "photo.delete", "Remover foto (soft)"),

    ("pareceres", "pareceres.reply_external", "Responder parecer externo"),
]


ROLE_DEFAULTS = {
    "OWNER": {"label": "Dono", "description": "Acesso total"},
    "ADMIN": {"label": "Administrador", "description": "Gestão geral menos exclusão"},
    "MANAGER": {"label": "Gerente", "description": "Gestão operacional"},
    "CONSULTANT": {"label": "Consultor", "description": "Atendimento e orçamento"},
    "MECHANIC": {"label": "Mecânico", "description": "Execução de reparo"},
    "FINANCIAL": {"label": "Financeiro", "description": "Pagamentos e fiscal"},
}


ROLE_PERMISSIONS = {
    "OWNER": "ALL",  # especial: recebe tudo
    "ADMIN": [
        "budget.create", "budget.edit_own", "budget.edit_any", "budget.approve", "budget.clone",
        "os.create", "os.edit", "os.change_status", "os.import_insurance", "os.view_cost_margin",
        "payment.create", "payment.view",
        "fiscal.issue_nfse", "fiscal.issue_nfe",
        "photo.upload", "photo.delete",
        "pareceres.reply_external",
    ],
    "MANAGER": [
        "budget.create", "budget.edit_own", "budget.edit_any", "budget.approve", "budget.clone",
        "os.create", "os.edit", "os.change_status", "os.import_insurance", "os.view_cost_margin",
        "payment.create", "payment.view",
        "fiscal.issue_nfse", "fiscal.issue_nfe",
        "photo.upload", "photo.delete",
        "pareceres.reply_external",
    ],
    "CONSULTANT": [
        "budget.create", "budget.edit_own", "budget.approve", "budget.clone",
        "os.create", "os.edit", "os.change_status", "os.import_insurance",
        "photo.upload",
        "pareceres.reply_external",
    ],
    "MECHANIC": [
        "os.change_status",
        "photo.upload",
    ],
    "FINANCIAL": [
        "payment.create", "payment.view",
        "fiscal.issue_nfse", "fiscal.issue_nfe",
    ],
}


def seed(apps, schema_editor):
    Permission = apps.get_model("authz", "Permission")
    Role = apps.get_model("authz", "Role")
    RolePermission = apps.get_model("authz", "RolePermission")

    # Permissões
    perm_by_code = {}
    for module, code, label in PERMISSIONS:
        p, _ = Permission.objects.get_or_create(code=code, defaults={"label": label, "module": module})
        perm_by_code[code] = p

    # Roles
    for code, defaults in ROLE_DEFAULTS.items():
        Role.objects.get_or_create(code=code, defaults=defaults)

    # Mapeamentos
    for role_code, perm_codes in ROLE_PERMISSIONS.items():
        role = Role.objects.get(code=role_code)
        if perm_codes == "ALL":
            codes_to_assign = list(perm_by_code.keys())
        else:
            codes_to_assign = perm_codes
        for pc in codes_to_assign:
            RolePermission.objects.get_or_create(role=role, permission=perm_by_code[pc])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("authz", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, noop_reverse),
    ]
```

- [ ] **Step 6.4: Rodar migrations + testes**

Run:
```bash
python manage.py migrate authz
pytest apps/authz/tests/test_permissions.py -v
```

Expected: 8 testes PASS.

- [ ] **Step 6.5: Commit**

```bash
git add backend/core/apps/authz/
git commit -m "feat(authz): seed de Permissions + Roles + mapeamento default MVP"
```

---

## Task 7: `ItemOperation` (polimórfico Budget/OS) no app `items`

**Files:**
- Modify: `backend/core/apps/items/models.py`
- Create: `backend/core/apps/items/tests/test_item_operation.py`

> Nota: `ItemOperation` referencia `BudgetVersionItem` (Task 10) e `ServiceOrderVersionItem` (Task 9) com FK nullable. Aqui criamos sem as FKs funcionais — FKs serão populadas por migration subsequente via `string reference` (lazy loading Django).

- [ ] **Step 7.1: Adicionar `ItemOperation` ao models.py**

Edit `backend/core/apps/items/models.py` — **adicionar** no final:

```python
class ItemOperation(models.Model):
    """Operação aplicada a um item. Um item pode ter várias (TROCA + PINTURA + OVERLAP)."""

    item_budget = models.ForeignKey(
        "budgets.BudgetVersionItem",
        on_delete=models.CASCADE, null=True, blank=True, related_name="operations",
    )
    item_so = models.ForeignKey(
        "service_orders.ServiceOrderVersionItem",
        on_delete=models.CASCADE, null=True, blank=True, related_name="operations",
    )

    operation_type = models.ForeignKey(
        ItemOperationType, on_delete=models.PROTECT, related_name="operations",
    )
    labor_category = models.ForeignKey(
        LaborCategory, on_delete=models.PROTECT, related_name="operations",
    )

    hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    labor_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(item_budget__isnull=False, item_so__isnull=True)
                    | models.Q(item_budget__isnull=True, item_so__isnull=False)
                ),
                name="itemop_xor_parent",
            ),
        ]
```

- [ ] **Step 7.2: Gerar migration (vai falhar — FKs não existem ainda)**

Run:
```bash
python manage.py makemigrations items --name add_item_operation
```

Expected: pode reclamar de lazy refs `budgets.BudgetVersionItem` / `service_orders.ServiceOrderVersionItem`. Django aceita lazy strings nessa forma — a migration será criada mas a constraint real só valida quando os models referenciados existirem.

> ⚠️ Se Django bloquear: postergar Task 7 pra DEPOIS das Tasks 9 e 10. Adicionar nota "⚠ Ordem: executar Task 7 após 9 e 10". Neste plano mantemos a ordem atual assumindo lazy ref aceita; validar no desenvolvimento.

- [ ] **Step 7.3: NÃO rodar migrate ainda** (depende de apps `budgets` e `service_orders` com versions)

Pular `migrate` por ora. Vamos rodar tudo junto após Task 10.

- [ ] **Step 7.4: Commit (só models + migration)**

```bash
git add backend/core/apps/items/models.py backend/core/apps/items/migrations/
git commit -m "feat(items): ItemOperation com FK nullable polimórfica (budget/os)"
```

---

## Task 8: Criar model `Insurer` em `service_orders`

**Files:**
- Modify: `backend/core/apps/service_orders/models.py`

- [ ] **Step 8.1: Adicionar `Insurer` no topo do models.py**

Edit `backend/core/apps/service_orders/models.py` — adicionar ANTES de `ServiceOrder`:

```python
class Insurer(models.Model):
    """Catálogo de seguradoras reconhecidas pelo sistema."""

    IMPORT_SOURCES = [
        ("cilia_api", "Cilia API"),
        ("html_upload", "HTML Upload"),
        ("xml_upload", "XML Upload"),
    ]

    code = models.CharField(max_length=40, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    cnpj = models.CharField(max_length=18, blank=True, default="")
    import_source = models.CharField(max_length=20, choices=IMPORT_SOURCES, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
```

- [ ] **Step 8.2: Gerar migration e seed**

Run:
```bash
python manage.py makemigrations service_orders --name add_insurer
```

Create `backend/core/apps/service_orders/migrations/0003_seed_insurers.py`:

```python
from django.db import migrations


INSURERS = [
    ("yelum", "Yelum Seguradora", "cilia_api"),
    ("porto", "Porto Seguro", "xml_upload"),
    ("azul", "Azul Seguros", "xml_upload"),
    ("itau", "Itaú Seguros", "xml_upload"),
    ("hdi", "HDI Seguros", "html_upload"),
    ("mapfre", "Mapfre", "cilia_api"),
    ("tokio", "Tokio Marine", "cilia_api"),
    ("bradesco", "Bradesco Seguros", "cilia_api"),
    ("allianz", "Allianz", "cilia_api"),
    ("suhai", "Suhai", "cilia_api"),
]


def seed(apps, schema_editor):
    Insurer = apps.get_model("service_orders", "Insurer")
    for code, name, src in INSURERS:
        Insurer.objects.get_or_create(code=code, defaults={"name": name, "import_source": src})


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0002_add_insurer"),
    ]

    operations = [
        migrations.RunPython(seed, noop_reverse),
    ]
```

> ⚠️ Nome da migration 0002 depende do nome gerado por `makemigrations`. Verificar e ajustar se diferente.

- [ ] **Step 8.3: Rodar migrate**

Run:
```bash
python manage.py migrate service_orders
```

Expected: sem erros.

- [ ] **Step 8.4: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(service_orders): model Insurer + seed das 10 seguradoras principais"
```

---

## Task 9: Evoluir `ServiceOrder` + adicionar `ServiceOrderVersion` e `ServiceOrderVersionItem`

**Files:**
- Modify: `backend/core/apps/service_orders/models.py`
- Create: `backend/core/apps/service_orders/tests/__init__.py`
- Create: `backend/core/apps/service_orders/tests/test_models.py`

- [ ] **Step 9.1: Evoluir model `ServiceOrder`**

Edit `backend/core/apps/service_orders/models.py` — modificar `ServiceOrder` para:

```python
from decimal import Decimal

from django.db import models

from apps.items.mixins import ItemFieldsMixin
from apps.persons.models import Person


class Insurer(models.Model):
    # ... já criado na Task 8


class ServiceOrder(models.Model):
    """OS — particular OU seguradora. Kanban 15 estados."""

    CUSTOMER_TYPES = [("PARTICULAR", "Particular"), ("SEGURADORA", "Seguradora")]

    STATUS_CHOICES = [
        ("reception", "Recepção"),
        ("initial_survey", "Vistoria Inicial"),
        ("budget", "Orçamento (aprovação de versão)"),
        ("waiting_parts", "Aguardando Peças"),
        ("repair", "Reparo"),
        ("mechanic", "Mecânica"),
        ("bodywork", "Funilaria"),
        ("painting", "Pintura"),
        ("assembly", "Montagem"),
        ("polishing", "Polimento"),
        ("washing", "Lavagem"),
        ("final_survey", "Vistoria Final"),
        ("ready", "Pronto para Entrega"),
        ("delivered", "Entregue"),
        ("cancelled", "Cancelada"),
    ]

    os_number = models.CharField(max_length=20, unique=True, db_index=True)
    customer = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="service_orders")
    customer_type = models.CharField(max_length=12, choices=CUSTOMER_TYPES, default="PARTICULAR", db_index=True)

    vehicle_plate = models.CharField(max_length=10, db_index=True)
    vehicle_description = models.CharField(max_length=200)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="reception", db_index=True)
    previous_status = models.CharField(max_length=30, blank=True, default="")

    # Se particular, aponta pro Budget que originou
    source_budget = models.ForeignKey(
        "budgets.Budget", on_delete=models.PROTECT,
        null=True, blank=True, related_name="resulting_orders",
    )

    # Se seguradora
    insurer = models.ForeignKey(Insurer, on_delete=models.PROTECT, null=True, blank=True)
    casualty_number = models.CharField(max_length=40, blank=True, default="", db_index=True)
    external_budget_number = models.CharField(max_length=40, blank=True, default="")
    policy_number = models.CharField(max_length=40, blank=True, default="")
    policy_item = models.CharField(max_length=20, blank=True, default="")
    franchise_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))  # DEPRECATED: remover no Ciclo 2
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    legacy_databox_id = models.CharField(max_length=40, blank=True, default="", db_index=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["insurer", "casualty_number"],
                condition=models.Q(casualty_number__gt=""),
                name="uq_insurer_casualty",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.os_number} - {self.vehicle_plate}"

    @property
    def active_version(self) -> "ServiceOrderVersion | None":
        return self.versions.order_by("-version_number").first()
```

- [ ] **Step 9.2: Adicionar `ServiceOrderVersion` e `ServiceOrderVersionItem`**

Edit `backend/core/apps/service_orders/models.py` — adicionar DEPOIS de `ServiceOrder`:

```python
class ServiceOrderVersion(models.Model):
    """Snapshot imutável por versão. Particular: v1, v2, v3... Seguradora: espelha 821980.1 / .2."""

    STATUS_CHOICES = [
        ("pending", "Pendente"),
        ("approved", "Aprovada"),
        ("rejected", "Rejeitada"),
        ("analisado", "Analisado"),
        ("autorizado", "Autorizado"),
        ("correcao", "Em Correção"),
        ("em_analise", "Em Análise"),
        ("negado", "Negado"),
        ("superseded", "Superada"),
    ]

    SOURCE_CHOICES = [
        ("manual", "Manual"),
        ("budget_approval", "Da aprovação de Budget"),
        ("cilia", "Cilia API"),
        ("hdi", "HDI HTML"),
        ("xml_porto", "XML Porto"),
        ("xml_azul", "XML Azul"),
        ("xml_itau", "XML Itaú"),
    ]

    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="versions")
    version_number = models.IntegerField()

    external_version = models.CharField(max_length=40, blank=True, default="")
    external_numero_vistoria = models.CharField(max_length=60, blank=True, default="")
    external_integration_id = models.CharField(max_length=40, blank=True, default="")

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="manual")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    net_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    labor_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    parts_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    total_seguradora = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_complemento_particular = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_franquia = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    content_hash = models.CharField(max_length=64, blank=True, default="")
    raw_payload_s3_key = models.CharField(max_length=500, blank=True, default="")

    hourly_rates = models.JSONField(default=dict, blank=True)
    global_discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=120, blank=True, default="")
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("service_order", "version_number")]
        ordering = ["-version_number"]

    def __str__(self) -> str:
        return self.status_label

    @property
    def status_label(self) -> str:
        if self.external_version:
            return f"{self.external_version} — {self.get_status_display()}"
        return f"v{self.version_number} — {self.get_status_display()}"


class ServiceOrderVersionItem(ItemFieldsMixin):
    """Item da versão da OS. Imutável após aprovar."""

    version = models.ForeignKey(ServiceOrderVersion, on_delete=models.CASCADE, related_name="items")

    class Meta:
        ordering = ["sort_order", "id"]
```

- [ ] **Step 9.3: Gerar migration**

Run:
```bash
python manage.py makemigrations service_orders --name add_version_model
```

Expected: cria `apps/service_orders/migrations/0004_add_version_model.py` (ou próximo número).

- [ ] **Step 9.4: NÃO rodar migrate ainda — depende de `budgets` (Task 10) pro FK `source_budget`**

Verificar: a FK `source_budget` referencia `"budgets.Budget"` como lazy string — Django aceita e só valida no migrate. Podemos tentar migrar com `--dry-run`:

```bash
python manage.py migrate --plan
```

Se reclamar de `budgets` não registrado, vamos criar app (Task 10) antes.

- [ ] **Step 9.5: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(service_orders): evolução ServiceOrder + ServiceOrderVersion + ServiceOrderVersionItem"
```

---

## Task 10: Criar app `budgets` com `Budget` + `BudgetVersion` + `BudgetVersionItem`

**Files:**
- Create: `backend/core/apps/budgets/__init__.py`
- Create: `backend/core/apps/budgets/apps.py`
- Create: `backend/core/apps/budgets/models.py`
- Create: `backend/core/apps/budgets/tests/__init__.py`
- Create: `backend/core/apps/budgets/tests/test_models.py`
- Modify: `backend/core/config/settings.py`

- [ ] **Step 10.1: Estrutura do app**

```bash
mkdir -p backend/core/apps/budgets/tests backend/core/apps/budgets/migrations
touch backend/core/apps/budgets/__init__.py
touch backend/core/apps/budgets/tests/__init__.py
touch backend/core/apps/budgets/migrations/__init__.py
```

- [ ] **Step 10.2: AppConfig**

Create `backend/core/apps/budgets/apps.py`:

```python
from django.apps import AppConfig


class BudgetsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.budgets"
    verbose_name = "Orçamentos (Particular pré-OS)"
```

- [ ] **Step 10.3: Registrar no settings**

Edit `backend/core/config/settings.py` — `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ...
    "apps.items",
    "apps.authz",
    "apps.budgets",  # ← NOVO
]
```

- [ ] **Step 10.4: Models**

Create `backend/core/apps/budgets/models.py`:

```python
from decimal import Decimal

from django.db import models

from apps.items.mixins import ItemFieldsMixin
from apps.persons.models import Person


class Budget(models.Model):
    """Orçamento particular pré-OS. Nunca usado para seguradora (conforme design)."""

    number = models.CharField(max_length=20, unique=True, db_index=True)
    customer = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="budgets")

    vehicle_plate = models.CharField(max_length=10, db_index=True)
    vehicle_description = models.CharField(max_length=200)

    cloned_from = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="clones",
    )
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="source_budgets",
    )

    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.number} — {self.vehicle_plate}"

    @property
    def active_version(self) -> "BudgetVersion | None":
        return self.versions.order_by("-version_number").first()


class BudgetVersion(models.Model):
    """Snapshot imutável após 'sent'. Draft é mutável."""

    STATUS_CHOICES = [
        ("draft", "Rascunho"),
        ("sent", "Enviado ao cliente"),
        ("approved", "Aprovado"),
        ("rejected", "Rejeitado"),
        ("expired", "Expirado"),
        ("revision", "Em revisão"),
        ("superseded", "Superado"),
    ]

    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name="versions")
    version_number = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft", db_index=True)

    valid_until = models.DateTimeField(null=True, blank=True)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    net_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    labor_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    parts_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    content_hash = models.CharField(max_length=64, blank=True, default="")
    pdf_s3_key = models.CharField(max_length=500, blank=True, default="")

    created_by = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.CharField(max_length=120, blank=True, default="")
    approval_evidence_s3_key = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        unique_together = [("budget", "version_number")]
        ordering = ["-version_number"]

    def __str__(self) -> str:
        return self.status_label

    @property
    def status_label(self) -> str:
        return f"{self.budget.number} v{self.version_number} — {self.get_status_display()}"

    def is_frozen(self) -> bool:
        return self.status != "draft"


class BudgetVersionItem(ItemFieldsMixin):
    """Item da versão do Budget. Imutável após 'sent'."""

    version = models.ForeignKey(BudgetVersion, on_delete=models.CASCADE, related_name="items")

    class Meta:
        ordering = ["sort_order", "id"]
```

- [ ] **Step 10.5: Gerar migrations**

Run:
```bash
python manage.py makemigrations budgets
```

- [ ] **Step 10.6: Rodar migrate geral** (agora todas as apps estão registradas)

Run:
```bash
python manage.py migrate
```

Expected: aplica migrations de items (incluindo ItemOperation com suas FKs lazy), budgets, service_orders. Sem erros.

- [ ] **Step 10.7: Testes básicos de models**

Create `backend/core/apps/budgets/tests/test_models.py`:

```python
import pytest
from decimal import Decimal

from apps.budgets.models import Budget, BudgetVersion, BudgetVersionItem
from apps.persons.models import Person


@pytest.fixture
def person(db):
    return Person.objects.create(name="João Particular", document="12345678900")


@pytest.mark.django_db
class TestBudget:
    def test_create(self, person):
        b = Budget.objects.create(
            number="OR-000001", customer=person,
            vehicle_plate="ABC1D23", vehicle_description="Honda Fit 2019",
        )
        assert str(b) == "OR-000001 — ABC1D23"

    def test_active_version_initially_none(self, person):
        b = Budget.objects.create(
            number="OR-000002", customer=person,
            vehicle_plate="XYZ9Z99", vehicle_description="Fiat",
        )
        assert b.active_version is None


@pytest.mark.django_db
class TestBudgetVersion:
    def test_status_label(self, person):
        b = Budget.objects.create(
            number="OR-000010", customer=person,
            vehicle_plate="PQR1S23", vehicle_description="VW Up",
        )
        v = BudgetVersion.objects.create(budget=b, version_number=1, status="draft")
        assert v.status_label == "OR-000010 v1 — Rascunho"

    def test_is_frozen(self, person):
        b = Budget.objects.create(
            number="OR-000011", customer=person,
            vehicle_plate="PQR1S24", vehicle_description="VW Up",
        )
        draft = BudgetVersion.objects.create(budget=b, version_number=1, status="draft")
        sent = BudgetVersion.objects.create(budget=b, version_number=2, status="sent")

        assert draft.is_frozen() is False
        assert sent.is_frozen() is True

    def test_unique_version_per_budget(self, person):
        from django.db.utils import IntegrityError
        b = Budget.objects.create(
            number="OR-000012", customer=person,
            vehicle_plate="PQR1S25", vehicle_description="VW Up",
        )
        BudgetVersion.objects.create(budget=b, version_number=1)
        with pytest.raises(IntegrityError):
            BudgetVersion.objects.create(budget=b, version_number=1)


@pytest.mark.django_db
class TestBudgetVersionItem:
    def test_create_part_item(self, person):
        b = Budget.objects.create(
            number="OR-000020", customer=person,
            vehicle_plate="ABC1D23", vehicle_description="Honda",
        )
        v = BudgetVersion.objects.create(budget=b, version_number=1)

        item = BudgetVersionItem.objects.create(
            version=v,
            description="AMORTECEDOR DIANT ESQ",
            external_code="543035RA1C",
            part_type="ORIGINAL",
            quantity=Decimal("1"),
            unit_price=Decimal("625.00"),
            net_price=Decimal("625.00"),
            item_type="PART",
        )
        assert item.description == "AMORTECEDOR DIANT ESQ"
        assert item.payer_block == "PARTICULAR"  # default do mixin
```

- [ ] **Step 10.8: Rodar testes**

Run:
```bash
pytest apps/budgets/tests/test_models.py -v
```

Expected: 5 testes PASS.

- [ ] **Step 10.9: Commit**

```bash
git add backend/core/apps/budgets/ backend/core/config/settings.py
git commit -m "feat(budgets): app budgets com Budget + BudgetVersion + BudgetVersionItem"
```

---

## Task 11: `ServiceOrderEvent` + data migration do `ServiceOrderStatusHistory`

**Files:**
- Modify: `backend/core/apps/service_orders/models.py`
- Create: `backend/core/apps/service_orders/tests/test_data_migration.py`

- [ ] **Step 11.1: Adicionar `ServiceOrderEvent` ao models.py**

Edit `backend/core/apps/service_orders/models.py` — adicionar NO FINAL:

```python
class ServiceOrderEvent(models.Model):
    """Timeline universal de mutações. Substitui ServiceOrderStatusHistory."""

    EVENT_TYPES = [
        ("STATUS_CHANGE", "Mudança de status"),
        ("AUTO_TRANSITION", "Transição automática"),
        ("VERSION_CREATED", "Nova versão criada"),
        ("VERSION_APPROVED", "Versão aprovada"),
        ("VERSION_REJECTED", "Versão rejeitada"),
        ("ITEM_ADDED", "Item adicionado"),
        ("ITEM_REMOVED", "Item removido"),
        ("ITEM_EDITED", "Item editado"),
        ("IMPORT_RECEIVED", "Importação recebida"),
        ("PARECER_ADDED", "Parecer adicionado"),
        ("PHOTO_UPLOADED", "Foto anexada"),
        ("PHOTO_REMOVED", "Foto removida"),
        ("PAYMENT_RECORDED", "Pagamento registrado"),
        ("FISCAL_ISSUED", "Nota fiscal emitida"),
        ("SIGNATURE_CAPTURED", "Assinatura capturada"),
        ("BUDGET_LINKED", "Budget aprovado virou OS"),
    ]

    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES, db_index=True)

    actor = models.CharField(max_length=120, blank=True, default="Sistema")
    payload = models.JSONField(default=dict, blank=True)

    from_state = models.CharField(max_length=30, blank=True, default="")
    to_state = models.CharField(max_length=30, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service_order", "-created_at"]),
            models.Index(fields=["event_type", "-created_at"]),
        ]
```

- [ ] **Step 11.2: Gerar migration schema**

Run:
```bash
python manage.py makemigrations service_orders --name add_event_model
```

- [ ] **Step 11.3: Criar data migration — copia status_history → events**

Create `backend/core/apps/service_orders/migrations/0006_migrate_status_history_to_events.py` (ajustar número conforme makemigrations):

```python
from django.db import migrations


def copy_history(apps, schema_editor):
    """Converte ServiceOrderStatusHistory existentes em ServiceOrderEvent(event_type=STATUS_CHANGE)."""
    SOStatusHistory = apps.get_model("service_orders", "ServiceOrderStatusHistory")
    SOEvent = apps.get_model("service_orders", "ServiceOrderEvent")

    events = []
    for h in SOStatusHistory.objects.all().iterator():
        events.append(SOEvent(
            service_order=h.service_order,
            event_type="STATUS_CHANGE",
            actor=h.changed_by or "Sistema",
            payload={"notes": h.notes},
            from_state=h.from_status,
            to_state=h.to_status,
            created_at=h.changed_at,
        ))
    if events:
        SOEvent.objects.bulk_create(events, batch_size=500)


def reverse_copy(apps, schema_editor):
    SOEvent = apps.get_model("service_orders", "ServiceOrderEvent")
    SOEvent.objects.filter(event_type="STATUS_CHANGE").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0005_add_event_model"),  # ⚠ ajustar nome
    ]

    operations = [
        migrations.RunPython(copy_history, reverse_copy),
    ]
```

> ⚠️ Ajustar o número das dependências conforme as migrations realmente geradas (0002, 0003, 0004, 0005 podem variar). Rode `ls backend/core/apps/service_orders/migrations/` pra conferir.

- [ ] **Step 11.4: Teste da data migration**

Create `backend/core/apps/service_orders/tests/test_data_migration.py`:

```python
import pytest
from django.db import connection
from django.utils import timezone

from apps.persons.models import Person
from apps.service_orders.models import ServiceOrder, ServiceOrderEvent, ServiceOrderStatusHistory


@pytest.mark.django_db
class TestMigrationStatusHistoryToEvents:

    def test_history_is_copied_to_events(self):
        person = Person.objects.create(name="Test", document="11122233344")
        os = ServiceOrder.objects.create(
            os_number="OS-000001", customer=person,
            vehicle_plate="ABC1D23", vehicle_description="Test",
        )
        h = ServiceOrderStatusHistory.objects.create(
            service_order=os, from_status="reception", to_status="initial_survey",
            changed_by="alice", notes="first move",
        )

        # O test simula a data migration executando a função diretamente
        from apps.service_orders.migrations import \
            migrate_status_history_to_events as m  # import ajustável
        # ou chamar call_command para migrate específico se preferir.
        # Neste MVP: validar que new events foram criados após migrate real.
        event = ServiceOrderEvent.objects.filter(service_order=os).first()
        # Esta asserção só é válida após a data migration rodar (CI/migrate):
        if event:
            assert event.event_type == "STATUS_CHANGE"
            assert event.from_state == "reception"
            assert event.to_state == "initial_survey"
```

> ⚠️ Este teste é ilustrativo — a data migration roda uma vez só. Para testar corretamente, usar `django_db_use_migrations=True` + fixture que cria ServiceOrderStatusHistory ANTES da migration. Marcar como `@pytest.mark.slow` e executar manualmente na primeira implantação.

- [ ] **Step 11.5: Rodar migrate**

Run:
```bash
python manage.py migrate
```

Expected: aplica migration schema + data migration (vazia se sem histórico).

- [ ] **Step 11.6: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(service_orders): ServiceOrderEvent + data migration do status_history"
```

---

## Task 12: `ServiceOrderParecer` + `ImpactAreaLabel`

**Files:**
- Modify: `backend/core/apps/service_orders/models.py`

- [ ] **Step 12.1: Adicionar models**

Edit `backend/core/apps/service_orders/models.py` — adicionar NO FINAL:

```python
class ServiceOrderParecer(models.Model):
    """Timeline de workflow/pareceres. Externo (importado) + interno (DSCar)."""

    PARECER_TYPE_CHOICES = [
        ("CONCORDADO", "Concordado"),
        ("AUTORIZADO", "Autorizado"),
        ("CORRECAO", "Correção"),
        ("NEGADO", "Negado"),
        ("SEM_COBERTURA", "Sem Cobertura"),
        ("COMENTARIO_INTERNO", "Comentário Interno"),
    ]

    SOURCE_CHOICES = [
        ("internal", "Interno DSCar"),
        ("cilia", "Cilia"),
        ("hdi", "HDI"),
        ("xml_porto", "XML Porto"),
        ("xml_azul", "XML Azul"),
        ("xml_itau", "XML Itaú"),
    ]

    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="pareceres")
    version = models.ForeignKey(
        ServiceOrderVersion, on_delete=models.CASCADE,
        null=True, blank=True, related_name="pareceres",
    )

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    flow_number = models.IntegerField(null=True, blank=True)

    author_external = models.CharField(max_length=120, blank=True, default="")
    author_org = models.CharField(max_length=120, blank=True, default="")
    author_internal = models.CharField(max_length=120, blank=True, default="")

    parecer_type = models.CharField(max_length=30, choices=PARECER_TYPE_CHOICES, blank=True, default="")
    body = models.TextField()

    created_at_external = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ImpactAreaLabel(models.Model):
    """Label opcional das áreas de impacto (1 = Frontal, 2 = Lateral direita, ...)."""

    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="area_labels")
    area_number = models.IntegerField()
    label_text = models.CharField(max_length=100)

    class Meta:
        unique_together = [("service_order", "area_number")]
        ordering = ["area_number"]
```

- [ ] **Step 12.2: Migration**

Run:
```bash
python manage.py makemigrations service_orders --name add_parecer_and_area_label
python manage.py migrate
```

- [ ] **Step 12.3: Testes**

Create/append em `backend/core/apps/service_orders/tests/test_models.py`:

```python
import pytest
from apps.persons.models import Person
from apps.service_orders.models import (
    ServiceOrder, ServiceOrderVersion, ServiceOrderParecer, ImpactAreaLabel,
)


@pytest.fixture
def os_instance(db):
    p = Person.objects.create(name="Test", document="99988877766")
    return ServiceOrder.objects.create(
        os_number="OS-000100", customer=p,
        vehicle_plate="ABC1D23", vehicle_description="Honda",
    )


@pytest.mark.django_db
class TestParecer:
    def test_create_internal(self, os_instance):
        p = ServiceOrderParecer.objects.create(
            service_order=os_instance,
            source="internal",
            author_internal="alice",
            parecer_type="COMENTARIO_INTERNO",
            body="Cliente ligou pedindo atualização",
        )
        assert p.source == "internal"


@pytest.mark.django_db
class TestImpactAreaLabel:
    def test_unique_area_per_os(self, os_instance):
        from django.db.utils import IntegrityError
        ImpactAreaLabel.objects.create(service_order=os_instance, area_number=1, label_text="Frontal")
        with pytest.raises(IntegrityError):
            ImpactAreaLabel.objects.create(service_order=os_instance, area_number=1, label_text="Outro")
```

- [ ] **Step 12.4: Rodar testes**

Run:
```bash
pytest apps/service_orders/tests/test_models.py -v
```

Expected: passa.

- [ ] **Step 12.5: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(service_orders): ServiceOrderParecer + ImpactAreaLabel"
```

---

## Task 13: Data migration — criar `ServiceOrderVersion` v1 pra OS existentes

**Files:**
- Create: `backend/core/apps/service_orders/migrations/0008_create_v1_for_existing_os.py`

> Esta migration converte o `total_value` legado em um `ServiceOrderVersion` v1 com 0 itens e net_total = total_value. Preserva dados existentes.

- [ ] **Step 13.1: Criar data migration**

Create (ajustar número conforme makemigrations sequence):

```python
from decimal import Decimal

from django.db import migrations


def backfill_v1(apps, schema_editor):
    ServiceOrder = apps.get_model("service_orders", "ServiceOrder")
    ServiceOrderVersion = apps.get_model("service_orders", "ServiceOrderVersion")

    for os in ServiceOrder.objects.all().iterator():
        if os.versions.exists():
            continue
        ServiceOrderVersion.objects.create(
            service_order=os,
            version_number=1,
            source="manual",
            status="approved" if os.status != "cancelled" else "rejected",
            net_total=os.total_value or Decimal("0"),
            subtotal=os.total_value or Decimal("0"),
            created_by="Sistema (migração 0.1)",
        )


def reverse_backfill(apps, schema_editor):
    # Remove apenas versions marcadas como "migração 0.1"
    ServiceOrderVersion = apps.get_model("service_orders", "ServiceOrderVersion")
    ServiceOrderVersion.objects.filter(created_by="Sistema (migração 0.1)").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0007_add_parecer_and_area_label"),  # ⚠ ajustar
    ]

    operations = [
        migrations.RunPython(backfill_v1, reverse_backfill),
    ]
```

- [ ] **Step 13.2: Rodar migrate**

Run:
```bash
python manage.py migrate
```

Expected: se não há OS em banco, migration é no-op. Se há, popula versions.

- [ ] **Step 13.3: Teste da backfill**

Append em `backend/core/apps/service_orders/tests/test_data_migration.py`:

```python
@pytest.mark.django_db
class TestBackfillV1:
    def test_existing_os_get_v1(self):
        """Validação manual: após migrate, toda OS existente tem v1."""
        from apps.service_orders.models import ServiceOrder
        for os in ServiceOrder.objects.all():
            assert os.versions.count() >= 1, f"OS {os.os_number} sem version"
```

Run:
```bash
pytest apps/service_orders/tests/test_data_migration.py -v
```

- [ ] **Step 13.4: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(service_orders): data migration cria v1 pra OSes legadas"
```

---

## Task 14: Admin básico (opcional mas recomendado — facilita debug)

**Files:**
- Create: `backend/core/apps/items/admin.py`
- Create: `backend/core/apps/authz/admin.py`
- Create: `backend/core/apps/budgets/admin.py`
- Modify: `backend/core/apps/service_orders/admin.py`

- [ ] **Step 14.1: Admin do app items**

Create `backend/core/apps/items/admin.py`:

```python
from django.contrib import admin

from .models import ItemOperationType, LaborCategory, NumberSequence, ItemOperation


@admin.register(ItemOperationType)
class ItemOperationTypeAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "sort_order", "is_active")
    search_fields = ("code", "label")
    list_filter = ("is_active",)


@admin.register(LaborCategory)
class LaborCategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "sort_order", "is_active")
    search_fields = ("code", "label")


@admin.register(NumberSequence)
class NumberSequenceAdmin(admin.ModelAdmin):
    list_display = ("sequence_type", "prefix", "next_number", "padding")
    readonly_fields = ("next_number",)  # evita edição manual


@admin.register(ItemOperation)
class ItemOperationAdmin(admin.ModelAdmin):
    list_display = ("id", "operation_type", "labor_category", "hours", "labor_cost")
    list_filter = ("operation_type", "labor_category")
```

- [ ] **Step 14.2: Admin do app authz**

Create `backend/core/apps/authz/admin.py`:

```python
from django.contrib import admin

from .models import Permission, Role, RolePermission, UserRole, UserPermission


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "module")
    list_filter = ("module",)
    search_fields = ("code", "label")


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 0


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "permissions_count")
    inlines = [RolePermissionInline]

    def permissions_count(self, obj):
        return obj.permissions.count()


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role")
    list_filter = ("role",)


@admin.register(UserPermission)
class UserPermissionAdmin(admin.ModelAdmin):
    list_display = ("user", "permission", "granted")
    list_filter = ("granted",)
```

- [ ] **Step 14.3: Admin do app budgets**

Create `backend/core/apps/budgets/admin.py`:

```python
from django.contrib import admin

from .models import Budget, BudgetVersion, BudgetVersionItem


class BudgetVersionInline(admin.TabularInline):
    model = BudgetVersion
    extra = 0
    readonly_fields = ("version_number", "status", "net_total", "created_at")
    can_delete = False


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ("number", "customer", "vehicle_plate", "created_at")
    search_fields = ("number", "vehicle_plate", "customer__name")
    inlines = [BudgetVersionInline]


@admin.register(BudgetVersion)
class BudgetVersionAdmin(admin.ModelAdmin):
    list_display = ("budget", "version_number", "status", "net_total", "valid_until")
    list_filter = ("status",)


@admin.register(BudgetVersionItem)
class BudgetVersionItemAdmin(admin.ModelAdmin):
    list_display = ("description", "item_type", "quantity", "net_price")
    list_filter = ("item_type", "payer_block", "bucket")
```

- [ ] **Step 14.4: Admin do app service_orders (append)**

Edit `backend/core/apps/service_orders/admin.py` (se não existir, criar):

```python
from django.contrib import admin

from .models import (
    Insurer, ServiceOrder, ServiceOrderVersion, ServiceOrderVersionItem,
    ServiceOrderEvent, ServiceOrderParecer, ImpactAreaLabel,
)


@admin.register(Insurer)
class InsurerAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "import_source", "is_active")
    list_filter = ("import_source", "is_active")


class ServiceOrderVersionInline(admin.TabularInline):
    model = ServiceOrderVersion
    extra = 0
    readonly_fields = ("version_number", "status", "net_total", "source", "created_at")
    can_delete = False


@admin.register(ServiceOrder)
class ServiceOrderAdmin(admin.ModelAdmin):
    list_display = ("os_number", "customer_type", "customer", "vehicle_plate", "status", "insurer")
    list_filter = ("customer_type", "status", "insurer")
    search_fields = ("os_number", "vehicle_plate", "casualty_number")
    inlines = [ServiceOrderVersionInline]


@admin.register(ServiceOrderVersion)
class ServiceOrderVersionAdmin(admin.ModelAdmin):
    list_display = ("service_order", "version_number", "external_version", "status", "net_total", "source")
    list_filter = ("status", "source")
    search_fields = ("external_version", "service_order__os_number")


@admin.register(ServiceOrderVersionItem)
class ServiceOrderVersionItemAdmin(admin.ModelAdmin):
    list_display = ("description", "item_type", "payer_block", "quantity", "net_price")
    list_filter = ("item_type", "payer_block", "bucket")


@admin.register(ServiceOrderEvent)
class ServiceOrderEventAdmin(admin.ModelAdmin):
    list_display = ("service_order", "event_type", "actor", "from_state", "to_state", "created_at")
    list_filter = ("event_type",)
    search_fields = ("service_order__os_number",)
    readonly_fields = ("service_order", "event_type", "actor", "payload",
                        "from_state", "to_state", "created_at")


@admin.register(ServiceOrderParecer)
class ServiceOrderParecerAdmin(admin.ModelAdmin):
    list_display = ("service_order", "source", "parecer_type", "author_external", "created_at")
    list_filter = ("source", "parecer_type")


@admin.register(ImpactAreaLabel)
class ImpactAreaLabelAdmin(admin.ModelAdmin):
    list_display = ("service_order", "area_number", "label_text")
```

- [ ] **Step 14.5: Validar admin**

Run:
```bash
python manage.py runserver
```

Acessar `http://localhost:8000/admin/` e navegar pelos menus. Todos os models devem aparecer agrupados pelos apps.

- [ ] **Step 14.6: Commit**

```bash
git add backend/core/apps/
git commit -m "feat(admin): registrar models novos no Django admin para debug"
```

---

## Task 15: Smoke test final + atualizar MVP_CHECKLIST

**Files:**
- Modify: `backend/core/MVP_CHECKLIST.md`
- Create: `backend/core/scripts/smoke_foundation.py` (útil pra validar após migrate em novo ambiente)

- [ ] **Step 15.1: Script smoke test**

Create `backend/core/scripts/smoke_foundation.py`:

```python
"""Smoke test do Ciclo 01 — Foundation.

Valida que:
- Tabelas de referência foram seedadas
- NumberAllocator funciona
- É possível criar Budget + BudgetVersion + BudgetVersionItem + ItemOperation
- É possível criar ServiceOrder + ServiceOrderVersion + ItemOperation

Uso: python manage.py shell < scripts/smoke_foundation.py
"""
from decimal import Decimal

from apps.authz.models import Role, Permission
from apps.budgets.models import Budget, BudgetVersion, BudgetVersionItem
from apps.items.models import ItemOperationType, LaborCategory, ItemOperation, NumberSequence
from apps.items.services import NumberAllocator
from apps.persons.models import Person
from apps.service_orders.models import (
    Insurer, ServiceOrder, ServiceOrderVersion, ServiceOrderVersionItem,
    ServiceOrderEvent,
)


def check(cond: bool, msg: str) -> None:
    status = "✅" if cond else "❌"
    print(f"{status} {msg}")
    assert cond, msg


def main():
    print("=== Smoke Test Ciclo 01 — Foundation ===\n")

    # Seeds
    check(ItemOperationType.objects.count() >= 7, "ItemOperationType seed (>=7)")
    check(LaborCategory.objects.count() >= 9, "LaborCategory seed (>=9)")
    check(Role.objects.count() >= 6, "Role seed (>=6)")
    check(Permission.objects.count() >= 18, "Permission seed (>=18)")
    check(NumberSequence.objects.count() == 2, "NumberSequence seed (2)")
    check(Insurer.objects.count() >= 10, "Insurer seed (>=10)")

    # Number allocator
    n1 = NumberAllocator.allocate("BUDGET")
    n2 = NumberAllocator.allocate("BUDGET")
    check(n1.startswith("OR-") and n2.startswith("OR-"), f"Alloc BUDGET: {n1}, {n2}")

    # Budget completo
    person, _ = Person.objects.get_or_create(name="Smoke Test", document="11122233344")
    b = Budget.objects.create(
        number=NumberAllocator.allocate("BUDGET"),
        customer=person, vehicle_plate="SMK1234", vehicle_description="Smoke",
    )
    v = BudgetVersion.objects.create(budget=b, version_number=1)
    i = BudgetVersionItem.objects.create(
        version=v, description="AMORTECEDOR TESTE",
        quantity=Decimal("1"), unit_price=Decimal("500"), net_price=Decimal("500"),
    )
    ItemOperation.objects.create(
        item_budget=i,
        operation_type=ItemOperationType.objects.get(code="TROCA"),
        labor_category=LaborCategory.objects.get(code="FUNILARIA"),
        hours=Decimal("1.00"), hourly_rate=Decimal("40"),
        labor_cost=Decimal("40"),
    )
    check(b.active_version.items.count() == 1, "Budget com 1 item")
    check(i.operations.count() == 1, "Item com 1 operation")

    # ServiceOrder seguradora
    yelum = Insurer.objects.get(code="yelum")
    os = ServiceOrder.objects.create(
        os_number=NumberAllocator.allocate("SERVICE_ORDER"),
        customer=person, customer_type="SEGURADORA",
        vehicle_plate="SEG1234", vehicle_description="Seg",
        insurer=yelum, casualty_number="SMK-99999",
        external_budget_number="999999",
    )
    sv = ServiceOrderVersion.objects.create(
        service_order=os, version_number=1, source="cilia",
        external_version="999999.1", status="autorizado",
    )
    svi = ServiceOrderVersionItem.objects.create(
        version=sv, description="PARA-CHOQUE SMK",
        payer_block="SEGURADORA", quantity=Decimal("1"),
        unit_price=Decimal("2000"), net_price=Decimal("2000"),
    )
    ItemOperation.objects.create(
        item_so=svi,
        operation_type=ItemOperationType.objects.get(code="TROCA"),
        labor_category=LaborCategory.objects.get(code="FUNILARIA"),
        hours=Decimal("1"), hourly_rate=Decimal("57"),
        labor_cost=Decimal("57"),
    )
    check(os.active_version.items.count() == 1, "OS seguradora com 1 item")
    check(svi.operations.count() == 1, "Item OS com 1 operation")

    # Event
    ServiceOrderEvent.objects.create(
        service_order=os, event_type="VERSION_CREATED", actor="smoke",
        payload={"version": 1},
    )
    check(os.events.count() == 1, "OS event criado")

    # Cleanup
    os.delete()
    b.delete()
    print("\n✅ Smoke test OK — Foundation ready.")


main()
```

- [ ] **Step 15.2: Executar smoke**

Run:
```bash
cd backend/core
python manage.py shell < scripts/smoke_foundation.py
```

Expected: todas as linhas com ✅.

- [ ] **Step 15.3: Atualizar MVP_CHECKLIST**

Edit `backend/core/MVP_CHECKLIST.md` — adicionar após a seção do ciclo 2:

```markdown
## Entregue no ciclo 3 — Módulo de Orçamentação (Foundation)

- [x] Apps Django novos: `items`, `authz`, `budgets`
- [x] Models de referência: `ItemOperationType`, `LaborCategory`, `NumberSequence`, `Insurer`
- [x] `ItemFieldsMixin` abstract compartilhado entre Budget e OS
- [x] `ItemOperation` polimórfica (FK nullable Budget/OS)
- [x] `Budget` + `BudgetVersion` + `BudgetVersionItem`
- [x] Evolução de `ServiceOrder` (customer_type, source_budget, insurer, casualty, franquia)
- [x] `ServiceOrderVersion` + `ServiceOrderVersionItem`
- [x] `ServiceOrderEvent` (timeline universal)
- [x] `ServiceOrderParecer` + `ImpactAreaLabel`
- [x] Data migration `ServiceOrderStatusHistory` → `ServiceOrderEvent`
- [x] Seeds: operation types, labor categories, insurers (10), permissions (18), roles (6)
- [x] `NumberAllocator` atômico (SELECT FOR UPDATE)
- [x] `user_has_perm()` helper com precedência override
- [x] Admin registrado pra debug
- [x] Smoke test `scripts/smoke_foundation.py`

## Próximo ciclo — Core services (Ciclo 2)

- [ ] `BudgetService` — create, send, approve, reject, revision, clone, expire
- [ ] `ServiceOrderService` — create_from_budget, change_status, create_new_version_from_import, approve_version
- [ ] `ComplementoParticularService`
- [ ] `PaymentService`
- [ ] `OSEventLogger` com helper centralizado
- [ ] Testes de services (>= 40 casos cobrindo transitions, approval, trava delivery)
```

- [ ] **Step 15.4: Rodar suite completa**

Run:
```bash
pytest apps/ -v --tb=short
```

Expected: todos os testes PASS.

- [ ] **Step 15.5: Commit final**

```bash
git add backend/core/scripts/ backend/core/MVP_CHECKLIST.md
git commit -m "chore(ciclo-01): smoke test foundation + checklist atualizado"
```

---

## Verificação final do ciclo

- [ ] **Checklist de conclusão** (marque cada um antes de passar pro Ciclo 2):
  - [ ] `pytest apps/` roda tudo PASS
  - [ ] `python manage.py migrate --check` diz "No migrations to apply"
  - [ ] `python manage.py shell < scripts/smoke_foundation.py` termina com ✅
  - [ ] Admin abre e mostra todas as novas entidades
  - [ ] `git status` clean
  - [ ] `git log --oneline` mostra 14 commits incrementais do ciclo

---

## Notas pro próximo ciclo (Ciclo 2 — Core services)

Arquivos que serão criados:
- `apps/budgets/services.py` — `BudgetService`
- `apps/service_orders/services.py` — evoluir `ServiceOrderService` (atual tem só `change_status`)
- `apps/service_orders/events.py` — `OSEventLogger`
- `apps/service_orders/kanban.py` — `VALID_TRANSITIONS` e helpers (mover do services.py atual)
- `apps/payments/models.py` + `services.py`

Dependências prontas após Ciclo 1:
- Models completos ✓
- Numeração atômica ✓
- Tabelas de referência ✓
- Event log model ✓

---

**Fim do Plano 01 — Foundation.** Próximo plano: `2026-04-20-ciclo-02-core-services.md` (a ser gerado após conclusão deste).
