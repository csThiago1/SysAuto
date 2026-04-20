# DESIGN — Módulo de Orçamentação (DS Car ERP)

**Data:** 2026-04-20
**Autor:** Thiago Campos + Claude (Paddock Solutions)
**Status:** Approved for implementation planning
**Tenant alvo:** `tenant_dscar`

---

## 📑 Índice

1. [Overview & Goals](#1-overview--goals)
2. [Glossário](#2-glossário)
3. [Agent Execution Map](#3-agent-execution-map)
4. [Arquitetura em camadas](#4-arquitetura-em-camadas)
5. [Modelo de dados (Django)](#5-modelo-de-dados-django)
6. [Service layer (regras de negócio)](#6-service-layer-regras-de-negócio)
7. [Importadores de seguradora](#7-importadores-de-seguradora)
8. [API REST (DRF)](#8-api-rest-drf)
9. [Frontend (Next.js/TanStack Query)](#9-frontend-nextjs-tanstack-query)
10. [PDF Engine (WeasyPrint)](#10-pdf-engine-weasyprint)
11. [Fotos & S3 storage layer](#11-fotos--s3-storage-layer)
12. [Assinatura digital](#12-assinatura-digital)
13. [Fiscal (NFS-e / NFe / Focus NF-e)](#13-fiscal)
14. [Permissões & numeração](#14-permissões--numeração)
15. [Event Log & Auto-Kanban](#15-event-log--auto-kanban)
16. [Estratégia de migração](#16-estratégia-de-migração)
17. [Testes](#17-testes)
18. [Acceptance criteria por módulo](#18-acceptance-criteria)
19. [Ordem de execução / dependências](#19-ordem-de-execução)
20. [Perguntas em aberto / Roadmap v2](#20-perguntas-em-aberto)

---

## 1. Overview & Goals

### O problema
O módulo de orçamentação está **fragmentado**: backend só tem um `total_value` (Decimal único) em `ServiceOrder`, frontend tem estrutura rica mas em `mockData.ts`, integração com seguradoras (Cilia/HDI/XML) está só em documentação. Não há versionamento, aprovação, pagamento, fiscal split, pareceres, fotos estruturadas ou auto-transições no Kanban.

### Os objetivos
1. **Entidade `Budget`** pré-OS para cliente **particular**, com versões v1/v2/v3, estados `draft/sent/approved/rejected/expired/revision`, validade 30 dias.
2. **OS seguradora importada** direto (sem passar por Budget) de **Cilia** (polling), **HDI** (upload HTML) e **XML IFX** (Porto/Azul/Itaú — schema unificado).
3. **Versionamento imutável** por snapshot — particular usa v1/v2/v3 internos, seguradora espelha `821980.1`, `821980.2`.
4. **3 blocos financeiros** na OS seguradora: cobertura-seguradora / complemento-particular / franquia.
5. **Itens ricos**: operações múltiplas (TROCA + PINTURA + OVERLAP), categorias de MO, tipos de peça, buckets (IMPACTO/SEM_COBERTURA/SOB_ANÁLISE), flags.
6. **PDF com WeasyPrint** — identidade DS Car — para orçamento, OS, entrega, recibo.
7. **Assinatura digital** — tablet canvas + link remoto + scan.
8. **Fotos** com impact_area + phase + S3 soft-delete (CLAUDE.md: S3 key nunca deletado).
9. **Event log universal** — toda mutação em OS vira entry na timeline.
10. **Auto-Kanban** — nova versão importada pausa em `budget`; aprovação de versão retorna ao estado anterior; NFS-e emitida libera delivery.
11. **Fiscal**: NFS-e (MO) + NFe (peça) separadas via Focus NF-e. Trava `ready → delivered` sem nota.
12. **Numeração contínua** `OR-NNNNNN` (orçamento) e `OS-NNNNNN` (OS), sem reset por ano.

### Não-objetivos (explícito)
- **Módulo de estoque** completo — fica roadmap v2. MVP: aviso "disponibilidade desconhecida" + gancho para OC/fornecedores.
- **Vinculação de foto a item específico** — v2.
- **UI de gestão de permissões** por role — v2 (MVP usa seeds).
- **Conciliação bancária** — fora de escopo.

---

## 2. Glossário

| Termo | Definição |
|---|---|
| **Budget (Orçamento particular)** | Entidade pré-OS para cliente particular. Tem versões v1/v2/v3. Validade 30 dias. Aprovado → vira OS. |
| **ServiceOrder (OS)** | Ordem de serviço. `customer_type` ∈ {PARTICULAR, SEGURADORA}. Tem versões. |
| **ServiceOrderVersion** | Snapshot imutável de uma versão da OS. Cada versão tem itens próprios (copiados, não referenciados). |
| **BudgetVersion** | Idem ao ServiceOrderVersion, para Budget particular. |
| **Sinistro (casualty_number)** | Número externo de um sinistro de seguradora. Único por `(insurer, casualty_number)`. |
| **Payer Block** | "Bolso" financeiro: SEGURADORA / COMPLEMENTO_PARTICULAR / FRANQUIA. Atributo do item. |
| **Bucket** | Classificação financeira do item: IMPACTO / SEM_COBERTURA / SOB_ANALISE. |
| **Impact Area (`impact_area`)** | Agrupamento do item por região do veículo (1, 2, 3…). Vem do Cilia "Área de Impacto" e do XML `divisaoOrcamento`. |
| **Operation** | O QUE se faz na peça: TROCA / RECUPERACAO / OVERLAP / PINTURA / R_I / MONTAGEM_DESMONTAGEM / DNC. Tabela de referência extensível. |
| **Labor Category** | Qual categoria de MO é cobrada: FUNILARIA / PINTURA / MECANICA / ELETRICA / TAPECARIA / ACABAMENTO / VIDRACARIA / REPARACAO / SERVICOS. Extensível. |
| **Part Type** | GENUINA / ORIGINAL / OUTRAS_FONTES / VERDE (reuso). |
| **Supplier (`supplier`)** | OFICINA ou SEGURADORA — quem fornece a peça. |
| **Parecer** | Entry em timeline de workflow entre oficina e seguradora. Externo (importado) ou interno. |
| **Import Attempt** | Registro auditável de cada tentativa de import (sucesso ou erro) com payload bruto em S3. |
| **Event / OSTimelineEntry** | Entry unificado de qualquer mutação na OS — status change, version, item edit, import, photo, payment, etc. |

---

## 3. Agent Execution Map

> **Para orquestração multi-agent.** Cada seção do spec mapeia para um agent specialist. Seções marcadas `[parallel-safe]` podem rodar em paralelo com worktree isolado.

| Seção | Agent sugerido | Paralelismo | Dependências |
|---|---|---|---|
| §5 Modelo de dados | `django-developer` | serial (fundação) | — |
| §6 Service layer | `django-developer` / `backend-developer` | parallel-safe | §5 |
| §7 Importadores | `python-pro` / `backend-developer` | parallel-safe (1 agent por source) | §5, §6 |
| §8 API REST | `api-designer` / `django-developer` | parallel-safe | §5, §6 |
| §9 Frontend | `react-specialist` / `nextjs-developer` | parallel-safe (1 agent por página) | §8 |
| §10 PDF Engine | `python-pro` | parallel-safe | §5 |
| §11 Fotos & S3 | `backend-developer` | parallel-safe | §5 |
| §12 Assinatura | `fullstack-developer` | parallel-safe | §5, §10 |
| §13 Fiscal | `fintech-engineer` | serial (após fotos+PDF) | §5, §6 |
| §14 Permissões & numeração | `backend-developer` | parallel-safe | §5 |
| §15 Event Log / Auto-Kanban | `backend-developer` | **serial** (cross-cutting) | §5, §6 |
| §17 Testes | `test-automator` + `qa-expert` | parallel-safe por módulo | todos anteriores |

### Perfil de conhecimento por agent

- **django-developer**: models, serializers, viewsets, migrations, django-tenants, schema_context
- **python-pro**: async, Celery, importers, parsers (BeautifulSoup, lxml, pydantic)
- **api-designer**: OpenAPI, REST best practices, endpoint naming
- **react-specialist**: TanStack Query v5, React Hook Form, Zod, shadcn/ui
- **nextjs-developer**: App Router, server components, server actions
- **fintech-engineer**: Focus NF-e, SEFAZ, ISS Manaus, ICMS
- **backend-developer**: services layer, signals, transactions
- **qa-expert**: test planning, edge cases, fixtures

### Subagent prompt hints

Ao disparar um subagent para uma seção, inclua:

```
Leia o spec completo em docs/superpowers/specs/2026-04-20-modulo-orcamentacao-design.md
Implemente APENAS a seção §X.
Dependências já implementadas: §Y, §Z (valide que existem antes de começar).
Use CLAUDE.md + .claude/SKILLS.md como contexto de padrões.
Ao terminar, rode pytest em apps/<nome>/tests/ e reporte.
```

---

## 4. Arquitetura em camadas

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 15)                            │
│   apps/dscar-web/src/                                                │
│   ├─ components/Budget/           ← orçamento particular UI           │
│   ├─ components/ServiceOrderV2/   ← OS nova UI                        │
│   ├─ api/budgets.ts                                                   │
│   ├─ api/serviceOrdersV2.ts                                           │
│   └─ hooks/useBudget, useOS, useImport                                │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ REST /api/v1/*
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        API Layer (DRF)                                │
│   apps/{budgets,service_orders,imports,fiscal,...}/views.py          │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Service Layer (regras)                             │
│   apps/budgets/services.py          — BudgetService                   │
│   apps/service_orders/services.py   — ServiceOrderService             │
│   apps/imports/services.py          — ImportService                   │
│   apps/service_orders/events.py     — OSEventLogger (cross-cutting)   │
│   apps/service_orders/kanban.py     — auto-transition rules           │
│   apps/fiscal/services.py           — FiscalService                   │
│   apps/pdf_engine/services.py       — PDFService                      │
│   apps/storage/services.py          — S3Service                       │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Data Layer (ORM)                                 │
│   apps/*/models.py                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

**Regras de camadas:**
- ViewSet NUNCA escreve no model direto. SEMPRE via Service.
- Service é responsável por: `@transaction.atomic`, validação de regras, `OSEventLogger.log_event()`, retorno.
- Signals são usados APENAS para auto-Kanban e notificações — nunca para lógica de negócio primária.
- Celery tasks SEMPRE recebem `tenant_schema: str` e abrem `schema_context(tenant_schema)` (CLAUDE.md).

---

## 5. Modelo de dados (Django)

> **Agent: `django-developer`.** Crie apps Django novos conforme separação abaixo. Use `EncryptedField` do pacote de LGPD para PII (CPF, telefone). Sempre adicione `is_active=True` e soft-delete ao invés de `.delete()` (CLAUDE.md).

### 5.1 — Apps Django

```
backend/core/apps/
├─ persons/              (existe)
├─ vehicles/             (existe)
├─ service_orders/       (existe — evoluir)
├─ budgets/              (NOVO)
├─ items/                (NOVO — catálogo de refs + item model compartilhado)
├─ imports/              (NOVO — Cilia/HDI/XML)
├─ fiscal/               (NOVO — NFSe/NFe via Focus NF-e)
├─ pdf_engine/           (NOVO — templates WeasyPrint)
├─ storage/              (NOVO — S3 abstraction)
├─ payments/             (NOVO)
├─ signatures/           (NOVO)
└─ authz/                (NOVO — Role/Permission)
```

### 5.2 — Tabelas de referência (`apps/items/models.py`)

```python
# apps/items/models.py
from django.db import models


class ItemOperationType(models.Model):
    """TROCA / RECUPERACAO / OVERLAP / PINTURA / R_I / MONTAGEM_DESMONTAGEM / DNC — extensível."""
    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]


class LaborCategory(models.Model):
    """FUNILARIA / PINTURA / MECANICA / ELETRICA / TAPECARIA / ACABAMENTO / VIDRACARIA / REPARACAO / SERVICOS."""
    code = models.CharField(max_length=40, unique=True, db_index=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]


# Seeds em data migration (apps/items/migrations/000N_seed_operation_types.py):
# ItemOperationType: TROCA, RECUPERACAO, OVERLAP, PINTURA, R_I, MONTAGEM_DESMONTAGEM, DNC
# LaborCategory: FUNILARIA, PINTURA, MECANICA, ELETRICA, TAPECARIA, ACABAMENTO, VIDRACARIA, REPARACAO, SERVICOS
```

### 5.3 — Budget (particular pré-OS) (`apps/budgets/models.py`)

```python
# apps/budgets/models.py
from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.persons.models import Person


class Budget(models.Model):
    """Orçamento particular. Entidade pré-OS. Nunca para seguradora."""
    number = models.CharField(max_length=20, unique=True, db_index=True)  # OR-000042
    customer = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="budgets")

    vehicle_plate = models.CharField(max_length=10, db_index=True)
    vehicle_description = models.CharField(max_length=200)

    cloned_from = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="clones")
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="source_budgets",
    )  # FK pro OS que nasceu deste budget (approved)

    is_active = models.BooleanField(default=True, db_index=True)  # soft-delete
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.number} — {self.vehicle_plate}"

    @property
    def active_version(self) -> "BudgetVersion | None":
        """A última versão (maior version_number). Pode ser qualquer status."""
        return self.versions.order_by("-version_number").first()


class BudgetVersion(models.Model):
    """Snapshot imutável após 'sent'. Draft é mutável."""
    STATUS_CHOICES = [
        ("draft", "Rascunho"),
        ("sent", "Enviado ao cliente"),
        ("approved", "Aprovado"),
        ("rejected", "Rejeitado"),
        ("expired", "Expirado"),
        ("revision", "Em revisão (vN+1 a caminho)"),
        ("superseded", "Superado por nova versão aprovada"),
    ]

    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name="versions")
    version_number = models.IntegerField()  # 1, 2, 3…
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft", db_index=True)

    valid_until = models.DateTimeField(null=True, blank=True)  # = sent_at + 30 dias

    # Totais cache (recalculados pelo Service ao mudar)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    net_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    labor_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    parts_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    content_hash = models.CharField(max_length=64, blank=True, default="")  # sha256 pós-congelamento
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

    @property
    def status_label(self) -> str:
        return f"{self.budget.number} v{self.version_number} — {self.get_status_display()}"

    def is_frozen(self) -> bool:
        return self.status != "draft"


class BudgetVersionItem(models.Model):
    """Item dentro de uma BudgetVersion. Imutável após vN virar 'sent'."""
    # Reutiliza o mesmo schema do ServiceOrderVersionItem (§5.4) — copiar modelo.
    # Agent deve criar ITEM_FIELDS como abstract model mixin em apps/items/mixins.py
    # e herdar aqui + no SOVI.
    version = models.ForeignKey(BudgetVersion, on_delete=models.CASCADE, related_name="items")
    # + ITEM_FIELDS mixin (ver §5.5)
```

### 5.4 — ServiceOrder (particular/seguradora) (`apps/service_orders/models.py`)

```python
# apps/service_orders/models.py  (EVOLUÇÃO do existente)
from decimal import Decimal
from django.db import models
from apps.persons.models import Person
from apps.items.mixins import ItemFieldsMixin  # ver §5.5


class Insurer(models.Model):
    """Catálogo de seguradoras. Seed: Yelum, HDI, Porto, Azul, Itaú."""
    code = models.CharField(max_length=40, unique=True)   # "yelum", "hdi", "porto"
    name = models.CharField(max_length=120)
    cnpj = models.CharField(max_length=18, blank=True, default="")
    import_source = models.CharField(
        max_length=20,
        choices=[("cilia_api", "Cilia API"), ("html_upload", "HTML Upload"), ("xml_upload", "XML Upload")],
    )
    is_active = models.BooleanField(default=True)


class ServiceOrder(models.Model):
    """OS — particular OU seguradora. Kanban de 15 estados preservado."""

    CUSTOMER_TYPES = [("PARTICULAR", "Particular"), ("SEGURADORA", "Seguradora")]

    STATUS_CHOICES = [  # 15 estados do Kanban — REGRA DE NEGÓCIO (CLAUDE.md)
        ("reception", "Recepção"),
        ("initial_survey", "Vistoria Inicial"),
        ("budget", "Orçamento (aprovação de versão)"),   # ← re-interpretado
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

    os_number = models.CharField(max_length=20, unique=True, db_index=True)  # OS-000088
    customer = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="service_orders")
    customer_type = models.CharField(max_length=12, choices=CUSTOMER_TYPES, db_index=True)

    vehicle_plate = models.CharField(max_length=10, db_index=True)
    vehicle_description = models.CharField(max_length=200)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="reception", db_index=True)
    previous_status = models.CharField(max_length=30, blank=True, default="")  # guardado ao entrar em 'budget'

    # Se particular
    source_budget = models.ForeignKey(
        "budgets.Budget", on_delete=models.PROTECT, null=True, blank=True, related_name="resulting_orders",
    )

    # Se seguradora
    insurer = models.ForeignKey(Insurer, on_delete=models.PROTECT, null=True, blank=True)
    casualty_number = models.CharField(max_length=40, blank=True, default="", db_index=True)
    external_budget_number = models.CharField(max_length=40, blank=True, default="")  # ex: "821980"
    policy_number = models.CharField(max_length=40, blank=True, default="")
    policy_item = models.CharField(max_length=20, blank=True, default="")
    franchise_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)  # soft-delete
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    legacy_databox_id = models.CharField(max_length=40, blank=True, default="", db_index=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # 1 sinistro = 1 OS (escolha do usuário, pergunta 7)
            models.UniqueConstraint(
                fields=["insurer", "casualty_number"],
                condition=models.Q(casualty_number__gt=""),
                name="uq_insurer_casualty",
            ),
        ]

    @property
    def active_version(self) -> "ServiceOrderVersion | None":
        return self.versions.order_by("-version_number").first()

    def balance_due(self, payer_block: str | None = None) -> Decimal:
        """Saldo a pagar. Filtrar por payer_block opcional."""
        # Implementação: sum(version.net_total do bloco) - sum(payments[block].amount)
        # Ver apps/payments/services.py
        ...


class ServiceOrderVersion(models.Model):
    """Snapshot imutável de uma versão da OS. v1 inicial, v2+ conforme gatilhos."""

    STATUS_CHOICES = [
        # Particular
        ("pending", "Pendente"),  # criada mas ainda sem aprovação
        ("approved", "Aprovada"),
        ("rejected", "Rejeitada"),
        # Seguradora (espelha Cilia / estado importado)
        ("analisado", "Analisado"),
        ("autorizado", "Autorizado"),
        ("correcao", "Em Correção"),
        ("em_analise", "Em Análise"),
        ("negado", "Negado"),
        # Universal
        ("superseded", "Superada"),
    ]

    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="versions")
    version_number = models.IntegerField()  # 1, 2, 3… interno

    external_version = models.CharField(max_length=40, blank=True, default="")  # "821980.1"
    external_numero_vistoria = models.CharField(max_length=60, blank=True, default="")  # XML: "531|2026|226472|0|12290418"
    external_integration_id = models.CharField(max_length=40, blank=True, default="")  # Cilia "11284203"

    source = models.CharField(
        max_length=20,
        choices=[
            ("manual", "Manual"),
            ("budget_approval", "Da aprovação de Budget"),
            ("cilia", "Cilia API"),
            ("hdi", "HDI HTML"),
            ("xml_porto", "XML Porto"),
            ("xml_azul", "XML Azul"),
            ("xml_itau", "XML Itaú"),
        ],
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)

    # Totais cache
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    net_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    labor_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    parts_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    # Por bloco
    total_seguradora = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_complemento_particular = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_franquia = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    content_hash = models.CharField(max_length=64, blank=True, default="")  # dedup de import

    raw_payload_s3_key = models.CharField(max_length=500, blank=True, default="")  # se veio de import
    import_attempt = models.ForeignKey(
        "imports.ImportAttempt", on_delete=models.SET_NULL, null=True, blank=True,
    )

    # Tabela de MO (valores/hora vigentes no momento da versão)
    hourly_rates = models.JSONField(default=dict, blank=True)
    # ex: {"FUNILARIA": 40.00, "PINTURA": 50.00, "MECANICA": 40.00, ...}

    # Desconto global aplicado (header Cilia mostra "Desconto 5,00%")
    global_discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=120, blank=True, default="")
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("service_order", "version_number")]
        ordering = ["-version_number"]

    @property
    def status_label(self) -> str:
        if self.external_version:
            return f"{self.external_version} — {self.get_status_display()}"
        return f"v{self.version_number} — {self.get_status_display()}"


class ServiceOrderVersionItem(ItemFieldsMixin):
    """Item da versão da OS. Imutável após versão ser aprovada/autorizada."""
    version = models.ForeignKey(ServiceOrderVersion, on_delete=models.CASCADE, related_name="items")

    class Meta:
        ordering = ["sort_order", "id"]
```

> `BudgetVersionItem` e `ServiceOrderVersionItem` herdam de `ItemFieldsMixin` (§5.5), portanto têm exatamente o mesmo schema de item, operações e flags. A diferença é apenas o parent `version` FK.

### 5.5 — ItemFields mixin (`apps/items/mixins.py`)

Schema compartilhado entre `BudgetVersionItem` e `ServiceOrderVersionItem`.

```python
# apps/items/mixins.py
from decimal import Decimal
from django.db import models


class ItemFieldsMixin(models.Model):
    """Schema comum de item (usado por Budget e ServiceOrder)."""

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

    SUPPLIER_CHOICES = [("OFICINA", "Oficina"), ("SEGURADORA", "Seguradora")]

    # Classificação
    bucket = models.CharField(max_length=20, choices=BUCKET_CHOICES, default="IMPACTO", db_index=True)
    payer_block = models.CharField(max_length=30, choices=PAYER_BLOCK_CHOICES, default="PARTICULAR", db_index=True)
    impact_area = models.IntegerField(null=True, blank=True, db_index=True)  # 1, 2, 3…
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES, default="PART")

    # Descrição + códigos
    description = models.CharField(max_length=300)
    external_code = models.CharField(max_length=60, blank=True, default="")  # "543035RA1C"
    internal_part = models.ForeignKey(
        "items.Part", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )

    # Tipo de peça
    part_type = models.CharField(max_length=20, choices=PART_TYPE_CHOICES, blank=True, default="")
    supplier = models.CharField(max_length=12, choices=SUPPLIER_CHOICES, default="OFICINA")

    # Financeiro
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=Decimal("1"))
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))   # venda
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)  # custo (margem)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    net_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))   # calculado

    # Flags (PDF Cilia mostra essas)
    flag_abaixo_padrao = models.BooleanField(default=False)
    flag_acima_padrao = models.BooleanField(default=False)
    flag_inclusao_manual = models.BooleanField(default=False)
    flag_codigo_diferente = models.BooleanField(default=False)
    flag_servico_manual = models.BooleanField(default=False)
    flag_peca_da_conta = models.BooleanField(default=False)

    sort_order = models.IntegerField(default=0)

    class Meta:
        abstract = True


class ItemOperation(models.Model):
    """Operação aplicada a um item. Um item pode ter múltiplas (TROCA + PINTURA + OVERLAP)."""

    # ContentType pra vincular a BudgetVersionItem OU ServiceOrderVersionItem
    # Alternativa simpler: duas FKs nullable (item_budget, item_so) — uma só preenchida.
    item_budget = models.ForeignKey(
        "budgets.BudgetVersionItem", on_delete=models.CASCADE, null=True, blank=True, related_name="operations",
    )
    item_so = models.ForeignKey(
        "service_orders.ServiceOrderVersionItem", on_delete=models.CASCADE, null=True, blank=True, related_name="operations",
    )

    operation_type = models.ForeignKey("items.ItemOperationType", on_delete=models.PROTECT)
    labor_category = models.ForeignKey("items.LaborCategory", on_delete=models.PROTECT)
    hours = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    labor_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))  # hours * rate

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

### 5.6 — Pareceres, ImpactAreaLabel (`apps/service_orders/models.py`)

```python
class ServiceOrderParecer(models.Model):
    """Timeline de workflow. Externo (importado) + interno (DSCar)."""

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
    version = models.ForeignKey(ServiceOrderVersion, on_delete=models.CASCADE, null=True, blank=True, related_name="pareceres")

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    flow_number = models.IntegerField(null=True, blank=True)  # "Fluxo 1" Cilia

    author_external = models.CharField(max_length=120, blank=True, default="")
    author_org = models.CharField(max_length=120, blank=True, default="")
    author_internal = models.CharField(max_length=120, blank=True, default="")  # User.username

    parecer_type = models.CharField(max_length=30, choices=PARECER_TYPE_CHOICES, blank=True, default="")
    body = models.TextField()

    created_at_external = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ImpactAreaLabel(models.Model):
    """Label opcional das áreas (1=Frontal, 2=Lateral direita, ...)."""
    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="area_labels")
    area_number = models.IntegerField()
    label_text = models.CharField(max_length=100)

    class Meta:
        unique_together = [("service_order", "area_number")]
```

### 5.7 — Event Log (`apps/service_orders/models.py`)

```python
class ServiceOrderEvent(models.Model):
    """Timeline universal de mutações em uma OS. Substitui ServiceOrderStatusHistory."""

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
        ("PHOTO_REMOVED", "Foto removida (soft)"),
        ("PAYMENT_RECORDED", "Pagamento registrado"),
        ("FISCAL_ISSUED", "Nota fiscal emitida"),
        ("SIGNATURE_CAPTURED", "Assinatura capturada"),
        ("BUDGET_LINKED", "Budget aprovado virou OS"),
    ]

    service_order = models.ForeignKey(ServiceOrder, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES, db_index=True)

    actor = models.CharField(max_length=120, blank=True, default="Sistema")
    payload = models.JSONField(default=dict, blank=True)  # detalhes do evento

    from_state = models.CharField(max_length=30, blank=True, default="")
    to_state = models.CharField(max_length=30, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service_order", "-created_at"]),
            models.Index(fields=["event_type", "-created_at"]),
        ]


# Migração: ServiceOrderStatusHistory → ServiceOrderEvent(event_type="STATUS_CHANGE")
# Ver §16.
```

### 5.8 — Outros models

- `apps/imports/models.py`: `ImportAttempt` (ver §7)
- `apps/fiscal/models.py`: `FiscalDocument` (ver §13)
- `apps/payments/models.py`: `Payment` (ver §6.4)
- `apps/signatures/models.py`: `Signature` (ver §12)
- `apps/storage/models.py`: `OSPhoto` (ver §11)
- `apps/authz/models.py`: `Role`, `Permission`, `RolePermission`, `UserPermission` (ver §14)
- `apps/items/models.py`: `Part` (catálogo interno peças), `NumberSequence` (ver §14)

---

## 6. Service layer (regras de negócio)

> **Agent: `django-developer` / `backend-developer`.** Toda mutação DEVE passar por Service. ViewSet nunca escreve direto em model. Service usa `@transaction.atomic` + `OSEventLogger.log_event()`.

### 6.1 — BudgetService (`apps/budgets/services.py`)

```python
# apps/budgets/services.py
from decimal import Decimal
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.items.services import NumberAllocator
from .models import Budget, BudgetVersion, BudgetVersionItem


class BudgetService:

    @classmethod
    @transaction.atomic
    def create(cls, *, customer, vehicle_plate, vehicle_description, created_by: str) -> Budget:
        budget = Budget.objects.create(
            number=NumberAllocator.allocate("BUDGET"),
            customer=customer,
            vehicle_plate=vehicle_plate.upper(),
            vehicle_description=vehicle_description,
        )
        BudgetVersion.objects.create(budget=budget, version_number=1, status="draft", created_by=created_by)
        return budget

    @classmethod
    @transaction.atomic
    def send_to_customer(cls, *, version: BudgetVersion, sent_by: str) -> BudgetVersion:
        """Congela a versão, gera PDF, marca 'sent', valid_until = now + 30 dias."""
        if version.status != "draft":
            raise ValidationError({"status": "Só versões em draft podem ser enviadas"})

        cls._recalculate_totals(version)
        cls._freeze(version)

        version.status = "sent"
        version.sent_at = timezone.now()
        version.valid_until = version.sent_at + timedelta(days=30)
        version.save()

        # Gera PDF
        from apps.pdf_engine.services import PDFService
        version.pdf_s3_key = PDFService.render_budget(version)
        version.save(update_fields=["pdf_s3_key"])
        return version

    @classmethod
    @transaction.atomic
    def approve(cls, *, version: BudgetVersion, approved_by: str, evidence_s3_key: str = "") -> "ServiceOrder":
        """Marca versão como aprovada e cria OS particular."""
        if version.status != "sent":
            raise ValidationError({"status": "Só versões em 'sent' podem ser aprovadas"})
        if version.valid_until and version.valid_until < timezone.now():
            raise ValidationError({"validity": "Orçamento expirado — crie um novo"})

        version.status = "approved"
        version.approved_at = timezone.now()
        version.approved_by = approved_by
        version.approval_evidence_s3_key = evidence_s3_key
        version.save()

        # Marca outras versões como superseded
        version.budget.versions.exclude(pk=version.pk).exclude(
            status__in=["approved", "rejected", "expired"]
        ).update(status="superseded")

        # Cria OS a partir da versão aprovada
        from apps.service_orders.services import ServiceOrderService
        os = ServiceOrderService.create_from_budget(version=version)
        version.budget.service_order = os
        version.budget.save(update_fields=["service_order"])

        return os

    @classmethod
    @transaction.atomic
    def reject(cls, *, version: BudgetVersion) -> BudgetVersion:
        if version.status != "sent":
            raise ValidationError({"status": "Só 'sent' pode ser rejeitada"})
        version.status = "rejected"
        version.save()
        return version

    @classmethod
    @transaction.atomic
    def request_revision(cls, *, version: BudgetVersion) -> BudgetVersion:
        """Cliente pediu ajuste. Cria v+1 em draft, marca vN como 'revision'."""
        if version.status != "sent":
            raise ValidationError({"status": "Só 'sent' pode entrar em revisão"})
        version.status = "revision"
        version.save()

        new_version = BudgetVersion.objects.create(
            budget=version.budget,
            version_number=version.version_number + 1,
            status="draft",
            created_by=version.created_by,
        )
        # Copia itens da versão anterior
        cls._copy_items(source=version, target=new_version)
        return new_version

    @classmethod
    def expire_stale_budgets(cls) -> int:
        """Celery task diária — marca sent expirados."""
        now = timezone.now()
        qs = BudgetVersion.objects.filter(status="sent", valid_until__lt=now)
        return qs.update(status="expired")

    @classmethod
    @transaction.atomic
    def clone(cls, *, source_budget: Budget, created_by: str) -> Budget:
        """Clona budget arquivado (rejected/expired) como novo."""
        new_b = Budget.objects.create(
            number=NumberAllocator.allocate("BUDGET"),
            customer=source_budget.customer,
            vehicle_plate=source_budget.vehicle_plate,
            vehicle_description=source_budget.vehicle_description,
            cloned_from=source_budget,
        )
        # Copia itens da última versão não-draft
        source_v = source_budget.versions.exclude(status="draft").order_by("-version_number").first()
        new_v = BudgetVersion.objects.create(budget=new_b, version_number=1, status="draft", created_by=created_by)
        if source_v:
            cls._copy_items(source=source_v, target=new_v)
        return new_b

    # Helpers privados

    @classmethod
    def _freeze(cls, version: BudgetVersion) -> None:
        """Calcula content_hash e impede edição subsequente dos itens (enforcement em save())."""
        import hashlib, json
        payload = [
            {k: str(v) for k, v in item.__dict__.items() if not k.startswith("_")}
            for item in version.items.all().order_by("sort_order", "pk")
        ]
        version.content_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        version.save(update_fields=["content_hash"])

    @classmethod
    def _recalculate_totals(cls, version: BudgetVersion) -> None:
        # Soma labor_cost das operations + net_price dos items
        labor = Decimal("0")
        parts = Decimal("0")
        subtotal = Decimal("0")
        discount = Decimal("0")

        for item in version.items.all().prefetch_related("operations"):
            item_net = item.net_price
            discount += (item.unit_price * item.quantity) - item_net
            if item.item_type == "PART":
                parts += item_net
            subtotal += item_net
            for op in item.operations.all():
                labor += op.labor_cost

        version.labor_total = labor
        version.parts_total = parts
        version.subtotal = subtotal + labor
        version.discount_total = discount
        version.net_total = version.subtotal - version.discount_total
        version.save()

    @classmethod
    def _copy_items(cls, *, source, target) -> None:
        for item in source.items.all().prefetch_related("operations"):
            new_item = BudgetVersionItem.objects.create(
                version=target,
                **{f.name: getattr(item, f.name) for f in item._meta.fields
                   if f.name not in ("id", "version")},
            )
            for op in item.operations.all():
                # nova op referenciando new_item
                from apps.items.models import ItemOperation
                ItemOperation.objects.create(
                    item_budget=new_item,
                    operation_type=op.operation_type,
                    labor_category=op.labor_category,
                    hours=op.hours,
                    hourly_rate=op.hourly_rate,
                    labor_cost=op.labor_cost,
                )
```

### 6.2 — ServiceOrderService (`apps/service_orders/services.py`)

```python
# apps/service_orders/services.py
from typing import Final
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.items.services import NumberAllocator
from .models import ServiceOrder, ServiceOrderVersion, ServiceOrderVersionItem
from .events import OSEventLogger
from .kanban import try_auto_transition


VALID_TRANSITIONS: Final[dict[str, list[str]]] = {
    "reception": ["initial_survey", "cancelled", "budget"],
    "initial_survey": ["budget"],
    "budget": ["waiting_parts", "repair"],
    "waiting_parts": ["repair"],
    "repair": ["mechanic", "bodywork", "polishing", "budget"],  # ← pode re-entrar em budget
    "mechanic": ["bodywork", "polishing", "budget"],
    "bodywork": ["painting", "budget"],
    "painting": ["assembly", "budget"],
    "assembly": ["polishing", "budget"],
    "polishing": ["washing", "budget"],
    "washing": ["final_survey", "budget"],
    "final_survey": ["ready"],
    "ready": ["delivered"],
    "delivered": [],
    "cancelled": [],
}


class ServiceOrderService:

    @classmethod
    @transaction.atomic
    def create_from_budget(cls, *, version) -> ServiceOrder:
        """Budget approved → cria OS particular v1 com itens copiados."""
        os = ServiceOrder.objects.create(
            os_number=NumberAllocator.allocate("SERVICE_ORDER"),
            customer=version.budget.customer,
            customer_type="PARTICULAR",
            vehicle_plate=version.budget.vehicle_plate,
            vehicle_description=version.budget.vehicle_description,
            source_budget=version.budget,
            status="reception",
        )
        os_v = ServiceOrderVersion.objects.create(
            service_order=os,
            version_number=1,
            source="budget_approval",
            status="approved",
            subtotal=version.subtotal,
            discount_total=version.discount_total,
            net_total=version.net_total,
            labor_total=version.labor_total,
            parts_total=version.parts_total,
            total_complemento_particular=Decimal("0"),
            total_seguradora=Decimal("0"),
            total_franquia=Decimal("0"),
        )
        cls._copy_items_from_budget(source=version, target=os_v)
        OSEventLogger.log_event(os, "BUDGET_LINKED", actor="Sistema",
                                 payload={"budget_number": version.budget.number, "version": version.version_number})
        OSEventLogger.log_event(os, "VERSION_CREATED", actor="Sistema",
                                 payload={"version_number": 1, "source": "budget_approval"})
        return os

    @classmethod
    @transaction.atomic
    def change_status(cls, *, service_order: ServiceOrder, new_status: str,
                      changed_by: str = "Sistema", notes: str = "",
                      is_auto: bool = False) -> ServiceOrder:
        """Muda status com validação de transição. Loga evento."""
        current = service_order.status
        allowed = VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise ValidationError({
                "status": f"Transição inválida: {current} → {new_status}. Permitidos: {allowed}"
            })

        # Guarda previous_status ao entrar em budget pro retorno automático
        if new_status == "budget":
            service_order.previous_status = current

        # Trava: ready → delivered exige NFS-e (particular) ou autorização (seguradora)
        if new_status == "delivered":
            ok, reason = cls._can_deliver(service_order)
            if not ok:
                raise ValidationError({"delivery": reason})

        service_order.status = new_status
        service_order.save(update_fields=["status", "previous_status", "updated_at"])

        OSEventLogger.log_event(
            service_order,
            "AUTO_TRANSITION" if is_auto else "STATUS_CHANGE",
            actor=changed_by,
            from_state=current,
            to_state=new_status,
            payload={"notes": notes},
        )
        return service_order

    @classmethod
    @transaction.atomic
    def create_new_version_from_import(cls, *, service_order: ServiceOrder,
                                         parsed_budget: "ParsedBudget",
                                         import_attempt) -> ServiceOrderVersion:
        """Chamado pelos importadores. Cria nova versão + pausa no budget."""
        next_num = (service_order.active_version.version_number if service_order.active_version else 0) + 1
        v = ServiceOrderVersion.objects.create(
            service_order=service_order,
            version_number=next_num,
            source=parsed_budget.source,
            external_version=parsed_budget.external_version,
            external_numero_vistoria=parsed_budget.external_numero_vistoria,
            external_integration_id=parsed_budget.external_integration_id,
            status=parsed_budget.external_status or "analisado",
            content_hash=parsed_budget.raw_hash,
            raw_payload_s3_key=import_attempt.raw_payload_s3_key,
            import_attempt=import_attempt,
            hourly_rates=parsed_budget.hourly_rates,
            global_discount_pct=parsed_budget.global_discount_pct,
        )
        # Cria items via ImportService (ver §7)
        from apps.imports.services import ImportService
        ImportService.persist_items(parsed_budget=parsed_budget, version=v)

        OSEventLogger.log_event(service_order, "VERSION_CREATED", actor="Sistema",
                                 payload={"version": next_num, "source": parsed_budget.source,
                                          "external": parsed_budget.external_version})
        OSEventLogger.log_event(service_order, "IMPORT_RECEIVED", actor="Sistema",
                                 payload={"source": parsed_budget.source,
                                          "attempt_id": import_attempt.pk})

        # Auto-transição pra budget se não estava lá
        if service_order.status != "budget" and service_order.status not in ("reception", "delivered", "cancelled"):
            cls.change_status(service_order=service_order, new_status="budget",
                              changed_by="Sistema", notes=f"Nova versão importada: {v.external_version or v.version_number}",
                              is_auto=True)
        return v

    @classmethod
    @transaction.atomic
    def approve_version(cls, *, version: ServiceOrderVersion, approved_by: str) -> ServiceOrderVersion:
        """Aceita nova versão e sai do estado 'budget' retornando ao previous_status."""
        os = version.service_order
        version.status = "autorizado" if os.customer_type == "SEGURADORA" else "approved"
        version.approved_at = timezone.now()
        version.save()

        # Marca outras versões como superseded
        os.versions.exclude(pk=version.pk).update(status="superseded")

        OSEventLogger.log_event(os, "VERSION_APPROVED", actor=approved_by,
                                 payload={"version": version.version_number})

        # Se OS está em 'budget' (pausa), retorna ao previous_status
        if os.status == "budget" and os.previous_status:
            cls.change_status(
                service_order=os, new_status=os.previous_status,
                changed_by="Sistema", notes="Auto: versão aprovada, retomando reparo",
                is_auto=True,
            )
        return version

    @classmethod
    def _can_deliver(cls, os: ServiceOrder) -> tuple[bool, str]:
        """Trava ready → delivered. CLAUDE.md regra."""
        if os.customer_type == "PARTICULAR":
            from apps.fiscal.models import FiscalDocument
            has_nfse = FiscalDocument.objects.filter(
                service_order=os, doc_type="NFSE", status="ISSUED"
            ).exists()
            if not has_nfse:
                return False, "NFS-e pendente — emitir antes da entrega"
        else:
            active = os.active_version
            if not active or active.status != "autorizado":
                return False, f"Versão {active.external_version if active else '?'} não autorizada"
        return True, ""

    @classmethod
    def _copy_items_from_budget(cls, *, source, target) -> None:
        for item in source.items.all().prefetch_related("operations"):
            new_item = ServiceOrderVersionItem.objects.create(
                version=target,
                payer_block="PARTICULAR",
                **{f.name: getattr(item, f.name) for f in item._meta.fields
                   if f.name not in ("id", "version", "payer_block")},
            )
            for op in item.operations.all():
                from apps.items.models import ItemOperation
                ItemOperation.objects.create(
                    item_so=new_item,
                    operation_type=op.operation_type,
                    labor_category=op.labor_category,
                    hours=op.hours,
                    hourly_rate=op.hourly_rate,
                    labor_cost=op.labor_cost,
                )
```

### 6.3 — Complemento particular dentro de OS-seguradora

```python
# apps/service_orders/services.py (continuação)

class ComplementoParticularService:

    @classmethod
    @transaction.atomic
    def add_complement(cls, *, service_order: ServiceOrder, items_data: list[dict],
                       approved_by: str) -> ServiceOrderVersion:
        """Cria nova versão com itens do payer_block=COMPLEMENTO_PARTICULAR."""
        if service_order.customer_type != "SEGURADORA":
            raise ValidationError({"type": "Complemento particular só em OS seguradora"})

        next_num = service_order.active_version.version_number + 1
        prev = service_order.active_version

        # Cria nova versão copiando itens da anterior + adicionando os novos
        new_v = ServiceOrderVersion.objects.create(
            service_order=service_order,
            version_number=next_num,
            source="manual",
            status="approved",
            hourly_rates=prev.hourly_rates,
        )

        # Copia itens anteriores
        ServiceOrderService._copy_items_from_version(source=prev, target=new_v)

        # Adiciona complementos
        for data in items_data:
            data["payer_block"] = "COMPLEMENTO_PARTICULAR"
            ServiceOrderVersionItem.objects.create(version=new_v, **data)

        # Recalcula e pausa na budget
        ServiceOrderService._recalculate_totals(new_v)
        OSEventLogger.log_event(service_order, "VERSION_CREATED", actor=approved_by,
                                 payload={"reason": "complement", "count": len(items_data)})
        return new_v
```

### 6.4 — PaymentService (`apps/payments/services.py`)

```python
# apps/payments/models.py
from decimal import Decimal
from django.db import models
from apps.service_orders.models import ServiceOrder


class Payment(models.Model):
    METHODS = [("PIX", "Pix"), ("BOLETO", "Boleto"), ("DINHEIRO", "Dinheiro"),
               ("CARTAO", "Cartão"), ("TRANSFERENCIA", "Transferência")]
    STATUSES = [("pending", "Pendente"), ("received", "Recebido"), ("refunded", "Estornado")]

    service_order = models.ForeignKey(ServiceOrder, on_delete=models.PROTECT, related_name="payments")
    payer_block = models.CharField(max_length=30, db_index=True)  # "SEGURADORA", "COMPLEMENTO_PARTICULAR", "FRANQUIA", "PARTICULAR"
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHODS)
    reference = models.CharField(max_length=200, blank=True, default="")

    received_at = models.DateTimeField(null=True, blank=True)
    received_by = models.CharField(max_length=120, blank=True, default="")

    fiscal_doc = models.ForeignKey(
        "fiscal.FiscalDocument", on_delete=models.SET_NULL, null=True, blank=True,
    )
    status = models.CharField(max_length=20, choices=STATUSES, default="pending", db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)


# apps/payments/services.py
class PaymentService:
    @classmethod
    @transaction.atomic
    def record(cls, *, service_order, payer_block, amount, method, reference, received_by):
        p = Payment.objects.create(
            service_order=service_order, payer_block=payer_block,
            amount=amount, method=method, reference=reference,
            received_by=received_by, received_at=timezone.now(), status="received",
        )
        OSEventLogger.log_event(service_order, "PAYMENT_RECORDED", actor=received_by,
                                 payload={"amount": str(amount), "method": method, "block": payer_block})
        return p
```

---

## 7. Importadores de seguradora

> **Agent: `python-pro` / `backend-developer`.** 1 agent por fonte (Cilia/HDI/XML) — podem rodar em paralelo (parallel-safe). Interface `SourceImporter` unificada.

### 7.1 — Interface e `ImportAttempt` (`apps/imports/models.py`, `apps/imports/services.py`)

```python
# apps/imports/models.py
class ImportAttempt(models.Model):
    TRIGGERS = [("polling", "Polling"), ("upload_manual", "Upload Manual")]
    SOURCES = [("cilia", "Cilia API"), ("hdi", "HDI HTML"),
               ("xml_porto", "XML Porto"), ("xml_azul", "XML Azul"), ("xml_itau", "XML Itaú")]

    source = models.CharField(max_length=20, choices=SOURCES, db_index=True)
    trigger = models.CharField(max_length=20, choices=TRIGGERS)

    raw_payload_s3_key = models.CharField(max_length=500)  # SEMPRE persiste payload bruto
    raw_hash = models.CharField(max_length=64, db_index=True)

    parsed_ok = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, default="")

    insurer_detected = models.CharField(max_length=40, blank=True, default="")
    casualty_detected = models.CharField(max_length=40, blank=True, default="")
    external_version_detected = models.CharField(max_length=40, blank=True, default="")

    service_order = models.ForeignKey("service_orders.ServiceOrder", on_delete=models.SET_NULL,
                                        null=True, blank=True)
    version_created = models.ForeignKey("service_orders.ServiceOrderVersion", on_delete=models.SET_NULL,
                                          null=True, blank=True)
    duplicate_of = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.CharField(max_length=120, blank=True, default="Sistema")
```

```python
# apps/imports/services.py
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal
from django.db import transaction
from apps.storage.services import S3Service
from apps.service_orders.services import ServiceOrderService
from apps.service_orders.models import ServiceOrder, Insurer
from .models import ImportAttempt


@dataclass
class ParsedItemDTO:
    bucket: str = "IMPACTO"
    payer_block: str = "SEGURADORA"
    impact_area: int | None = None
    item_type: str = "PART"
    description: str = ""
    external_code: str = ""
    part_type: str = ""
    supplier: str = "OFICINA"
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    net_price: Decimal = Decimal("0")
    flags: dict = field(default_factory=dict)
    operations: list[dict] = field(default_factory=list)  # [{op_type, labor_cat, hours, rate}]


@dataclass
class ParsedParecerDTO:
    flow_number: int | None = None
    author_external: str = ""
    author_org: str = ""
    parecer_type: str = ""
    body: str = ""
    created_at_external: str | None = None


@dataclass
class ParsedBudget:
    source: str
    insurer_code: str
    casualty_number: str
    external_budget_number: str
    external_version: str
    external_numero_vistoria: str = ""
    external_integration_id: str = ""
    external_status: str = "analisado"

    # Dados do veículo/segurado
    segurado_name: str = ""
    segurado_cpf: str = ""
    segurado_phone: str = ""
    vehicle_plate: str = ""
    vehicle_description: str = ""
    vehicle_chassis: str = ""
    vehicle_km: str = ""

    # Totais
    franchise_amount: Decimal = Decimal("0")
    global_discount_pct: Decimal = Decimal("0")
    hourly_rates: dict = field(default_factory=dict)

    items: list[ParsedItemDTO] = field(default_factory=list)
    pareceres: list[ParsedParecerDTO] = field(default_factory=list)

    raw_hash: str = ""


class SourceImporter(ABC):
    source: str  # "cilia" | "hdi" | "xml_porto" | ...

    @abstractmethod
    def parse(self, raw_payload: bytes) -> ParsedBudget: ...

    def process(self, raw_payload: bytes, trigger: str, actor: str) -> ImportAttempt:
        """Pipeline unificado: hash → dedup → parse → persist."""
        import hashlib
        raw_hash = hashlib.sha256(raw_payload).hexdigest()

        # Persiste payload bruto SEMPRE
        s3_key = S3Service.put_import_payload(self.source, raw_payload)

        attempt = ImportAttempt.objects.create(
            source=self.source, trigger=trigger,
            raw_payload_s3_key=s3_key, raw_hash=raw_hash,
            created_by=actor,
        )

        # Dedup exato (mesmo hash já processado com sucesso)
        dup = ImportAttempt.objects.filter(raw_hash=raw_hash, parsed_ok=True).exclude(pk=attempt.pk).first()
        if dup:
            attempt.duplicate_of = dup
            attempt.parsed_ok = False
            attempt.error_message = "Payload idêntico já processado"
            attempt.save()
            return attempt

        try:
            parsed = self.parse(raw_payload)
            parsed.raw_hash = raw_hash
            ImportService.persist_parsed(parsed=parsed, attempt=attempt)
            attempt.parsed_ok = True
            attempt.save()
        except Exception as exc:
            attempt.parsed_ok = False
            attempt.error_message = f"{type(exc).__name__}: {exc}"
            attempt.save()
            raise
        return attempt


class ImportService:

    @classmethod
    @transaction.atomic
    def persist_parsed(cls, *, parsed: ParsedBudget, attempt: ImportAttempt) -> None:
        """Encontra/cria OS + cria nova versão + itens + pareceres."""
        insurer = Insurer.objects.get(code=parsed.insurer_code)

        attempt.insurer_detected = insurer.code
        attempt.casualty_detected = parsed.casualty_number
        attempt.external_version_detected = parsed.external_version

        # Match OS existente por (insurer, casualty_number)
        os, created = ServiceOrder.objects.get_or_create(
            insurer=insurer, casualty_number=parsed.casualty_number,
            defaults={
                "os_number": cls._alloc_os_number(),
                "customer_type": "SEGURADORA",
                "customer": cls._get_or_create_segurado_person(parsed),
                "vehicle_plate": parsed.vehicle_plate.upper(),
                "vehicle_description": parsed.vehicle_description,
                "external_budget_number": parsed.external_budget_number,
                "policy_number": "",
                "franchise_amount": parsed.franchise_amount,
                "status": "reception",
            },
        )
        attempt.service_order = os

        # Se versão com esse external_version já existe, não recria
        if os.versions.filter(external_version=parsed.external_version, content_hash=parsed.raw_hash).exists():
            attempt.error_message = "Versão já importada (chave + hash idênticos)"
            return

        version = ServiceOrderService.create_new_version_from_import(
            service_order=os, parsed_budget=parsed, import_attempt=attempt,
        )
        attempt.version_created = version

        cls.persist_pareceres(parsed=parsed, service_order=os, version=version)

    @classmethod
    def persist_items(cls, *, parsed_budget: ParsedBudget, version) -> None:
        from apps.service_orders.models import ServiceOrderVersionItem
        from apps.items.models import ItemOperation, ItemOperationType, LaborCategory

        for dto in parsed_budget.items:
            item = ServiceOrderVersionItem.objects.create(
                version=version,
                **{k: v for k, v in dto.__dict__.items() if k not in ("operations", "flags")},
                **{f"flag_{k}": v for k, v in dto.flags.items()},
            )
            for op_data in dto.operations:
                ItemOperation.objects.create(
                    item_so=item,
                    operation_type=ItemOperationType.objects.get(code=op_data["op_type"]),
                    labor_category=LaborCategory.objects.get(code=op_data["labor_cat"]),
                    hours=op_data["hours"],
                    hourly_rate=op_data["rate"],
                    labor_cost=Decimal(op_data["hours"]) * Decimal(op_data["rate"]),
                )

    @classmethod
    def persist_pareceres(cls, *, parsed: ParsedBudget, service_order, version) -> None:
        from apps.service_orders.models import ServiceOrderParecer
        for p in parsed.pareceres:
            ServiceOrderParecer.objects.create(
                service_order=service_order, version=version,
                source=version.source,
                flow_number=p.flow_number,
                author_external=p.author_external, author_org=p.author_org,
                parecer_type=p.parecer_type, body=p.body,
                created_at_external=p.created_at_external,
            )
```

### 7.2 — Cilia Importer (`apps/imports/sources/cilia.py`)

```python
# apps/imports/sources/cilia.py
import httpx
from decimal import Decimal
from django.conf import settings
from apps.imports.services import SourceImporter, ParsedBudget, ParsedItemDTO


class CiliaImporter(SourceImporter):
    source = "cilia"

    def __init__(self):
        self.client = httpx.Client(
            base_url=settings.CILIA_API_BASE_URL,
            headers={"Authorization": f"Bearer {settings.CILIA_API_TOKEN}"},
            timeout=30,
        )

    def list_budgets_since(self, last_sync: str) -> list[dict]:
        r = self.client.get("/budgets", params={"since": last_sync, "oficina_cnpj": settings.DSCAR_CNPJ})
        r.raise_for_status()
        return r.json()["budgets"]

    def fetch_budget_json(self, budget_id: str) -> bytes:
        r = self.client.get(f"/budgets/{budget_id}/detail")
        r.raise_for_status()
        return r.content  # raw JSON bytes

    def parse(self, raw_payload: bytes) -> ParsedBudget:
        import json
        data = json.loads(raw_payload)
        header = data["dadosOrcamento"]

        pb = ParsedBudget(
            source=self.source,
            insurer_code=self._map_insurer(header["seguradora"]["nome"]),
            casualty_number=header["sinistro"],
            external_budget_number=header["orcamento"]["numero"],
            external_version=f"{header['orcamento']['numero']}.{header['orcamento']['versao']}",
            external_integration_id=header["numeroIntegracao"],
            external_status=self._map_status(data["status"]),
            segurado_name=header["segurado"]["nome"],
            vehicle_plate=header["placa"],
            vehicle_description=header["descricaoModelo"],
            vehicle_chassis=header["chassi"],
            franchise_amount=Decimal(str(data["totais"]["franquia"])),
            global_discount_pct=Decimal(str(header["descontoGlobalPct"])),
            hourly_rates={
                "MAO_DE_OBRA": Decimal(str(header["maoObraHora"])),
                "REPARACAO": Decimal(str(header["reparacaoHora"])),
                "PINTURA": Decimal(str(header["pinturaHora"])),
            },
        )

        # Parse itens por área de impacto
        for area in data.get("areasDeImpacto", []):
            area_num = area["numero"]
            for entry in area["itens"]:
                pb.items.append(self._parse_item(entry, area_num))

        # Parse pareceres
        for pe in data.get("ultimosPareceres", []):
            from apps.imports.services import ParsedParecerDTO
            pb.pareceres.append(ParsedParecerDTO(
                flow_number=pe["fluxo"],
                author_external=pe["criadoPor"],
                author_org=pe["organizacao"],
                parecer_type=pe.get("tipo", ""),
                body=pe["texto"],
                created_at_external=pe["dataCriacao"],
            ))

        return pb

    def _parse_item(self, entry: dict, area_num: int) -> ParsedItemDTO:
        # Legendas Cilia → operation types
        op_map = {"T": "TROCA", "R&I": "R_I", "R": "RECUPERACAO", "P": "PINTURA"}
        operations = []
        for op_code, hours in entry.get("operacoes", []):
            operations.append({
                "op_type": op_map[op_code],
                "labor_cat": self._infer_labor_cat(op_code, entry),
                "hours": Decimal(str(hours)),
                "rate": Decimal("40"),  # resolvido do header
            })
        return ParsedItemDTO(
            impact_area=area_num,
            description=entry["titulo"],
            external_code=entry.get("codigo", ""),
            part_type=entry.get("tipoPeca", ""),
            supplier=entry.get("fornecimento", "OFICINA").upper(),
            quantity=Decimal(str(entry["qtd"])),
            unit_price=Decimal(str(entry["preco"])),
            discount_pct=Decimal(str(entry.get("desconto", 0))),
            net_price=Decimal(str(entry["precoLiquido"])),
            flags={
                "abaixo_padrao": entry.get("abaixoPadrao", False),
                "acima_padrao": entry.get("acimaPadrao", False),
                "inclusao_manual": entry.get("inclusaoManual", False),
            },
            operations=operations,
        )

    def _map_insurer(self, nome: str) -> str:
        mapping = {"Yelum Seguradora": "yelum", "Porto Seguro": "porto",
                   "Azul Seguros": "azul", "Itaú Seguros": "itau", "HDI Seguros": "hdi"}
        return mapping.get(nome, "outras")

    def _map_status(self, s: str) -> str:
        return {"Analisado": "analisado", "Autorizado": "autorizado",
                "Correção": "correcao", "Em Análise": "em_analise"}.get(s, "analisado")

    def _infer_labor_cat(self, op_code: str, entry: dict) -> str:
        if op_code == "P":
            return "PINTURA"
        # ... lógica por descrição/tipo
        return "FUNILARIA"


# Celery task
from celery import shared_task
from django_tenants.utils import schema_context

@shared_task(bind=True, max_retries=3)
def sync_cilia_budgets(self, tenant_schema: str) -> dict:
    with schema_context(tenant_schema):
        imp = CiliaImporter()
        last_sync = ...  # carregar de settings/db
        results = {"processed": 0, "created": 0, "duplicates": 0, "errors": 0}
        for budget_meta in imp.list_budgets_since(last_sync):
            try:
                raw = imp.fetch_budget_json(budget_meta["id"])
                attempt = imp.process(raw, trigger="polling", actor="Sistema")
                results["processed"] += 1
                if attempt.duplicate_of:
                    results["duplicates"] += 1
                elif attempt.version_created:
                    results["created"] += 1
            except Exception:
                results["errors"] += 1
        return results
```

**Celery beat schedule** (em `config/celery.py`):
```python
app.conf.beat_schedule = {
    "sync-cilia-dscar": {
        "task": "apps.imports.sources.cilia.sync_cilia_budgets",
        "schedule": 60 * 15,  # 15 min
        "args": ["tenant_dscar"],
    },
}
```

### 7.3 — XML IFX Importer (`apps/imports/sources/xml_ifx.py`)

```python
# apps/imports/sources/xml_ifx.py
from lxml import etree
from decimal import Decimal
from apps.imports.services import SourceImporter, ParsedBudget, ParsedItemDTO


class XmlIfxImporter(SourceImporter):
    """Parser único para Porto/Azul/Itaú — schema IFX/finalizacaoOrcamentoVO."""
    source = "xml_ifx"  # source final resolvido pela seguradora detectada

    def parse(self, raw_payload: bytes) -> ParsedBudget:
        tree = etree.fromstring(raw_payload)
        dados = tree.find("dadosOrcamento")

        # Detecta seguradora por numeroDaApolice ou configuração
        apolice = dados.findtext("numeroDaApolice", "")
        insurer_code = self._detect_insurer(apolice, dados)

        # Validação de segurança: CNPJ da oficina deve ser DSCar
        cnpj = dados.findtext("numeroCpfCnpj", "").replace(".", "").replace("/", "").replace("-", "")
        if cnpj != "10362513000104":
            raise ValueError(f"CNPJ da oficina no XML ({cnpj}) não é DSCar")

        numero_vistoria = dados.findtext("numeroVistoria", "")  # "531|2026|226472|0|12290418"
        num_sinistro = dados.findtext("numSinistro", "")

        pb = ParsedBudget(
            source=f"xml_{insurer_code}",
            insurer_code=insurer_code,
            casualty_number=num_sinistro,
            external_budget_number=numero_vistoria.split("|")[2] if "|" in numero_vistoria else numero_vistoria,
            external_version=numero_vistoria,
            external_numero_vistoria=numero_vistoria,
            external_status="autorizado",  # XMLs só vêm quando finalizado
            segurado_name=dados.findtext("nomeSegurado", ""),
            vehicle_plate=dados.findtext("licencaDoVeiculo", ""),
            vehicle_description=dados.findtext("descricaoModelo", ""),
            vehicle_chassis=dados.findtext("nroChassiDoVeiculo", ""),
            vehicle_km=dados.findtext("quilometragem", ""),
        )

        # Franquia
        mao = tree.find("maoDeObra")
        if mao is not None:
            pb.franchise_amount = self._dec(mao.findtext("valorFranquia", "0"))

        # Hourly rates
        rates = tree.find("valoresMOPadrao")
        if rates is not None:
            pb.hourly_rates = {
                "FUNILARIA": self._dec(rates.findtext("funilaria", "0")),
                "PINTURA": self._dec(rates.findtext("pintura", "0")),
                "MECANICA": self._dec(rates.findtext("mecanica", "0")),
                "ELETRICA": self._dec(rates.findtext("eletrica", "0")),
                "TAPECARIA": self._dec(rates.findtext("tapecaria", "0")),
                "ACABAMENTO": self._dec(rates.findtext("acabamento", "0")),
            }

        # Mapeamento das 5 listas
        self._parse_pecas(tree.find("pecasTrocadas"), "TROCA", pb)
        self._parse_pecas(tree.find("pecasRecuperadas"), "RECUPERACAO", pb)
        self._parse_pecas(tree.find("pecasOverlap"), "OVERLAP", pb)
        self._parse_pecas(tree.find("pecasMontagemDesmontagem"), "MONTAGEM_DESMONTAGEM", pb)
        self._parse_pecas(tree.find("pecasDNC"), "DNC", pb)

        # Serviços terceiros
        svcs = tree.find("servicosTerceiros")
        if svcs is not None:
            for svc in svcs.findall("servico"):
                pb.items.append(ParsedItemDTO(
                    item_type="EXTERNAL_SERVICE",
                    impact_area=int(svc.findtext("divisaoOrcamento", "1")),
                    description=svc.findtext("descricaoServico", ""),
                    quantity=Decimal("1"),
                    unit_price=self._dec(svc.findtext("valorBruto", "0")),
                    net_price=self._dec(svc.findtext("valorLiquido", "0")),
                ))

        return pb

    def _parse_pecas(self, container, operation: str, pb: ParsedBudget) -> None:
        if container is None:
            return
        for peca in container.findall("peca"):
            tipo_uso = peca.findtext("tipoUso", "FUNILARIA")
            price = self._dec(peca.findtext("precoLiquido") or peca.findtext("precoNegociado") or "0")
            unit_price = self._dec(peca.findtext("precoBruto") or "0") or price

            item = ParsedItemDTO(
                impact_area=int(peca.findtext("divisaoOrcamento", "1")),
                item_type="PART",
                description=peca.findtext("descricaoPeca") or peca.findtext("apelidoPeca", ""),
                external_code=(peca.findtext("codigoOriginalPeca") or "").strip(),
                supplier="OFICINA" if peca.findtext("pecaFornecida", "false").lower() == "true" else "SEGURADORA",
                quantity=self._dec(peca.findtext("quantidadePecasItemOrcamento", "1")),
                unit_price=unit_price,
                discount_pct=self._dec(peca.findtext("descontoOficina", "0")),
                net_price=price,
                part_type=self._map_part_type(peca.findtext("pecaNegociada", "")),
                operations=[],
            )

            tempo_mo = self._dec(peca.findtext("tempoMaoDeObra", "0"))
            tempo_pt = self._dec(peca.findtext("tempoPintura", "0"))

            if tempo_mo > 0:
                item.operations.append({
                    "op_type": operation, "labor_cat": tipo_uso,
                    "hours": tempo_mo, "rate": pb.hourly_rates.get(tipo_uso, Decimal("0")),
                })
            if tempo_pt > 0:
                item.operations.append({
                    "op_type": "PINTURA", "labor_cat": "PINTURA",
                    "hours": tempo_pt, "rate": pb.hourly_rates.get("PINTURA", Decimal("0")),
                })

            pb.items.append(item)

    @staticmethod
    def _dec(s: str) -> Decimal:
        if not s:
            return Decimal("0")
        return Decimal(s.strip().replace(".", "").replace(",", "."))

    @staticmethod
    def _map_part_type(flag: str) -> str:
        return {"G": "GENUINA", "F": "ORIGINAL", "N": "OUTRAS_FONTES"}.get(flag.upper(), "")

    def _detect_insurer(self, apolice: str, dados) -> str:
        # Config tabela InsurerDetectionRule ou hardcoded MVP:
        # Por convenção DS Car sabe qual seguradora cada XML veio (upload manual já contém contexto)
        # No MVP: consultor escolhe no upload. Futuro: heurística por apolice.
        return "porto"  # fallback, sobrescrito pela UI no upload
```

### 7.4 — HDI HTML Importer (esqueleto)

```python
# apps/imports/sources/hdi.py
from bs4 import BeautifulSoup
from apps.imports.services import SourceImporter, ParsedBudget


class HdiImporter(SourceImporter):
    source = "hdi"

    def parse(self, raw_payload: bytes) -> ParsedBudget:
        soup = BeautifulSoup(raw_payload, "html.parser")
        # TODO: parser específico — obter amostra real HTML antes
        # Estrutura provável similar ao Cilia (áreas, itens, pareceres)
        pb = ParsedBudget(source="hdi", insurer_code="hdi", ...)
        # ...
        return pb
```

> ⚠️ **HDI — aguardar HTML real do portal**. Spec atual é placeholder. Agent deve pedir HTML de exemplo ao usuário antes de implementar parser.

---

## 8. API REST (DRF)

> **Agent: `api-designer` / `django-developer`.** ViewSets simples (apenas passam pra Service). Usar `ModelViewSet` onde faz sentido, `GenericViewSet` com `@action` onde custom. OpenAPI gerado por `drf-spectacular`.

### 8.1 — Endpoints

```
# Budgets (particular)
GET    /api/v1/budgets/
POST   /api/v1/budgets/
GET    /api/v1/budgets/{id}/
GET    /api/v1/budgets/{id}/versions/
POST   /api/v1/budgets/{id}/versions/               → cria v+1 em draft
GET    /api/v1/budgets/{id}/versions/{v}/
PATCH  /api/v1/budgets/{id}/versions/{v}/           → só se draft
GET    /api/v1/budgets/{id}/versions/{v}/pdf/       → stream PDF

POST   /api/v1/budgets/{id}/versions/{v}/send/      → congela + envia
POST   /api/v1/budgets/{id}/versions/{v}/approve/   → body: {approved_by, evidence_s3_key}
POST   /api/v1/budgets/{id}/versions/{v}/reject/
POST   /api/v1/budgets/{id}/versions/{v}/revision/  → cria v+1
POST   /api/v1/budgets/{id}/clone/                   → clona arquivado

# Itens de versão de budget
POST   /api/v1/budgets/{id}/versions/{v}/items/     → só draft
PATCH  /api/v1/budgets/{id}/versions/{v}/items/{item_id}/
DELETE /api/v1/budgets/{id}/versions/{v}/items/{item_id}/


# Service Orders
GET    /api/v1/service-orders/
POST   /api/v1/service-orders/                       → só particular manual (seguradora vem de import)
GET    /api/v1/service-orders/{id}/
POST   /api/v1/service-orders/{id}/change-status/   → body: {new_status, notes}

GET    /api/v1/service-orders/{id}/versions/
GET    /api/v1/service-orders/{id}/versions/{v}/
GET    /api/v1/service-orders/{id}/versions/{v}/diff/{prev_v}/   → comparativo
POST   /api/v1/service-orders/{id}/versions/{v}/approve/
POST   /api/v1/service-orders/{id}/complement/       → body: {items: [...]}

GET    /api/v1/service-orders/{id}/events/            → timeline (substitui status_history)
GET    /api/v1/service-orders/{id}/pareceres/
POST   /api/v1/service-orders/{id}/pareceres/         → parecer interno

# Imports
POST   /api/v1/imports/upload/                        → body: {source, file}
GET    /api/v1/imports/attempts/                      → auditoria
GET    /api/v1/imports/attempts/{id}/
POST   /api/v1/imports/cilia/sync/                    → gatilho manual do polling

# Fotos
GET    /api/v1/service-orders/{id}/photos/
POST   /api/v1/service-orders/{id}/photos/            → upload (multipart)
DELETE /api/v1/service-orders/{id}/photos/{photo_id}/ → soft

# Pagamentos
GET    /api/v1/service-orders/{id}/payments/
POST   /api/v1/service-orders/{id}/payments/          → registrar

# Fiscal
POST   /api/v1/service-orders/{id}/fiscal/nfse/issue/
POST   /api/v1/service-orders/{id}/fiscal/nfe/issue/
GET    /api/v1/service-orders/{id}/fiscal/documents/

# Assinatura
POST   /api/v1/signatures/                            → body: {os_id, doc_type, method, signature_png_b64}
POST   /api/v1/signatures/remote-link/                → gera token pro cliente assinar via link
POST   /api/v1/signatures/remote/{token}/             → cliente posta assinatura (público, sem auth)

# Tabelas de referência
GET    /api/v1/items/operation-types/
GET    /api/v1/items/labor-categories/
GET    /api/v1/insurers/

# Dashboard / KPIs
GET    /api/v1/dashboard/budget-conversion/           → taxa aprovação/rejeição
GET    /api/v1/dashboard/os-pipeline/                 → quantos em cada estado
GET    /api/v1/dashboard/margem-por-seguradora/       → só user com perm view_cost_margin
```

### 8.2 — Exemplo de ViewSet + Serializer

```python
# apps/budgets/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Budget, BudgetVersion
from .serializers import BudgetSerializer, BudgetVersionSerializer, BudgetVersionDetailSerializer
from .services import BudgetService


class BudgetViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Budget.objects.filter(is_active=True).select_related("customer").prefetch_related("versions")
    serializer_class = BudgetSerializer

    def create(self, request):
        budget = BudgetService.create(
            customer_id=request.data["customer_id"],
            vehicle_plate=request.data["vehicle_plate"],
            vehicle_description=request.data["vehicle_description"],
            created_by=request.user.username,
        )
        return Response(self.get_serializer(budget).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def clone(self, request, pk=None):
        source = self.get_object()
        new_b = BudgetService.clone(source_budget=source, created_by=request.user.username)
        return Response(self.get_serializer(new_b).data, status=status.HTTP_201_CREATED)


class BudgetVersionViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetVersionDetailSerializer

    def get_queryset(self):
        return BudgetVersion.objects.filter(
            budget_id=self.kwargs["budget_pk"]
        ).prefetch_related("items__operations__operation_type", "items__operations__labor_category")

    @action(detail=True, methods=["post"])
    def send(self, request, budget_pk=None, pk=None):
        version = self.get_object()
        BudgetService.send_to_customer(version=version, sent_by=request.user.username)
        return Response(self.get_serializer(version).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, budget_pk=None, pk=None):
        version = self.get_object()
        os = BudgetService.approve(
            version=version,
            approved_by=request.user.username,
            evidence_s3_key=request.data.get("evidence_s3_key", ""),
        )
        from apps.service_orders.serializers import ServiceOrderSerializer
        return Response({"version": self.get_serializer(version).data,
                         "service_order": ServiceOrderSerializer(os).data})

    @action(detail=True, methods=["post"])
    def reject(self, request, budget_pk=None, pk=None):
        version = self.get_object()
        BudgetService.reject(version=version)
        return Response(self.get_serializer(version).data)

    @action(detail=True, methods=["post"])
    def revision(self, request, budget_pk=None, pk=None):
        version = self.get_object()
        new_v = BudgetService.request_revision(version=version)
        return Response(self.get_serializer(new_v).data, status=status.HTTP_201_CREATED)
```

### 8.3 — Exemplo Serializer (nested items+operations)

```python
# apps/budgets/serializers.py
from rest_framework import serializers
from apps.items.serializers import ItemOperationSerializer
from .models import Budget, BudgetVersion, BudgetVersionItem


class BudgetVersionItemSerializer(serializers.ModelSerializer):
    operations = ItemOperationSerializer(many=True, read_only=True)

    class Meta:
        model = BudgetVersionItem
        fields = [
            "id", "bucket", "payer_block", "impact_area", "item_type",
            "description", "external_code", "part_type", "supplier",
            "quantity", "unit_price", "unit_cost", "discount_pct", "net_price",
            "flag_abaixo_padrao", "flag_acima_padrao", "flag_inclusao_manual",
            "flag_codigo_diferente", "flag_servico_manual", "flag_peca_da_conta",
            "sort_order", "operations",
        ]


class BudgetVersionDetailSerializer(serializers.ModelSerializer):
    items = BudgetVersionItemSerializer(many=True, read_only=True)
    status_label = serializers.CharField(read_only=True)

    class Meta:
        model = BudgetVersion
        fields = [
            "id", "version_number", "status", "status_label",
            "valid_until", "subtotal", "discount_total", "net_total",
            "labor_total", "parts_total", "pdf_s3_key",
            "sent_at", "approved_at", "approved_by",
            "items",
        ]
        read_only_fields = ["subtotal", "discount_total", "net_total", "labor_total", "parts_total"]


class BudgetSerializer(serializers.ModelSerializer):
    active_version = BudgetVersionDetailSerializer(read_only=True)

    class Meta:
        model = Budget
        fields = ["id", "number", "customer", "vehicle_plate", "vehicle_description",
                  "cloned_from", "service_order", "active_version", "created_at"]
```

---

## 9. Frontend (Next.js / TanStack Query)

> **Agent: `react-specialist` / `nextjs-developer`.** Usar shadcn/ui + TanStack Query v5 + Zod para validar response. Sempre 3 estados (Skeleton / error / empty) conforme CLAUDE.md.

### 9.1 — Estrutura de pastas

```
apps/dscar-web/src/
├─ api/
│  ├─ budgets.ts
│  ├─ serviceOrdersV2.ts
│  ├─ imports.ts
│  ├─ payments.ts
│  └─ fiscal.ts
├─ hooks/
│  ├─ useBudget.ts
│  ├─ useServiceOrderV2.ts
│  ├─ useImport.ts
│  └─ useTimeline.ts
├─ schemas/                    ← Zod
│  ├─ budget.ts
│  ├─ serviceOrder.ts
│  └─ item.ts
├─ components/Budget/
│  ├─ BudgetList.tsx
│  ├─ BudgetDetail.tsx
│  ├─ BudgetVersionEditor.tsx  ← edita draft, congelado é read-only
│  ├─ BudgetItemForm.tsx
│  ├─ BudgetStatusBadge.tsx
│  └─ BudgetSendDialog.tsx
├─ components/ServiceOrderV2/
│  ├─ OSDetail.tsx              ← tabs: Versões / Timeline / Fotos / Pagamentos / Fiscal
│  ├─ OSVersionComparison.tsx   ← diff v1 vs v2 (ex: seguradora)
│  ├─ OSTimeline.tsx            ← events
│  ├─ OSComplementForm.tsx      ← complemento particular
│  └─ OSPhotoGallery.tsx
├─ components/Imports/
│  ├─ ImportUploader.tsx        ← dropzone XML/HTML
│  └─ ImportAttemptsTable.tsx
└─ components/Kanban.tsx (existente — atualizar status 'budget')
```

### 9.2 — Zod schemas (`schemas/budget.ts`)

```typescript
import { z } from "zod";

export const BudgetStatusSchema = z.enum([
  "draft", "sent", "approved", "rejected", "expired", "revision", "superseded"
]);

export const ItemOperationSchema = z.object({
  id: z.string(),
  operation_type: z.object({ code: z.string(), label: z.string() }),
  labor_category: z.object({ code: z.string(), label: z.string() }),
  hours: z.string(),  // Decimal serializa como string
  hourly_rate: z.string(),
  labor_cost: z.string(),
});

export const BudgetVersionItemSchema = z.object({
  id: z.string(),
  bucket: z.enum(["IMPACTO", "SEM_COBERTURA", "SOB_ANALISE"]),
  payer_block: z.enum(["SEGURADORA", "COMPLEMENTO_PARTICULAR", "FRANQUIA", "PARTICULAR"]),
  impact_area: z.number().nullable(),
  item_type: z.enum(["PART", "SERVICE", "EXTERNAL_SERVICE", "FEE", "DISCOUNT"]),
  description: z.string(),
  external_code: z.string(),
  part_type: z.string(),
  supplier: z.enum(["OFICINA", "SEGURADORA"]),
  quantity: z.string(),
  unit_price: z.string(),
  unit_cost: z.string().nullable(),
  discount_pct: z.string(),
  net_price: z.string(),
  operations: z.array(ItemOperationSchema),
});

export const BudgetVersionSchema = z.object({
  id: z.string(),
  version_number: z.number(),
  status: BudgetStatusSchema,
  status_label: z.string(),
  valid_until: z.string().nullable(),
  subtotal: z.string(),
  net_total: z.string(),
  pdf_s3_key: z.string(),
  items: z.array(BudgetVersionItemSchema),
});

export const BudgetSchema = z.object({
  id: z.string(),
  number: z.string(),
  customer: z.string(),
  vehicle_plate: z.string(),
  vehicle_description: z.string(),
  active_version: BudgetVersionSchema.nullable(),
  created_at: z.string(),
});

export type Budget = z.infer<typeof BudgetSchema>;
export type BudgetVersion = z.infer<typeof BudgetVersionSchema>;
```

### 9.3 — TanStack Query hook (`hooks/useBudget.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/budgets";
import { BudgetSchema } from "../schemas/budget";

export function useBudget(id: string) {
  return useQuery({
    queryKey: ["budgets", id],
    queryFn: async () => {
      const data = await api.getBudget(id);
      return BudgetSchema.parse(data);  // valida runtime
    },
  });
}

export function useSendBudgetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, versionId }: { budgetId: string; versionId: string }) =>
      api.sendVersion(budgetId, versionId),
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: ["budgets", budgetId] });
    },
  });
}

export function useApproveBudgetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, versionId, evidenceS3Key, approvedBy }: {
      budgetId: string; versionId: string; evidenceS3Key: string; approvedBy: string;
    }) => api.approveVersion(budgetId, versionId, { evidence_s3_key: evidenceS3Key, approved_by: approvedBy }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["service-orders"] });  // OS criada
    },
  });
}
```

### 9.4 — Componente (sketch) `BudgetVersionEditor.tsx`

```tsx
// Read-only se status !== "draft"
export function BudgetVersionEditor({ version, budgetId }: Props) {
  const { mutate: send, isPending } = useSendBudgetVersion();
  const isDraft = version.status === "draft";

  return (
    <div className="space-y-4">
      <BudgetStatusBadge status={version.status} label={version.status_label} />
      <ItemsTable items={version.items} readOnly={!isDraft} />
      {isDraft && (
        <Button onClick={() => send({ budgetId, versionId: version.id })} disabled={isPending}>
          Enviar ao cliente
        </Button>
      )}
      {version.status === "sent" && (
        <>
          <ApproveDialog budgetId={budgetId} versionId={version.id} />
          <RejectButton budgetId={budgetId} versionId={version.id} />
          <RevisionButton budgetId={budgetId} versionId={version.id} />
        </>
      )}
    </div>
  );
}
```

---

## 10. PDF Engine (WeasyPrint)

> **Agent: `python-pro`.** Usar WeasyPrint 62+. Templates Jinja2 em `apps/pdf_engine/templates/`. Helper Decimal→BRL.

### 10.1 — Setup

```python
# apps/pdf_engine/services.py
from weasyprint import HTML
from django.template.loader import render_to_string
from apps.storage.services import S3Service


class PDFService:

    @classmethod
    def render_budget(cls, version) -> str:
        """Retorna S3 key do PDF gerado."""
        html_string = render_to_string("pdf_engine/budget.html", {
            "version": version,
            "budget": version.budget,
            "customer": version.budget.customer,
            "items_by_area": cls._group_by_area(version),
            "totals": cls._compute_totals(version),
            "hoje": timezone.now(),
        })
        pdf_bytes = HTML(string=html_string).write_pdf()
        key = f"service-orders/_budgets/{version.budget.number}/v{version.version_number}.pdf"
        S3Service.put(key, pdf_bytes, content_type="application/pdf")
        return key

    @classmethod
    def render_os_open(cls, os) -> str: ...
    @classmethod
    def render_os_delivery(cls, os, signature_key: str | None = None) -> str: ...
    @classmethod
    def render_version_diff(cls, prev_v, new_v) -> str: ...
```

### 10.2 — Templates

```
apps/pdf_engine/templates/pdf_engine/
├─ base.html                  ← header (logo, CNPJ, endereço DS Car) + footer (rodapé legal)
├─ budget.html
├─ os_open.html
├─ os_delivery.html
├─ version_diff.html
├─ payment_receipt.html
└─ _partials/
   ├─ items_table.html
   ├─ totals_block.html
   ├─ customer_block.html
   └─ signature_box.html
```

Exemplo `budget.html`:

```html
{% extends "pdf_engine/base.html" %}

{% block title %}Orçamento {{ budget.number }}{% endblock %}

{% block content %}
  <h1>Orçamento — {{ version.status_label }}</h1>
  <p><strong>Número:</strong> {{ budget.number }} · v{{ version.version_number }}</p>
  <p><strong>Validade:</strong> {{ version.valid_until|date:"d/m/Y" }}</p>

  {% include "pdf_engine/_partials/customer_block.html" %}

  {% for area, items in items_by_area %}
    <h3>Área de Impacto {{ area }}</h3>
    {% include "pdf_engine/_partials/items_table.html" with items=items %}
  {% endfor %}

  {% include "pdf_engine/_partials/totals_block.html" with totals=totals %}

  {% include "pdf_engine/_partials/signature_box.html" %}
{% endblock %}
```

---

## 11. Fotos & S3 storage layer

> **Agent: `backend-developer`.** Django-storages + boto3. Sempre soft-delete (`is_active=False`), **nunca** `.delete()` (CLAUDE.md).

### 11.1 — `S3Service`

```python
# apps/storage/services.py
import boto3
from django.conf import settings


class S3Service:
    _client = None

    @classmethod
    def _get_client(cls):
        if cls._client is None:
            cls._client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION,
            )
        return cls._client

    @classmethod
    def _build_key(cls, tenant_schema: str, *parts: str) -> str:
        return "/".join([tenant_schema, *parts])

    @classmethod
    def put_photo(cls, os_id: str, impact_area: int | None, phase: str | None,
                   file_bytes: bytes, ext: str = "jpg") -> str:
        import uuid
        from django.db import connection
        schema = connection.tenant.schema_name
        parts = ["service-orders", os_id, "photos"]
        if impact_area is not None:
            parts.append(str(impact_area))
        if phase:
            parts.append(phase.lower())
        parts.append(f"{uuid.uuid4()}.{ext}")
        key = cls._build_key(schema, *parts)
        cls.put(key, file_bytes, content_type=f"image/{ext}")
        return key

    @classmethod
    def put(cls, key: str, payload: bytes, content_type: str) -> None:
        cls._get_client().put_object(
            Bucket=settings.AWS_S3_BUCKET, Key=key, Body=payload,
            ContentType=content_type, ServerSideEncryption="AES256",
        )

    @classmethod
    def get_signed_url(cls, key: str, expires: int = 3600) -> str:
        return cls._get_client().generate_presigned_url(
            "get_object", Params={"Bucket": settings.AWS_S3_BUCKET, "Key": key}, ExpiresIn=expires,
        )

    @classmethod
    def put_import_payload(cls, source: str, raw_payload: bytes) -> str:
        import uuid, datetime
        from django.db import connection
        schema = connection.tenant.schema_name
        stamp = datetime.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        key = cls._build_key(schema, "imports", source, f"{stamp}-{uuid.uuid4()}.bin")
        cls.put(key, raw_payload, content_type="application/octet-stream")
        return key
