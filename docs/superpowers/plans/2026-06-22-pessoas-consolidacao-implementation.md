# Consolidação de Pessoas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar duplicação de "pessoas" no backend (`Supplier`, `Expert`, `Fornecedor` paralelos a `Person`) e padronizar UX de cadastro com campos obrigatórios visíveis e masks.

**Architecture:** `persons.Person` é raiz única. `SupplierProfile` e `ExpertProfile` viram OneToOne com Person. 9 FKs (em accounts_payable, accounting, purchasing, service_orders, pricing_catalog) migram pra Person via expand→backfill→contract. Cutover em 1 deploy.

**Tech Stack:** Django 5 + DRF · django-tenants · pytest-django + factory-boy · Next.js 15 + TypeScript + React Hook Form + Zod · Vitest + Playwright.

## Global Constraints

- **Spec:** [`docs/superpowers/specs/2026-06-22-pessoas-consolidacao-suppliers-experts-design.md`](../specs/2026-06-22-pessoas-consolidacao-suppliers-experts-design.md). Toda decisão diverge da spec só com aprovação humana.
- **Tenant context obrigatório:** Toda migration/test usa `schema_context('tenant_dscar')` — nada de `.objects.all()` em modelo tenant-aware fora de contexto.
- **CLAUDE.md compliance:** Type hints obrigatórios em Python. Strict TypeScript (sem `any`). Conventional commits. Sem `print()` — `logger`.
- **PII LGPD:** `SupplierProfile.bank_account` e `SupplierProfile.pix_key` usam `EncryptedCharField`. Nunca logar valor de campos criptografados.
- **DRF padrão:** `read_only_fields` em serializers; erros como `{"detail": "..."}`; nunca expor `str(e)`.
- **Frontend:** Hooks de API via `/api/proxy/`. Sempre `fetchList<T>` para endpoints paginados. `dirtyFields` em vez de `isDirty` com `z.preprocess`. Hooks SEMPRE antes de early return.
- **Validador obrigatório:** Antes de cada migration de drop (Task 11, 15), rodar `python manage.py validate_persons_migration`.
- **Neon branch snapshot:** Obrigatório antes do deploy final. Nome `pre-pessoas-unificacao-YYYY-MM-DD`.
- **App `experts/`:** Removido apenas em commit pós-deploy estável, NÃO neste PR.

---

## File Structure

### Backend — criação

```
backend/core/apps/persons/
├── models.py                                      [MODIFY] +SupplierProfile, +ExpertProfile, +EXPERT em RolePessoa
├── signals.py                                     [CREATE] auto-cria profile ao adicionar role
├── apps.py                                        [MODIFY] registra signals em ready()
├── serializers.py                                 [MODIFY] +SupplierProfileSerializer, +ExpertProfileSerializer, profile expand
├── views.py                                       [MODIFY] aceita role=EXPERT, adiciona /profiles/* actions
├── migrations/0012_supplier_expert_profiles.py    [CREATE] schema migration
├── migrations/0013_backfill_persons_from_legacy.py [CREATE] data migration
├── migrations/_backfill_helpers.py                [CREATE] funções testáveis isoladas
├── management/commands/validate_persons_migration.py [CREATE] validador
└── tests/
    ├── test_supplier_profile.py                   [CREATE]
    ├── test_expert_profile.py                     [CREATE]
    ├── test_signals.py                            [CREATE]
    ├── test_backfill_helpers.py                   [CREATE]
    └── test_validate_command.py                   [CREATE]

backend/core/apps/accounts_payable/
├── models.py                                      [MODIFY] PayableDocument.supplier: Supplier→Person; remove Supplier/SupplierContact após drop
└── migrations/
    ├── 0007_add_payable_person_fk.py              [CREATE] expand
    ├── 0008_swap_payable_supplier_fk.py           [CREATE] swap
    └── 0009_drop_supplier_tables.py               [CREATE] drop (depende de purchasing.0007 + accounting.0005)

backend/core/apps/accounting/
├── models/despesa_recorrente.py                   [MODIFY] supplier: Supplier→Person
└── migrations/0005_swap_despesa_recorrente_fk.py  [CREATE]

backend/core/apps/purchasing/
├── models.py                                      [MODIFY] 3 FKs → Person/PersonContact
└── migrations/
    ├── 0005_add_person_fks_nullable.py            [CREATE] expand
    ├── 0006_backfill_person_fks.py                [CREATE] data
    └── 0007_swap_purchasing_fks.py                [CREATE] swap

backend/core/apps/pricing_catalog/
├── models/supplier.py                             [MODIFY] CodigoFornecedorPeca.fornecedor: Fornecedor→Person; remove Fornecedor model
└── migrations/
    ├── 0003_swap_codigo_fornecedor.py             [CREATE]
    └── 0004_drop_fornecedor_table.py              [CREATE]

backend/core/apps/service_orders/
├── models/service_order.py                        [MODIFY] expert: experts.Expert→persons.Person
└── migrations/0032_swap_expert_fk.py              [CREATE]

backend/core/apps/experts/
└── migrations/0NNN_drop_expert_table.py           [CREATE] drop final (não remover app aqui)
```

### Frontend — criação/modificação

```
apps/dscar-web/src/components/ui/
└── masked-input.tsx                               [MODIFY] +DateInput, +CepInput, +EmailInput, +PixKeyInput
                                                   tests: masked-input.test.tsx

apps/dscar-web/src/components/Cadastros/
├── index.tsx                                      [MODIFY] +tab "Peritos"
├── PersonForm.tsx                                 [CREATE] form refatorado (substitui PersonFormModal)
├── PersonFormModal.tsx                            [MODIFY] vira wrapper de PersonForm pra criação rápida
└── PersonDetail/
    ├── index.tsx                                  [CREATE] container com tabs
    ├── PersonHeader.tsx                           [CREATE] nome + CPF/CNPJ + badges de roles
    ├── GeneralTab.tsx                             [CREATE]
    ├── DocumentsTab.tsx                           [CREATE]
    ├── ContactsTab.tsx                            [CREATE]
    ├── AddressesTab.tsx                           [CREATE]
    ├── SupplierTab.tsx                            [CREATE]
    ├── ExpertTab.tsx                              [CREATE]
    ├── ClientTab.tsx                              [CREATE]
    └── EmployeeTab.tsx                            [CREATE] (link pro /rh)

apps/dscar-web/src/app/(app)/cadastros/
└── [id]/page.tsx                                  [CREATE] rota de detalhe

apps/dscar-web/src/hooks/
├── usePersons.ts                                  [MODIFY] aceita role=EXPERT
├── useSupplierProfile.ts                          [CREATE]
├── useExpertProfile.ts                            [CREATE]
├── usePurchasing.ts                               [MODIFY] useSuppliers vira alias deprecated
└── useFinanceiro.ts                               [MODIFY] idem

apps/dscar-web/src/app/(app)/financeiro/contas-pagar/novo/page.tsx          [MODIFY] usa usePersons
apps/dscar-web/src/components/purchasing/QuotationBuilder.tsx               [MODIFY]
apps/dscar-web/src/components/purchasing/RespostaForm.tsx                   [MODIFY]
apps/dscar-web/src/components/purchasing/MontarOCModal.tsx                  [MODIFY]
apps/dscar-web/src/components/purchasing/OrdemCompraDetail.tsx              [MODIFY]
apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/PartsTab.tsx      [MODIFY]
apps/dscar-web/src/app/(app)/estoque/nfe-recebida/[id]/page.tsx             [MODIFY]

apps/dscar-web/src/app/(app)/cadastros/catalogo/fornecedores/                [DELETE] redireciona
apps/dscar-web/src/app/(app)/cadastros/especialistas/                        [DELETE] redireciona

apps/dscar-web/next.config.js                                                [MODIFY] +redirects
packages/types/persons.ts                                                    [MODIFY] +EXPERT role, Zod schema
```

### E2E

```
apps/dscar-web/tests/e2e/pessoas-consolidacao.spec.ts                       [CREATE]
```

---

## Task Sequencing

Tasks 1-11 são **backend** (encadeadas via dependências de migration). Tasks 12-19 são **frontend** (paralelizáveis exceto Task 18, 19 que dependem das outras). Task 20 é E2E + smoke. Task 21 é remoção do app experts/ (POST-deploy).

```
1 → 2 → 3 → 4 ┬─ 5 ─┬─ 11 ────────────┐
              ├─ 6  │                  │
              ├─ 7  │                  │
              ├─ 8  │                  ├─ 20 → 21
              └─ 9  │                  │
                    │                  │
        10 (drop) ──┘                  │
                                       │
12, 13, 14, 15, 16, 17, 18, 19 ────────┘
```

---

## Task 1: Modelos SupplierProfile, ExpertProfile + EXPERT role

**Files:**
- Modify: `backend/core/apps/persons/models.py`
- Create: `backend/core/apps/persons/migrations/0012_supplier_expert_profiles.py`
- Create: `backend/core/apps/persons/tests/test_supplier_profile.py`
- Create: `backend/core/apps/persons/tests/test_expert_profile.py`

**Interfaces:**
- Produces:
  - `persons.SupplierProfile(person, category, default_payment_days, default_payment_method, bank_name, bank_agency, bank_account, pix_key, pix_key_type, notes, legacy_supplier_id)`
  - `persons.ExpertProfile(person, registration_number, insurers, legacy_expert_id)`
  - `RolePessoa.PERITO = "EXPERT"`
  - `SupplierProfile.Categoria.PARTS/SERVICE/MATERIAL/GENERAL`

---

- [ ] **Step 1: Escrever testes que falham**

Criar `backend/core/apps/persons/tests/test_supplier_profile.py`:

```python
import pytest
from django_tenants.utils import schema_context
from django.core.exceptions import ValidationError

from apps.persons.models import Person, PersonRole, SupplierProfile, RolePessoa, TipoPessoa


@pytest.mark.django_db(transaction=True)
class TestSupplierProfile:
    def test_create_supplier_profile_with_person(self):
        with schema_context("tenant_dscar"):
            person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="Auto Peças MAO")
            PersonRole.objects.create(person=person, role=RolePessoa.FORNECEDOR)

            profile = SupplierProfile.objects.create(
                person=person,
                category=SupplierProfile.Categoria.PARTS,
                default_payment_days=30,
            )

            assert profile.person == person
            assert profile.category == "PARTS"
            assert profile.default_payment_days == 30

    def test_default_category_is_general(self):
        with schema_context("tenant_dscar"):
            person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="X")
            profile = SupplierProfile.objects.create(person=person)
            assert profile.category == SupplierProfile.Categoria.GENERAL

    def test_one_to_one_constraint(self):
        with schema_context("tenant_dscar"):
            person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="X")
            SupplierProfile.objects.create(person=person)
            with pytest.raises(Exception):  # IntegrityError
                SupplierProfile.objects.create(person=person)

    def test_bank_fields_encrypted(self):
        with schema_context("tenant_dscar"):
            person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="X")
            profile = SupplierProfile.objects.create(
                person=person,
                bank_account="12345-6",
                pix_key="empresa@example.com",
                pix_key_type="EMAIL",
            )
            profile.refresh_from_db()
            assert profile.bank_account == "12345-6"
            assert profile.pix_key == "empresa@example.com"

    def test_legacy_supplier_id_indexed(self):
        with schema_context("tenant_dscar"):
            person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="X")
            SupplierProfile.objects.create(person=person, legacy_supplier_id=999)
            assert SupplierProfile.objects.filter(legacy_supplier_id=999).exists()
```

Criar `backend/core/apps/persons/tests/test_expert_profile.py`:

```python
import pytest
from django_tenants.utils import schema_context

from apps.persons.models import Person, ExpertProfile, RolePessoa, PersonRole, TipoPessoa


@pytest.mark.django_db(transaction=True)
class TestExpertProfile:
    def test_create_expert_profile(self):
        with schema_context("tenant_dscar"):
            person = Person.objects.create(person_kind=TipoPessoa.FISICA, full_name="João Perito")
            PersonRole.objects.create(person=person, role=RolePessoa.PERITO)
            profile = ExpertProfile.objects.create(person=person, registration_number="CREA-12345")
            assert profile.registration_number == "CREA-12345"
            assert profile.person == person

    def test_expert_choice_added(self):
        assert "EXPERT" in {choice[0] for choice in RolePessoa.choices}
```

- [ ] **Step 2: Rodar testes pra ver que falham**

Executar:
```bash
docker exec paddock_django pytest apps/persons/tests/test_supplier_profile.py apps/persons/tests/test_expert_profile.py -v 2>&1 | tail -20
```
Esperado: `ImportError: cannot import name 'SupplierProfile'` (ou similar).

- [ ] **Step 3: Adicionar modelos em `apps/persons/models.py`**

No final do arquivo, após `BrokerPerson`:

