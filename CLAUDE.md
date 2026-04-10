# Paddock Solutions · paddock.solutions
# CLAUDE.md — Contexto Global do Monorepo
# Lido automaticamente pelo Claude Code em toda sessão.
# ─────────────────────────────────────────────────────────────────────────────

## 🏢 A Empresa

**Paddock Solutions** é uma software house que desenvolve sistemas digitais
personalizados: ERPs, PDVs, e-commerces, automações e LPs — com foco no setor
automotivo e varejo.

**Cliente interno de referência:** Grupo DS Car (Manaus, AM)
**Repositório:** grupo-dscar (monorepo Turborepo)
**Desenvolvedor:** fundador solo + Claude Code como par de programação

---

## 🏁 Cliente: Grupo DS Car

| Empresa | Slug | App | Domínio |
|---------|------|-----|---------|
| DS Car Centro Automotivo | `dscar` | ERP (OS, Kanban, IA) | dscar.paddock.solutions |
| Loja de Peças Automotivas | `pecas` | PDV + E-commerce | pecas.paddock.solutions |
| Loja de Vidros | `vidros` | PDV + E-commerce | vidros.paddock.solutions |
| Loja de Estética | `estetica` | PDV + E-commerce | estetica.paddock.solutions |
| Portal Hub / SSO | `hub` | SSO + Analytics | paddock.solutions |

---

## 🗂️ Estrutura do Monorepo

```
grupo-dscar/
├── CLAUDE.md                         ← este arquivo
├── turbo.json
├── package.json
│
├── apps/
│   ├── hub/                          ← Portal SSO (Next.js 15)
│   ├── dscar-web/                    ← ERP DS Car (Next.js 15)
│   ├── store-web/                    ← PDV + E-commerce lojas (Next.js 15)
│   └── mobile/                      ← App React Native + Expo
│
├── backend/
│   ├── core/                         ← Django 5 — API principal
│   │   ├── apps/
│   │   │   ├── authentication/       ← SSO, JWT, OIDC (Keycloak)
│   │   │   ├── tenants/              ← Multitenancy (django-tenants)
│   │   │   ├── customers/            ← Cliente unificado + LGPD
│   │   │   ├── service_orders/       ← OS, Kanban, Checklist (DS Car)
│   │   │   ├── inventory/            ← Estoque por tenant
│   │   │   ├── fiscal/               ← NF-e, NFS-e, NFC-e (nfelib)
│   │   │   ├── crm/                  ← CRM + WhatsApp (Evolution API)
│   │   │   ├── store/                ← PDV + E-commerce
│   │   │   └── ai/                   ← Claude API + RAG
│   │   └── config/
│   └── workers/                      ← Node.js workers (WhatsApp, NF-e)
│
├── packages/
│   ├── ui/                           ← Design system compartilhado
│   ├── types/                        ← TypeScript types + VALID_TRANSITIONS
│   ├── auth/                         ← Auth helpers (JWT, OIDC)
│   └── utils/
│
├── data/
│   ├── migrations/                   ← ETL legado (Box Empresa → 10k OS, 7k clientes)
│   ├── dbt/                          ← Modelos dbt (Data Warehouse)
│   └── seeds/                        ← FIPE, manuais, dados automotivos
│
└── infra/
    ├── terraform/                    ← IaC AWS
    └── docker/                       ← docker-compose.dev.yml
```

---

## 🛠️ Stack Tecnológica

### Frontend
```
Framework:   Next.js 15 (App Router)
Linguagem:   TypeScript (strict SEMPRE)
Estilo:      Tailwind CSS + shadcn/ui
State:       Zustand (global) + TanStack Query v5 (server state)
Forms:       React Hook Form + Zod
Realtime:    Socket.io client
Auth:        next-auth v5 (OIDC → Keycloak + dev-credentials)
Testes:      Vitest + Playwright
DnD:         @dnd-kit/core + @dnd-kit/sortable (Kanban)
```