```

### 11.2 — `OSPhoto` model

```python
# apps/storage/models.py
class OSPhoto(models.Model):
    PHASE_CHOICES = [
        ("BEFORE", "Antes"), ("DURING", "Durante"),
        ("AFTER", "Depois"), ("CHECKLIST", "Checklist"), ("DELIVERY", "Entrega"),
    ]

    service_order = models.ForeignKey("service_orders.ServiceOrder", on_delete=models.CASCADE,
                                        related_name="photos")
    impact_area = models.IntegerField(null=True, blank=True, db_index=True)
    phase = models.CharField(max_length=20, choices=PHASE_CHOICES, blank=True, default="", db_index=True)

    s3_key = models.CharField(max_length=500, unique=True)
    original_filename = models.CharField(max_length=200, blank=True, default="")
    mime_type = models.CharField(max_length=60, blank=True, default="")
    size_bytes = models.BigIntegerField(default=0)
    watermark_applied = models.BooleanField(default=False)

    caption = models.TextField(blank=True, default="")
    uploaded_by = models.CharField(max_length=120, blank=True, default="")
    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)

    is_active = models.BooleanField(default=True, db_index=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    deactivated_by = models.CharField(max_length=120, blank=True, default="")

    legacy_databox_id = models.CharField(max_length=40, blank=True, default="")

    class Meta:
        ordering = ["-uploaded_at"]
```

---

## 12. Assinatura digital

> **Agent: `fullstack-developer`.** Canvas HTML5 + merge no PDF + JWT pra link remoto.

```python
# apps/signatures/models.py
class Signature(models.Model):
    METHODS = [("CANVAS_TABLET", "Canvas Tablet"), ("REMOTE_LINK", "Link Remoto"), ("SCAN_PDF", "Scan")]
    DOC_TYPES = [
        ("BUDGET_APPROVAL", "Aprovação de Orçamento"),
        ("OS_OPEN", "Recepção do Veículo"),
        ("OS_DELIVERY", "Entrega do Veículo"),
        ("COMPLEMENT_APPROVAL", "Complemento Particular"),
    ]

    service_order = models.ForeignKey("service_orders.ServiceOrder", on_delete=models.PROTECT,
                                        null=True, blank=True)
    budget = models.ForeignKey("budgets.Budget", on_delete=models.PROTECT, null=True, blank=True)
    document_type = models.CharField(max_length=40, choices=DOC_TYPES)
    method = models.CharField(max_length=20, choices=METHODS)

    signer_name = models.CharField(max_length=200)
    signer_cpf = models.CharField(max_length=14, blank=True, default="")  # EncryptedField em prod

    signature_image_s3_key = models.CharField(max_length=500)  # PNG
    pdf_s3_key = models.CharField(max_length=500)              # PDF final com merge
    signature_hash = models.CharField(max_length=64)            # sha256 do PDF

    signed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True, default="")