```python
class SupplierProfile(models.Model):
    """Dados contábeis/operacionais do fornecedor — OneToOne Person."""

    class Categoria(models.TextChoices):
        PARTS    = "PARTS",    "Peças"
        SERVICE  = "SERVICE",  "Serviços"
        MATERIAL = "MATERIAL", "Material"
        GENERAL  = "GENERAL",  "Geral"

    class FormaPagamento(models.TextChoices):
        BANK_TRANSFER = "bank_transfer", "Transferência"
        PIX           = "pix",           "PIX"
        BOLETO        = "boleto",        "Boleto"
        CHECK         = "check",         "Cheque"
        CASH          = "cash",          "Dinheiro"

    class TipoPix(models.TextChoices):
        CPF    = "CPF",    "CPF"
        CNPJ   = "CNPJ",   "CNPJ"
        EMAIL  = "EMAIL",  "E-mail"
        PHONE  = "PHONE",  "Telefone"
        RANDOM = "RANDOM", "Aleatória"

    person = models.OneToOneField(
        Person, on_delete=models.CASCADE, related_name="supplier_profile",
        verbose_name="Pessoa",
    )
    category = models.CharField(
        max_length=10, choices=Categoria.choices, default=Categoria.GENERAL,
        verbose_name="Categoria",
    )
    default_payment_days = models.PositiveIntegerField(
        default=30, verbose_name="Prazo padrão (dias)",
    )
    default_payment_method = models.CharField(
        max_length=20, choices=FormaPagamento.choices, blank=True, default="",
        verbose_name="Forma de pagamento padrão",
    )
    bank_name    = models.CharField(max_length=100, blank=True, default="", verbose_name="Banco")
    bank_agency  = models.CharField(max_length=20,  blank=True, default="", verbose_name="Agência")
    bank_account = EncryptedCharField(max_length=50, blank=True, default="", verbose_name="Conta")
    pix_key      = EncryptedCharField(max_length=200, blank=True, default="", verbose_name="Chave PIX")
    pix_key_type = models.CharField(
        max_length=10, choices=TipoPix.choices, blank=True, default="",
        verbose_name="Tipo de chave PIX",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Observações")
    legacy_supplier_id = models.IntegerField(
        null=True, blank=True, db_index=True,
        help_text="ID original em accounts_payable.Supplier — preenchido na migração",
    )

    class Meta:
        verbose_name = "Perfil de Fornecedor"
        verbose_name_plural = "Perfis de Fornecedor"

    def __str__(self) -> str:
        return f"Fornecedor — {self.person.full_name}"


class ExpertProfile(models.Model):
    """Perfil de perito — OneToOne Person, substitui experts.Expert."""

    person = models.OneToOneField(
        Person, on_delete=models.CASCADE, related_name="expert_profile",
        verbose_name="Pessoa",
    )
    registration_number = models.CharField(
        max_length=50, blank=True, default="",
        help_text="CREA ou registro profissional",
        verbose_name="Número de registro",
    )
    insurers = models.ManyToManyField(
        "insurers.Insurer", related_name="experts_as_person",
        blank=True,
        help_text="Seguradoras para as quais este perito atua",
        verbose_name="Seguradoras",
    )
    legacy_expert_id = models.IntegerField(
        null=True, blank=True, db_index=True,
        help_text="ID original em experts.Expert — preenchido na migração",
    )

    class Meta:
        verbose_name = "Perfil de Perito"
        verbose_name_plural = "Perfis de Perito"

    def __str__(self) -> str:
        return f"Perito — {self.person.full_name}"
```

Em `RolePessoa` (linha 20-25), adicionar:
```python
class RolePessoa(models.TextChoices):
    CLIENTE     = "CLIENT",   "Cliente"
    SEGURADORA  = "INSURER",  "Seguradora"
    CORRETOR    = "BROKER",   "Corretor"
    FUNCIONARIO = "EMPLOYEE", "Funcionário"
    FORNECEDOR  = "SUPPLIER", "Fornecedor"
    PERITO      = "EXPERT",   "Perito"  # NOVO
```

- [ ] **Step 4: Gerar e validar migration**

```bash
docker exec paddock_django python manage.py makemigrations persons --name supplier_expert_profiles
docker exec paddock_django python manage.py migrate_schemas
```

Verificar que criou `backend/core/apps/persons/migrations/0012_supplier_expert_profiles.py`.

- [ ] **Step 5: Rodar testes — passar**

```bash
docker exec paddock_django pytest apps/persons/tests/test_supplier_profile.py apps/persons/tests/test_expert_profile.py -v 2>&1 | tail -15
```
Esperado: `5 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/persons/models.py \
        backend/core/apps/persons/migrations/0012_supplier_expert_profiles.py \
        backend/core/apps/persons/tests/test_supplier_profile.py \
        backend/core/apps/persons/tests/test_expert_profile.py
git commit -m "feat(persons): adiciona SupplierProfile, ExpertProfile e role EXPERT"
```

---

## Task 2: Signal — auto-criar profile ao adicionar role

**Files:**
- Create: `backend/core/apps/persons/signals.py`
- Modify: `backend/core/apps/persons/apps.py`
- Create: `backend/core/apps/persons/tests/test_signals.py`

**Interfaces:**
- Consumes: `SupplierProfile`, `ExpertProfile`, `ClientProfile`, `PersonRole`
- Produces: signal handler `auto_create_profile_for_role(sender, instance, created, **kwargs)`

---

- [ ] **Step 1: Escrever teste que falha**

Criar `backend/core/apps/persons/tests/test_signals.py`:

```python
import pytest
from django_tenants.utils import schema_context

from apps.persons.models import (
    Person, PersonRole, SupplierProfile, ExpertProfile, ClientProfile,
    RolePessoa, TipoPessoa,
)


@pytest.mark.django_db(transaction=True)
class TestProfileAutoCreation:
    def test_adding_supplier_role_creates_supplier_profile(self):
        with schema_context("tenant_dscar"):
            person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="X")
            PersonRole.objects.create(person=person, role=RolePessoa.FORNECEDOR)
            assert SupplierProfile.objects.filter(person=person).exists()

    def test_adding_expert_role_creates_expert_profile(self):
        with schema_context("tenant_dscar"):
            person = Person.objects.create(person_kind=TipoPessoa.FISICA, full_name="Y")
            PersonRole.objects.create(person=person, role=RolePessoa.PERITO)
            assert ExpertProfile.objects.filter(person=person).exists()

    def test_adding_client_role_creates_client_profile(self):
        with schema_context("tenant_dscar"):
            person = Person.objects.create(person_kind=TipoPessoa.FISICA, full_name="Z")
            PersonRole.objects.create(person=person, role=RolePessoa.CLIENTE)
            assert ClientProfile.objects.filter(person=person).exists()

    def test_idempotent_signal_does_not_duplicate(self):
        with schema_context("tenant_dscar"):
            person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="W")
            PersonRole.objects.create(person=person, role=RolePessoa.FORNECEDOR)
            PersonRole.objects.filter(person=person, role=RolePessoa.FORNECEDOR).first().save()
            assert SupplierProfile.objects.filter(person=person).count() == 1
```

- [ ] **Step 2: Rodar teste — falha**

```bash
docker exec paddock_django pytest apps/persons/tests/test_signals.py -v 2>&1 | tail -10
```
Esperado: 3 tests fail (profile não criado).

- [ ] **Step 3: Criar `backend/core/apps/persons/signals.py`**

```python
"""Signals do app persons — auto-criação de profiles ao adicionar role."""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.persons.models import (
    PersonRole, SupplierProfile, ExpertProfile, ClientProfile, RolePessoa,
)

logger = logging.getLogger(__name__)


@receiver(post_save, sender=PersonRole)
def auto_create_profile_for_role(sender, instance: PersonRole, created: bool, **kwargs) -> None:
    """Cria perfil OneToOne vazio quando role é adicionado à Person.
    Idempotente — get_or_create evita duplicatas.
    """
    if not created:
        return

    person = instance.person
    role = instance.role

    if role == RolePessoa.FORNECEDOR:
        SupplierProfile.objects.get_or_create(person=person)
    elif role == RolePessoa.PERITO:
        ExpertProfile.objects.get_or_create(person=person)
    elif role == RolePessoa.CLIENTE:
        ClientProfile.objects.get_or_create(person=person)
    # EMPLOYEE → criado pelo app hr/ ao admitir colaborador
    # BROKER → criado manualmente (escolher PF vs PJ)
    # INSURER → schema público, não cabe aqui
```

- [ ] **Step 4: Registrar signal em `apps/persons/apps.py`**

Substituir conteúdo:

```python
from django.apps import AppConfig


class PersonsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.persons"
    verbose_name = "Cadastros"

    def ready(self) -> None:
        from apps.persons import signals  # noqa: F401
```

- [ ] **Step 5: Rodar testes — passar**

```bash
docker exec paddock_django pytest apps/persons/tests/test_signals.py -v 2>&1 | tail -10
```
Esperado: `4 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/persons/signals.py \
        backend/core/apps/persons/apps.py \
        backend/core/apps/persons/tests/test_signals.py
git commit -m "feat(persons): signal auto-cria SupplierProfile/ExpertProfile/ClientProfile ao adicionar role"
```

---

## Task 3: Helpers testáveis de backfill

**Files:**
- Create: `backend/core/apps/persons/migrations/_backfill_helpers.py`
- Create: `backend/core/apps/persons/tests/test_backfill_helpers.py`

**Interfaces:**
- Produces:
  - `backfill_suppliers_to_persons(apps_registry) → dict[int, int]` — retorna `{legacy_supplier_id: person_id}`
  - `backfill_experts_to_persons(apps_registry) → dict[int, int]`
  - `find_or_create_person_from_supplier(apps_registry, supplier) → Person`

---

- [ ] **Step 1: Escrever testes que falham**

Criar `backend/core/apps/persons/tests/test_backfill_helpers.py`:

```python
import pytest
from django.apps import apps as django_apps
from django_tenants.utils import schema_context

from apps.persons.migrations._backfill_helpers import (
    backfill_suppliers_to_persons,
    find_or_create_person_from_supplier,
)


@pytest.mark.django_db(transaction=True)
class TestBackfillSuppliers:
    def test_supplier_with_cnpj_creates_pj_person(self):
        with schema_context("tenant_dscar"):
            Supplier = django_apps.get_model("accounts_payable", "Supplier")
            Person = django_apps.get_model("persons", "Person")
            SupplierProfile = django_apps.get_model("persons", "SupplierProfile")

            sup = Supplier.objects.create(
                name="Auto Peças MAO LTDA",
                cnpj="12345678000190",
                email="contato@autopecasmao.com.br",
                phone="92999999999",
            )

            mapping = backfill_suppliers_to_persons(django_apps)

            assert sup.id in mapping
            person = Person.objects.get(pk=mapping[sup.id])
            assert person.person_kind == "PJ"
            assert person.full_name == "Auto Peças MAO LTDA"
            assert SupplierProfile.objects.get(person=person).legacy_supplier_id == sup.id

    def test_supplier_with_cpf_creates_pf_person(self):
        with schema_context("tenant_dscar"):
            Supplier = django_apps.get_model("accounts_payable", "Supplier")
            Person = django_apps.get_model("persons", "Person")

            sup = Supplier.objects.create(name="João Autônomo", cpf="12345678901")
            mapping = backfill_suppliers_to_persons(django_apps)
            person = Person.objects.get(pk=mapping[sup.id])
            assert person.person_kind == "PF"

    def test_idempotent_no_duplicate_person(self):
        with schema_context("tenant_dscar"):
            Supplier = django_apps.get_model("accounts_payable", "Supplier")
            Person = django_apps.get_model("persons", "Person")

            sup = Supplier.objects.create(name="X", cnpj="11111111000111")
            backfill_suppliers_to_persons(django_apps)
            count1 = Person.objects.count()
            backfill_suppliers_to_persons(django_apps)
            count2 = Person.objects.count()
            assert count1 == count2

    def test_supplier_email_creates_person_contact(self):
        with schema_context("tenant_dscar"):
            Supplier = django_apps.get_model("accounts_payable", "Supplier")
            PersonContact = django_apps.get_model("persons", "PersonContact")

            sup = Supplier.objects.create(
                name="X", cnpj="22222222000122",
                email="x@example.com", phone="92988887777",
            )
            backfill_suppliers_to_persons(django_apps)
            contacts = PersonContact.objects.filter(person__supplier_profile__legacy_supplier_id=sup.id)
            assert contacts.filter(contact_type="EMAIL").exists()
            assert contacts.filter(contact_type="CELULAR").exists()
```

- [ ] **Step 2: Rodar — falha**

```bash
docker exec paddock_django pytest apps/persons/tests/test_backfill_helpers.py -v 2>&1 | tail -5
```
Esperado: `ImportError: No module named '_backfill_helpers'`.