### Mobile
```
Framework:   React Native + Expo SDK 52
Roteamento:  Expo Router v4
Câmera:      expo-camera + expo-image-manipulator (marca d'água local)
Offline:     WatermelonDB
Auth:        expo-auth-session (OIDC)
State:       Zustand + MMKV
```

### Backend
```
Framework:   Django 5 + Django REST Framework
Linguagem:   Python 3.12 (type hints OBRIGATÓRIOS)
Tenancy:     django-tenants (schema-per-tenant)
Auth:        mozilla-django-oidc + simplejwt + PyJWT (JWKS)
Tasks:       Celery 5 + Redis
Realtime:    Django Channels + Redis
Fiscal:      nfelib (NF-e/NFC-e) + Focus NF-e (NFS-e)
Pagamentos:  Asaas
Linting:     Black + isort (OBRIGATÓRIO)
Testes:      pytest + pytest-django + factory-boy
API Docs:    drf-spectacular (Swagger automático)
```

### Infraestrutura
```
Banco:       PostgreSQL 16 + pgvector
Cache/Queue: Redis 7
Storage:     AWS S3
DW:          S3 (Parquet) + AWS Glue + Athena + dbt
BI:          Metabase (self-hosted)
SSO:         Keycloak 24 (self-hosted)
Cloud:       AWS (ECS Fargate + RDS + ElastiCache + S3)
IaC:         Terraform
CI/CD:       GitHub Actions
WhatsApp:    Evolution API (self-hosted)
Consulta placa: placa-fipe.apibrasil.com.br (gratuita, sem chave, POST /placa/consulta)
IA:          Claude API (Anthropic) + RAG (pgvector)
Monit:       Sentry + Grafana
```

---

## 📐 Padrões de Código

### Commits (Conventional Commits — obrigatório)
```
feat(dscar): adiciona painel IA na abertura de OS
fix(auth): corrige refresh token expirado no mobile
chore(infra): atualiza terraform ECS Fargate
docs(claude): atualiza CLAUDE.md com módulo fiscal
test(inventory): adiciona testes para baixa de estoque
refactor(customers): extrai lógica LGPD para serviço
```

### TypeScript
```typescript
// strict sempre ativo — nunca 'any', usar 'unknown' + narrowing
// retornos de funções sempre tipados explicitamente
// dados externos (API, forms): sempre validar com Zod — nunca 'as Type'
// imports: externos → internos → tipos
```

### Python / Django
```python
# type hints obrigatórios em funções e métodos
# docstrings em classes e métodos públicos (Google Style)
# nunca raw SQL — usar ORM Django
# select_related/prefetch_related obrigatórios quando há relações
# logger = logging.getLogger(__name__) — nunca print()
```

---

## 🔐 Autenticação — Fluxo Dev vs Prod

### Dev (dev-credentials)
- Provider `dev-credentials` no next-auth: qualquer email + senha `paddock123`
- Gera JWT **HS256** com `{ email, role: "ADMIN", jti }` — secret `dscar-dev-secret-paddock-2025`
- Backend: `DevJWTAuthentication` valida HS256 e faz `get_or_create` do `GlobalUser` por `email_hash`
- `session.role = "ADMIN"` propagado automaticamente → todos os `PermissionGate` liberados

### Prod (Keycloak)
- Provider `Keycloak` no next-auth — OIDC padrão
- Gera JWT **RS256** — chave pública via JWKS endpoint
- Backend: `KeycloakJWTAuthentication` usa `PyJWKClient` para validar RS256
  - JWKS URL: `http://keycloak:8080/realms/paddock/protocol/openid-connect/certs`
  - Fallback: retorna `None` (warn) se Keycloak offline — sem crash 500
- `session.role` extraído de `token.realm_access.roles`
- **Setup Keycloak:** Antes do primeiro `docker compose up`, criar schema PostgreSQL:
  ```bash
  docker exec paddock_postgres psql -U paddock -d paddock_dev -c "CREATE SCHEMA IF NOT EXISTS keycloak;"
  ```