# apps/signatures/services.py
class SignatureService:

    @classmethod
    def capture_canvas(cls, *, service_order=None, budget=None, document_type: str,
                        signer_name: str, signer_cpf: str, signature_png_b64: str,
                        ip: str, ua: str) -> Signature: ...

    @classmethod
    def generate_remote_link(cls, *, service_order, document_type: str, expires_hours: int = 48) -> str:
        """Retorna URL pública com JWT curto."""
        import jwt
        payload = {"os_id": str(service_order.id), "doc_type": document_type,
                   "exp": datetime.utcnow() + timedelta(hours=expires_hours)}
        token = jwt.encode(payload, settings.SIGNATURE_REMOTE_SECRET, algorithm="HS256")
        return f"{settings.PUBLIC_URL}/sign/{token}"
```

---

## 13. Fiscal

> **Agent: `fintech-engineer`.** Focus NF-e como gateway. `SEFAZ_ENV=homologation` em dev/staging (CLAUDE.md).

```python
# apps/fiscal/models.py
class FiscalDocument(models.Model):
    DOC_TYPES = [("NFSE", "NFS-e"), ("NFE", "NFe"), ("RPS", "RPS")]
    STATUSES = [("pending", "Pendente"), ("issued", "Emitida"),
                ("cancelled", "Cancelada"), ("rejected", "Rejeitada")]

    service_order = models.ForeignKey("service_orders.ServiceOrder", on_delete=models.PROTECT,
                                        related_name="fiscal_docs")
    version = models.ForeignKey("service_orders.ServiceOrderVersion", on_delete=models.PROTECT)
    payer_block = models.CharField(max_length=30)  # cobra qual "bolso"
    doc_type = models.CharField(max_length=10, choices=DOC_TYPES)
    status = models.CharField(max_length=20, choices=STATUSES, default="pending", db_index=True)

    number = models.CharField(max_length=40, blank=True, default="", db_index=True)
    access_key = models.CharField(max_length=60, blank=True, default="")  # chave SEFAZ
    focus_ref = models.CharField(max_length=80, blank=True, default="")   # Focus NF-e reference

    amount = models.DecimalField(max_digits=14, decimal_places=2)

    pdf_s3_key = models.CharField(max_length=500, blank=True, default="")
    xml_s3_key = models.CharField(max_length=500, blank=True, default="")

    issued_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")