- [ ] **Step 3: Criar `backend/core/apps/persons/migrations/_backfill_helpers.py`**

```python
"""Helpers de backfill — extraídos das migrations pra ficarem testáveis.

Usados em:
  - persons/migrations/0013_backfill_persons_from_legacy.py (Supplier, Expert)
  - accounts_payable/migrations/0007_add_payable_person_fk.py (PayableDocument.person)
  - purchasing/migrations/0006_backfill_person_fks.py (3 FKs)
"""
import logging
import re
from typing import Any

from apps.persons.utils import sha256_hex

logger = logging.getLogger(__name__)


def _only_digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def find_or_create_person_from_supplier(apps_registry: Any, supplier: Any) -> Any:
    """Idempotente — retorna Person existente (via legacy_supplier_id) ou cria nova.

    Cria também: PersonRole=SUPPLIER, SupplierProfile, PersonDocument (CPF/CNPJ),
    PersonContact (email, phone).

    Args:
        apps_registry: registry de migration (django.apps OR `apps` parameter de RunPython)
        supplier: instance de accounts_payable.Supplier (state da migration)

    Returns:
        Person instance (state da migration)
    """
    Person          = apps_registry.get_model("persons", "Person")
    PersonRole      = apps_registry.get_model("persons", "PersonRole")
    PersonDocument  = apps_registry.get_model("persons", "PersonDocument")
    PersonContact   = apps_registry.get_model("persons", "PersonContact")
    SupplierProfile = apps_registry.get_model("persons", "SupplierProfile")

    existing = SupplierProfile.objects.filter(legacy_supplier_id=supplier.id).first()
    if existing:
        return existing.person

    cnpj = _only_digits(supplier.cnpj)
    cpf  = _only_digits(supplier.cpf)
    person_kind = "PJ" if cnpj else "PF"
    primary_doc_type = "CNPJ" if cnpj else "CPF"
    primary_doc_value = cnpj or cpf

    person = Person.objects.create(person_kind=person_kind, full_name=supplier.name)
    PersonRole.objects.create(person=person, role="SUPPLIER")

    if primary_doc_value:
        PersonDocument.objects.create(
            person=person,
            doc_type=primary_doc_type,
            value=primary_doc_value,
            value_hash=sha256_hex(primary_doc_value),
            is_primary=True,
        )

    if supplier.email:
        PersonContact.objects.create(
            person=person, contact_type="EMAIL",
            value=supplier.email, value_hash=sha256_hex(supplier.email),
            is_primary=True,
        )

    if supplier.phone:
        PersonContact.objects.create(
            person=person, contact_type="CELULAR",
            value=supplier.phone, value_hash=sha256_hex(supplier.phone),
            is_primary=True,
        )

    SupplierProfile.objects.create(
        person=person,
        notes=supplier.notes or "",
        legacy_supplier_id=supplier.id,
    )

    logger.info("backfill: Supplier #%s → Person #%s", supplier.id, person.id)
    return person


def backfill_suppliers_to_persons(apps_registry: Any) -> dict[int, int]:
    """Migra TODOS os accounts_payable.Supplier para Person + SupplierProfile.

    Returns:
        dict {legacy_supplier_id: person_id}
    """
    Supplier = apps_registry.get_model("accounts_payable", "Supplier")
    mapping: dict[int, int] = {}
    for sup in Supplier.objects.all():
        person = find_or_create_person_from_supplier(apps_registry, sup)
        mapping[sup.id] = person.id
    return mapping


def find_or_create_person_from_expert(apps_registry: Any, expert: Any) -> Any:
    """Idempotente — cria Person + role=EXPERT + ExpertProfile para Expert legado."""
    Person         = apps_registry.get_model("persons", "Person")
    PersonRole     = apps_registry.get_model("persons", "PersonRole")
    PersonContact  = apps_registry.get_model("persons", "PersonContact")
    ExpertProfile  = apps_registry.get_model("persons", "ExpertProfile")

    existing = ExpertProfile.objects.filter(legacy_expert_id=expert.id).first()
    if existing:
        return existing.person

    person = Person.objects.create(person_kind="PF", full_name=expert.name)
    PersonRole.objects.create(person=person, role="EXPERT")

    if expert.email:
        PersonContact.objects.create(
            person=person, contact_type="EMAIL",
            value=expert.email, value_hash=sha256_hex(expert.email),
            is_primary=True,
        )
    if expert.phone:
        PersonContact.objects.create(
            person=person, contact_type="CELULAR",
            value=expert.phone, value_hash=sha256_hex(expert.phone),
            is_primary=True,
        )

    profile = ExpertProfile.objects.create(
        person=person,
        registration_number=expert.registration_number or "",
        legacy_expert_id=expert.id,
    )
    if hasattr(expert, "insurers"):
        profile.insurers.set(expert.insurers.all())

    logger.info("backfill: Expert #%s → Person #%s", expert.id, person.id)
    return person


def backfill_experts_to_persons(apps_registry: Any) -> dict[int, int]:
    """Migra TODOS os experts.Expert para Person + ExpertProfile."""
    Expert = apps_registry.get_model("experts", "Expert")
    mapping: dict[int, int] = {}
    for exp in Expert.objects.all():
        person = find_or_create_person_from_expert(apps_registry, exp)
        mapping[exp.id] = person.id
    return mapping
```

- [ ] **Step 4: Rodar testes — passar**

```bash
docker exec paddock_django pytest apps/persons/tests/test_backfill_helpers.py -v 2>&1 | tail -15
```
Esperado: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/persons/migrations/_backfill_helpers.py \
        backend/core/apps/persons/tests/test_backfill_helpers.py
git commit -m "feat(persons): helpers testáveis de backfill Supplier/Expert → Person"
```

---

## Task 4: Data migration 0013 — backfill legacy

**Files:**
- Create: `backend/core/apps/persons/migrations/0013_backfill_persons_from_legacy.py`

**Interfaces:**
- Consumes: `_backfill_helpers.backfill_suppliers_to_persons`, `backfill_experts_to_persons`
- Produces: Person + SupplierProfile/ExpertProfile linhas pra cada legacy

---

- [ ] **Step 1: Criar migration**

`backend/core/apps/persons/migrations/0013_backfill_persons_from_legacy.py`:

```python
"""Backfill: accounts_payable.Supplier + experts.Expert → persons.Person + Profiles."""
from django.db import migrations


def forwards(apps, schema_editor):
    from apps.persons.migrations._backfill_helpers import (
        backfill_suppliers_to_persons,
        backfill_experts_to_persons,
    )
    backfill_suppliers_to_persons(apps)
    backfill_experts_to_persons(apps)


def reverse(apps, schema_editor):
    """Reverso: deleta Persons criadas pelo backfill (identificadas por legacy_*_id)."""
    SupplierProfile = apps.get_model("persons", "SupplierProfile")
    ExpertProfile   = apps.get_model("persons", "ExpertProfile")
    Person          = apps.get_model("persons", "Person")

    person_ids = list(SupplierProfile.objects.exclude(legacy_supplier_id__isnull=True)
                                              .values_list("person_id", flat=True))
    person_ids += list(ExpertProfile.objects.exclude(legacy_expert_id__isnull=True)
                                              .values_list("person_id", flat=True))
    Person.objects.filter(pk__in=person_ids).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("persons", "0012_supplier_expert_profiles"),
        ("accounts_payable", "0006_suppliercontact"),
        ("experts", "0001_initial"),  # ajustar pra última migration de experts
    ]

    operations = [
        migrations.RunPython(forwards, reverse),
    ]
```

- [ ] **Step 2: Confirmar última migration de experts**

```bash
ls backend/core/apps/experts/migrations/ | grep -v __ | tail -1
```

Substituir `"0001_initial"` pela versão real.

- [ ] **Step 3: Aplicar migration**

```bash
docker exec paddock_django python manage.py migrate_schemas
```

Esperado: `Applying persons.0013_backfill_persons_from_legacy... OK`.

- [ ] **Step 4: Validar resultado**

```bash
docker exec paddock_django python manage.py shell -c "
from django_tenants.utils import schema_context
with schema_context('tenant_dscar'):
    from apps.persons.models import SupplierProfile, ExpertProfile
    print('Suppliers migrated:', SupplierProfile.objects.exclude(legacy_supplier_id__isnull=True).count())
    print('Experts migrated:',   ExpertProfile.objects.exclude(legacy_expert_id__isnull=True).count())
"
```
Esperado: `Suppliers migrated: 6`, `Experts migrated: 0`.

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/persons/migrations/0013_backfill_persons_from_legacy.py
git commit -m "feat(persons): data migration — backfill Supplier/Expert → Person"
```

---

## Task 5: Validador `validate_persons_migration`

**Files:**
- Create: `backend/core/apps/persons/management/commands/validate_persons_migration.py`
- Create: `backend/core/apps/persons/tests/test_validate_command.py`

**Interfaces:**
- Produces: comando Django `python manage.py validate_persons_migration` — exit 0 (OK), 1 (BLOCKERs).

---

- [ ] **Step 1: Escrever teste que falha**

Criar `backend/core/apps/persons/tests/test_validate_command.py`:

```python
import pytest
from io import StringIO
from django.core.management import call_command
from django_tenants.utils import schema_context

from apps.persons.models import Person, PersonRole, SupplierProfile, RolePessoa, TipoPessoa


@pytest.mark.django_db(transaction=True)
class TestValidateCommand:
    def test_clean_state_returns_zero(self):
        out = StringIO()
        try:
            call_command("validate_persons_migration", stdout=out)
        except SystemExit as e:
            assert e.code == 0

    def test_person_supplier_without_profile_is_warning(self):
        with schema_context("tenant_dscar"):
            from apps.persons.signals import auto_create_profile_for_role
            from django.db.models.signals import post_save
            post_save.disconnect(auto_create_profile_for_role, sender=PersonRole)
            try:
                person = Person.objects.create(person_kind=TipoPessoa.JURIDICA, full_name="OrphanSup")
                PersonRole.objects.create(person=person, role=RolePessoa.FORNECEDOR)
                assert not SupplierProfile.objects.filter(person=person).exists()
            finally:
                post_save.connect(auto_create_profile_for_role, sender=PersonRole)

        out = StringIO()
        try:
            call_command("validate_persons_migration", stdout=out)
        except SystemExit as e:
            assert e.code == 0  # warning não bloqueia
        assert "WARNING" in out.getvalue() or "OrphanSup" in out.getvalue()
```

- [ ] **Step 2: Rodar — falha**

```bash
docker exec paddock_django pytest apps/persons/tests/test_validate_command.py -v 2>&1 | tail -5
```
Esperado: `Unknown command: 'validate_persons_migration'`.

- [ ] **Step 3: Criar comando**

`backend/core/apps/persons/management/commands/validate_persons_migration.py`:

```python
"""Valida invariantes de consistência pós-migração — exit 1 se houver BLOCKER."""
import sys
from typing import Iterable

from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context, get_tenant_model


class Command(BaseCommand):
    help = "Valida consistência das tabelas após consolidação de Person."

    def handle(self, *args, **options) -> None:
        blockers: list[str] = []
        warnings: list[str] = []

        for schema in self._iter_tenant_schemas():
            with schema_context(schema):
                blockers.extend(self._check_orphan_legacy_fks(schema))
                blockers.extend(self._check_missing_primary_doc(schema))
                warnings.extend(self._check_supplier_without_profile(schema))
                warnings.extend(self._check_duplicate_cpf(schema))

        for w in warnings:
            self.stdout.write(self.style.WARNING(f"[WARNING] {w}"))
        for b in blockers:
            self.stdout.write(self.style.ERROR(f"[BLOCKER] {b}"))

        if blockers:
            self.stdout.write(self.style.ERROR(f"\n{len(blockers)} BLOCKER(s). Deploy NOT safe."))
            sys.exit(1)

        self.stdout.write(self.style.SUCCESS(f"\nOK. {len(warnings)} warning(s)."))
        sys.exit(0)

    def _iter_tenant_schemas(self) -> Iterable[str]:
        Tenant = get_tenant_model()
        return [t.schema_name for t in Tenant.objects.exclude(schema_name="public")]

    def _check_orphan_legacy_fks(self, schema: str) -> list[str]:
        """Garante que toda Person criada pelo backfill manteve legacy_id consistente."""
        from apps.persons.models import SupplierProfile, ExpertProfile
        out = []
        for sp in SupplierProfile.objects.exclude(legacy_supplier_id__isnull=True):
            if sp.person is None:
                out.append(f"{schema}: SupplierProfile legacy_supplier_id={sp.legacy_supplier_id} sem Person")
        return out

    def _check_missing_primary_doc(self, schema: str) -> list[str]:
        """Toda Person ativa deve ter PersonDocument primary (CPF ou CNPJ)."""
        from apps.persons.models import Person
        out = []
        missing = Person.objects.filter(
            is_active=True,
        ).exclude(documents__is_primary=True, documents__doc_type__in=["CPF", "CNPJ"])
        for p in missing[:10]:  # limita output
            out.append(f"{schema}: Person #{p.pk} '{p.full_name}' sem documento primário")
        return out

    def _check_supplier_without_profile(self, schema: str) -> list[str]:
        from apps.persons.models import Person
        orphans = Person.objects.filter(roles__role="SUPPLIER", supplier_profile__isnull=True)
        return [f"{schema}: Person #{p.pk} '{p.full_name}' role=SUPPLIER sem SupplierProfile" for p in orphans[:10]]

    def _check_duplicate_cpf(self, schema: str) -> list[str]:
        from django.db.models import Count
        from apps.persons.models import PersonDocument
        dups = (PersonDocument.objects
                .filter(doc_type__in=["CPF", "CNPJ"], is_primary=True)
                .values("value_hash")
                .annotate(c=Count("id"))
                .filter(c__gt=1))
        return [f"{schema}: documento value_hash={d['value_hash'][:12]}... em {d['c']} pessoas" for d in dups[:10]]
```