- **Seed users:**
  - `admin@paddock.solutions / admin123` (ADMIN)
  - `thiago@paddock.solutions / paddock123` (OWNER)

### Tenant Routing (dev)
- Node.js fetch ignora header `Host` customizado
- Proxy Next.js envia `X-Tenant-Domain: dscar.localhost` (dinâmico via `session.activeCompany`)
- `DevTenantMiddleware` lê `X-Tenant-Domain` antes de usar o `Host` padrão

### Proxy API Route
- Rota: `apps/dscar-web/src/app/api/proxy/[...path]/route.ts`
- **Sempre adiciona trailing slash** antes de repassar ao Django (`APPEND_SLASH=True`)
- Encaminha `Authorization: Bearer <token>` e `X-Tenant-Domain`
- **Redirect pós-login:** `/login` → `/os` (não `result.url` que é URL interna)

---

## 🔐 Regras de Negócio Críticas

### Multitenancy — nunca violar
```python
# ERRADO — vaza dados entre empresas
ServiceOrder.objects.filter(status='open')

# CORRETO — context manager explícito (Celery, scripts)
from django_tenants.utils import schema_context
with schema_context('tenant_dscar'):
    ServiceOrder.objects.filter(status='open')

# Tasks Celery SEMPRE recebem tenant_schema como parâmetro
@shared_task
def my_task(data: dict, tenant_schema: str) -> None:
    with schema_context(tenant_schema):
        ...
```

### JWT Claims — estrutura padrão
```json
{
  "sub": "uuid",
  "email": "user@email.com",
  "companies": ["dscar", "pecas"],
  "active_company": "dscar",
  "role": "CONSULTANT",
  "tenant_schema": "tenant_dscar",
  "client_slug": "grupo-dscar"
}
```

### RBAC — hierarquia de roles
```typescript
// packages/types/src/index.ts
OWNER: 5 > ADMIN: 4 > MANAGER: 3 > CONSULTANT: 2 > STOREKEEPER: 1

// Proteção de componentes
<PermissionGate role="CONSULTANT">  // mínimo CONSULTANT para ver
  <Button>Nova OS</Button>
</PermissionGate>

// Hook
const canEdit = usePermission("MANAGER"); // true se role >= MANAGER
```

### Ordens de Serviço — regras Kanban
```typescript
// packages/types/src/index.ts — VALID_TRANSITIONS (espelho do backend)
// Transições são validadas CLIENT-SIDE antes de chamar o backend
// O backend também valida — dupla proteção

// Número da OS: gerado automaticamente (MAX + 1) — nunca enviar no POST
// customer_id: UUID ref ao schema público — não é FK, não tem validação cross-schema
// customer_name: campo desnormalizado — sempre enviar junto com customer_id
```

### LGPD — dados pessoais
```python
# CPF, email, telefone: SEMPRE EncryptedField
# group_sharing_consent: SEMPRE verificar antes de cruzar dados entre empresas
# Logs: NUNCA incluir CPF, email ou telefone em texto claro
# Hard delete de clientes: PROIBIDO — usar erasure (anonimização)
# Lookup por email: usar email_hash (SHA-256) — EncryptedEmailField não suporta filter()
```

### Estoque — nunca negativo
```python
# Constraint em banco: CHECK (quantity >= 0)
# No código: select_for_update() + verificação antes de debitar
# InsufficientStockError — nunca deixar negativo silenciosamente
```

### Fotos de OS — imutáveis
```python
# Fotos são evidência de sinistro para seguradoras
# Soft delete apenas (is_active=False) — S3 key NUNCA deletado
# Marca d'água processada no device antes do upload
```

### NF-e — emissão obrigatória
```python
# OS de cliente particular: NF-e ou NFS-e OBRIGATÓRIA ao fechar
# Ambiente: homologação em dev/staging, produção em prod
# XMLs autorizados: sempre salvar no S3
```

---

## 🖥️ Componentes Frontend Relevantes (dscar-web)