# apps/fiscal/services.py
class FiscalService:

    @classmethod
    def issue_nfse(cls, *, os, payer_block: str = "PARTICULAR") -> FiscalDocument:
        """Emite NFS-e para a soma de MO+serviços (ISS Manaus)."""
        labor_amount = cls._sum_labor(os.active_version, payer_block=payer_block)
        # Chama Focus NF-e via API
        # Persiste FiscalDocument com status pending → issued/rejected
        ...

    @classmethod
    def issue_nfe(cls, *, os, payer_block: str = "PARTICULAR") -> FiscalDocument:
        """Emite NFe para a soma das peças (ICMS)."""
        parts_amount = cls._sum_parts(os.active_version, payer_block=payer_block)
        ...
```

---

## 14. Permissões & numeração

### 14.1 — `apps/authz/models.py`

```python
class Permission(models.Model):
    code = models.CharField(max_length=60, unique=True)  # "budget.approve"
    label = models.CharField(max_length=200)
    module = models.CharField(max_length=40)


class Role(models.Model):
    code = models.CharField(max_length=40, unique=True)  # "OWNER", "ADMIN", "MANAGER", "CONSULTANT", "MECHANIC", "FINANCIAL"
    label = models.CharField(max_length=100)
    permissions = models.ManyToManyField(Permission, through="RolePermission")


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    class Meta:
        unique_together = [("role", "permission")]