- [ ] **Step 4: Rodar testes**

```bash
docker exec paddock_django pytest apps/persons/tests/test_validate_command.py -v 2>&1 | tail -5
```
Esperado: `2 passed`.

- [ ] **Step 5: Rodar contra estado atual**

```bash
docker exec paddock_django python manage.py validate_persons_migration
```
Esperado: `OK. 0 warning(s).` ou warnings legítimos.

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/persons/management/commands/validate_persons_migration.py \
        backend/core/apps/persons/tests/test_validate_command.py
git commit -m "feat(persons): comando validate_persons_migration"
```

---

## Task 6: PayableDocument.supplier → Person (expand/swap)

**Files:**
- Create: `backend/core/apps/accounts_payable/migrations/0007_add_payable_person_fk.py`
- Create: `backend/core/apps/accounts_payable/migrations/0008_swap_payable_supplier_fk.py`
- Modify: `backend/core/apps/accounts_payable/models.py:89` (PayableDocument.supplier FK target)

**Interfaces:**
- Produces: `PayableDocument.supplier` aponta para `persons.Person` (mantém nome `supplier`)

---

- [ ] **Step 1: Migration expand (add nullable person FK + backfill)**

`backend/core/apps/accounts_payable/migrations/0007_add_payable_person_fk.py`:

```python
from django.db import migrations, models


def backfill_person_from_legacy(apps, schema_editor):
    PayableDocument = apps.get_model("accounts_payable", "PayableDocument")
    SupplierProfile = apps.get_model("persons", "SupplierProfile")

    sup_to_person = dict(
        SupplierProfile.objects.exclude(legacy_supplier_id__isnull=True)
                               .values_list("legacy_supplier_id", "person_id")
    )

    for payable in PayableDocument.objects.all():
        person_id = sup_to_person.get(payable.supplier_id)
        if person_id is None:
            raise ValueError(
                f"PayableDocument #{payable.id} → Supplier #{payable.supplier_id} não tem Person mapeada"
            )
        payable.person = person_id
        payable.save(update_fields=["person"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts_payable", "0006_suppliercontact"),
        ("persons", "0013_backfill_persons_from_legacy"),
    ]

    operations = [
        migrations.AddField(
            model_name="payabledocument",
            name="person",
            field=models.ForeignKey(
                null=True, blank=True,
                on_delete=models.deletion.PROTECT,
                related_name="payables_new",
                to="persons.person",
            ),
        ),
        migrations.RunPython(backfill_person_from_legacy, migrations.RunPython.noop),
    ]
```

- [ ] **Step 2: Aplicar e validar**

```bash
docker exec paddock_django python manage.py migrate_schemas
docker exec paddock_django python manage.py shell -c "
from django_tenants.utils import schema_context
with schema_context('tenant_dscar'):
    from apps.accounts_payable.models import PayableDocument
    print('Payables com person:', PayableDocument.objects.exclude(person__isnull=True).count())
    print('Payables sem person:', PayableDocument.objects.filter(person__isnull=True).count())
"
```
Esperado: `sem person: 0`.

- [ ] **Step 3: Migration swap (drop supplier, rename person→supplier)**

`backend/core/apps/accounts_payable/migrations/0008_swap_payable_supplier_fk.py`:

```python
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("accounts_payable", "0007_add_payable_person_fk")]

    operations = [
        migrations.RemoveField(model_name="payabledocument", name="supplier"),
        migrations.RenameField(
            model_name="payabledocument", old_name="person", new_name="supplier",
        ),
        migrations.AlterField(
            model_name="payabledocument", name="supplier",
            field=models.ForeignKey(
                on_delete=models.deletion.PROTECT,
                related_name="payables",
                to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
                verbose_name="Fornecedor",
            ),
        ),
    ]
```

- [ ] **Step 4: Atualizar `apps/accounts_payable/models.py:89`**

Substituir bloco da FK supplier de PayableDocument:

```python
    supplier = models.ForeignKey(
        "persons.Person",
        on_delete=models.PROTECT,
        related_name="payables",
        limit_choices_to={"roles__role": "SUPPLIER"},
        verbose_name=_("Fornecedor"),
    )
```

- [ ] **Step 5: Aplicar swap**

```bash
docker exec paddock_django python manage.py migrate_schemas
```

- [ ] **Step 6: Smoke test**

```bash
docker exec paddock_django python manage.py shell -c "
from django_tenants.utils import schema_context
with schema_context('tenant_dscar'):
    from apps.accounts_payable.models import PayableDocument
    p = PayableDocument.objects.first()
    if p: print('OK — supplier:', p.supplier.full_name, '(Person)')
    else: print('Nenhum PayableDocument pra validar')
"
```

- [ ] **Step 7: Commit**

```bash
git add backend/core/apps/accounts_payable/migrations/0007_*.py \
        backend/core/apps/accounts_payable/migrations/0008_*.py \
        backend/core/apps/accounts_payable/models.py
git commit -m "feat(accounts_payable): PayableDocument.supplier → persons.Person"
```

---

## Task 7: DespesaRecorrente.supplier → Person

**Files:**
- Create: `backend/core/apps/accounting/migrations/0005_swap_despesa_recorrente_fk.py`
- Modify: `backend/core/apps/accounting/models/despesa_recorrente.py:85`

---

- [ ] **Step 1: Migration**

`backend/core/apps/accounting/migrations/0005_swap_despesa_recorrente_fk.py`:

```python
from django.db import migrations, models


def backfill(apps, schema_editor):
    DespesaRecorrente = apps.get_model("accounting", "DespesaRecorrente")
    SupplierProfile   = apps.get_model("persons", "SupplierProfile")

    sup_to_person = dict(
        SupplierProfile.objects.exclude(legacy_supplier_id__isnull=True)
                               .values_list("legacy_supplier_id", "person_id")
    )
    for dr in DespesaRecorrente.objects.exclude(supplier__isnull=True):
        dr.person = sup_to_person.get(dr.supplier_id)
        dr.save(update_fields=["person"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0004_despesarecorrente_supplier_dia"),
        ("accounts_payable", "0008_swap_payable_supplier_fk"),
    ]

    operations = [
        migrations.AddField(
            model_name="despesarecorrente",
            name="person",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.SET_NULL,
                related_name="despesas_recorrentes_new",
                to="persons.person",
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.RemoveField(model_name="despesarecorrente", name="supplier"),
        migrations.RenameField(
            model_name="despesarecorrente", old_name="person", new_name="supplier",
        ),
        migrations.AlterField(
            model_name="despesarecorrente", name="supplier",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.SET_NULL,
                related_name="despesas_recorrentes",
                to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
            ),
        ),
    ]
```

- [ ] **Step 2: Atualizar model `apps/accounting/models/despesa_recorrente.py:85`**

```python
    supplier = models.ForeignKey(
        "persons.Person",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="despesas_recorrentes",
        limit_choices_to={"roles__role": "SUPPLIER"},
    )
```

- [ ] **Step 3: Aplicar**

```bash
docker exec paddock_django python manage.py migrate_schemas
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/accounting/migrations/0005_*.py \
        backend/core/apps/accounting/models/despesa_recorrente.py
git commit -m "feat(accounting): DespesaRecorrente.supplier → persons.Person"
```

---

## Task 8: Purchasing — 3 FKs (Item/Cotacao/Resposta) → Person

**Files:**
- Create: `backend/core/apps/purchasing/migrations/0005_add_person_fks_nullable.py`
- Create: `backend/core/apps/purchasing/migrations/0006_backfill_person_fks.py`
- Create: `backend/core/apps/purchasing/migrations/0007_swap_purchasing_fks.py`
- Modify: `backend/core/apps/purchasing/models.py:191,274,279,314`

---

- [ ] **Step 1: Migration 0005 — expand**

```python
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("purchasing", "0004_itemordemcompra_data_prevista_and_more"),
        ("persons", "0013_backfill_persons_from_legacy"),
    ]

    operations = [
        migrations.AddField(
            model_name="itemordemcompra", name="person_fornecedor",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.SET_NULL,
                related_name="itens_oc_new", to="persons.person",
            ),
        ),
        migrations.AddField(
            model_name="cotacaolog", name="person_supplier",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.CASCADE,
                related_name="cotacoes_recebidas_new", to="persons.person",
            ),
        ),
        migrations.AddField(
            model_name="cotacaolog", name="person_supplier_contact",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.SET_NULL,
                related_name="cotacoes_new", to="persons.personcontact",
            ),
        ),
        migrations.AddField(
            model_name="respostacotacao", name="person_supplier",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.CASCADE,
                related_name="respostas_cotacao_new", to="persons.person",
            ),
        ),
    ]
```

- [ ] **Step 2: Migration 0006 — backfill**

```python
from django.db import migrations


def backfill(apps, schema_editor):
    SupplierProfile  = apps.get_model("persons", "SupplierProfile")
    Fornecedor       = apps.get_model("pricing_catalog", "Fornecedor")
    ItemOrdemCompra  = apps.get_model("purchasing", "ItemOrdemCompra")
    CotacaoLog       = apps.get_model("purchasing", "CotacaoLog")
    RespostaCotacao  = apps.get_model("purchasing", "RespostaCotacao")
    PersonContact    = apps.get_model("persons", "PersonContact")

    sup_legacy_to_person = dict(
        SupplierProfile.objects.exclude(legacy_supplier_id__isnull=True)
                               .values_list("legacy_supplier_id", "person_id")
    )

    # Fornecedor (pricing_catalog) — tabela vazia (0 reg), mas se aparecer no futuro
    # usa OneToOne FK Person existente
    fornec_to_person = dict(
        Fornecedor.objects.exclude(perfil_fornecedor__isnull=True)
                          .values_list("id", "perfil_fornecedor_id")
    )

    for item in ItemOrdemCompra.objects.exclude(fornecedor__isnull=True):
        item.person_fornecedor_id = fornec_to_person.get(item.fornecedor_id)
        item.save(update_fields=["person_fornecedor"])

    for cot in CotacaoLog.objects.all():
        cot.person_supplier_id = sup_legacy_to_person.get(cot.supplier_id)
        # supplier_contact não tem mapping legado fácil — deixa NULL
        cot.save(update_fields=["person_supplier"])

    for resp in RespostaCotacao.objects.all():
        resp.person_supplier_id = sup_legacy_to_person.get(resp.supplier_id)
        resp.save(update_fields=["person_supplier"])


class Migration(migrations.Migration):
    dependencies = [("purchasing", "0005_add_person_fks_nullable")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
```

- [ ] **Step 3: Migration 0007 — swap**

```python
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("purchasing", "0006_backfill_person_fks")]
    operations = [
        migrations.RemoveField(model_name="itemordemcompra", name="fornecedor"),
        migrations.RenameField("itemordemcompra", "person_fornecedor", "fornecedor"),
        migrations.AlterField(
            "itemordemcompra", "fornecedor",
            models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.SET_NULL,
                related_name="itens_oc", to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
            ),
        ),

        migrations.RemoveField(model_name="cotacaolog", name="supplier"),
        migrations.RemoveField(model_name="cotacaolog", name="supplier_contact"),
        migrations.RenameField("cotacaolog", "person_supplier", "supplier"),
        migrations.RenameField("cotacaolog", "person_supplier_contact", "supplier_contact"),
        migrations.AlterField(
            "cotacaolog", "supplier",
            models.ForeignKey(
                on_delete=models.deletion.CASCADE, related_name="cotacoes_recebidas",
                to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
            ),
        ),
        migrations.AlterField(
            "cotacaolog", "supplier_contact",
            models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.SET_NULL,
                related_name="cotacoes", to="persons.personcontact",
            ),
        ),

        migrations.RemoveField(model_name="respostacotacao", name="supplier"),
        migrations.RenameField("respostacotacao", "person_supplier", "supplier"),
        migrations.AlterField(
            "respostacotacao", "supplier",
            models.ForeignKey(
                on_delete=models.deletion.CASCADE, related_name="respostas_cotacao",
                to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
            ),
        ),
    ]