### Modais de Criação
```
src/components/modals/
├── NovoClienteModal.tsx   ← Dialog: nome, telefone, CPF, email, LGPD
└── NovaOSModal.tsx        ← Dialog scrollável: busca cliente + inline create + veículo
```
- Abertos a partir de `/clientes` e `/os` via `useState(false)` no botão
- Inline create: dentro do `NovaOSModal`, permite cadastrar cliente sem sair do fluxo

### Kanban
```
src/components/kanban/
├── KanbanBoard.tsx   ← DndContext + validação VALID_TRANSITIONS client-side
├── KanbanColumn.tsx  ← useDroppable por status
└── KanbanCard.tsx    ← useSortable + router.push (sem <Link> aninhado)
```
- `over.id` pode ser UUID de card ou status de coluna — KanbanBoard resolve ambos
- Otimismo: override de status enquanto refetch não completa
- Erros: toast com próximos passos permitidos

### RBAC
```
src/hooks/usePermission.ts     ← retorna boolean baseado em ROLE_HIERARCHY
src/components/PermissionGate.tsx  ← wrapper condicional por role
src/lib/withRoleGuard.ts           ← HOC para páginas inteiras
src/middleware.ts                  ← proteção de rotas /admin e /configuracoes
```

---

## 🔌 Variáveis de Ambiente

| Variável | Serviço |
|----------|---------|
| `AUTH_SECRET` | next-auth v5 (signing JWTs) |
| `ANTHROPIC_API_KEY` | Claude API (IA) |
| `EVOLUTION_API_URL` / `_KEY` | WhatsApp |
| ~~`SIEVE_API_KEY`~~ | Removido — usar placa-fipe.apibrasil.com.br (sem chave) |
| `DSCAR_CNPJ` / `_CERT_PATH` / `_CERT_PASSWORD` | NF-e DS Car |
| `FOCUSNFE_TOKEN` | NFS-e |
| `ASAAS_API_KEY` / `_ENV` | Pagamentos |
| `AWS_S3_BUCKET` / `AWS_ACCESS_KEY_ID` | Storage |
| `DW_S3_BUCKET` | Data Warehouse |
| `SEFAZ_ENV` | `homologation` ou `production` |
| `SENTRY_DSN` | Monitoramento |
| `DEV_JWT_SECRET` | Secret HS256 dev (padrão: `dscar-dev-secret-paddock-2025`) |
| `KEYCLOAK_CLIENT_ID` / `_SECRET` / `_ISSUER` | OIDC Keycloak |

---

## ⚡ Comandos Úteis

```bash
# Desenvolvimento local
make dev             # sobe todos os serviços Docker
make dev-stop        # para os serviços
make dev-ps          # status dos serviços
make dev-logs        # logs em tempo real

# Banco de dados
make migrate         # roda migrations em todos os tenants
make shell           # Django shell com contexto de tenant

# Testes
make test            # todos os testes
make test-backend    # apenas pytest
make test-web        # Vitest + Playwright
make lint            # ESLint + Black + isort (verificação)
make format          # Black + isort (correção automática)
make typecheck       # mypy + tsc

# Claude Code
/mcp                 # verificar MCPs conectados
/clear               # limpar contexto da sessão
/compact             # comprimir contexto em sessões longas
```

---

## 🧠 Uso da IA (Claude API)

```python
# Modelo padrão:   claude-sonnet-4-6 (custo-benefício)
# Modelo pesado:   claude-opus-4-6 (tarefas complexas)
# Temperature:     0.3 para dados factuais | 0.7+ para texto criativo
# Embeddings RAG:  pgvector no PostgreSQL

# Casos de uso:
# 1. Recomendações de OS — ao abrir atendimento (Celery, async)
# 2. Cross-sell — produtos para cliente da OS
# 3. Normalização de dados — veículos de APIs de placa
# 4. Churn prediction — clientes em risco de abandono
```

---

## 📋 Checklist antes de abrir PR