class UserRole(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    class Meta:
        unique_together = [("user", "role")]


class UserPermission(models.Model):
    """Override individual — ganha/perde permissão específica."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    granted = models.BooleanField(default=True)  # False = negada explicitamente
    class Meta:
        unique_together = [("user", "permission")]
```

**Seed inicial** (data migration): conforme matriz de Pergunta 19.

**Helper**:
```python
# apps/authz/services.py
def user_has_perm(user, perm_code: str) -> bool:
    # check UserPermission override → else check via Role → RolePermission
    override = UserPermission.objects.filter(user=user, permission__code=perm_code).first()
    if override:
        return override.granted
    return RolePermission.objects.filter(
        role__userrole__user=user, permission__code=perm_code,
    ).exists()
```

### 14.2 — NumberSequence (`apps/items/models.py`)

```python
class NumberSequence(models.Model):
    SEQ_TYPES = [("BUDGET", "Budget"), ("SERVICE_ORDER", "Service Order")]
    sequence_type = models.CharField(max_length=20, choices=SEQ_TYPES, unique=True)
    prefix = models.CharField(max_length=10)       # "OR-" | "OS-"
    padding = models.IntegerField(default=6)
    next_number = models.IntegerField(default=1)


# apps/items/services.py
class NumberAllocator:
    @classmethod
    @transaction.atomic
    def allocate(cls, sequence_type: str) -> str:
        seq = NumberSequence.objects.select_for_update().get(sequence_type=sequence_type)
        number = seq.next_number
        seq.next_number += 1
        seq.save(update_fields=["next_number"])
        return f"{seq.prefix}{number:0{seq.padding}d}"
```

---

## 15. Event Log & Auto-Kanban

> **Agent: `backend-developer`.** Cross-cutting — agent deve implementar DEPOIS que §5 e §6 estão estáveis.

### 15.1 — `OSEventLogger` (`apps/service_orders/events.py`)

```python
from django.db import transaction
from .models import ServiceOrder, ServiceOrderEvent


class OSEventLogger:
    @classmethod
    def log_event(cls, service_order: ServiceOrder, event_type: str, *,
                   actor: str = "Sistema", payload: dict | None = None,
                   from_state: str = "", to_state: str = "") -> ServiceOrderEvent:
        return ServiceOrderEvent.objects.create(
            service_order=service_order, event_type=event_type,
            actor=actor, payload=payload or {},
            from_state=from_state, to_state=to_state,
        )
```

### 15.2 — Auto-Kanban rules (`apps/service_orders/kanban.py`)

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import ServiceOrderVersion
from apps.fiscal.models import FiscalDocument


@receiver(post_save, sender=ServiceOrderVersion)
def auto_return_from_budget(sender, instance, created, **kwargs):
    """Quando versão é aprovada/autorizada e OS está em 'budget', retorna ao previous_status."""
    if created:
        return
    os = instance.service_order
    if os.status != "budget":
        return
    if instance.status not in ("approved", "autorizado"):
        return
    if not os.previous_status:
        return
    from .services import ServiceOrderService
    ServiceOrderService.change_status(
        service_order=os, new_status=os.previous_status,
        changed_by="Sistema", notes=f"Auto: versão {instance.version_number} aprovada",
        is_auto=True,
    )


@receiver(post_save, sender=FiscalDocument)
def unlock_delivery_on_nfse_issued(sender, instance, created, **kwargs):
    """Quando NFS-e é emitida e OS está em 'ready', notifica (não move auto — só libera)."""
    if instance.doc_type != "NFSE" or instance.status != "issued":
        return
    # Não moveu automaticamente: só loga evento informativo
    from .events import OSEventLogger
    OSEventLogger.log_event(
        instance.service_order, "FISCAL_ISSUED", actor="Sistema",
        payload={"doc_type": instance.doc_type, "number": instance.number},
    )
```

---

## 16. Estratégia de migração

### 16.1 — Estado atual do código

- `ServiceOrder` existe com campos `os_number, customer, vehicle_plate, vehicle_description, status, total_value, notes, is_active, created_at, updated_at`.
- `ServiceOrderStatusHistory` existe.
- Nenhuma OS criada ainda em produção (pré-MVP).

### 16.2 — Plano de migração

**Fase A — Schema novo (nova branch)**
1. Criar novos apps conforme §5.1.
2. `makemigrations` — gera migrations novas.
3. Evoluir `ServiceOrder` existente: adicionar `customer_type`, `previous_status`, `source_budget`, `insurer`, `casualty_number`, `external_budget_number`, `policy_number`, `franchise_amount`, `legacy_databox_id`.
4. Converter `ServiceOrderStatusHistory` → `ServiceOrderEvent` via data migration:
   ```python
   # migration RunPython
   def migrate_history(apps, schema_editor):
       SOStatusHistory = apps.get_model("service_orders", "ServiceOrderStatusHistory")
       SOEvent = apps.get_model("service_orders", "ServiceOrderEvent")
       for h in SOStatusHistory.objects.all():
           SOEvent.objects.create(
               service_order=h.service_order, event_type="STATUS_CHANGE",
               actor=h.changed_by, from_state=h.from_status, to_state=h.to_status,
               payload={"notes": h.notes}, created_at=h.changed_at,
           )
   ```
5. `total_value` do model antigo vira `@property` computada sobre `active_version.net_total`. Campo físico mantido por 1 ciclo pra safety, marcado como `deprecated=True` em comment.
6. Data migration: pra cada OS existente, cria `ServiceOrderVersion` v1 com 0 itens (ou popula via parsing do frontend mock, se já houver dados).

**Fase B — Seeds**
- `Insurer`: Yelum, Porto, Azul, Itaú, HDI, Mapfre, Tokio, Bradesco.
- `ItemOperationType`: 7 operações.
- `LaborCategory`: 9 categorias.
- `NumberSequence`: BUDGET (prefix OR-), SERVICE_ORDER (prefix OS-).
- `Role` + `Permission` + `RolePermission`: seeds MVP.

**Fase C — Integração Databox (migração de 10k OS)**
- Já existe etl/ mencionado no CLAUDE.md.
- ETL converte export Databox → cria `ServiceOrder` + `ServiceOrderVersion` v1 + itens mapeados.
- `legacy_databox_id` preservado em todos.

---

## 17. Testes

> **Agent: `test-automator` / `qa-expert`.** pytest + pytest-django + factory-boy. Meta: 80% coverage nos services.

### 17.1 — Estrutura

```
apps/budgets/tests/
├─ test_services.py        ← unit tests dos métodos do BudgetService
├─ test_viewsets.py         ← integration via APIClient
├─ factories.py             ← factory-boy
├─ test_pdf.py
└─ test_expiration.py

apps/service_orders/tests/
├─ test_services.py
├─ test_kanban_transitions.py
├─ test_auto_transition.py
├─ test_version_creation.py
└─ test_events.py

apps/imports/tests/
├─ test_cilia_importer.py
├─ test_xml_ifx_importer.py     ← usar fixtures XML reais em fixtures/
├─ test_hdi_importer.py
├─ test_dedup.py
└─ fixtures/
   ├─ cilia_821980_1.json
   ├─ cilia_821980_2.json        ← simular complemento
   ├─ xml_porto_sample.xml       ← os 2 xmls reais que o user forneceu
   └─ xml_porto_sample_v2.xml
```

### 17.2 — Cenários críticos

- Budget aprovado → cria OS, marca outras versões superseded
- Budget `sent` expira em 30 dias (test_expiration com freezegun)
- Budget clonado preserva `cloned_from`
- ServiceOrder particular cria versão 1 a partir de Budget
- OS-seguradora `.2` importada → OS vai pra `budget`, snapshot de v1 mantido
- OS-seguradora aprovada em `budget` → retorna ao previous_status
- Trava delivery sem NFS-e (particular)
- Dedup: mesmo XML 2x não cria duplicado
- Complemento particular cria nova versão mantendo bloco seguradora
- Pareceres importados do Cilia viram timeline
- `ServiceOrderEvent` gerado para cada mutação

---

## 18. Acceptance criteria

| Módulo | Critério | Como testar |
|---|---|---|
| Budget CRUD | Consigo criar, editar, enviar, aprovar, rejeitar, clonar | API integration test + curl |
| Budget expira 30d | `sent` vira `expired` via celery task | freezegun + unit |
| OS-particular de Budget | Budget aprovado → OS v1 criada com itens copiados | integration |
| OS-seguradora import XML | Upload XML exemplo → OS criada com 11 itens | fixture XML real |
| OS-seguradora v2 pausa | `.2` importado → estado vai pra `budget`, v1 mantido | integration |
| OS-seguradora v2 aprovada | Retorna ao previous_status | signal test |
| Complemento particular | Adiciona itens block COMPLEMENTO → nova versão | unit |
| Trava delivery | particular sem NFSE → ValidationError | unit |
| Timeline | Cada mutação gera evento | integration |
| PDF budget | Baixo PDF legível | manual |
| Assinatura canvas | POST PNG → PDF final com merge | integration |
| Fotos S3 | Upload + signed URL funciona | boto3 mock |
| Cilia polling | Task agendada roda e cria/atualiza versões | celery eager |
| Dedup | Mesmo hash 2x → marcado duplicate | unit |
| Permissões | Usuário sem `view_cost_margin` não vê custo | permission test |

---

## 19. Ordem de execução

**Ciclo 1 — Foundation (sequencial, serial-only)**
1. §5 Models (todos, sem lógica) + migrations
2. §14.2 NumberSequence + seeds
3. §5.2 Tabelas de ref + seeds

**Ciclo 2 — Core services (parallel OK após ciclo 1)**
4. §6.1 BudgetService ← agent A
5. §6.2 ServiceOrderService ← agent B (pode paralelo com A)
6. §15.1 OSEventLogger ← agent C (mini)

**Ciclo 3 — API + Frontend base (parallel OK)**
7. §8 ViewSets Budget + ServiceOrder ← agent D
8. §9 Frontend schemas + hooks ← agent E
9. §10 PDF templates ← agent F

**Ciclo 4 — Imports (parallel OK)**
10. §7.2 CiliaImporter ← agent G
11. §7.3 XmlIfxImporter ← agent H (com XMLs reais fornecidos)
12. §7.4 HdiImporter ← agent I (aguardar HTML sample)

**Ciclo 5 — Transversais (parallel OK)**
13. §11 Fotos + S3 ← agent J
14. §12 Assinatura ← agent K
15. §13 Fiscal ← agent L (mais pesado, pode ser serial)
16. §14.1 Permissões ← agent M
17. §15.2 Auto-Kanban signals ← agent N (após tudo de cima)

**Ciclo 6 — Integração e polimento**
18. §17 Testes e2e cruzando módulos
19. §16 Migração Databox (em paralelo com §17)
20. Performance audit + dashboards

---

## 20. Perguntas em aberto / Roadmap v2

- **HDI HTML**: aguardando amostra real pra finalizar parser.
- **Seguradoras adicionais** (Mapfre, Tokio, Bradesco): descobrir se usam IFX ou formato próprio.
- **Módulo de estoque completo**: reserva de peça, OC automática, sugestão de fornecedor. Roadmap v2.
- **Foto vinculada a item específico**: roadmap v2.
- **UI de gestão de permissões** (checkbox por role): roadmap v2.
- **Dashboard KPI completo** (conversão budget, margem por seguradora, tempo médio por estado): roadmap v2.
- **Notificações push/email** (cliente recebe budget via email): roadmap v2.
- **Mobile app** (Expo + WatermelonDB): roadmap v2.
- **KPI serviços adicionais** (quanto a oficina ganha com ADD/BDR/KBP/TDA etc. do Cilia): roadmap v2.

---

## Anexos

### A.1 — Schema XML IFX real

Ver arquivos em `fixtures/xml_ifx/`:
- `QZP8B26_531_2026_226472_0_12290418_20260420_041607.xml`
- `TAF7C72_531_2026_233175_0_12298737_20260420_041538.xml`

### A.2 — Schema Cilia (amostra)

PDF `Cilia - Orçamento 821980.1.pdf` com todas as seções esperadas do JSON da API (inferido):
- dadosOrcamento (header)
- areasDeImpacto[] (com itens)
- totais (por tipo de MO, por bucket)
- ultimosPareceres[] (fluxos)
- statusOrcamento, tipoDeConclusao

### A.3 — Pontos-chave do CLAUDE.md honrados

- ✅ Multitenancy: `schema_context(tenant_schema)` em toda task Celery
- ✅ LGPD: EncryptedField em CPF/telefone, soft-delete sempre
- ✅ S3: NUNCA deletado, soft via `is_active=False`
- ✅ Fiscal: NFS-e obrigatória antes de `delivered` (particular)
- ✅ SEFAZ_ENV=homologation em dev/staging
- ✅ Nunca `print()` — sempre `logger.getLogger(__name__)`
- ✅ Nunca raw SQL — ORM only
- ✅ Type hints obrigatórios
- ✅ TS strict, Zod em API, 3 estados (loading/error/empty)
- ✅ Conventional Commits

---

**Fim do documento.** Implementação: seguir §19 e disparar subagents conforme §3.