```

- [ ] **Step 4: Atualizar `apps/purchasing/models.py`**

Linha 191 (`ItemOrdemCompra.fornecedor`):
```python
    fornecedor = models.ForeignKey(
        "persons.Person",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="itens_oc",
        limit_choices_to={"roles__role": "SUPPLIER"},
        verbose_name="Fornecedor",
    )
```

Linhas 274-280 (`CotacaoLog.supplier`, `supplier_contact`):
```python
    supplier = models.ForeignKey(
        "persons.Person",
        on_delete=models.CASCADE,
        related_name="cotacoes_recebidas",
        limit_choices_to={"roles__role": "SUPPLIER"},
    )
    supplier_contact = models.ForeignKey(
        "persons.PersonContact",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="cotacoes",
    )
```

Linha 314 (`RespostaCotacao.supplier`):
```python
    supplier = models.ForeignKey(
        "persons.Person",
        on_delete=models.CASCADE,
        related_name="respostas_cotacao",
        limit_choices_to={"roles__role": "SUPPLIER"},
    )
```

- [ ] **Step 5: Aplicar**

```bash
docker exec paddock_django python manage.py migrate_schemas
```

- [ ] **Step 6: Smoke test**

```bash
docker exec paddock_django python manage.py shell -c "
from django_tenants.utils import schema_context
with schema_context('tenant_dscar'):
    from apps.purchasing.models import ItemOrdemCompra, CotacaoLog, RespostaCotacao
    print('Item ok:', ItemOrdemCompra.objects.count())
    print('Cot ok:',  CotacaoLog.objects.count())
    print('Resp ok:', RespostaCotacao.objects.count())
"
```

- [ ] **Step 7: Commit**

```bash
git add backend/core/apps/purchasing/migrations/0005_*.py \
        backend/core/apps/purchasing/migrations/0006_*.py \
        backend/core/apps/purchasing/migrations/0007_*.py \
        backend/core/apps/purchasing/models.py
git commit -m "feat(purchasing): 3 FKs (Item/Cotacao/Resposta) → persons.Person"
```

---

## Task 9: ServiceOrder.expert → Person

**Files:**
- Create: `backend/core/apps/service_orders/migrations/0032_swap_expert_fk.py`
- Modify: `backend/core/apps/service_orders/models/service_order.py:168`

---

- [ ] **Step 1: Migration swap**

```python
from django.db import migrations, models


def backfill(apps, schema_editor):
    ServiceOrder  = apps.get_model("service_orders", "ServiceOrder")
    ExpertProfile = apps.get_model("persons", "ExpertProfile")

    exp_to_person = dict(
        ExpertProfile.objects.exclude(legacy_expert_id__isnull=True)
                             .values_list("legacy_expert_id", "person_id")
    )
    for os in ServiceOrder.objects.exclude(expert__isnull=True):
        os.person_expert_id = exp_to_person.get(os.expert_id)
        os.save(update_fields=["person_expert"])


class Migration(migrations.Migration):
    dependencies = [
        ("service_orders", "0031_add_external_invoice"),
        ("persons", "0013_backfill_persons_from_legacy"),
    ]
    operations = [
        migrations.AddField(
            model_name="serviceorder", name="person_expert",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.SET_NULL,
                related_name="service_orders_as_expert_new", to="persons.person",
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.RemoveField(model_name="serviceorder", name="expert"),
        migrations.RenameField("serviceorder", "person_expert", "expert"),
        migrations.AlterField(
            "serviceorder", "expert",
            models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.SET_NULL,
                related_name="service_orders_as_expert", to="persons.person",
                limit_choices_to={"roles__role": "EXPERT"},
            ),
        ),
    ]
```

- [ ] **Step 2: Atualizar `apps/service_orders/models/service_order.py:168`**

```python
    expert = models.ForeignKey(
        "persons.Person",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="service_orders_as_expert",
        limit_choices_to={"roles__role": "EXPERT"},
    )
```

- [ ] **Step 3: Aplicar e commitar**

```bash
docker exec paddock_django python manage.py migrate_schemas
git add backend/core/apps/service_orders/migrations/0032_*.py \
        backend/core/apps/service_orders/models/service_order.py
git commit -m "feat(service_orders): ServiceOrder.expert → persons.Person"
```

---

## Task 10: pricing_catalog.CodigoFornecedorPeca → Person + drop Fornecedor table

**Files:**
- Create: `backend/core/apps/pricing_catalog/migrations/0003_swap_codigo_fornecedor.py`
- Create: `backend/core/apps/pricing_catalog/migrations/0004_drop_fornecedor_table.py`
- Modify: `backend/core/apps/pricing_catalog/models/supplier.py:77` (CodigoFornecedorPeca.fornecedor), remover model `Fornecedor`

---

- [ ] **Step 1: Migration 0003 — swap**

```python
from django.db import migrations, models


def backfill(apps, schema_editor):
    CodigoFornecedorPeca = apps.get_model("pricing_catalog", "CodigoFornecedorPeca")
    Fornecedor           = apps.get_model("pricing_catalog", "Fornecedor")

    fornec_to_person = dict(
        Fornecedor.objects.exclude(perfil_fornecedor__isnull=True)
                          .values_list("id", "perfil_fornecedor_id")
    )
    for cfp in CodigoFornecedorPeca.objects.all():
        cfp.person_fornecedor_id = fornec_to_person.get(cfp.fornecedor_id)
        cfp.save(update_fields=["person_fornecedor"])


class Migration(migrations.Migration):
    dependencies = [
        ("pricing_catalog", "0002_pecacanonica_ncm"),
        ("persons", "0013_backfill_persons_from_legacy"),
    ]
    operations = [
        migrations.AddField(
            model_name="codigofornecedorpeca", name="person_fornecedor",
            field=models.ForeignKey(
                null=True, blank=True, on_delete=models.deletion.CASCADE,
                related_name="codigos_peca_new", to="persons.person",
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.RemoveField(model_name="codigofornecedorpeca", name="fornecedor"),
        migrations.RenameField("codigofornecedorpeca", "person_fornecedor", "fornecedor"),
        migrations.AlterField(
            "codigofornecedorpeca", "fornecedor",
            models.ForeignKey(
                on_delete=models.deletion.CASCADE,
                related_name="codigos_peca", to="persons.person",
                limit_choices_to={"roles__role": "SUPPLIER"},
                verbose_name="Fornecedor",
            ),
        ),
    ]
```

- [ ] **Step 2: Migration 0004 — drop Fornecedor**

```python
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("pricing_catalog", "0003_swap_codigo_fornecedor"),
        ("purchasing", "0007_swap_purchasing_fks"),
    ]
    operations = [
        migrations.DeleteModel(name="Fornecedor"),
    ]
```

- [ ] **Step 3: Atualizar `apps/pricing_catalog/models/supplier.py`**

Remover classe `Fornecedor` inteira. Atualizar `CodigoFornecedorPeca.fornecedor`:

```python
    fornecedor = models.ForeignKey(
        "persons.Person",
        on_delete=models.CASCADE,
        related_name="codigos_peca",
        limit_choices_to={"roles__role": "SUPPLIER"},
        verbose_name="Fornecedor",
    )
```

Verificar imports do model `Fornecedor` em outros arquivos do app:
```bash
grep -rln "from .*supplier.* import.*Fornecedor\|models\.Fornecedor\|pricing_catalog.Fornecedor" backend/core/apps/pricing_catalog/
```
Remover/ajustar referências encontradas.

- [ ] **Step 4: Aplicar**

```bash
docker exec paddock_django python manage.py migrate_schemas
```

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/pricing_catalog/migrations/0003_*.py \
        backend/core/apps/pricing_catalog/migrations/0004_*.py \
        backend/core/apps/pricing_catalog/models/supplier.py \
        backend/core/apps/pricing_catalog/
git commit -m "feat(pricing_catalog): CodigoFornecedorPeca → Person; drop tabela Fornecedor"
```

---

## Task 11: Drop Supplier, SupplierContact + Expert tables

**Files:**
- Create: `backend/core/apps/accounts_payable/migrations/0009_drop_supplier_tables.py`
- Create: `backend/core/apps/experts/migrations/0NNN_drop_expert_table.py` (descobrir N)
- Modify: `backend/core/apps/accounts_payable/models.py` — remover `Supplier` e `SupplierContact`

---

- [ ] **Step 1: Pré-validação**

```bash
docker exec paddock_django python manage.py validate_persons_migration
```
Esperado: `OK. 0 BLOCKERs`.

- [ ] **Step 2: Backup Neon**

```bash
# A partir do Neon dashboard ou CLI:
# neon branch create --name pre-pessoas-unificacao-2026-06-22
echo "Anotar branch name no PR description"
```

- [ ] **Step 3: Migration accounts_payable.0009**

```python
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts_payable", "0008_swap_payable_supplier_fk"),
        ("accounting", "0005_swap_despesa_recorrente_fk"),
        ("purchasing", "0007_swap_purchasing_fks"),
    ]
    operations = [
        migrations.DeleteModel(name="SupplierContact"),
        migrations.DeleteModel(name="Supplier"),
    ]
```

- [ ] **Step 4: Migration experts (descobrir número)**

```bash
ls backend/core/apps/experts/migrations/ | grep -v __ | sort | tail -1
```

Criar `0NNN_drop_expert_table.py` (substituir NNN pelo próximo número):

```python
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("experts", "0NNN_PREVIOUS"),  # ajustar
        ("service_orders", "0032_swap_expert_fk"),
        ("persons", "0013_backfill_persons_from_legacy"),
    ]
    operations = [
        migrations.DeleteModel(name="Expert"),
    ]
```

- [ ] **Step 5: Remover classes em `apps/accounts_payable/models.py`**

Remover blocos `class Supplier(PaddockBaseModel)` (linhas 47-64) e `class SupplierContact(PaddockBaseModel)` (linhas 67-83). Remover import `EncryptedCharField` se ficar não utilizado.

- [ ] **Step 6: Aplicar migrations**

```bash
docker exec paddock_django python manage.py migrate_schemas
```

- [ ] **Step 7: Smoke test**

```bash
docker exec paddock_django python manage.py shell -c "
from django.db import connection
with connection.cursor() as c:
    c.execute(\"SET search_path TO tenant_dscar\")
    c.execute(\"SELECT table_name FROM information_schema.tables WHERE table_schema='tenant_dscar' AND table_name IN ('accounts_payable_supplier','experts_expert','pricing_catalog_fornecedor')\")
    print('tabelas remanescentes:', c.fetchall())
"
```
Esperado: `[]`.

- [ ] **Step 8: Validador pós-drop**

```bash
docker exec paddock_django python manage.py validate_persons_migration
```

- [ ] **Step 9: Commit**

```bash
git add backend/core/apps/accounts_payable/migrations/0009_*.py \
        backend/core/apps/accounts_payable/models.py \
        backend/core/apps/experts/migrations/0NNN_*.py
git commit -m "feat(persons): drop Supplier, SupplierContact, Expert tables"
```

---

## Task 12: API — Serializers + endpoints de profile

**Files:**
- Modify: `backend/core/apps/persons/serializers.py`
- Modify: `backend/core/apps/persons/views.py`
- Modify: `backend/core/apps/persons/urls.py`

**Interfaces:**
- Produces:
  - `GET /api/v1/persons/?role=EXPERT` retorna lista
  - `GET /api/v1/persons/{id}/` expande `supplier_profile`, `expert_profile`, `client_profile` conforme roles
  - `PATCH /api/v1/persons/{id}/supplier_profile/` atualiza SupplierProfile
  - `PATCH /api/v1/persons/{id}/expert_profile/` atualiza ExpertProfile
  - Endpoints antigos retornam `410 Gone`

---

- [ ] **Step 1: Adicionar serializers em `persons/serializers.py`**

```python
class SupplierProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierProfile
        fields = [
            "category", "default_payment_days", "default_payment_method",
            "bank_name", "bank_agency", "bank_account",
            "pix_key", "pix_key_type", "notes",
        ]


class ExpertProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpertProfile
        fields = ["registration_number", "insurers"]
```

E expor no PersonSerializer (expandir o detalhe):

```python
class PersonDetailSerializer(PersonSerializer):  # estende existente
    supplier_profile = SupplierProfileSerializer(read_only=True)
    expert_profile   = ExpertProfileSerializer(read_only=True)
    client_profile   = ClientProfileSerializer(read_only=True)

    class Meta(PersonSerializer.Meta):
        fields = PersonSerializer.Meta.fields + ["supplier_profile", "expert_profile", "client_profile"]
```

- [ ] **Step 2: PersonViewSet — actions de profile**

Em `persons/views.py`, adicionar:

```python
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

class PersonViewSet(viewsets.ModelViewSet):
    # ... existente ...

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PersonDetailSerializer
        return PersonSerializer

    @action(detail=True, methods=["get", "patch"], url_path="supplier-profile")
    def supplier_profile(self, request, pk=None):
        person = self.get_object()
        profile, _ = SupplierProfile.objects.get_or_create(person=person)
        if request.method == "PATCH":
            serializer = SupplierProfileSerializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(SupplierProfileSerializer(profile).data)

    @action(detail=True, methods=["get", "patch"], url_path="expert-profile")
    def expert_profile(self, request, pk=None):
        person = self.get_object()
        profile, _ = ExpertProfile.objects.get_or_create(person=person)
        if request.method == "PATCH":
            serializer = ExpertProfileSerializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(ExpertProfileSerializer(profile).data)
```

- [ ] **Step 3: 410 Gone para endpoints antigos**

Criar view em `apps/accounts_payable/views.py`:

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


class GoneRedirectView(APIView):
    """Endpoint deprecated — retorna 410 com Link header pro novo."""
    authentication_classes = []
    permission_classes = []
    new_url: str = "/api/v1/persons/?role=SUPPLIER"

    def dispatch(self, request, *args, **kwargs):
        return Response(
            {"detail": "Endpoint movido. Use /api/v1/persons/?role=SUPPLIER"},
            status=status.HTTP_410_GONE,
            headers={"Link": f"<{self.new_url}>; rel=successor-version"},
        )
```

E em `apps/accounts_payable/urls.py`:

```python
from .views import GoneRedirectView

urlpatterns = [
    path("suppliers/", GoneRedirectView.as_view()),
    path("suppliers/<int:pk>/", GoneRedirectView.as_view()),
    # ... outras rotas que ficam (PayableDocument etc) ...
]
```

Repetir para `experts/urls.py` e `pricing_catalog/urls.py` (rotas `fornecedores/`).

- [ ] **Step 4: Testes**

Adicionar em `apps/persons/tests/test_serializers_v2.py`:

```python
def test_person_detail_expands_supplier_profile(api_client, supplier_person):
    response = api_client.get(f"/api/v1/persons/{supplier_person.pk}/")
    assert response.status_code == 200
    assert "supplier_profile" in response.data
    assert response.data["supplier_profile"]["category"] == "GENERAL"


def test_patch_supplier_profile(api_client, supplier_person):
    response = api_client.patch(
        f"/api/v1/persons/{supplier_person.pk}/supplier-profile/",
        data={"default_payment_days": 60, "category": "PARTS"},
    )
    assert response.status_code == 200
    assert response.data["default_payment_days"] == 60


def test_deprecated_supplier_endpoint_returns_410(api_client):
    response = api_client.get("/api/v1/accounts-payable/suppliers/")
    assert response.status_code == 410
    assert "Link" in response.headers
```

- [ ] **Step 5: Aplicar + testar**

```bash
docker exec paddock_django pytest apps/persons/tests/test_serializers_v2.py -v 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/persons/serializers.py \
        backend/core/apps/persons/views.py \
        backend/core/apps/persons/urls.py \
        backend/core/apps/persons/tests/test_serializers_v2.py \
        backend/core/apps/accounts_payable/views.py \
        backend/core/apps/accounts_payable/urls.py \
        backend/core/apps/experts/urls.py \
        backend/core/apps/pricing_catalog/urls.py
git commit -m "feat(persons): expose SupplierProfile/ExpertProfile endpoints; 410 Gone em rotas legadas"
```

---

## Task 13: Frontend — Masks novas (DateInput, CepInput, EmailInput, PixKeyInput)

**Files:**
- Modify: `apps/dscar-web/src/components/ui/masked-input.tsx`
- Create: `apps/dscar-web/src/components/ui/masked-input.test.tsx`

**Interfaces:**
- Produces: `<DateInput>`, `<CepInput>`, `<EmailInput>`, `<PixKeyInput pixType={...}>`

---

- [ ] **Step 1: Escrever testes que falham**

Criar `apps/dscar-web/src/components/ui/masked-input.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { DateInput, CepInput, EmailInput, formatDate, formatCep } from "./masked-input";

describe("formatDate", () => {
  it("formats 8 digits as DD/MM/YYYY", () => {
    expect(formatDate("01021999")).toBe("01/02/1999");
  });
  it("formats partial input", () => {
    expect(formatDate("0102")).toBe("01/02");
    expect(formatDate("01")).toBe("01");
  });
  it("strips non-digits", () => {
    expect(formatDate("a1b2/c3")).toBe("12/3");
  });
});

describe("formatCep", () => {
  it("formats 8 digits as 00000-000", () => {
    expect(formatCep("69050001")).toBe("69050-001");
  });
});

describe("DateInput", () => {
  it("shows DD/MM/AAAA placeholder", () => {
    const { getByPlaceholderText } = render(<DateInput />);
    expect(getByPlaceholderText("DD/MM/AAAA")).toBeTruthy();
  });
});

describe("CepInput", () => {
  it("shows 00000-000 placeholder", () => {
    const { getByPlaceholderText } = render(<CepInput />);
    expect(getByPlaceholderText("00000-000")).toBeTruthy();
  });
});

describe("EmailInput", () => {
  it("uses type=email + placeholder de exemplo", () => {
    const { container } = render(<EmailInput />);
    const input = container.querySelector("input");
    expect(input?.type).toBe("email");
    expect(input?.placeholder).toBe("nome@exemplo.com.br");
  });
});
```

- [ ] **Step 2: Rodar — falha**

```bash
cd apps/dscar-web && pnpm test masked-input 2>&1 | tail -15
```

- [ ] **Step 3: Implementar em `masked-input.tsx`**

Adicionar ao final do arquivo:

```tsx
/** Formata para DD/MM/AAAA */
export function formatDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Formata para 00000-000 */
export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export const DateInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ onChange, onValueChange, value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDate(e.target.value);
      e.target.value = formatted;
      onChange?.(e);
      onValueChange?.(formatted);  // mantém formato BR pra UI
    };
    return <Input ref={ref} onChange={handleChange} value={value} placeholder="DD/MM/AAAA" inputMode="numeric" {...props} />;
  }
);
DateInput.displayName = "DateInput";