- [ ] `make lint` passou sem erros
- [ ] `make typecheck` passou sem erros
- [ ] Testes relevantes escritos e passando
- [ ] Nenhum dado pessoal em logs ou respostas de API
- [ ] Migrations sem operações destrutivas (ou aprovadas)
- [ ] Novas variáveis de ambiente documentadas aqui
- [ ] Commit segue Conventional Commits

---

## 🗺️ Sprints em Andamento

### Sprint 14 — Abril 2026 (em progresso)
**Contas a Pagar + Contas a Receber**
- Backend: `apps.accounts_payable` + `apps.accounts_receivable` (TENANT_APPS)
- Integração automática com `accounting.JournalEntryService` (baixa gera lançamento)
- Frontend: `/financeiro/contas-pagar` + `/financeiro/contas-receber` (substituindo placeholders)

---

## 📦 Sprints Entregues

### Sprint 13 — Abril 2026
**Integração RH↔Contabilidade + Impostos Trabalhistas**
- `apps/hr/tax_calculator.py` — INSS/IRRF/FGTS progressivo (tabelas 2024/2025)
- `apps/hr/accounting_service.py` — lançamentos automáticos ao fechar contracheque/pagar vale/registrar bônus
- `PayslipService.generate_payslip()` — INSS e IRRF calculados automaticamente; base tributável exclui vales (art. 458 CLT)
- Frontend: módulo `/financeiro` completo (dashboard, lançamentos, plano de contas, páginas novo/detalhe)
- `packages/types/src/accounting.types.ts` criado; hooks `useAccounting.ts` (9 hooks TanStack Query v5)
- Sidebar: menu Financeiro colapsável
- Fix: `DevTenantMiddleware` fallback `dscar.localhost` (admin Django funcionando)
- Fix: admissão colaborador HTTP 400 (filtro de campos vazios antes do POST)
- Spec: `docs/sprint-13-hr-accounting-integration.md`

---

### Sprint 12 — Abril 2026
**Auth & SSO: Keycloak Funcionando End-to-End**
- `AUTH_SECRET` (next-auth v5), schema keycloak PostgreSQL, redirect pós-login, RBAC backend, identidade unificada (/me), Protocol Mappers Keycloak
- Spec/review: `docs/sprint-12-auth-sso-fix.md`

---

### Sprint 11 — Abril 2026
**Módulo Financeiro: Fundação Contábil**

Backend (app `apps.accounting` — TENANT_APPS):
- **Models:** `ChartOfAccount` (plano de contas hierárquico, 5 níveis, SPED-compatível), `CostCenter`, `FiscalYear`, `FiscalPeriod`, `JournalEntry` (GenericFK para rastreabilidade), `JournalEntryLine` (partidas dobradas), `NumberSequence`
- **Services:** `JournalEntryService` (create/approve/reverse + `create_from_service_order`), `NumberingService` (sequencial thread-safe com `select_for_update`), `AccountBalanceService` (saldo com subárvore via `code__startswith`), `FiscalPeriodService` (criação automática + fechamento)
- **API:** 5 ViewSets — `ChartOfAccountViewSet` (CRUD + `tree` + `balance`), `CostCenterViewSet`, `FiscalYearViewSet`, `FiscalPeriodViewSet` (+ `close` + `current`), `JournalEntryViewSet` (+ `approve` + `reverse`, DELETE=405)
- **Fixture:** 84 contas do plano DS Car (fixture `chart_of_accounts_dscar.py`)
- **Management command:** `setup_chart_of_accounts [--reset]` — popula plano de contas por tenant
- **Migration:** `0001_initial.py` — 7 models, 10 índices
- **Testes:** 93 testes (28 models + 32 services + 33 views) em `TenantTestCase` — requerem `make dev` para rodar
- `manage.py check` — 0 issues; 0 SyntaxWarnings