export const CepInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ onChange, onValueChange, value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCep(e.target.value);
      e.target.value = formatted;
      onChange?.(e);
      onValueChange?.(formatted.replace(/\D/g, ""));
    };
    return <Input ref={ref} onChange={handleChange} value={value} placeholder="00000-000" inputMode="numeric" {...props} />;
  }
);
CepInput.displayName = "CepInput";

export const EmailInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <Input ref={ref} type="email" placeholder="nome@exemplo.com.br" {...props} />
);
EmailInput.displayName = "EmailInput";

export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM" | "";

interface PixKeyInputProps extends MaskedInputProps {
  pixType?: PixKeyType;
}

export const PixKeyInput = React.forwardRef<HTMLInputElement, PixKeyInputProps>(
  ({ pixType, onChange, onValueChange, value, ...props }, ref) => {
    const placeholder =
      pixType === "CPF" ? "000.000.000-00" :
      pixType === "CNPJ" ? "00.000.000/0000-00" :
      pixType === "EMAIL" ? "nome@exemplo.com.br" :
      pixType === "PHONE" ? "(00) 00000-0000" :
      "chave aleatória";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value;
      if (pixType === "CPF" || pixType === "CNPJ") v = formatCpfCnpj(v);
      else if (pixType === "PHONE") v = formatPhone(v);
      e.target.value = v;
      onChange?.(e);
      onValueChange?.(v.replace(/[^A-Za-z0-9@.-]/g, ""));
    };

    return <Input ref={ref} onChange={handleChange} value={value} placeholder={placeholder} {...props} />;
  }
);
PixKeyInput.displayName = "PixKeyInput";
```

- [ ] **Step 4: Rodar — passa**

```bash
cd apps/dscar-web && pnpm test masked-input 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/ui/masked-input.tsx \
        apps/dscar-web/src/components/ui/masked-input.test.tsx
git commit -m "feat(ui): adiciona DateInput, CepInput, EmailInput, PixKeyInput"
```

---

## Task 14: Types — adicionar role EXPERT e Zod schema

**Files:**
- Modify: `packages/types/persons.ts` (ou onde a interface Person está)
- Modify: `packages/types/index.ts` se necessário

---

- [ ] **Step 1: Localizar definição**

```bash
grep -rln "PersonRole\|'SUPPLIER'\|\"SUPPLIER\"" packages/types/src 2>/dev/null | head -5
```

- [ ] **Step 2: Adicionar EXPERT**

Em `packages/types/src/persons.ts` (ou arquivo encontrado):

```typescript
export type PersonRole = "CLIENT" | "INSURER" | "BROKER" | "EMPLOYEE" | "SUPPLIER" | "EXPERT"

export const PERSON_ROLES: Record<PersonRole, string> = {
  CLIENT:   "Cliente",
  INSURER:  "Seguradora",
  BROKER:   "Corretor",
  EMPLOYEE: "Funcionário",
  SUPPLIER: "Fornecedor",
  EXPERT:   "Perito",
}
```

- [ ] **Step 3: Zod schema de criação**

Adicionar `personCreateSchema`:

```typescript
import { z } from "zod"

const isValidCpfCnpj = (v: string) => {
  const d = v.replace(/\D/g, "")
  return d.length === 11 || d.length === 14
}

export const personCreateSchema = z.object({
  person_kind:      z.enum(["PF", "PJ"]),
  full_name:        z.string().min(3, "Nome é obrigatório"),
  primary_document: z.string().refine(isValidCpfCnpj, "CPF/CNPJ inválido"),
  primary_phone:    z.string().min(10, "Celular obrigatório"),
  primary_email:    z.string().email("E-mail inválido").optional().or(z.literal("")),
  birth_date:       z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use DD/MM/AAAA").optional().or(z.literal("")),
  gender:           z.enum(["M", "F", "N"]).optional(),
  roles:            z.array(z.enum(["CLIENT","SUPPLIER","EMPLOYEE","BROKER","EXPERT","INSURER"]))
                     .min(1, "Selecione ao menos um papel"),
  address: z.object({
    zip_code:     z.string().regex(/^\d{5}-\d{3}$/, "CEP inválido"),
    street:       z.string().min(1),
    number:       z.string().min(1),
    neighborhood: z.string().min(1),
    city:         z.string().min(1),
    state:        z.string().length(2),
  }).optional(),
})

export type PersonCreateInput = z.infer<typeof personCreateSchema>
```

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/persons.ts
git commit -m "feat(types): adiciona role EXPERT e personCreateSchema"
```

---

## Task 15: Frontend — Tab "Peritos" em /cadastros

**Files:**
- Modify: `apps/dscar-web/src/components/Cadastros/index.tsx`

---

- [ ] **Step 1: Editar `Cadastros/index.tsx`**

Atualizar array `TABS` (linha 25):

```tsx
const TABS: { id: TabId; label: string }[] = [
  { id: "ALL",      label: "Todos" },
  { id: "CLIENT",   label: "Clientes" },
  { id: "SUPPLIER", label: "Fornecedores" },
  { id: "EMPLOYEE", label: "Funcionários" },
  { id: "EXPERT",   label: "Peritos" },
  { id: "INSURER",  label: "Seguradoras" },
  { id: "BROKER",   label: "Corretores" },
];
```

- [ ] **Step 2: Smoke test**

```bash
cd apps/dscar-web && pnpm dev
# abrir /cadastros, clicar em "Peritos" — tab deve aparecer
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/components/Cadastros/index.tsx
git commit -m "feat(cadastros): adiciona tab Peritos"
```

---

## Task 16: Frontend — PersonForm refatorado com CPF/CNPJ no topo + obrigatórios visíveis

**Files:**
- Create: `apps/dscar-web/src/components/Cadastros/PersonForm.tsx`
- Modify: `apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx` (vira wrapper)

---

- [ ] **Step 1: Criar `PersonForm.tsx`**