**Regras contábeis críticas:**
- `JournalEntry` imutável após aprovação — correção apenas via `reverse_entry()`
- `FiscalPeriod.can_post()` verificado em todo `create_entry()` — período fechado bloqueia lançamentos
- `DecimalField(max_digits=18, decimal_places=2)` em todos os valores — nunca `float`
- `GenericForeignKey` em `JournalEntry` rastreia origem (OS, NF-e, Asaas, etc.)
- DRE e Balanço baseados em `JournalEntryLine` (competência) — nunca em AP/AR
- `NumberingService.next()` usa `select_for_update()` — thread-safe em multitenancy

**Centros de Custo padrão (criar via `setup_chart_of_accounts`):**
```
CC-OS       Centro Automotivo (OS)
CC-PECAS    Loja de Peças
CC-VIDROS   Loja de Vidros
CC-ESTETICA Estética Automotiva
CC-ADM      Administrativo (rateado)
```

**Contas contábeis-chave (DS Car):**
```
1.1.01.001   Caixa Geral
1.1.01.002   Banco Bradesco C/C
1.1.02.001   Clientes Particulares (AR)
1.1.02.002   Seguradoras (AR)
4.1.01.001   Receita Bruta Peças
4.1.02.001   Receita Bruta Serviços OS
5.1.01.001   CMV Peças
```

**Spec completa:** `docs/spec-financial-module.md`
**Review:** `docs/sprint-11-accounting-review.md`

---

### Sprint 9 — Abril 2026
**Integração Person↔Employee: admissão sem UUID**

Backend:
- `GlobalUser.save()` — override que computa `email_hash` automaticamente (bug fix); type hints `*args: object`/`**kwargs: object` corrigidos (Django não tipifica esses parâmetros)
- `GlobalUserManager.create_user/create_superuser` — `**extra_fields: object` → `**extra_fields` (idem)
- `EmployeeCreateSerializer` — aceita `name` + `email` em vez do UUID do GlobalUser; `create()` envolto em `transaction.atomic()` (evita race condition em admissões simultâneas); faz `get_or_create` do GlobalUser por `email_hash`; `validate_email()` bloqueia e-mail com colaborador ativo; resposta inclui `id`
- `test_employee_views.py` — migrado para `TenantTestCase` + `APIClient` (base `HRTestCase`); `make_user` computa `email_hash` explicitamente; 18/18 testes passando

Frontend:
- `CreateEmployeePayload` — substituído `user: string` por `name: string` + `email: string`
- `UpdateEmployeePayload` — Omit atualizado para excluir `name`/`email`
- Formulário `/rh/colaboradores/novo` — `z.enum()` para `department`/`position`/`contract_type` (narrowing automático, sem `as Type` casts); `FormDraft` type para estado do form (selects precisam de `""` inicial); `FormData = z.infer<>` para o payload validado; 0 erros `tsc --strict`

**Documentação:** `docs/sprint-09-hr-onboarding-integration.md` (spec) · `docs/sprint-09-review.md` (review + guia de validação humana)

---

### Sprint 8 — Abril 2026
**HR Frontend: Ponto, Metas, Vales e Folha de Pagamento**

Frontend (Next.js 15 · TypeScript strict · shadcn/ui):
- **Tabs colaborador:** `TabBonificacoes`, `TabVales`, `TabDescontos` no detalhe do colaborador
- **Ponto `/rh/ponto`:** `LiveClock` (atualiza 1s), botão contextual sequencial, histórico do dia
- **Espelho `/rh/ponto/espelho`:** visão gestor com data+setor, `EspelhoRow` (query independente por colaborador)
- **Metas `/rh/metas`:** progress bars, filtros status+setor, `CreateGoalForm` (XOR employee|department)
- **Vales `/rh/vales`:** tabs por status, approve/pay inline, badges coloridos
- **Folha `/rh/folha`:** lista meses agrupados por `reference_month`, form "Gerar contracheque"
- **Folha detalhe `/rh/folha/[month]`:** tabela com tfoot totais, summary cards, "Fechar Folha" com dupla confirmação
- **Contracheques self-service `/rh/folha/contracheque`:** filtrado por `useMyEmployee()`, breakdown visual, download PDF
- **Backend adição:** `GET /hr/employees/me/` action no `EmployeeViewSet`
- **Hooks:** 15 novos hooks em `useHR.ts` (TimeClock, Goals, Allowances, Payslips)
- `tsc --strict` — 0 erros

---

### Sprint 7 — Abril 2026
**HR Frontend: Dashboard + Colaboradores**

Frontend (Next.js 15 · TypeScript strict · shadcn/ui):
- **Types:** `packages/types/src/hr.types.ts` — 15 interfaces, 8 union types, 4 display config objects
- **Hooks:** `src/hooks/useHR.ts` — useEmployees, useEmployee, useCreateEmployee, useUpdateEmployee, useTerminateEmployee, useEmployeeDocuments, useSalaryHistory, useCreateSalaryHistory + `hrKeys`
- **Sidebar:** item "Recursos Humanos" com ícone Briefcase
- **Dashboard `/rh`:** cards headcount (total/ativo/afastado/férias) + quick links + alerta documentos
- **Lista `/rh/colaboradores`:** tabela com filtros status+setor+busca (debounce), EmployeeStatusBadge
- **Admissão `/rh/colaboradores/novo`:** form Zod em 3 seções (trabalhista / pessoal / endereço), redirect pós-criação
- **Detalhe `/rh/colaboradores/[id]`:** 6 tabs — TabDadosPessoais (edição inline PATCH), TabDocumentos (soft-delete), TabSalario (reajuste + timeline), + 3 placeholders Sprint 8
- **Placeholders:** /rh/ponto, /rh/metas, /rh/vales, /rh/folha
- `tsc --strict` — 0 erros

---

### Sprint 5 + 6 — Abril 2026
**HR Backend Completo**

Backend (app `apps.hr` — TENANT_APPS):
- **10 models:** Employee, EmployeeDocument, SalaryHistory, Bonus, GoalTarget, Allowance, Deduction, TimeClockEntry, WorkSchedule, Payslip
- **Services:** TimeClockService (sequência válida de batidas), AllowanceService (fluxo solicitação→aprovação→pagamento), GoalService (achieve gera Bonus automático), PayslipService (cálculo completo + fechamento imutável)
- **ViewSets:** Employee (CRUD + terminate), Document (soft delete), SalaryHistory, Bonus, Goal (+ achieve action), Allowance (+ approve/pay), Deduction, TimeClock (+ approve), WorkSchedule, Payslip (+ generate/close)
- **Migrations:** 0001 (3 models) + 0002 (7 models + constraints XOR + unique_payslip + manual_entry_requires_justification)
- **Tasks Celery:** task_generate_recurring_allowances, task_check_expiring_documents, task_generate_payslip_pdf
- **Testes:** 18 unit tests passando sem Docker; DB tests requerem `make dev`
- `manage.py check` — 0 issues (Sprint 5 e Sprint 6)

---

### Sprint 4 — Abril 2026
**RBAC, UX de criação e correções de integração**

Backend:
- `DevJWTAuthentication`: valida HS256, `get_or_create` GlobalUser por `email_hash`
- `KeycloakJWTAuthentication`: valida RS256 via `PyJWKClient` (JWKS), resiliente a Keycloak offline
- `DevTenantMiddleware`: lê `X-Tenant-Domain` (Node.js fetch ignora header `Host`)
- `ServiceOrder.number`: gerado automaticamente em `perform_create` (`MAX + 1`) — removido dos campos do serializer para evitar conflito com `unique_together`
- `UnifiedCustomerViewSet.create`: retorna `UnifiedCustomerListSerializer` (inclui `id`, `cpf_masked`, `phone_masked`)