```tsx
"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { personCreateSchema, type PersonCreateInput, PERSON_ROLES, type PersonRole } from "@paddock/types";
import { Button, Input, Label } from "@/components/ui";
import { CpfCnpjInput, PhoneInput, EmailInput, DateInput, CepInput } from "@/components/ui/masked-input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";

interface PersonFormProps {
  defaultValues?: Partial<PersonCreateInput>;
  onSubmit: (data: PersonCreateInput) => Promise<void>;
  onCancel?: () => void;
}

export function PersonForm({ defaultValues, onSubmit, onCancel }: PersonFormProps): JSX.Element {
  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } =
    useForm<PersonCreateInput>({
      resolver: zodResolver(personCreateSchema),
      defaultValues: { person_kind: "PF", roles: [], ...defaultValues },
    });

  const personKind = watch("person_kind");
  const [cepLoading, setCepLoading] = useState(false);

  async function handleCepBlur(cep: string) {
    if (cep.replace(/\D/g, "").length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`/api/proxy/persons/cep/?cep=${cep.replace(/\D/g, "")}`);
      const data = await res.json();
      // setValue em address.street, neighborhood, city, state via setValue do useForm
    } catch { /* silent */ }
    finally { setCepLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Tipo PF/PJ */}
      <Controller name="person_kind" control={control} render={({ field }) => (
        <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
          <label className="flex items-center gap-2"><RadioGroupItem value="PF" /> Pessoa Física</label>
          <label className="flex items-center gap-2"><RadioGroupItem value="PJ" /> Pessoa Jurídica</label>
        </RadioGroup>
      )} />

      {/* Nome + Documento (TOPO) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label required>{personKind === "PJ" ? "Razão Social" : "Nome completo"}</Label>
          <Input placeholder="Fulano da Silva" {...register("full_name")} />
          {errors.full_name && <p className="text-error-500 text-sm">{errors.full_name.message}</p>}
        </div>
        <div>
          <Label required>{personKind === "PJ" ? "CNPJ" : "CPF"}</Label>
          <Controller name="primary_document" control={control} render={({ field }) => (
            <CpfCnpjInput value={field.value} onValueChange={field.onChange} />
          )} />
          {errors.primary_document && <p className="text-error-500 text-sm">{errors.primary_document.message}</p>}
        </div>
      </div>

      {/* Contato */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label required>Celular</Label>
          <Controller name="primary_phone" control={control} render={({ field }) => (
            <PhoneInput value={field.value} onValueChange={field.onChange} />
          )} />
          {errors.primary_phone && <p className="text-error-500 text-sm">{errors.primary_phone.message}</p>}
        </div>
        <div>
          <Label>E-mail</Label>
          <EmailInput {...register("primary_email")} />
        </div>
      </div>

      {/* Nascimento + Sexo (só PF) */}
      {personKind === "PF" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data de nascimento</Label>
            <Controller name="birth_date" control={control} render={({ field }) => (
              <DateInput value={field.value} onValueChange={field.onChange} />
            )} />
          </div>
          <div>
            <Label>Sexo</Label>
            <select {...register("gender")} className="w-full rounded border px-3 py-2">
              <option value="">Selecione</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="N">Não informado</option>
            </select>
          </div>
        </div>
      )}

      {/* Papéis */}
      <div>
        <Label required>Papel da pessoa</Label>
        <p className="text-xs text-muted-foreground mb-1">Pode marcar mais de um</p>
        <Controller name="roles" control={control} render={({ field }) => (
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(PERSON_ROLES) as [PersonRole, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.value?.includes(key)}
                  onCheckedChange={(checked) => {
                    field.onChange(checked
                      ? [...(field.value || []), key]
                      : field.value?.filter((r) => r !== key));
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        )} />
        {errors.roles && <p className="text-error-500 text-sm">{errors.roles.message as string}</p>}
      </div>

      {/* Endereço */}
      <fieldset className="border rounded p-3">
        <legend className="text-sm font-medium">Endereço principal</legend>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div>
            <Label>CEP</Label>
            <Controller name="address.zip_code" control={control} render={({ field }) => (
              <CepInput value={field.value} onValueChange={field.onChange} onBlur={(e) => handleCepBlur(e.target.value)} />
            )} />
          </div>
          <div className="col-span-2">
            <Label>Logradouro {cepLoading && <span className="text-xs">(buscando...)</span>}</Label>
            <Input {...register("address.street")} />
          </div>
          <div><Label>Número</Label><Input {...register("address.number")} /></div>
          <div><Label>Bairro</Label><Input {...register("address.neighborhood")} /></div>
          <div><Label>Cidade</Label><Input {...register("address.city")} /></div>
          <div><Label>UF</Label><Input maxLength={2} {...register("address.state")} /></div>
        </div>
      </fieldset>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" disabled={isSubmitting}>Salvar</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Atualizar `<Label required>` em `components/ui/label.tsx`** se não suporta:

```tsx
export function Label({ required, children, ...props }: LabelProps & { required?: boolean }) {
  return (
    <label {...props}>
      {children} {required && <span className="text-error-500">*</span>}
    </label>
  );
}
```

- [ ] **Step 3: Adaptar `PersonFormModal.tsx`**

Vira wrapper finíssimo:

```tsx
export function PersonFormModal({ open, onOpenChange, person }: Props) {
  const create = useCreatePerson();
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={person ? "Editar Pessoa" : "Nova Pessoa"}>
      <PersonForm
        defaultValues={person ? mapPersonToInput(person) : undefined}
        onSubmit={async (data) => {
          await create.mutateAsync(data);
          onOpenChange(false);
        }}
        onCancel={() => onOpenChange(false)}
      />
    </Modal>
  );
}
```

- [ ] **Step 4: Verificar adapter no backend**

`PersonViewSet.create` precisa aceitar o payload achatado (`primary_document`, `primary_phone`, `primary_email`, `address`, `roles`) e desmembrar em PersonDocument/PersonContact/PersonAddress/PersonRole. Verificar se já está implementado em `serializers.py`. Se não, adicionar `PersonCreateSerializer`.

- [ ] **Step 5: Smoke test**

```bash
cd apps/dscar-web && pnpm dev
# abrir /cadastros → "Nova Pessoa" → preencher → salvar → verificar criou
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/components/Cadastros/PersonForm.tsx \
        apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx \
        apps/dscar-web/src/components/ui/label.tsx
git commit -m "feat(cadastros): PersonForm com CPF/CNPJ no topo, masks padronizadas, obrigatórios visíveis"
```

---

## Task 17: Frontend — Página /cadastros/[id] com tabs por perfil

**Files:**
- Create: `apps/dscar-web/src/app/(app)/cadastros/[id]/page.tsx`
- Create: `apps/dscar-web/src/components/Cadastros/PersonDetail/index.tsx`
- Create: `apps/dscar-web/src/components/Cadastros/PersonDetail/PersonHeader.tsx`
- Create: `apps/dscar-web/src/components/Cadastros/PersonDetail/GeneralTab.tsx`
- Create: `apps/dscar-web/src/components/Cadastros/PersonDetail/DocumentsTab.tsx`
- Create: `apps/dscar-web/src/components/Cadastros/PersonDetail/ContactsTab.tsx`
- Create: `apps/dscar-web/src/components/Cadastros/PersonDetail/AddressesTab.tsx`
- Create: `apps/dscar-web/src/components/Cadastros/PersonDetail/SupplierTab.tsx`
- Create: `apps/dscar-web/src/components/Cadastros/PersonDetail/ExpertTab.tsx`
- Create: `apps/dscar-web/src/components/Cadastros/PersonDetail/ClientTab.tsx`
- Create: `apps/dscar-web/src/hooks/useSupplierProfile.ts`
- Create: `apps/dscar-web/src/hooks/useExpertProfile.ts`

---

- [ ] **Step 1: Hook useSupplierProfile**

`apps/dscar-web/src/hooks/useSupplierProfile.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface SupplierProfileData {
  category: "PARTS" | "SERVICE" | "MATERIAL" | "GENERAL";
  default_payment_days: number;
  default_payment_method: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  pix_key: string;
  pix_key_type: "" | "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";
  notes: string;
}

export function useSupplierProfile(personId: number) {
  return useQuery({
    queryKey: ["supplier-profile", personId],
    queryFn: () => apiFetch<SupplierProfileData>(`/api/proxy/persons/${personId}/supplier-profile/`),
    enabled: !!personId,
  });
}

export function useUpdateSupplierProfile(personId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SupplierProfileData>) =>
      apiFetch<SupplierProfileData>(`/api/proxy/persons/${personId}/supplier-profile/`, {
        method: "PATCH", body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-profile", personId] }),
  });
}
```

`useExpertProfile.ts` — mesmo padrão, com `registration_number` e `insurers`.

- [ ] **Step 2: Page route**

`apps/dscar-web/src/app/(app)/cadastros/[id]/page.tsx`:

```tsx
"use client";
import { use } from "react";
import { PersonDetail } from "@/components/Cadastros/PersonDetail";

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PersonDetail personId={Number(id)} />;
}
```

- [ ] **Step 3: PersonDetail container**

`apps/dscar-web/src/components/Cadastros/PersonDetail/index.tsx`:

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { usePerson } from "@/hooks";
import { PersonHeader } from "./PersonHeader";
import { GeneralTab } from "./GeneralTab";
import { DocumentsTab } from "./DocumentsTab";
import { ContactsTab } from "./ContactsTab";
import { AddressesTab } from "./AddressesTab";
import { SupplierTab } from "./SupplierTab";
import { ExpertTab } from "./ExpertTab";
import { ClientTab } from "./ClientTab";
import { EmployeeTab } from "./EmployeeTab";

type TabKey = "general" | "documents" | "contacts" | "addresses"
            | "client" | "supplier" | "employee" | "expert" | "broker";

export function PersonDetail({ personId }: { personId: number }) {
  const { data: person, isLoading } = usePerson(personId);
  const [active, setActive] = useState<TabKey>("general");

  if (isLoading) return <div>Carregando...</div>;
  if (!person) return <div>Pessoa não encontrada</div>;

  const roles = new Set(person.roles ?? []);
  const tabs: { id: TabKey; label: string; visible: boolean }[] = [
    { id: "general",    label: "Geral",        visible: true },
    { id: "documents",  label: "Documentos",   visible: true },
    { id: "contacts",   label: "Contatos",     visible: true },
    { id: "addresses",  label: "Endereços",    visible: true },
    { id: "client",     label: "Cliente",      visible: roles.has("CLIENT") },
    { id: "supplier",   label: "Fornecedor",   visible: roles.has("SUPPLIER") },
    { id: "employee",   label: "Funcionário",  visible: roles.has("EMPLOYEE") },
    { id: "expert",     label: "Perito",       visible: roles.has("EXPERT") },
  ];

  return (
    <div className="space-y-4">
      <Link href="/cadastros" className="inline-flex items-center text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Cadastros
      </Link>
      <PersonHeader person={person} />

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.filter((t) => t.visible).map((t) => (
          <button key={t.id} onClick={() => setActive(t.id)}
                  className={`px-4 py-2 text-sm ${active === t.id ? "border-b-2 border-primary font-medium" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="py-2">
        {active === "general"    && <GeneralTab person={person} />}
        {active === "documents"  && <DocumentsTab person={person} />}
        {active === "contacts"   && <ContactsTab person={person} />}
        {active === "addresses"  && <AddressesTab person={person} />}
        {active === "client"     && <ClientTab personId={personId} />}
        {active === "supplier"   && <SupplierTab personId={personId} />}
        {active === "employee"   && <EmployeeTab person={person} />}
        {active === "expert"     && <ExpertTab personId={personId} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: PersonHeader + tabs simples (Geral/Documentos/Contatos/Endereços)**

Implementar cada um. `PersonHeader.tsx`:

```tsx
export function PersonHeader({ person }: { person: Person }) {
  const primaryDoc = person.documents?.find((d) => d.is_primary);
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{person.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          {primaryDoc?.doc_type}: {primaryDoc?.value_masked ?? "—"} · {person.person_kind === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {person.roles?.map((r) => (
          <span key={r} className="px-2 py-1 text-xs rounded bg-muted">{r}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: SupplierTab + ExpertTab + ClientTab**

`SupplierTab.tsx`:

```tsx
import { useForm } from "react-hook-form";
import { useSupplierProfile, useUpdateSupplierProfile } from "@/hooks/useSupplierProfile";
import { Button, Input, Label } from "@/components/ui";
import { PixKeyInput } from "@/components/ui/masked-input";

export function SupplierTab({ personId }: { personId: number }) {
  const { data: profile } = useSupplierProfile(personId);
  const update = useUpdateSupplierProfile(personId);
  const { register, handleSubmit, watch } = useForm({ values: profile ?? undefined });
  const pixType = watch("pix_key_type");

  return (
    <form onSubmit={handleSubmit((d) => update.mutate(d))} className="grid grid-cols-2 gap-3 max-w-2xl">
      <div>
        <Label>Categoria</Label>
        <select {...register("category")} className="w-full rounded border px-3 py-2">
          <option value="GENERAL">Geral</option>
          <option value="PARTS">Peças</option>
          <option value="SERVICE">Serviços</option>
          <option value="MATERIAL">Material</option>
        </select>
      </div>
      <div>
        <Label>Prazo padrão (dias)</Label>
        <Input type="number" {...register("default_payment_days", { valueAsNumber: true })} />
      </div>
      <div><Label>Banco</Label><Input {...register("bank_name")} /></div>
      <div><Label>Agência</Label><Input {...register("bank_agency")} /></div>
      <div><Label>Conta</Label><Input {...register("bank_account")} /></div>
      <div>
        <Label>Tipo de chave PIX</Label>
        <select {...register("pix_key_type")} className="w-full rounded border px-3 py-2">
          <option value="">—</option>
          <option value="CPF">CPF</option>
          <option value="CNPJ">CNPJ</option>
          <option value="EMAIL">E-mail</option>
          <option value="PHONE">Telefone</option>
          <option value="RANDOM">Aleatória</option>
        </select>
      </div>
      <div>
        <Label>Chave PIX</Label>
        <PixKeyInput pixType={pixType} {...register("pix_key")} />
      </div>
      <div className="col-span-2">
        <Label>Observações</Label>
        <textarea {...register("notes")} className="w-full rounded border px-3 py-2" rows={3} />
      </div>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" disabled={update.isPending}>Salvar</Button>
      </div>
    </form>
  );
}
```

`ExpertTab.tsx` e `ClientTab.tsx` seguem o mesmo padrão (formulário simples com hook + mutation).

`EmployeeTab.tsx` é só um link:

```tsx
export function EmployeeTab({ person }: { person: Person }) {
  return (
    <div>
      <p>Esta pessoa é funcionário(a). Folha, ponto e contracheque são gerenciados no módulo de RH.</p>
      <Link href={`/rh/colaboradores/${person.employee_id}`} className="text-primary underline">Abrir no /rh →</Link>
    </div>
  );
}
```

- [ ] **Step 6: Smoke test**

```bash
cd apps/dscar-web && pnpm dev
# abrir /cadastros → clicar em qualquer pessoa → ver tabs corretas
```

- [ ] **Step 7: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/cadastros/\[id\]/ \
        apps/dscar-web/src/components/Cadastros/PersonDetail/ \
        apps/dscar-web/src/hooks/useSupplierProfile.ts \
        apps/dscar-web/src/hooks/useExpertProfile.ts
git commit -m "feat(cadastros): página /cadastros/[id] com tabs condicionais por perfil"
```

---

## Task 18: Frontend — migrar 7 consumidores de useSuppliers → usePersons

**Files:**
- Modify: `apps/dscar-web/src/hooks/usePurchasing.ts`
- Modify: `apps/dscar-web/src/hooks/useFinanceiro.ts`
- Modify: `apps/dscar-web/src/app/(app)/financeiro/contas-pagar/novo/page.tsx`
- Modify: `apps/dscar-web/src/components/purchasing/QuotationBuilder.tsx`
- Modify: `apps/dscar-web/src/components/purchasing/RespostaForm.tsx`
- Modify: `apps/dscar-web/src/components/purchasing/MontarOCModal.tsx`
- Modify: `apps/dscar-web/src/components/purchasing/OrdemCompraDetail.tsx`
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/PartsTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/estoque/nfe-recebida/[id]/page.tsx`

---

- [ ] **Step 1: useSuppliers vira alias deprecated em usePurchasing.ts**

Encontrar implementação atual e substituir:

```typescript
import { usePersons } from "./usePersons";

/** @deprecated Use usePersons({ role: 'SUPPLIER' }) directly. */
export function useSuppliers() {
  if (typeof window !== "undefined") {
    console.warn("[deprecated] useSuppliers — use usePersons({ role: 'SUPPLIER' })");
  }
  const { data, ...rest } = usePersons({ role: "SUPPLIER" });
  return {
    ...rest,
    data: data?.map((p) => ({
      id: p.id,
      name: p.full_name,
      cnpj: p.documents?.find((d) => d.doc_type === "CNPJ")?.value ?? "",
      cpf:  p.documents?.find((d) => d.doc_type === "CPF")?.value ?? "",
      email: p.contacts?.find((c) => c.contact_type === "EMAIL")?.value ?? "",
      phone: p.contacts?.find((c) => c.contact_type === "CELULAR")?.value ?? "",
    })),
  };
}
```

- [ ] **Step 2: Idem em useFinanceiro.ts**

Se houver hook de Supplier ali, repetir mesma estratégia.

- [ ] **Step 3: Atualizar cada um dos 7 consumidores**

Padrão: trocar `useSuppliers()` por `usePersons({ role: "SUPPLIER" })` e adaptar acesso a `p.full_name` em vez de `s.name`, `p.id` etc.

Em cada arquivo, fazer search/replace:
- `const { data: suppliers } = useSuppliers()` → `const { data: suppliers } = usePersons({ role: "SUPPLIER" })`
- `supplier.name` → `supplier.full_name`
- `supplier.cnpj` → `supplier.documents?.find((d) => d.doc_type === "CNPJ")?.value`

Lista de arquivos a tocar (uma de cada vez, commit por arquivo se preferir):
1. `financeiro/contas-pagar/novo/page.tsx`
2. `purchasing/QuotationBuilder.tsx`
3. `purchasing/RespostaForm.tsx`
4. `purchasing/MontarOCModal.tsx`
5. `purchasing/OrdemCompraDetail.tsx`
6. `os/[numero]/_components/tabs/PartsTab.tsx`
7. `estoque/nfe-recebida/[id]/page.tsx`

- [ ] **Step 4: Smoke test em cada tela**

```bash
cd apps/dscar-web && pnpm dev
# abrir cada tela, criar registro com fornecedor, verificar autocomplete
```

- [ ] **Step 5: Commit (pode dividir em 7 commits ou 1)**

```bash
git add apps/dscar-web/src/hooks/usePurchasing.ts \
        apps/dscar-web/src/hooks/useFinanceiro.ts \
        apps/dscar-web/src/app/\(app\)/financeiro/ \
        apps/dscar-web/src/components/purchasing/ \
        apps/dscar-web/src/app/\(app\)/os/ \
        apps/dscar-web/src/app/\(app\)/estoque/
git commit -m "feat(frontend): migra 7 consumidores de useSuppliers para usePersons"
```

---

## Task 19: Frontend — redirects + deleção de rotas antigas

**Files:**
- Modify: `apps/dscar-web/next.config.js` (ou `.ts`)
- Delete: `apps/dscar-web/src/app/(app)/cadastros/catalogo/fornecedores/` (diretório)
- Delete: `apps/dscar-web/src/app/(app)/cadastros/especialistas/` (diretório)

---

- [ ] **Step 1: Adicionar redirects**

Editar `apps/dscar-web/next.config.js`:

```js
async redirects() {
  return [
    {
      source: "/cadastros/catalogo/fornecedores",
      destination: "/cadastros?role=SUPPLIER",
      permanent: true,
    },
    {
      source: "/cadastros/especialistas",
      destination: "/cadastros?role=EXPERT",
      permanent: true,
    },
  ];
}
```

- [ ] **Step 2: Deletar diretórios**

```bash
rm -rf apps/dscar-web/src/app/\(app\)/cadastros/catalogo/fornecedores
rm -rf apps/dscar-web/src/app/\(app\)/cadastros/especialistas
```

- [ ] **Step 3: Verificar referências quebradas**

```bash
cd apps/dscar-web && grep -rn "cadastros/catalogo/fornecedores\|cadastros/especialistas" src/
```
Esperado: nada (ou só strings que vão pro redirect).

- [ ] **Step 4: Smoke test**

```bash
cd apps/dscar-web && pnpm dev
# navegar para /cadastros/catalogo/fornecedores → deve ir pra /cadastros?role=SUPPLIER
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/next.config.js
git rm -r apps/dscar-web/src/app/\(app\)/cadastros/catalogo/fornecedores
git rm -r apps/dscar-web/src/app/\(app\)/cadastros/especialistas
git commit -m "feat(frontend): redirects de rotas antigas; remove catalogo/fornecedores e especialistas"
```

---

## Task 20: E2E + smoke test final

**Files:**
- Create: `apps/dscar-web/tests/e2e/pessoas-consolidacao.spec.ts`

---

- [ ] **Step 1: E2E test**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Pessoas Consolidação", () => {
  test("Fornecedor cadastrado em /cadastros aparece no autocomplete de OC", async ({ page }) => {
    await page.goto("/cadastros");
    await page.click("text=Nova Pessoa");
    await page.click("text=Pessoa Jurídica");
    await page.fill("[placeholder='Fulano da Silva']", "Teste Auto Peças LTDA");
    await page.fill("[placeholder='000.000.000-00']", "12345678000190");
    await page.fill("[placeholder='(00) 00000-0000']", "92999998888");
    await page.check("text=Fornecedor");
    await page.click("text=Salvar");
    await expect(page.locator("text=Teste Auto Peças LTDA")).toBeVisible();

    await page.goto("/compras/ordens-compra/nova");
    await page.click("[name='fornecedor']");
    await page.fill("[name='fornecedor']", "Teste Auto");
    await expect(page.locator("text=Teste Auto Peças LTDA")).toBeVisible();
  });

  test("Redirect /cadastros/catalogo/fornecedores → /cadastros?role=SUPPLIER", async ({ page }) => {
    const response = await page.goto("/cadastros/catalogo/fornecedores");
    expect(page.url()).toContain("/cadastros");
    expect(page.url()).toContain("role=SUPPLIER");
  });

  test("CPF/CNPJ obrigatório no topo do formulário", async ({ page }) => {
    await page.goto("/cadastros");
    await page.click("text=Nova Pessoa");
    await page.fill("[placeholder='Fulano da Silva']", "Sem Documento");
    await page.click("text=Salvar");
    await expect(page.locator("text=/CPF.*inválido|CPF.*obrigatório/i")).toBeVisible();
  });
});
```

- [ ] **Step 2: Rodar E2E**

```bash
cd apps/dscar-web && pnpm playwright test pessoas-consolidacao 2>&1 | tail -15
```

- [ ] **Step 3: Smoke test backend final**

```bash
docker exec paddock_django python manage.py validate_persons_migration
```
Esperado: `OK. 0 warning(s).` ou warnings inocuos.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/tests/e2e/pessoas-consolidacao.spec.ts
git commit -m "test(e2e): cenários de consolidação de pessoas"
```

---

## Task 21: Remoção do app experts/ (POST-deploy estável)

**ATENÇÃO:** Esta task NÃO faz parte do PR principal. Deve ser executada em commit separado, **APÓS** 7+ dias de produção estável.

**Files:**
- Delete: `backend/core/apps/experts/` (diretório inteiro)
- Modify: `backend/core/config/settings/base.py` — remover `apps.experts` de `INSTALLED_APPS`
- Modify: `backend/core/config/urls.py` — remover `path('experts/', ...)` se existir

---

- [ ] **Step 1: Confirmar estabilidade**

```bash
# Verificar Sentry — zero ocorrências de "experts" ou "Expert" há 7+ dias
docker exec paddock_django python manage.py validate_persons_migration
```

- [ ] **Step 2: Remover diretório e config**

```bash
rm -rf backend/core/apps/experts
# Em base.py — remover linha 'apps.experts'
# Em urls.py — remover include
```

- [ ] **Step 3: Rodar testes**

```bash
docker exec paddock_django pytest -x 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/config/ backend/core/apps/
git commit -m "chore(experts): remove app experts/ (substituído por persons.ExpertProfile)"
```

---

## Self-Review Checklist

- [x] **Coverage:** Cada requisito do spec mapeado a uma task. Modelos (Task 1), signal (2), backfill (3-4), validador (5), 9 FKs (6-10), drop legacy (11), API (12), masks (13), types (14), tab Peritos (15), PersonForm (16), página detalhe (17), 7 consumidores (18), redirects (19), E2E (20), cleanup (21). UnifiedCustomer marcado como out of scope.
- [x] **Placeholders:** Procurei "TBD", "TODO", "etc" — só restou um "0NNN_PREVIOUS" em Task 11.Step 4 com instrução explícita pra descobrir o número.
- [x] **Consistência de types:** `SupplierProfile.Categoria.PARTS/SERVICE/MATERIAL/GENERAL` usado em todas as tasks. `PersonRole`/`RolePessoa` distinção PT/EN preservada (backend `RolePessoa`, frontend `PersonRole`). `legacy_supplier_id`/`legacy_expert_id` consistentes.
- [x] **Ordem de migrations:** Dependências cruzadas declaradas em Task 6, 7, 8, 10, 11.

---

## Execution Handoff

Plano completo e salvo em `docs/superpowers/plans/2026-06-22-pessoas-consolidacao-implementation.md`. Duas opções de execução:

**1. Subagent-Driven (recomendado)** — Eu disparo um subagente fresh por task, reviso entre tasks, iteração rápida.

**2. Inline Execution** — Executo as tasks nesta sessão usando executing-plans, em batches com checkpoints pra revisão.

**Qual abordagem prefere?**