Frontend:
- `NovoClienteModal` + `NovaOSModal`: dialogs com scroll, inline customer create no fluxo de OS
- `PermissionGate` + `usePermission`: RBAC por role com fallback `STOREKEEPER`
- `session.role` propagado do provider `dev-credentials` para o token next-auth
- Proxy API route: trailing slash garantida em todas as chamadas ao Django
- Kanban: validação client-side de `VALID_TRANSITIONS`, resolução de `over.id` card→coluna, guard otimista contra double-submit
- `VALID_TRANSITIONS` exportado de `@paddock/types` (espelho do backend)

---

## 🧑‍💼 Módulo de RH — Contexto e Padrões

### App Django: `apps.hr` (TENANT_APPS)

```python
# 10 models no app hr:
# Employee, EmployeeDocument, SalaryHistory,
# Bonus, GoalTarget, Allowance, Deduction,
# TimeClockEntry, WorkSchedule, Payslip

# NÃO existem models Department/Position separados
# Usar CharField com choices de apps.persons:
from apps.persons.models import SetorPessoa, CargoPessoa

class Employee(PaddockBaseModel):
    department = models.CharField(max_length=30, choices=SetorPessoa.choices)
    position   = models.CharField(max_length=30, choices=CargoPessoa.choices)
```

### Services (regras de negócio — nunca nos ViewSets)
- `TimeClockService` — sequência válida: clock_in → break_start → break_end → clock_out
- `AllowanceService` — fluxo: requested → approved → paid (sem pulo)
- `PayslipService` — cálculo: base + bônus + vales + HE - descontos = net

### Regras HR Críticas
1. LGPD: CPF, RG, PIX, telefone → sempre `EncryptedField`
2. Contracheque fechado → imutável (correção via lançamento compensatório)
3. Ponto manual → justificativa obrigatória + aprovação gestor
4. Documentos → soft delete apenas (nunca hard delete)
5. Desligamento → `status='terminated'`, dados retidos 5-10 anos
6. source='biometric' → bloqueado (erro amigável, integração futura)

### Skill File HR
- Localização: `~/Downloads/hr-module-skill-v2.md`
- Skill docs: `docs/sprint-05-hr-backend-foundation.md` ... `sprint-08-hr-frontend-ponto-folha.md`

### Frontend HR (Sprint 7 entregue)
```
packages/types/src/hr.types.ts          ← todos os tipos HR
apps/dscar-web/src/hooks/useHR.ts       ← hooks TanStack Query v5
app/(app)/rh/
  page.tsx                    ✅ Dashboard (headcount 4 cards + quick links)
  _components/HRStatCard.tsx  ✅
  colaboradores/
    page.tsx                  ✅ Lista com filtros + debounce
    _components/EmployeeStatusBadge.tsx ✅
    _components/EmployeeTable.tsx       ✅
    novo/page.tsx             ✅ Admissão (Zod)
    [id]/page.tsx             ✅ Detalhe (6 tabs)
    [id]/_components/         ✅ Header, DadosPessoais, Documentos, Salario, Placeholders
  ponto/page.tsx              ✅ Relógio de ponto (Sprint 8)
  ponto/espelho/page.tsx      ✅ Espelho gestor (Sprint 8)
  metas/page.tsx              ✅ Painel metas + form (Sprint 8)
  vales/page.tsx              ✅ Gestão vales tabs (Sprint 8)
  folha/page.tsx              ✅ Lista meses (Sprint 8)
  folha/[month]/page.tsx      ✅ Detalhe + fechar folha (Sprint 8)
  folha/contracheque/page.tsx ✅ Self-service contracheques (Sprint 8)
```

### Frontend HR Sprint 8 (entregue)
- TabBonificacoes, TabVales, TabDescontos (detalhe colaborador) ✅
- `/rh/ponto` — relógio (LiveClock) + espelho de ponto (gestor) ✅
- `/rh/metas` — painel de metas individuais/setor + CreateGoalForm ✅
- `/rh/vales` — fluxo aprovação vales (tabs requested/approved/paid) ✅
- `/rh/folha` — lista meses + detalhe [month] + self-service contracheques ✅

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
*Última atualização: Abril 2026*
