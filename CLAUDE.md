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
│   │   │   ├── persons/              ← Modelo unificado Person (PF/PJ, SetorPessoa/CargoPessoa)
│   │   │   ├── customers/            ← Cliente unificado + LGPD
│   │   │   ├── service_orders/       ← OS, Kanban, Checklist (DS Car)
│   │   │   ├── inventory/            ← Estoque por tenant
│   │   │   ├── fiscal/               ← NF-e, NFS-e, NFC-e (nfelib)
│   │   │   ├── crm/                  ← CRM + WhatsApp (Evolution API)
│   │   │   ├── store/                ← PDV + E-commerce
│   │   │   ├── ai/                   ← Claude API + RAG
│   │   │   ├── hr/                   ← RH: Employee, Payslip, TimeClock, etc. (TENANT_APP)
│   │   │   ├── experts/              ← Especialistas externos (peritos) (TENANT_APP)
│   │   │   ├── accounting/           ← Plano de contas, JournalEntry, DRE (TENANT_APP)
│   │   │   ├── accounts_payable/     ← Contas a Pagar (TENANT_APP)
│   │   │   ├── accounts_receivable/  ← Contas a Receber (TENANT_APP)
│   │   │   ├── cilia/                ← Integração API Cilia
│   │   │   ├── vehicle_catalog/      ← Catálogo de veículos/cores (SHARED_APP)
│   │   │   └── insurers/             ← Seguradoras (SHARED_APP)
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

## ⚠️ Armadilhas Conhecidas — Não Repetir

### Keycloak 24 — Freemarker: usar `url.resourcesPath` não `resourcesPath`
```freemarker
<!-- ERRADO — resourcesPath não existe no data model do KC 24 → InvalidReferenceException -->
<link href="${resourcesPath}/css/login.css">
<img src="${resourcesPath}/img/logo.png">

<!-- CORRETO — KC 24 expõe via objeto url (UrlBean) -->
<link href="${url.resourcesPath}/css/login.css">
<img src="${url.resourcesPath}/img/logo.png">
<script src="${url.resourcesPath}/js/carousel.js">
```
Outros vars KC 24 que continuam funcionando: `${url.loginAction}`, `${login.username!''}`, `${messagesPerField.existsError(...)}`.

### Django — Roteamento DRF com múltiplos routers no mesmo app
```python
# ERRADO — DefaultRouter registrado em "" captura qualquer segmento como pk
# /api/v1/service-orders/service-catalog/ → tratado como pk="service-catalog" → 404
router = DefaultRouter()
router.register(r"", ServiceOrderViewSet, basename="service-order")
catalog_router = DefaultRouter()
catalog_router.register(r"service-catalog", ServiceCatalogViewSet, ...)
urlpatterns = [
    path("", include(router.urls)),
    path("", include(catalog_router.urls)),  # nunca chega aqui
]

# CORRETO — prefixo explícito + SimpleRouter (sem API root extra)
catalog_router = SimpleRouter()
catalog_router.register(r"", ServiceCatalogViewSet, basename="service-catalog")
urlpatterns = [
    path("service-catalog/", include(catalog_router.urls)),  # ANTES do router principal
    path("", include(router.urls)),
]
```

### Django — Migrações com número duplicado após merge de branches
Ao fazer merge de duas branches que criaram migrações na mesma app (ex: `0015_foo` e `0015_bar`):
```bash
# Detecta o conflito
python manage.py migrate_schemas  # → "Conflicting migrations detected"

# Gera migration de merge
python manage.py makemigrations --merge <app_name> --no-input

# Aplica
python manage.py migrate_schemas
```
Sempre commitar o arquivo `0016_merge_*.py` gerado.

### Frontend — DRF paginado: extrair `.results` nos hooks de lista

Por padrão o `DefaultRouter` retorna envelope paginado:
`{ count, next, previous, results: [...] }`. Chamar `.map()` diretamente lança
`TypeError: xxx.map is not a function`.

```typescript
// ERRADO — retorna envelope, não array
queryFn: () => apiFetch<Empresa[]>(`${BASE}/empresas/`),

// CORRETO — helper que extrai .results quando presente
type Paginated<T> = { results: T[]; count: number; next: string | null; previous: string | null }

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<Paginated<T> | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

queryFn: () => fetchList<Empresa>(`${BASE}/empresas/`),
```

Regra: toda `queryFn` de endpoint de lista DRF usa `fetchList<T>` — nunca
`apiFetch<T[]>` diretamente.

### Frontend — Hooks de API: sempre usar `/api/proxy/` como prefixo
```typescript
// ERRADO — chama o Django direto
const API = "/api/service-orders"

// CORRETO — passa pelo proxy Next.js (adiciona auth header + tenant header)
const API = "/api/proxy/service-orders"
```
O proxy está em `apps/dscar-web/src/app/api/proxy/[...path]/route.ts`.

### Docker Dev — Django usa volume mount, não rebuild
O container Django monta `backend/core:/app` — qualquer alteração em `.py` é
refletida imediatamente via hot-reload do `runserver`. **Não precisa rebuild.**
Exceções que exigem ação manual:
- Novas migrations → `make migrate`
- Novo pacote Python no `requirements.txt` → rebuild: `docker compose build django`

### TypeScript — `ActivityType` deve espelhar `ActivityType` do Django
```python
# backend/core/apps/service_orders/models.py — ActivityType choices
```
```typescript
// packages/types/src/service-order.types.ts — ActivityType union
// Manter sincronizados. Se adicionar no backend, adicionar no tipo TS também.
```

### npm — Após merge ou adição de dependência, rodar `npm install` na raiz
```bash
# No root do monorepo (Turborepo gerencia workspaces)
npm install
# Verifica se pacote está acessível
ls node_modules/<pacote>
```

### Frontend — Formulários aninhados em `ServiceOrderForm`
Qualquer aba renderizada dentro de `ServiceOrderForm` já está dentro de um `<form>`.
HTML não permite `<form>` dentro de `<form>` — causa hydration error.

```tsx
// ERRADO — nested form
<form onSubmit={handleSubmit(onAdd)} className="space-y-2">
  ...
  <Button type="submit">Adicionar</Button>
</form>

// CORRETO — div + onClick dispara o handleSubmit manualmente
<div className="space-y-2">
  ...
  <Button type="button" onClick={() => handleSubmit(onAdd)()}>Adicionar</Button>
</div>
```
Regra: dentro de qualquer tab do `ServiceOrderForm`, **nunca usar `<form>`**. Sempre `<div>` + `onClick={() => handleSubmit(fn)()}`.

### Backend — Editar arquivo no worktree não reflete no dev server
O dev server roda da pasta principal `/Users/thiagocampos/Documents/Projetos/grupo-dscar/`.
Editar em `.worktrees/sprint-XX/` não tem efeito no servidor em execução.
Ao corrigir bugs com o servidor rodando, editar sempre a pasta principal (branch `main`).

---

## 🔐 Padrões de Segurança

### Django DRF — RBAC em ViewSets

Todo `ModelViewSet` com operações de escrita deve usar `get_permissions()` para separar leitura de escrita:

```python
# ERRADO — todos os verbos com a mesma permissão
class MyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

# CORRETO — leitura: CONSULTANT+, escrita: MANAGER+
class MyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]
```

Permission classes disponíveis em `apps.authentication.permissions`:
- `IsConsultantOrAbove` — CONSULTANT, MANAGER, ADMIN, OWNER
- `IsManagerOrAbove` — MANAGER, ADMIN, OWNER
- `IsAdminOrAbove` — ADMIN, OWNER
- `_get_role(request)` — extrai role do JWT (não usar `request.query_params`)

### Django DRF — Nunca determinar role via query param

O role do usuário **sempre vem do JWT**, nunca de parâmetros da URL.

```python
# ERRADO — cliente controla qual dashboard recebe (qualquer role pode ver qualquer view)
role = request.query_params.get("role", "").upper()
if role == "MANAGER":
    return Response(self._manager_stats())

# CORRETO — role extraído do token assinado
from apps.authentication.permissions import _get_role
role = _get_role(request)
if role in ("MANAGER", "ADMIN", "OWNER"):
    return Response(self._manager_stats())
```

### Django DRF — Serializers de update: nunca usar somente `exclude`

`exclude` expõe todo o modelo por padrão. Campos calculados, de auditoria e de fluxo devem ser `read_only`:

```python
# ERRADO — is_active, status, totais, campos fiscais ficam graváveis
class Meta:
    model = ServiceOrder
    exclude = ["number", "created_by"]

# CORRETO — proteger campos sensíveis com read_only_fields
class Meta:
    model = ServiceOrder
    exclude = ["number", "created_by"]
    read_only_fields = [
        "status",        # use endpoint de transição
        "is_active",     # não permite soft-delete via PATCH
        "invoice_issued",
        "parts_total", "services_total", "discount_total",  # calculados
        "ai_recommendations", "nfe_key", "nfse_number",     # fiscais/internos
        "delivered_at", "delivery_date", "client_delivery_date",
    ]
```

Alternativa mais segura para novos serializers: usar `fields` explícito em vez de `exclude`.

### Django DRF — `is_active=True` obrigatório em todas as queries de APIView

`ViewSet.get_queryset()` já filtra `is_active=True` pelo padrão do projeto.
`APIView` separadas **não herdam esse filtro** — precisam incluir explicitamente.

```python
# ERRADO — APIView retorna OS soft-deleted
class CalendarView(APIView):
    def get(self, request):
        qs = ServiceOrder.objects.filter(
            Q(scheduling_date__range=...) | Q(estimated_delivery_date__range=...)
        )

# CORRETO
class CalendarView(APIView):
    def get(self, request):
        qs = ServiceOrder.objects.filter(
            is_active=True,  # ← obrigatório em APIView
        ).filter(
            Q(scheduling_date__range=...) | Q(estimated_delivery_date__range=...)
        )
```

Aplica-se a: `CalendarView`, `DashboardStatsView`, endpoints `@action` que constroem queries manualmente.

### Django DRF — Campo correto para "data de entrega"

O modelo `ServiceOrder` tem três campos de data relacionados à entrega:

| Campo | Quando é preenchido | Uso correto |
|---|---|---|
| `delivered_at` | No `transition()` para `DELIVERED` | KPIs "entregue hoje/semana", produtividade |
| `delivery_date` | Previsão de entrega (planejamento) | Nunca usar para contar entregas realizadas |
| `client_delivery_date` | Data de retirada pelo cliente | Relatórios de SLA ao cliente |

```python
# ERRADO — delivery_date não é preenchido na transição de status
completed_week = ServiceOrder.objects.filter(delivery_date__date__gte=week_ago)

# CORRETO
completed_week = ServiceOrder.objects.filter(delivered_at__date__gte=week_ago)
```

### Django DRF — Parâmetros numéricos de query string: sempre validar

```python
# ERRADO — int() de string inválida lança ValueError → 500
days_ahead = int(request.query_params.get("days_ahead", 0))

# CORRETO — try/except + limite máximo
try:
    days_ahead = max(0, min(int(request.query_params.get("days_ahead", 0)), 365))
except (ValueError, TypeError):
    days_ahead = 0
```

### Django DRF — Erros de integração externa: nunca vazar `str(e)`

```python
# ERRADO — vaza paths internos, detalhes de API, stack traces
except Exception as e:
    return Response({"erro": str(e)}, status=500)

# CORRETO — mensagem genérica ao cliente, detalhe no log
except Exception as e:
    logger.error(f"Erro inesperado em <contexto>: {e}")
    return Response({"erro": "Erro interno ao processar requisição."}, status=500)
```

### Frontend — Proxy Next.js: nunca logar body do request (LGPD)

O body de qualquer PATCH/POST pode conter CPF, email, telefone.
O arquivo `apps/dscar-web/src/app/api/proxy/[...path]/route.ts` **não deve** logar o body.

```typescript
// ERRADO — pode incluir CPF, email, telefone em texto claro nos logs
if (!response.ok) {
    console.error(`[proxy] request body:`, body.slice(0, 500))
}

// CORRETO — logar apenas método, URL e status
if (!response.ok) {
    console.error(`[proxy] ${method} ${backendUrl} → ${response.status}`)
}
```

### Frontend — Mutations React Query: sempre com try/catch

```typescript
// ERRADO — erro de API trava o formulário sem feedback
async function onSubmit(values: FormValues) {
    await mutation.mutateAsync(payload)
    closeForm()
}

// CORRETO — usuário recebe feedback, formulário não trava
async function onSubmit(values: FormValues) {
    try {
        await mutation.mutateAsync(payload)
        closeForm()
    } catch {
        toast.error("Erro ao salvar. Tente novamente.")
    }
}
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
- **Setup Keycloak:** Schema PostgreSQL criado automaticamente por `infra/docker/init/01_setup.sql` — **não requer passo manual**
- **Tema de login:** `infra/docker/keycloak/themes/paddock/` — tema customizado DS Car (split 50/50, neon, carrossel)
  - `docker-compose.dev.yml`: volume + `--health-enabled=true` + `KC_HEALTH_ENABLED: "true"`
  - `realm-export.json`: `loginTheme: "paddock"`, `resetPasswordAllowed: false`
  - Aplicar mudanças de realm: `make dev-reset && make dev` (reimporta do zero)
- **Client ID no realm:** `paddock-frontend` (não `dscar-web`)
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

### Seguradoras — Logo Upload
```python
# Modelo: apps.insurers.Insurer (SHARED_APP — schema público)
# logo_url  = CharField(max_500) — URL crua salva no banco
# logo       = SerializerMethodField — URL resolvida (logo_url OU fallback Person.logo_url)

# Upload via endpoint dedicado (não ImageField — sem Pillow):
# POST /api/v1/insurers/{id}/upload_logo/  multipart/form-data campo "logo"
# Aceita: PNG ou SVG · max 2 MB
# Dev:  salva em MEDIA_ROOT/insurers/logos/<uuid>.<ext> → URL /media/...
# Prod: salva no S3 via default_storage → URL https://bucket.s3...amazonaws.com/...

# Next.js rewrite para servir media em dev (next.config.ts):
# /media/* → http://localhost:8000/media/*

# Mobile: resolveLogoUrl() em useInsurers.ts converte URL relativa em absoluta
# logo.startsWith('/') → `${API_BASE_URL}${logo}`   (dev: localhost:8000)
# logo.startsWith('http') → passa direto              (prod: S3)
```

**Campos `Insurer` retornados por `InsurerMinimalSerializer` (list + nested em OS):**
```
id · name · trade_name · cnpj · brand_color · abbreviation
display_name · logo (resolvida) · logo_url (crua) · uses_cilia · is_active
```

**Semântica `logo` vs `logo_url`:**
- `logo` → usar em **display** (inclui fallback via `Person.logo_url`)
- `logo_url` → usar em **admin/edição** (valor bruto armazenado)

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

### Módulo Seguradoras (`/cadastros/seguradoras`)
```
app/(app)/cadastros/seguradoras/
├── page.tsx                            ← Lista + CRUD + upload rápido de logo
└── _components/
    └── InsurerDialog.tsx               ← Sheet lateral: form + preview logo + file input
```
- CRUD completo via `InsurerViewSet` (antes era read-only)
- Upload rápido: clicar na logo na tabela abre file input diretamente
- Upload via dialog: preview antes de salvar, separado do form
- Hook global: `src/hooks/useInsurers.ts` — `useInsurers`, `useInsurerCreate`, `useInsurerUpdate`, `useInsurerDelete`, `useInsurerUploadLogo`
- Sidebar: item "Seguradoras" (ícone `Shield`) sob "Cadastros"

### Módulo Financeiro (`/financeiro`)
```
app/(app)/financeiro/
├── page.tsx                           ← Dashboard de visão geral (4 cards + links)
├── lancamentos/
│   ├── page.tsx                       ← Lista de lançamentos contábeis
│   ├── [id]/page.tsx                  ← Detalhe + histórico
│   └── novo/page.tsx                  ← Formulário partidas dobradas
├── plano-contas/
│   ├── page.tsx                       ← Árvore hierárquica do plano de contas
│   └── nova/page.tsx                  ← Criação de nova conta
├── contas-pagar/
│   ├── page.tsx                       ← Lista AP + cards + RecordPaymentDialog
│   ├── novo/page.tsx                  ← Novo título a pagar
│   └── [id]/page.tsx                  ← Detalhe + histórico de baixas
├── contas-receber/
│   ├── page.tsx                       ← Lista AR + cards + RecordReceiptDialog
│   ├── novo/page.tsx                  ← Novo título a receber
│   └── [id]/page.tsx                  ← Detalhe + histórico de recebimentos
└── relatorios/
    ├── page.tsx                       ← Dashboard de relatórios (Sprint 15)
    ├── dre/page.tsx                   ← DRE por período
    ├── balanco/page.tsx               ← Balanço Patrimonial
    └── fluxo-caixa/page.tsx           ← Fluxo de Caixa Realizado vs. Projetado
```
- **Types:** `packages/types/src/financeiro.types.ts` (tipos AP/AR)
- **Hooks:** `src/hooks/useFinanceiro.ts` (TanStack Query v5)
- Sidebar menu "Financeiro" colapsável

### Módulo RH (`/rh`)
```
app/(app)/rh/
├── page.tsx                           ← Dashboard (headcount 4 cards + quick links)
├── colaboradores/
│   ├── page.tsx                       ← Lista com filtros + debounce
│   ├── novo/page.tsx                  ← Formulário admissão (3 seções Zod)
│   └── [id]/page.tsx                  ← Detalhe com 6 tabs (dados, docs, salário, bônus, vales, descontos)
├── ponto/
│   ├── page.tsx                       ← Relógio de ponto (LiveClock)
│   └── espelho/page.tsx               ← Visão gestor com data+setor
├── metas/page.tsx                     ← Painel metas + CreateGoalForm
├── vales/page.tsx                     ← Gestão vales (tabs: solicitado/aprovado/pago)
└── folha/
    ├── page.tsx                       ← Lista meses agrupados
    ├── [month]/page.tsx               ← Detalhe + fechar folha
    └── contracheque/page.tsx          ← Self-service contracheques
```
- **Types:** `packages/types/src/hr.types.ts` (15 interfaces + 8 unions)
- **Hooks:** `src/hooks/useHR.ts` (15+ hooks TanStack Query v5)
- Sidebar menu "Recursos Humanos" com ícone Briefcase

### Feature: Criação de OS
```
src/features/create-os/
├── CreateOSDialog.tsx                 ← Dialog com busca cliente + inline create + veículo
├── useCreateOS.ts                     ← Hook com validação client-side
└── types.ts                           ← CreateOSPayload + validações
```
- Acesso via botão sidebar ou modal em `/os`
- Número da OS gerado automaticamente (MAX + 1)

### Modais de Criação
```
src/components/modals/
├── NovoClienteModal.tsx               ← Dialog: nome, telefone, CPF, email, LGPD
└── NovaOSModal.tsx                    ← Dialog scrollável (substituído por CreateOSDialog)
```
- Inline create: permite cadastrar cliente sem sair do fluxo

### Kanban
```
src/components/kanban/
├── KanbanBoard.tsx                    ← DndContext + validação VALID_TRANSITIONS client-side
├── KanbanColumn.tsx                   ← useDroppable por status
└── KanbanCard.tsx                     ← useSortable + router.push (sem <Link> aninhado)
```
- `over.id` pode ser UUID de card ou status de coluna — KanbanBoard resolve ambos
- Otimismo: override de status enquanto refetch não completa
- Erros: toast com próximos passos permitidos

### RBAC
```
src/hooks/usePermission.ts             ← retorna boolean baseado em ROLE_HIERARCHY
src/components/PermissionGate.tsx      ← wrapper condicional por role
src/lib/withRoleGuard.ts               ← HOC para páginas inteiras
src/middleware.ts                      ← proteção de rotas /admin e /configuracoes
```

---

## 📡 Módulo: Paddock Inbox

Módulo SaaS omnichannel reutilizável desenvolvido pela Paddock Solutions.
Backend multi-tenant central. Dois pacotes frontend consumíveis por qualquer projeto.
**Todo desenvolvimento e deploy é da Paddock — sem devs externos.**

### Visão geral

```
Backend central:  services/inbox-api/        ← Django 5, único para todos os clientes
Pacote web:       packages/inbox-web/         ← @paddock/inbox-web (React/Next.js)
Pacote mobile:    packages/inbox-native/      ← @paddock/inbox-native (React Native/Expo)
Contrato shared:  packages/inbox-core/        ← tipos TS + useInbox() hook (FONTE DA VERDADE)
```

Canais suportados: **WhatsApp** (Meta WABA oficial) · **Instagram DM** · **Instagram Comentários** · **Facebook Messenger**

Clientes ativos: DS Car ERP · Paddock Agências · futuros clientes Paddock

### Estrutura de pastas

```
services/inbox-api/
└── inbox/
    ├── models/
    │   ├── contact.py          # Contact unificado por tenant
    │   ├── conversation.py     # Thread por contato+canal+tenant
    │   ├── message.py          # Mensagem individual com source e status
    │   └── channel.py          # Configuração de canal por tenant (credentials encrypted)
    ├── connectors/
    │   ├── base.py             # Classe abstrata — todos os connectors herdam
    │   ├── whatsapp.py         # Evolution API + WABA
    │   ├── instagram.py        # Meta Graph API — DM e comentários
    │   └── facebook.py         # Meta Graph API — Messenger
    ├── webhooks/
    │   ├── receiver.py         # Endpoint único — valida assinatura + enfileira
    │   └── normalizer.py       # Converte payload de qualquer canal para Message padrão
    ├── consumers/
    │   └── inbox_consumer.py   # Django Channels WebSocket — push em tempo real
    ├── tasks/
    │   └── message_tasks.py    # Celery: processar e entregar mensagens
    ├── onboarding/
    │   └── embedded_signup.py  # Fluxo OAuth Meta por tenant
    └── urls.py

packages/inbox-core/src/
    ├── types.ts                # InboxMessage, InboxConversation, ChannelType, InboxEvent
    └── useInbox.ts             # hook principal — única interface para os pacotes frontend

packages/inbox-web/src/
    ├── components/
    │   ├── InboxPanel.tsx      # Componente raiz exportado — recebe token + wsUrl
    │   ├── ConversationList.tsx
    │   ├── ConversationView.tsx
    │   ├── MessageComposer.tsx
    │   └── ChannelBadge.tsx
    └── hooks/useInbox.ts       # re-exporta de inbox-core — nunca reimplementar

packages/inbox-native/src/
    ├── components/             # Mesma estrutura do inbox-web, adaptada para RN
    └── hooks/useInbox.ts       # re-exporta de inbox-core
```

### Modelos Django

```python
# contact.py
class Contact(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    instagram_id = models.CharField(max_length=100, null=True, blank=True)
    facebook_id = models.CharField(max_length=100, null=True, blank=True)
    whatsapp_id = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = [['tenant', 'phone'], ['tenant', 'instagram_id']]

# conversation.py
class Conversation(models.Model):
    CHANNEL_TYPES = [('whatsapp','WhatsApp'),('instagram_dm','Instagram DM'),
                     ('instagram_comment','Instagram Comentário'),('facebook','Facebook')]
    STATUS = [('open','Aberta'),('resolved','Resolvida'),('pending','Pendente')]
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE)
    channel_type = models.CharField(max_length=30, choices=CHANNEL_TYPES)
    status = models.CharField(max_length=20, choices=STATUS, default='open')
    last_message_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

# message.py
class Message(models.Model):
    DIRECTIONS = [('in','Recebida'),('out','Enviada')]
    STATUSES = [('sent','Enviada'),('delivered','Entregue'),('read','Lida'),('failed','Falhou')]
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    direction = models.CharField(max_length=3, choices=DIRECTIONS)
    source = models.CharField(max_length=30)  # whatsapp | instagram_dm | instagram_comment | facebook
    content = models.TextField(blank=True)
    media_url = models.URLField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='sent')
    external_id = models.CharField(max_length=255, unique=True)  # ID da plataforma
    created_at = models.DateTimeField(auto_now_add=True)

# channel.py
class Channel(models.Model):
    TYPES = [('whatsapp','WhatsApp'),('instagram','Instagram'),('facebook','Facebook')]
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    type = models.CharField(max_length=20, choices=TYPES)
    credentials = models.JSONField()  # encrypted com django-cryptography
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### Endpoints REST

```
POST   /webhooks/meta/                      # Eventos Meta (Instagram + Facebook)
POST   /webhooks/whatsapp/                  # Eventos WhatsApp (Evolution API)
GET    /webhooks/meta/                      # Verificação de webhook Meta

GET    /api/conversations/                  # Lista conversas do tenant (paginado)
GET    /api/conversations/{id}/messages/    # Mensagens de uma conversa
POST   /api/conversations/{id}/messages/    # Envia mensagem de volta ao canal
PATCH  /api/conversations/{id}/             # Atualiza status (open/resolved/pending)

GET    /api/channels/                       # Canais configurados do tenant
POST   /api/channels/                       # Cria canal (pós Embedded Signup)
DELETE /api/channels/{id}/                  # Desconecta canal

POST   /api/onboarding/meta/start/          # Inicia Embedded Signup — retorna OAuth URL
POST   /api/onboarding/meta/callback/       # Recebe code OAuth, troca por token, salva
```

### Contrato WebSocket (inbox-core — fonte da verdade)

```typescript
// packages/inbox-core/src/types.ts
export type ChannelType = 'whatsapp' | 'instagram_dm' | 'instagram_comment' | 'facebook'

export interface InboxMessage {
  id: string; conversationId: string; direction: 'in' | 'out'
  source: ChannelType; content: string; mediaUrl?: string
  status: 'sent' | 'delivered' | 'read' | 'failed'; createdAt: string
}

export interface InboxConversation {
  id: string; contact: { id: string; name: string; phone?: string }
  channelType: ChannelType; status: 'open' | 'resolved' | 'pending'
  lastMessageAt: string; unreadCount: number
}

export type InboxEvent =
  | { type: 'conversation.new';      payload: InboxConversation }
  | { type: 'message.new';           payload: InboxMessage }
  | { type: 'message.status';        payload: { id: string; status: string } }
  | { type: 'conversation.assigned'; payload: { id: string; assignedTo: string } }

// packages/inbox-core/src/useInbox.ts
export function useInbox(token: string, wsUrl?: string): {
  conversations: InboxConversation[]
  messages: (conversationId: string) => InboxMessage[]
  sendMessage: (conversationId: string, content: string) => Promise<void>
  isConnected: boolean
}
```

### Como usar nos projetos cliente

```tsx
// Qualquer app Next.js da Paddock
import { InboxPanel } from '@paddock/inbox-web'

<InboxPanel
  token={clientToken}     // API token do tenant — vem do backend
  wsUrl={process.env.NEXT_PUBLIC_INBOX_WS_URL}  // opcional
  onConversationSelect={(id) => router.push(`/inbox/${id}`)}
/>
```

### Regras invioláveis do módulo

```
1. inbox-core é a FONTE DA VERDADE para tipos e eventos.
   Nenhum pacote redefine tipos que já existem lá.

2. Frontend NUNCA abre WebSocket diretamente.
   Sempre via useInbox() do inbox-core.

3. Agente Integrações NUNCA altera modelos Django.
   Apenas consome via ORM nos connectors/.

4. Channel.credentials NUNCA vai para o frontend.
   Apenas o backend acessa credenciais de canal.

5. Webhook receiver SEMPRE valida assinatura antes de processar.
   Payloads sem assinatura válida: 403, sem enfileirar.

6. Novos canais: criar connector + registrar no receiver + adicionar tipo no ChannelType.
   PR revisado antes de merge.
```

### Infra do módulo (Coolify · mesmo VPS do ERP)

```
Serviços Docker via Coolify:
  inbox-api        ← Django ASGI (Daphne) — API REST + WebSocket
  inbox-worker     ← Celery worker (mesma imagem Django)
  inbox-redis      ← Redis 7 (filas Celery + Django Channels layer)

Externos:
  Neon DB          ← PostgreSQL gerenciado (database: paddock_inbox)
  Cloudflare R2    ← Mídia (bucket: paddock-inbox-media)
  Cloudflare CDN   ← Proxy SSL + rate limit em /webhooks/*

Domínio:  api.paddockinbox.com.br
WebSocket: wss://api.paddockinbox.com.br/ws/inbox/
```

### Onboarding de novo cliente (feito pela Paddock)

```
1. Criar tenant no banco (Agente Infra)
2. Gerar API token para o tenant
3. Cliente faz Embedded Signup no painel (autoriza Meta — similar a "Entrar com Google")
4. Dev Paddock instala @paddock/inbox-web no projeto do cliente
5. Adiciona <InboxPanel token={token} /> no layout
```

### Variáveis de ambiente do módulo

```bash
# Meta (Instagram + Facebook + WhatsApp WABA)
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=        # string aleatória — configurar no painel Meta
META_ACCESS_TOKEN=                 # token de sistema do app Meta
WABA_ID=                           # WhatsApp Business Account ID
WABA_PHONE_NUMBER_ID=              # ID do número WABA

# Evolution API (se usado como camada WABA)
EVOLUTION_API_URL=https://evolution.paddock.solutions
EVOLUTION_API_KEY=

# Banco e cache (inbox-api)
DATABASE_URL=postgresql://...@ep-xxx.neon.tech/paddock_inbox?sslmode=require
REDIS_URL=redis://inbox-redis:6379/0
CELERY_BROKER_URL=redis://inbox-redis:6379/1
DJANGO_CHANNELS_LAYER_URL=redis://inbox-redis:6379/2

# Storage de mídia
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=paddock-inbox-media
R2_PUBLIC_URL=https://media.paddockinbox.com.br

# Segurança
FIELD_ENCRYPTION_KEY=              # Fernet key — para Channel.credentials
```

### Agentes IA do módulo (system prompts completos)

Cada agente tem escopo fechado. Handoff só ocorre quando a etapa anterior está completa e documentada.

**Ordem de execução:**
1. Agente Infra — serviços rodando + .env.example entregue
2. Agente Backend — modelos + migrations + endpoints documentados
3. Agente Integrações — connectors WhatsApp + Meta + Embedded Signup
4. Agente Backend — WebSocket consumer + eventos inbox-core publicados
5. Agente Frontend Web — InboxPanel funcional consumindo inbox-core
6. Agente Mobile — paridade funcional em React Native

#### Agente PM

```
Você é o Agente PM do projeto Paddock Inbox (Paddock Solutions).
PAPEL: coordenar agentes, definir prioridades, validar escapes de escopo, tomar decisões de produto.
NUNCA escreva código. Apenas especifique, revise e coordene.
Handoff só ocorre quando a etapa anterior está completa e documentada.
Qualquer mudança de escopo passa pelo PM antes de ser implementada.
```

#### Agente Backend

```
Você é o Agente Backend do Paddock Inbox (Paddock Solutions).
STACK: Django 5 + DRF + Django Channels + Celery + Redis + PostgreSQL (Neon DB)
ESCOPO: services/inbox-api/inbox/ — models, serializers, views, consumers, tasks, webhooks/
RESPONSABILIDADES:
- Implementar e manter modelos, migrations, serializers, viewsets, consumers, tasks
- Manter inbox-core atualizado com tipos TypeScript e contrato de eventos
- Documentar todos os endpoints no README antes de handoff para Frontend
NÃO FAZER: não toque em connectors/ — escopo do Agente Integrações
CRITÉRIO DE CONCLUSÃO: migrations rodando + testes passando + endpoints documentados + eventos inbox-core publicados
```

#### Agente Integrações

```
Você é o Agente Integrações do Paddock Inbox (Paddock Solutions).
STACK: Python + httpx + Meta Graph API v21 + Evolution API + OAuth 2.0
ESCOPO: inbox/connectors/ · inbox/webhooks/ · inbox/onboarding/
RESPONSABILIDADES:
- Connectors de canal (whatsapp, instagram, facebook)
- Webhook receiver: recebe, valida assinatura HMAC, normaliza, enfileira no Celery
- Embedded Signup: fluxo OAuth Meta completo por tenant
- Envio de mensagens de volta (reply) para cada canal
NÃO FAZER: não altere modelos Django. Não toque no WebSocket consumer.
CONTRATO: normalizer SEMPRE retorna {source, external_id, direction, content, media_url, contact_data}
REGRA: credentials acessados APENAS via Channel.credentials (ORM) — nunca hardcode
```

#### Agente Frontend Web

```
Você é o Agente Frontend Web do Paddock Inbox (Paddock Solutions).
STACK: Next.js 15 + TypeScript strict + React + Tailwind CSS + @paddock/inbox-core
ESCOPO: packages/inbox-web/
RESPONSABILIDADES: InboxPanel, ConversationList, ConversationView, MessageComposer, ChannelBadge
CONTRATO DA PROP PRINCIPAL:
  <InboxPanel token={string} wsUrl?={string} onConversationSelect?={fn} />
NÃO FAZER: não reimplemente WebSocket — use useInbox() do inbox-core. Sem dependências pesadas sem aprovação PM.
PRÉ-REQUISITO: inbox-core publicado e documentado antes de iniciar.
```

#### Agente Mobile

```
Você é o Agente Mobile do Paddock Inbox (Paddock Solutions).
STACK: React Native + Expo SDK 52 + TypeScript + @paddock/inbox-core
ESCOPO: packages/inbox-native/
RESPONSABILIDADES: paridade funcional com inbox-web, adaptada para RN
DIFERENÇAS OBRIGATÓRIAS: FlatList para listas, KeyboardAvoidingView no composer,
  expo-image para cache, swipe para arquivar, TouchableOpacity sem hover states,
  Expo Notifications para push em mensagem nova.
PRÉ-REQUISITO: inbox-web funcional antes de iniciar.
```

#### Agente Infra

```
Você é o Agente Infra do Paddock Inbox (Paddock Solutions).
STACK: Coolify + Hostinger KVM 4 (Ubuntu 24.04) + Neon DB + Redis + Cloudflare + Docker
SERVIÇOS: inbox-api (Django ASGI/Daphne) · inbox-worker (Celery) · inbox-redis · Neon DB · Cloudflare
RESPONSABILIDADES:
- Provisionar todos os serviços antes de qualquer agente iniciar dev
- Configurar health checks e restart policy no Coolify
- Cloudflare: SSL + rate limit em /webhooks/*
- Entregar .env.example completo para o Backend antes do handoff
NÃO FAZER: não escreva código da aplicação — apenas infra e deploy.
CRITÉRIO DE CONCLUSÃO: todos os serviços healthy no Coolify + WebSocket acessível em wss:// + webhook endpoint em https:// com SSL válido
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
| `VOYAGE_API_KEY` | Embeddings semânticos (Voyage voyage-3) — Motor de Orçamentos MO-2+ |
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
- [ ] `make sprint-close SPRINT=XX` executado ao fim de cada sprint

---

## 🗺️ Sprints em Andamento

Nenhuma sprint ativa no momento.

---

## 🗄️ Backlog Pausado

### Sprint 15 — Banking + Asaas + Relatórios Financeiros
**Adiado indefinidamente — retomar quando o módulo financeiro for prioridade**
- App `accounts_banking`: BankAccount, BankTransaction, OFXImportService
- Reconciliação AP/AR ↔ lançamentos bancários
- `CashFlowService`: fluxo de caixa projetado
- Asaas webhook completo + auto-baixa ReceivableDocument
- OS → ReceivableDocument na entrega
- Relatórios DRE, Balanço, Fluxo de Caixa (PDF + XLSX)
- Frontend `/financeiro/relatorios` + detalhes AP/AR

---

## 📦 Sprints Entregues

### Ciclo 07 — Cadastros Unificados — Abril 2026 ✅
**Person limpo + sub-modelos por role + InsurerTenantProfile tenant-aware + Corretores + Especialistas**

Backend:
- `persons/migrations/0010_person_cleanup`: remove 5 campos deprecated de `Person` (document, logo_url, insurer_code, job_title, department)
- `persons/migrations/0011_add_submodels`: cria `ClientProfile`, `BrokerOffice`, `BrokerPerson` (OneToOneField → Person)
- `insurers/migrations/0005`: `InsurerTenantProfile` + `0006`: adiciona `company FK` (tenants.Company) + `unique_together(insurer, company)` — isolamento real por tenant
- `hr/migrations/0005`: adiciona bank fields + `emergency_contact_relationship`; `0006`: re-encripta `emergency_contact_phone` (LGPD)
- `EmployeeCreateSerializer.create()`: auto-cria `Person(PF)` + `PersonRole(EMPLOYEE)` na admissão
- `PersonCreateUpdateSerializer`: suporte a escrita de `documents[]` via `_sync_documents()` (empty list = preserva existentes)
- `PersonDetailSerializer`: retorna `documents[]` (mascarados) e `client_profile`
- `PersonViewSet.get_queryset()`: suporte ao filtro `?kind=PF|PJ`
- `InsurerViewSet`: RBAC — MANAGER+ em write; `_logo_extension()` remove `text/plain` (segurança)
- `ExpertViewSet`: RBAC — CONSULTANT+ leitura, MANAGER+ escrita
- Endpoint `GET/PUT /api/v1/insurers/{id}/tenant_profile/` — usa `connection.tenant` para isolamento

Frontend:
- `packages/types/src/person.types.ts`: remove `document`, adiciona `PersonDocument`, `PersonDocumentWrite`, `ClientProfile`, `InsurerTenantProfile`
- `packages/types/src/hr.types.ts`: adiciona campos bancários + `emergency_contact_relationship`
- `PersonFormModal`: seção Documentos com `useFieldArray`; docs existentes read-only (sem pre-fill mascarado)
- `/cadastros/seguradoras/[id]`: tabs "Dados Gerais" + "Perfil Operacional"
- `/cadastros/corretores`: split panel escritórios (PJ) + corretores (PF)
- `/cadastros/especialistas`: lista + dialog peritos externos
- `useInsurers`: `useInsurerTenantProfile` + `useUpdateInsurerTenantProfile`
- `useExperts`, `usePersons` (filtro kind) adicionados

**Padrões estabelecidos:**
- `InsurerTenantProfile` usa `(insurer, company)` unique_together — `get_or_create(insurer=..., company=connection.tenant)`
- `_sync_documents(person, [])` → return early (preserva docs existentes); lista não-vazia → delete-all + recreate
- `PersonFormModal` em modo edição: não pre-preenche `value` de documentos com `value_masked` (corrupção de dados)
- `emergency_contact_phone` SEMPRE EncryptedCharField — telefone de terceiro ainda é PII coberto pelo LGPD
- `PersonViewSet` aceita `?kind=PF|PJ` como alias de `person_kind`

---

### Ciclo 07 (anterior) — Keycloak Ativação + Tema de Login DS Car — Abril 2026 ✅
**Keycloak 24 ativo em dev + tema customizado DS Car (split 50/50, neon, carrossel)**

Infra:
- `infra/docker/docker-compose.dev.yml`: volume do tema + `--health-enabled=true` + `KC_HEALTH_ENABLED`
- `infra/docker/keycloak/realm-export.json`: `loginTheme: "paddock"`, `resetPasswordAllowed: false`
- Schema Keycloak criado automaticamente por `infra/docker/init/01_setup.sql` (não requer passo manual)

Tema `infra/docker/keycloak/themes/paddock/login/`:
- `theme.properties`: `parent=base`, `styles=css/login.css`, `scripts=js/carousel.js`
- `login.ftl`: template Freemarker — split 50/50, logo DS Car, form OIDC, 4 slides carrossel, 16 neon lines, footer
- `resources/css/login.css`: dark theme, animações neon (travel-h/travel-v), Montserrat
- `resources/js/carousel.js`: autoplay 4500ms, dot navigation
- `resources/img/logo-dscar.png`: copiado de `apps/dscar-web/public/`

**Padrões estabelecidos:**
- KC 24: usar `${url.resourcesPath}` não `${resourcesPath}` em templates .ftl (ver Armadilhas)
- Client ID no realm: `paddock-frontend` (não `dscar-web`)
- Reset de senha self-service: DESATIVADO (`resetPasswordAllowed: false`) — senha temporária via WhatsApp pelo admin
- Reimportar realm (após mudanças em realm-export.json): `make dev-reset && make dev`
- Em prod: fluxo de login aponta diretamente para Keycloak (sem tela intermediária Next.js `/login`)

---

### Ciclo 06C — NFS-e Manaus end-to-end + NF-e Recebidas — Abril 2026 ✅
**App `apps.fiscal` (extendido) — emissão NFS-e Manaus + manifestação de destinatário**

Backend:
- Migration `fiscal/0004`: `FiscalDocument` expandido com `ref`, `config FK`, `service_order FK`, `destinatario FK`, `protocolo`, `caminho_xml`, `caminho_pdf`, `payload_enviado`, `ultima_resposta`, `mensagem_sefaz`, `natureza_rejeicao`, `valor_impostos`, `documento_referenciado`, `created_by`, `manual_reason` + `CheckConstraint`
- `ManausNfseBuilder.build()`: monta payload Focus NFS-e para Manaus (IBGE `1302603`) — LC116 6 dígitos (`140100`), RPS, tomador PF/PJ via `Person+PersonDocument+PersonAddress`
- `ManualNfseBuilder.build()`: monta payload NFS-e a partir de `ManualNfseInputSerializer.validated_data`
- `FiscalService.emit_nfse()`, `emit_manual_nfse()`, `consult()`, `cancel()` — implementação completa com `@transaction.atomic`, idempotência via `ref`, polling via Celery
- `poll_fiscal_document` task: polling a cada 10s, max 60 retentativas, encerra quando Focus retorna `autorizado`/`erro_autorizacao`
- `NfseEmitView`, `NfseEmitManualView`, `FiscalDocumentViewSet` — RBAC: emissão CONSULTANT+, manual ADMIN+, cancelamento MANAGER+
- `NfeRecebidaListView`: GET `/fiscal/nfe-recebidas/` — pass-through Focus `/v2/nfes_recebidas` por CNPJ
- `NfeRecebidaManifestView`: POST `/fiscal/nfe-recebidas/{chave}/manifesto/` — encaminha manifestação à Focus
- Fix crítico: `FOCUSNFE_TOKEN` (env container) vs `FOCUS_NFE_TOKEN` (settings antigo) — fallback chain em `settings/base.py`

Frontend (`dscar-web`):
- `packages/types/src/fiscal.types.ts` — `FiscalDocument`, `FiscalDocumentList`, `ManualNfseInput`, `ManualNfseItem`
- `src/hooks/useFiscal.ts` — `useFiscalDocuments`, `useFiscalDocument`, `useEmitNfse`, `useEmitManualNfse`, `useCancelFiscalDoc`, `useNfeRecebidas`, `useNfeRecebidaManifest`
- `/fiscal/documentos` — lista de documentos fiscais emitidos: KPIs (pendente/autorizado/rejeitado), filtros tipo+status, links PDF/XML, cancelamento MANAGER+
- `/fiscal/emitir-nfse` — formulário NFS-e manual ADMIN+: busca de Person, array dinâmico de itens, discriminação, motivo obrigatório
- `/fiscal/nfe-recebidas` — lista NF-e recebidas de fornecedores: manifesto de destinatário (ciência → confirmar/desconhecer)
- Sidebar: seção "FISCAL" com "Documentos Emitidos" (FileText), "NF-e Recebidas" (Inbox), "Emitir NFS-e Manual" (FileText)

**Padrões estabelecidos:**
- `FOCUSNFE_TOKEN` é o env var correto no container; settings lê com fallback: `config("FOCUSNFE_TOKEN") or config("FOCUS_NFE_TOKEN")`
- Manaus IBGE: `"1302603"`; LC116 formato: 6 dígitos numéricos sem ponto (`"140100"`, `"140500"`)
- `_normalize_lc116(code)`: strip de pontos + ljust(6, "0")[:6]
- NF-e recebidas: pass-through Focus sem armazenar no banco — `NfeRecebidaListView` e `NfeRecebidaManifestView` são puramente proxy
- `FocusNFeError` deve ser capturado explicitamente com `isinstance()` nas views — não cai no `except Exception` genérico
- `FiscalDocumentListSerializer`: nunca usar `source=` quando field name == source (AssertionError DRF)
- `NfeRecebida` campos reais Focus: `nome_emitente` e `documento_emitente` (não `emitente_nome`/`emitente_cnpj`)

---

### MO-9 — Capacidade + Variâncias + Auditoria — Abril 2026 ✅
**Extensões em `apps.service_orders`, `apps.pricing_tech`, `apps.pricing_engine`**

Backend:
- `CapacidadeTecnico`: horas/dia por técnico × categoria, dias_semana JSON, vigência temporal
- `BloqueioCapacidade`: bloqueio pontual (férias, licença) — CapacidadeService desconta ao calcular
- `CapacidadeService`: `utilizacao()` (horas disponíveis vs. comprometidas), `heatmap_semana()` (7 dias), `proxima_data_disponivel()`
- `VarianciaFicha`: desvio horas e insumos estimados vs. realizados (por ServicoCanonico + mês)
- `VarianciaPecaCusto`: desvio custo snapshot motor vs. custo NF-e real, flag `alerta` quando |Δ| > 15%
- `VarianciaService.gerar_variancia_periodo()`: idempotente via `update_or_create`, dispara via `task_gerar_variancias_mensais`
- `AuditoriaMotor`: log imutável de cada chamada ao motor — operação, contexto, resultado, tempo_ms, sucesso
- `AuditoriaService.log()`: context manager → grava AuditoriaMotor sem interromper fluxo principal
- `AuditoriaService.healthcheck()`: total_chamadas, taxa_erro_pct, tempo_medio_ms
- `setup_motor_precificacao` management command: onboarding idempotente de MargemOperacao padrão + CustoHoraFallback por Empresa
- Migrations: `service_orders/0020_capacity_models`, `pricing_tech/0002_variancia_models`, `pricing_engine/0005_auditoria_motor`
- Endpoints: `GET /api/v1/capacidade/*` (utilizacao, heatmap-semana, proxima-data, capacidades/, bloqueios/), `GET /api/v1/pricing/variancias/fichas|pecas/` (+ `POST fichas/gerar/`), `GET /api/v1/pricing/engine/auditoria/`, `GET /api/v1/pricing/engine/healthcheck/`

Frontend:
- `capacidade.types.ts` — tipos CapacidadeTecnico, BloqueioCapacidade, UtilizacaoCapacidade, HeatmapDia, VarianciaFicha, VarianciaPecaCusto, AuditoriaMotor, MotorHealthcheck
- `useCapacidade.ts` — 14 hooks TanStack Query v5
- `/capacidade` — heatmap semanal (verde/amarelo/vermelho), CRUD capacidades/bloqueios
- `/configuracao-motor/variancias` — tabs Fichas/Peças, filtro por mês, badge alertas, botão gerar
- `/auditoria/motor` — KPIs healthcheck + tabela de auditorias com filtros operação/erros
- Sidebar: seção "OPERAÇÃO" com Capacidade, Variâncias, Auditoria Motor

**Padrões estabelecidos:**
- `CapacidadeService` usa `select_for_update` não é necessário (leitura) — mas `update_or_create` nas variâncias garante idempotência
- `AuditoriaService` retorna `False` em `__exit__` — nunca suprime exceção original
- `task_gerar_variancias_mensais` usa mês anterior se `mes_referencia_iso` omitido — padrão para agendamento Celery beat
- `dias_semana` usa `_dias_semana_default` (callable) não lista literal — Django JSONField exige callable

---

### MO-8 — Benchmark IA + Ingestão PDF + Circuito de Aprendizado — Abril 2026 ✅
**App `apps.pricing_benchmark` (TENANT_APP) — coleta, processamento e sugestão IA**

Backend:
- `BenchmarkFonte`: empresa FK, tipo (seguradora_pdf/seguradora_json/cotacao_externa/concorrente), confiabilidade Decimal
- `BenchmarkIngestao`: fonte FK, arquivo FileField, status (recebido/processando/concluido/erro), contadores, log_erro
- `BenchmarkAmostra`: ingestao+fonte FKs, tipo_item (servico/peca), alias_match_confianca, descricao_bruta, valor_praticado; 3 índices DB
- `SugestaoIA`: orcamento FK nullable, briefing, veiculo_info JSON, resposta_raw JSON, avaliacao, modelo_usado, tempo_resposta_ms
- `PDFIngestionService.processar()`: pdfplumber, regex valor, AliasMatcher instância (score 0-100), confianca = score/100.0
- `AliasFeedbackService.aceitar_match()`: cria AliasServico/AliasPeca + atualiza confianca → 1.00 + dispatcha reembed
- `AliasFeedbackService.descartar()`: marca descartada=True com motivo
- `IAComposicaoService.sugerir()`: Claude Sonnet 4.6, temperature=0.3, SYSTEM_PROMPT proíbe preço, validação regex TERMOS_PRECO (Armadilha A10)
- `BenchmarkService` real (substitui stub MO-6): two-pass query (específico ≥ 8 amostras → senão genérico), p90 via statistics.quantiles (Armadilha P4)
- Migrations: `pricing_benchmark/0001_initial` (FK `persons.Person` não Pessoa, UUID padrão PaddockBaseModel)
- Endpoints: `GET/POST benchmark/fontes|ingestoes|amostras/`, `POST amostras/{id}/aceitar-match|descartar/`, `GET benchmark/estatisticas/servico/{id}/`, `POST ia/sugestoes/sugerir-composicao/`, `POST ia/{id}/avaliar/`

Frontend:
- `benchmark.types.ts` — 12 tipos incluindo BenchmarkFonte, BenchmarkAmostra, SugestaoIA, BenchmarkEstatisticas
- `useBenchmark.ts` — 12 hooks
- `/benchmark/fontes` — tabela CRUD + form inline
- `/benchmark/ingestoes` — upload FormData + lista expandível com amostras
- `/benchmark/revisao` — split-panel: lista pendentes / painel aceitar-match ou descartar
- `/benchmark/estatisticas` — filtros UUID+segmento+tamanho, KPIs p50/p90/min/max/count
- Sidebar: seção "BENCHMARK" com 4 sub-itens

**Padrões estabelecidos:**
- `AliasMatcher()` é instância, não static — `match_servico(descricao, top_k=1)` retorna `list[MatchResult]` com `score` 0-100
- Armadilha A7: benchmark é teto, nunca alvo — `min(preco_calculado, p90)`
- Armadilha A10: IA nunca sugere preço — SYSTEM_PROMPT + `_validar()` regex + schema sem campos de preço
- Armadilha P4: two-pass benchmark — específico primeiro; se < 8, incorpora genérico

---

### MO-7 — Orçamento + OS integrada ao Motor — Abril 2026 ✅
**App `apps.quotes` (TENANT_APP) + extensão `apps.service_orders` com entidades de execução**

Backend:
- `Orcamento`: documento comercial versionado (numero ORC-{year}-{seq}, versao 1+), status rascunho→enviado→aprovado/aprovado_parc/recusado/expirado/convertido_os
- `AreaImpacto`: região do veículo negociada em bloco com seguradora; toda OS nasce com área "Geral"
- `OrcamentoIntervencao`: (Peça × Ação) — UniqueConstraint(orcamento, area, peca, acao); snapshot imutável obrigatório
- `OrcamentoItemAdicional`: serviço sem peça específica (alinhamento, polimento, lavagem)
- `MAPEAMENTO_ACAO_SERVICO` em `pricing_catalog/constants.py`: trocar→INST_PECA, reparar→FUNILARIA, pintar→PINTURA, remocao_instalacao→REMOCAO_INSTAL
- `OrcamentoService.criar()`: resolves enquadramento (fallback "medio/medio"), gera ORC-{year}-{seq:06d}, cria área "Geral"
- `OrcamentoService.adicionar_intervencao()`: resolve ServicoCanonico via MAPEAMENTO, FichaTecnicaService.resolver(), ContextoCalculo + calcular_intervencao() → cria OrcamentoIntervencao
- `OrcamentoService.aprovar()`: @transaction.atomic → cria ServiceOrder, espelha OSAreaImpacto/OSIntervencao/OSItemAdicional, reserva automática TROCAR+OFICINA (ReservaIndisponivel avisa, não bloqueia)
- `OrcamentoService.nova_versao()`: clona orçamento incrementando versão, recalcula todos snapshots com custos correntes
- Entidades de execução em `service_orders`:
  - `OSAreaImpacto`: espelho da AreaImpacto aprovada na OS (related_name: `areas_motor`)
  - `OSIntervencao`: intervenção aprovada + unidade_reservada nullable (preenchida no picking)  — related_name: `intervencoes_motor`
  - `OSItemAdicional`: serviço adicional aprovado — related_name: `itens_adicionais_motor`
  - `ApontamentoHoras`: rastreamento de tempo real por técnico (status: iniciado/encerrado/validado)
- Migration `quotes/0001_initial` + `service_orders/0019_motor_entities`; `manage.py check` 0 issues
- RBAC: criação CONSULTANT+, aprovação/recusa MANAGER+
- Endpoints: `GET/POST /api/v1/quotes/orcamentos/`, `GET /orcamentos/{id}/`, `POST orcamentos/{id}/intervencoes/`, `POST orcamentos/{id}/itens-adicionais/`, `POST orcamentos/{id}/enviar/`, `POST orcamentos/{id}/recusar/`, `POST orcamentos/{id}/aprovar/`, `POST orcamentos/{id}/nova-versao/`

Frontend:
- `packages/types/src/quote.types.ts` — Acao, StatusItem, QualificadorPeca, Fornecimento, StatusArea, StatusOrcamento, OrcamentoList, Orcamento (completo com areas+intervencoes+itens_adicionais)
- `hooks/useQuotes.ts` — 9 hooks TanStack Query v5
- `/orcamentos` — lista com 4 KPIs (rascunhos, enviados, aprovados, volume), filtro por status, tabela com placa
- `/orcamentos/novo` — formulário: empresa, cliente, seguradora, tipo_responsabilidade, veículo, observações
- `/orcamentos/[id]` — detalhe: cabeçalho (numero+versao+status), totais (subtotal/desconto/total), intervenções agrupadas por área, itens adicionais; botões de fluxo (enviar, recusar, aprovar→OS, nova versão)
- Sidebar: item "Orçamentos" (FileText) entre Agenda e Cadastros

**Padrões críticos estabelecidos:**
- `MAPEAMENTO_ACAO_SERVICO` em `pricing_catalog/constants.py` é o contrato único — nunca duplicar em outros módulos
- `adicionar_intervencao()` só aceita status="rascunho" — intervenções em orçamento enviado são bloqueadas (OrcamentoNaoEditavel)
- `aprovar()` é @transaction.atomic — falha na reserva de peças NÃO reverte a aprovação (P10: aviso no log)
- `OSIntervencao.unidade_reservada` preenchida pelo PickingService após bipar unidade (futuro)
- `ApontamentoHoras` = tempo real vs. `horas_mao_obra` do snapshot (estimativa do motor) — diferença gera KPI produtividade
- Endpoint aprovação retorna `{os_id, os_number}` — frontend redireciona para `/os/{os_id}`

---

### MO-6 — Motor de Precificação + Snapshots — Abril 2026 ✅
**App `apps.pricing_engine` (completado) — motor de cálculo de preço com audit trail imutável**

Backend:
- `MargemOperacao`: margem por (empresa, segmento, tipo_operacao) com vigência temporal — hierarquia: peça-específica > faixa de custo > segmento default
- `MarkupPeca`: markup por `peca_canonica_id` (UUID, `db_constraint=False`) OU faixa de custo `[custo_min, custo_max)` — XOR validado no serializer
- `CalculoCustoSnapshot`: registro imutável de auditoria — `save()` lança `ValueError` se campos de custo/preço mudarem após criação; FKs `servico_canonico`/`peca_canonica` com `db_constraint=False` (permite snapshot mesmo se catálogo mudar)
- `MargemResolver`: hierarquia de resolução — `markup_peca_especifico()` > `markup_peca_faixa()` > `margem_segmento()` > `MargemNaoDefinida`
- `BenchmarkService`: aplica teto de preço por segmento (`preco_teto_benchmark`); `teto_aplicado=True` no resultado quando o teto é acionado
- `MotorPrecificacaoService`: facade unificada — `calcular_servico()` + `calcular_peca()` + `simular()`; raises `ErroMotorPrecificacao` para erros de domínio
- Migrations 0002 (motor models), 0003 (created_by fix em modelos gerados manualmente), 0004 (`SeparateDatabaseAndState` + `RunSQL` PL/pgSQL para DROP FK constraints por nome de coluna)
- 33 testes passando: `test_margem_resolver` (9), `test_snapshot_imutabilidade` (10), `test_motor_peca` (6), `test_motor_servico` (9)

Padrões críticos estabelecidos:
- `db_constraint=False` em FKs de snapshot — permite audit trail mesmo após deleção de catálogo (sem quebrar integridade dos registros históricos)
- Imports no nível do módulo em `services/motor.py` — lazy imports impossibilitam `@patch` nos testes (armadilha crítica)
- UUIDs válidos obrigatórios mesmo com `db_constraint=False` — Django valida formato UUID no Python antes de tocar no DB
- `SeparateDatabaseAndState` para alterar `db_constraint` em migrations — `AlterField` simples não executa DROP CONSTRAINT no banco
- `fator_responsabilidade` mínimo 0.5 (validator) — usar `Decimal("1.00")` nos testes, não `Decimal("0.10")`
- `ordem` NOT NULL em `SegmentoVeicular` e `CategoriaTamanho` — sempre incluir nos helpers de teste

Frontend:
- `packages/types/src/pricing-engine.types.ts` — `ContextoCalculoInput`, `CalcularServicoInput`, `CalcularPecaInput`, `ResultadoServicoDTO`, `ResultadoPecaDTO`, `SnapshotMin/Mgr/Full`, `Snapshot` union, `MargemOperacao`, `MarkupPeca`
- `hooks/usePricingEngine.ts` — margens, markups, snapshots (`staleTime: Infinity`), `useCalcularServico`, `useCalcularPeca`, `useSimular`
- `/configuracao-motor/margens` — 2 abas: MargemOperacao (segmento × operação) e MarkupPeca (por UUID de peça ou faixa de custo)
- `/configuracao-motor/snapshots` — lista com filtro por origem + busca por veículo/ID
- `/configuracao-motor/snapshots/[id]` — detalhe: contexto, preços, margens, custos (ADMIN+), decomposição JSON
- `/configuracao-motor/simulador` — calcula preços de N serviços por UUID com contexto veicular completo
- Sidebar: "Margens" (Percent), "Snapshots" (Layers), "Simulador" (FlaskConical) adicionados ao grupo Motor

---

### MO-5 — Estoque Físico + NF-e Entrada — Abril 2026 ✅
**Apps `apps.inventory` (extendido) + `apps.fiscal` (extendido) + `apps.pricing_engine` (custo base)**

Backend:
- `NFeEntrada` + `NFeEntradaItem` em `apps.fiscal.models` — status (importada/validada/estoque_gerado), reconciliação por item (peca/insumo/ignorado), flag `estoque_gerado` para idempotência (Armadilha P10)
- `UnidadeFisica`: peça fisicamente identificável, barcode `P{pk.hex}` (Armadilha P4), status AVAILABLE/RESERVED/CONSUMED/RETURNED/LOST, FK nullable para OS
- `LoteInsumo`: insumo fungível, barcode `L{pk.hex}`, FIFO por `created_at`, `valor_unitario_base` calculado no `save()`, CHECK constraint `saldo >= 0`
- `ConsumoInsumo`: snapshot de `valor_unitario_na_baixa` (Armadilha P8) — imutável
- `ImpressoraEtiqueta` + `EtiquetaImpressa` (XOR constraint unidade_fisica / lote_insumo)
- `ReservaUnidadeService`: `select_for_update(skip_locked=True)` (Armadilha P5), `forcar_mais_caro` requer ADMIN+ com log (Armadilha P7)
- `BaixaInsumoService`: FIFO com `select_for_update`, snapshot de custo, `ReservaIndisponivel` se saldo insuficiente
- `ZPLService`: gera ZPL para peça e lote; impressão sempre via Celery (Armadilha P6)
- `NFeIngestaoService.criar_registros_estoque()`: idempotente via `estoque_gerado` flag
- `CustoPecaService.custo_base()`: `max(valor_nf)` incluindo reservadas (Armadilha A2)
- `CustoInsumoService.custo_base()`: `max(valor_unitario_base)` de lotes com `saldo > 0`
- Migrations: `fiscal/0002` + `inventory/0002`; `manage.py check` 0 issues
- 23 testes (8 ZPL passando imediato; 15 DB em TenantTestCase)
- Endpoints: `/api/v1/inventory/unidades/`, `/api/v1/inventory/lotes/`, `/api/v1/inventory/baixar-insumo/`, `/api/v1/inventory/impressoras/`, `/api/v1/fiscal/nfe-entrada/`
- Debug endpoints ADMIN+: `/api/v1/pricing/engine/debug/custo-peca/`, `/debug/custo-insumo/`

Frontend:
- `packages/types/src/inventory.types.ts` — 15 interfaces + 5 unions
- `apps/dscar-web/src/hooks/useInventory.ts` — 14 hooks (unidades, lotes, bipagem, impressoras, NF-e)
- `/estoque` — dashboard com links para submodules
- `/estoque/unidades` — lista com filtro por status
- `/estoque/lotes` — lista com barra de saldo visual (%, gradiente vermelho→verde)
- `/estoque/nfe-recebida` — lista de NF-e com filtro por status
- `/estoque/nfe-recebida/[id]` — detalhe + tabela de itens reconciliados + botão "Gerar Estoque"
- `/configuracao-motor/impressoras` — CRUD de impressoras ZPL + botão Testar
- Sidebar: seção "ESTOQUE" (Unidades, Lotes, NF-e) + seção "MOTOR" (Custos, Impressoras)

**Padrões estabelecidos:**
- Barcode: `P{pk.hex}` para peças (33 chars), `L{pk.hex}` para lotes — determinístico, nunca global
- Armadilha A2: `custo_base` inclui unidades RESERVED (não só AVAILABLE) — crítico para não subestimar custo
- `select_for_update(skip_locked=True)` em toda operação de reserva/baixa — nunca sem lock
- `valor_unitario_na_baixa` é snapshot imutável do momento da baixa — nunca recalcular
- `estoque_gerado=True` é flag de idempotência — endpoint `gerar-estoque/` retorna 409 se já executado
- `StockLocation` não existe no codebase — usar `localizacao = CharField(max_length=80)` em vez de FK

---

### MO-4 — Ficha Técnica + Multiplicadores — Abril 2026 ✅
**App `apps.pricing_tech` (TENANT_APP) — fichas técnicas versionadas com aplicação de multiplicadores de tamanho**

Backend:
- App `apps.pricing_tech` registrado em `TENANT_APPS`; migration `0001_initial` aplicada
- `FichaTecnicaServico`: versão versionada por `(servico, versao, tipo_pintura)` — unique_together; `tipo_pintura=NULL` = genérica
- `FichaTecnicaMaoObra` + `FichaTecnicaInsumo`: imutáveis por design (Armadilha P1) — `ReadOnlyModelViewSet`
- `FichaTecnicaInsumo.clean()`: valida `unidade == material_canonico.unidade_base` (Armadilha A5)
- `FichaTecnicaService.resolver()`: específica → genérica → `FichaNaoEncontrada`
- `FichaTecnicaService.aplicar_multiplicadores()`: gate geral + per-item `afetada_por_tamanho`
- `FichaTecnicaService.criar_nova_versao()`: atômica, `select_for_update`, desativa anterior
- Endpoints: `GET /fichas/`, `GET /fichas/{id}/`, `POST /fichas/resolver/`, `POST /fichas/{id}/nova-versao/`, `DELETE /fichas/{id}/` (soft, ADMIN+)
- 33 testes unitários passando; management command `setup_fichas_base` idempotente (10 fichas top-10 DS Car)

Frontend:
- `packages/types/src/pricing-tech.types.ts` — tipos TS para fichas
- `hooks/useFichaTecnica.ts` — `useFichas`, `useFicha`, `useFichaResolver`, `useNovaVersao`
- `/cadastros/fichas-tecnicas` — lista + filtro por serviço
- `/cadastros/fichas-tecnicas/{servico_id}` — editor de receita, histórico de versões, dialog nova versão com Motivo obrigatório
- `/cadastros/fichas-tecnicas/simular` — debug tool simulador (ADMIN only): base vs multiplicadores lado a lado

**Padrões estabelecidos:**
- Imutabilidade por versão: fichas não têm PATCH/PUT — mudança = nova versão com motivo obrigatório (min 10 chars)
- `tipo_pintura=NULL` em `unique_together`: PostgreSQL permite múltiplos NULLs — unicidade de genérica validada no serializer
- `afetada_por_tamanho` (flag por item) + `aplica_multiplicador_tamanho` (gate do `ServicoCanonico`) são conceitos distintos (ver Armadilhas P4/P5)

---

### MO-3 — Adapters de Custo — Abril 2026 ✅
**Extensão `apps.accounting` + skeleton `apps.pricing_engine` + services adapters**

Backend:
- `DespesaRecorrente` (accounting): FK Empresa + ChartOfAccount, vigência datada, 12 tipos, migration 0002
- App `apps.pricing_engine` (skeleton TENANT_APP): `ParametroRateio`, `ParametroCustoHora`, `CustoHoraFallback` com vigência temporal
- `MAPEAMENTO_CATEGORIA_POSITION` em `constants.py` — mapeia categoria MO → hr.position (documento vivo)
- `RHAdapter`: lê `Payslip.is_closed=True` + `gross_pay` (campos reais do modelo HR, não spec)
- `DespesaRecorrenteService`: `total_vigente()` + `decomposicao_vigente()`
- `RateioService`: `por_hora()` = total despesas / horas produtivas
- `CustoHoraService`: pipeline RH + ParametroCustoHora → CustoHoraFallback → `CustoNaoDefinido`
- `dataclass CustoHora` com decomposição de auditoria (bruto_folha, com_13_ferias, com_fgts, …)
- Endpoints `/api/v1/pricing/engine/parametros/*` (ADMIN+ escrita) + `/debug/custo-hora/` + `/debug/rateio/`
- 32 testes (service + RBAC)

Frontend:
- `pricing-cost.types.ts` (ParametroRateio, CustoHoraFallback, CustoHoraResult)
- `usePricingCost.ts` — 12 hooks com fetchList
- Página `/configuracao-motor/custos` com 4 abas (Custo/Hora, Parâmetros, Despesas, Simulação ADMIN)

**Padrões estabelecidos:**
- `Payslip.is_closed` (bool) e `gross_pay` — campos reais, não `status="closed"` / `gross_salary`
- Vigência temporal obrigatória: `Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data)` em toda query de parâmetro
- Toda query de parâmetro filtra por `empresa_id` — nunca agregar todas as empresas
- `CustoHoraService` usa `_default_parametros()` se `ParametroCustoHora` nunca cadastrado
- Endpoints debug `/debug/*` apenas ADMIN — retornam decomposição completa (não usar em prod)

---

### MO-2 — Catálogo Técnico — Abril 2026 ✅
**App `apps.pricing_catalog` (TENANT_APP) — catálogo canônico de serviços, peças, materiais e aliases**

Backend:
- 12 models: `CategoriaServico`, `ServicoCanonico` (VectorField 1024d), `CategoriaMaoObra`, `MaterialCanonico`, `InsumoMaterial` (fator_conversao obrigatório), `PecaCanonica`, `CompatibilidadePeca`, `Fornecedor` (OneToOne → `persons.Person`), `CodigoFornecedorPeca`, `AliasServico/Peca/Material` (índice GIN trgm)
- Migration `0001_initial` com `CreateExtension("vector")` + `CreateExtension("pg_trgm")`
- `normalizar_texto` (`apps/pricing_catalog/utils/text.py`) — 21 regras de abreviação automotiva
- `AliasMatcher` — pipeline exato → fuzzy (`rapidfuzz`) → embedding (pgvector cosine)
- `embed_texts` / `embed_text` (`utils/embeddings.py`) — Voyage `voyage-3`, batch 128, fallback sem chave
- Celery task `embed_canonicos_pendentes(tenant_schema)` — multitenancy + bulk
- 8 ViewSets RBAC com `get_permissions()` + `@action match/`, `by-gtin/`, `revisao/`, `approve/`, `reject/`
- `setup_catalogo_base` — 12 cats serviço + 8 cats mão de obra + 20 materiais + 30 serviços (idempotente)

Frontend:
- `packages/types/src/pricing-catalog.types.ts` — 8 interfaces + 3 unions
- `apps/dscar-web/src/hooks/usePricingCatalog.ts` — todos os hooks com `fetchList<T>`
- 7 páginas `/cadastros/catalogo/*` (servicos, pecas, materiais, insumos, categorias-mao-obra, fornecedores, aliases/revisao)
- Sidebar "Catálogo Técnico" sob MOTOR (7 itens)

**Padrões estabelecidos:**
- `aplica_multiplicador_tamanho=True` APENAS em pintura, funilaria, polimento, vitrificação (default False — armadilha A3)
- `MaterialCanonico.unidade_base` e `codigo` são `read_only` em serializer de update (imutáveis após uso — armadilha P2)
- Busca fuzzy v1 em memória (`rapidfuzz`) — migrar para pg_trgm nativo quando catálogo > 5k aliases
- Todos hooks de lista usam `fetchList<T>` (extrai `.results` do envelope DRF paginado)
- `VOYAGE_API_KEY` — variável necessária para embeddings (sem chave: vetores zerados com warning)

---

### MO-1 — Fundação Veicular — Abril 2026 ✅
**App `apps.pricing_profile` (TENANT_APP) + extensão `apps.vehicle_catalog` (SHARED)**

Backend:
- `apps.pricing_profile`: `Empresa`, `SegmentoVeicular`, `CategoriaTamanho`, `TipoPintura`, `EnquadramentoVeiculo`, `EnquadramentoFaltante`
- `EnquadramentoService.resolver(marca, modelo, ano)` — 4 níveis de fallback (exato → marca_modelo → marca → fallback "medio/medio")
- Endpoints CRUD + `POST /resolver/`; RBAC com `get_permissions()`
- `VehicleMake`, `VehicleModel`, `VehicleYearVersion` em `vehicle_catalog` com integração FIPE (parallelum.com.br)
- Celery tasks semanais de sync FIPE
- `ServiceOrder` + 8 campos (segmento_codigo, tamanho_codigo, tipo_pintura_codigo, empresa_id, vehicle_*_id, vehicle_fipe_value_snapshot)
- `setup_perfil_veicular` — seeds de segmentos/tamanhos/tipos pintura/154 enquadramentos

Frontend:
- `packages/types/src/pricing.types.ts` — 9 interfaces
- `usePricingProfile.ts` com `fetchList<T>` (helper extrai `.results` DRF paginado)
- `FipeSelectGroup.tsx` — 3 selects cascata Marca → Modelo → Ano com badge de perfil resolvido
- 5 páginas `/cadastros/empresas`, `/cadastros/perfil-veicular/*`
- Sidebar grupo "MOTOR" com Settings2

---

### Sprints 17/18/19 — UX/UI Polish dscar-web — Abril 2026 ✅
**30 melhorias de UX/UI no ERP web — design system, fluxo de OS e módulo de agenda**

Design System (Sprint 17):
- `tailwind.config.ts`: `primary-600: #ea0e03`, `primary-700: #c50b02` (cor oficial DS Car) ✅
- Todos os textos abaixo de 12px migrados para `text-xs` (WCAG AA) ✅
- `ConfirmDialog` — componente reutilizável substitui todos os `window.confirm()` ✅
- `packages/utils/src/form-styles.ts` — constantes `FORM_LABEL`, `FORM_INPUT`, `FORM_ERROR`, `FORM_HINT` ✅
- `packages/utils/formatters.ts` — `formatCurrency({ compact: true })` → "R$1,2k" / "R$2,5M" ✅
- `BillingByTypeChart` — legenda dupla removida (era enganosa), barra única com total ✅
- `ServicesTab` + `PartsTab` — painel de totais standalone (fora do `<tfoot>`) com `formatCurrency` ✅
- `InsurerDialog` — seletor de cor nativo (`type="color"`) + input hex + swatch preview ✅
- `TableSkeleton` — loading states em listas de OS e seguradoras ✅

Fluxo de OS (Sprint 18):
- Lista OS: paginação 20/página com barra "N–M de total" + reset ao mudar filtro ✅
- OS detail: badge "Alterações não salvas" (isDirty) + botão Salvar desabilitado quando limpo ✅
- OS detail: `form.reset(savedOrder)` após save — elimina falso isDirty pós-gravação ✅
- OS detail: dropdown de transição de status no cabeçalho (usa `VALID_TRANSITIONS`) ✅
- `ServicesTab`: edição inline de quantidade e preço unitário (Enter salva, Escape cancela) ✅
- `PartsTab`: `ConfirmDialog` ao remover peça + try/catch em `handleDelete` ✅
- `PrazosSection`: labels de data desambiguados (`delivery_date` ≠ `estimated_delivery_date`) ✅
- `EntrySection`: painel read-only de NF-e/NFS-e com validação de 44 dígitos ✅
- `InsurerDialog`: máscara CNPJ `XX.XXX.XXX/XXXX-XX` ✅
- Kanban: toggles separados "Entregues" e "Canceladas" + coluna `cancelled` adicionada a `KANBAN_COLUMNS_ORDER` e `KANBAN_PHASE_GROUPS` em `packages/utils` ✅
- `ServicesTab` + `PartsTab`: toggle de desconto oculto por padrão ✅

Agenda + Polish (Sprint 19):
- `DayView`: full-width (removido `max-w-xl`) ✅
- `WeekView` + `DayView`: indicador de hora atual (linha vermelha, atualiza a cada 60s) ✅
- `WeekView` + `DayView`: células clicáveis abrem `SchedulingDialog` com data/hora pré-preenchidos ✅
- `WeekView`: máximo 2 eventos por célula + badge "+N mais" clicável → muda para DayView ✅
  - `MAX_VISIBLE = 2` constante; prop `onSwitchToDayView?: (date: Date) => void`
  - `agenda/page.tsx` passa `onSwitchToDayView={handleDayClick}` ao WeekView
- `CalendarEventCard`: cores WCAG AA (600–700 em vez de 500) ✅
- `CalendarEventCard`: exibe "Marca Modelo" em vez de primeiro nome (fallback para nome) ✅
- `agenda/page.tsx`: padding `p-6` consistente com outras páginas ✅
- `Sidebar`: tooltip corrige offset quando nav está scrollada (`navEl.scrollTop`) ✅
- Dashboard (`ManagerDashboard`, `ConsultantDashboard`, `TeamProductivityTable`, `OverdueOSList`): migração `emerald→success`, `blue→info` (tokens do design system) ✅
- `dashboard/page.tsx`: grid STOREKEEPER dinâmico via `cn()` baseado em `topStatuses.length` ✅

**Padrões estabelecidos nessas sprints:**
- `window.confirm()` proibido → sempre usar `ConfirmDialog` com estado `confirmXId`
- Mutations de delete sempre com try/catch + `toast.error`
- Campos de data em OS: `scheduling_date` / `delivery_date` / `estimated_delivery_date` / `client_delivery_date` — ver `PrazosSection.tsx` para labels corretos
- Tokens de cor: `success-*` (verde), `info-*` (azul), `error-*` (vermelho), `warning-*` (âmbar) — `accent-*` é escala cinza metálico, NÃO violet

---

### Sprint 16 — Catálogo de Serviços + Agenda + Dashboard Role-Based — Abril 2026 ✅
**Três features web entregues em uma sprint**

Backend:
- `ServiceCatalog` model (name, category, suggested_price, is_active) no app `service_orders` ✅
- FK opcional `service_catalog` em `ServiceOrderLabor` (ON_DELETE=SET_NULL) ✅
- Migration de merge `0015` (service_catalog + customer_uuid) ✅
- Endpoint `GET /service-orders/calendar/?date_start=&date_end=` → `CalendarView` ✅
- `DashboardStatsView`: retorna `ConsultantDashboardStats` ou `ManagerDashboardStats` por role JWT ✅
- Billing via `ReceivableDocument` com fallback em `services_total + parts_total` ✅

Frontend web:
- `/cadastros/servicos` — CRUD completo com busca e filtro por categoria ✅
- `ServicesTab` na OS: combobox busca catálogo + preço editável + tabela itens ✅
- `/agenda` — views Mês/Semana/Dia com date-fns (sem lib extra), `SchedulingDialog` ✅
- `/dashboard` — `ConsultantDashboard` (KPIs pessoais) e `ManagerDashboard` (faturamento, ticket médio, gráfico 6 meses, produtividade equipe, OS atrasadas) ✅
- Sidebar: item "Agenda" (CalendarDays) entre OS e Cadastros; "Serviços" sob Cadastros ✅

### Sprint M6 Mobile — Acompanhamento + Vistorias + Push Notifications — Abril 2026 ✅
**App mobile completo: fotos, vistorias e notificações push**

Mobile:
- Fotos de acompanhamento no detalhe da OS: câmera → upload → pasta `acompanhamento` ✅
- `vistoria/entrada/[osId].tsx` — checklist fotográfico (PhotoSlotGrid), ItemChecklistGrid, observações, transição → `budget` ✅
- `vistoria/saida/[osId].tsx` — comparativo antes/depois (fotos `vistoria_inicial` vs slots novos `vistoria_final`), checkboxes de reparos, transição → `ready` ✅
- `usePushNotifications.ts` — solicita permissão pós-login, registra Expo Push Token, listener foreground ✅

Backend:
- `GlobalUser.push_token` — `CharField` nullable + migration `authentication/0003_globaluser_push_token` ✅
- Endpoint `PATCH /api/v1/users/push-token/` — salva token no `GlobalUser` ✅
- Celery task `task_send_push_notification(tenant_schema, token, title, body)` — POST para `exp.host` ✅
- Disparada no `ServiceOrderViewSet` ao mudar status ✅

### OS Detail Dark Theme + Foto Sync Mobile — Abril 2026 ✅
**OS detail redesign completo (dark glass) + upload de fotos end-to-end funcionando**

Mobile — OS detail dark theme:
- `os/_layout.tsx` — `[id]` screen: `headerShown: false` (remove barra iOS nativa branca) ✅
- `components/ui/Card.tsx` — fundo dark glass (`Colors.surface #1c1c1e`, borda `Colors.border`) ✅
- `components/os/OSDetailHeader.tsx` — redesign completo: `LinearGradient`, `useSafeAreaInsets`, botão voltar, badge placa 22px/800 ✅
- `os/[id].tsx` — `VistoriaCTACard`: tints dark (`rgba(59,130,246,0.10)` / `rgba(22,163,74,0.10)`); `AcompanhamentoSection`: retry para fotos com erro (`errorCount`, `retryPhoto`) ✅

Mobile — foto sync:
- `lib/constants.ts` — `getTenantDomain(slug)` centralizado (`*.localhost` dev / `*.paddock.solutions` prod) ✅
- `lib/api.ts` — usa `getTenantDomain(activeCompany)` ✅
- `stores/photo.store.ts` — `uploadPendingPhotos` reescrito com `fetch + FormData` (remove `expo-file-system/legacy`); `updateOsId(oldId, newId)` action ✅
- `stores/photo.store.ts` — guard `if (!osId) continue` (pula fotos de OS offline ainda não sincronizadas) ✅
- `db/sync.ts` — `X-Tenant-Domain` usa `getTenantDomain`; após push bem-sucedido chama `updateOsId(localUUID, serverUUID)` ✅
- `hooks/usePushNotifications.ts` — `projectId` lido de `Constants.expoConfig?.extra?.eas?.projectId`; skip silencioso se não configurado ✅

Backend:
- `serializers.py` — `UploadPhotoSerializer.file`: `ImageField` → `FileField` (Pillow não instalado no container) ✅
- `serializers.py` — `ServiceOrderPhotoSerializer.get_url`: `request.build_absolute_uri(url)` quando URL relativa (dev local) ✅
- `views.py` — passa `context={'request': request}` nos dois pontos de instanciação do `ServiceOrderPhotoSerializer` ✅
- `models.py` — `OSPhotoFolder`: adicionados `FINAL_CHECKLIST = "checklist_saida"`, `EXPERTISE = "pericia"`, `OTHER = "outros"` ✅

### Seguradoras CRUD + Logo Upload — Abril 2026 ✅
**Gestão de Seguradoras com Upload de Logo (Web + Mobile)**

Backend:
- `InsurerViewSet` expandido para CRUD completo (antes só list) ✅
- `POST /api/v1/insurers/{id}/upload_logo/` — multipart PNG/SVG máx 2 MB ✅
- `default_storage` (local dev → `MEDIA_ROOT/insurers/logos/`, prod → S3) ✅
- `InsurerMinimalSerializer` agora retorna `cnpj`, `logo_url`, `is_active` além dos campos já existentes ✅
- `urls.py` dev: `static(MEDIA_URL, ...)` para servir uploads localmente ✅

Frontend Web:
- `/cadastros/seguradoras` — página de gestão com tabela, busca, CRUD ✅
- Upload rápido: clique na logo na tabela abre file input inline ✅
- `InsurerDialog` — Sheet com preview de logo, file input (PNG/SVG), cor, abreviação, Cilia ✅
- `src/hooks/useInsurers.ts` — hook global com create/update/delete/uploadLogo ✅
- Sidebar: item "Seguradoras" (Shield) adicionado em Cadastros ✅
- `next.config.ts`: rewrite `/media/*` → `http://localhost:8000/media/*` (dev) ✅

Frontend Mobile:
- `useInsurers.ts`: `resolveLogoUrl()` converte URL relativa em absoluta para `Image` do RN ✅
- `OSCard`: logo sem background — só shadow (`insurerLogoShadow` + `insurerLogoClip`) ✅
- Cache key bumped `v2` → `v3` para invalidar dados sem os novos campos ✅

Tipo `Insurer` (`@paddock/types`):
- Adicionados: `cnpj`, `logo_url`, `is_active`, `uses_cilia` como required ✅
- `logo: string | null` mantido (URL resolvida com fallback) ✅
- Novo: `InsurerFull` para retorno do endpoint CRUD ✅

### UX Refinamentos dscar-web — Abril 2026 ✅
**Nova Sidebar + OS Form + Filtros em Português**
- Nova `Sidebar.tsx` — Montserrat, animação fade-in, sem AppHeader, sem sidebarCollapsed
- OS Form redesign: `NewOSDrawer`, `TypeBar`, `VehicleSection` (fuel_type select PT), `CustomerSection` editável, `InsurerSection` com logo
- Filtros lista OS: selects nativos com labels em português
- Histórico OS: agrupamento por tipo de campo (customer/vehicle/schedule/insurer), ícones distintos, sem descrição verbosa
- Kanban: Tailwind content scan corrigido (packages/utils), `cancelled` → "Cancelada"
- Mobile: status keys alinhados com backend (waiting_auth, authorized, repair…)

### Sprint M5 Mobile — Abril 2026 ✅
**Abertura de OS no Mobile — Wizard 4 Steps**
- Wizard nova OS: Step1Vehicle (placa-fipe + MMKV 7d + fallback manual), Step2Customer (busca + cadastro rápido + LGPD), Step3OSType (toggle segurado/particular + grid tipo + campos seguradora), Step4Review (resumo + "Criar OS e Iniciar Checklist")
- `useVehicleByPlate` — POST placa-fipe.apibrasil.com.br + cache MMKV (TTL 7d, max 50 placas)
- `useCreateServiceOrder` — online (POST → WatermelonDB com `r._raw.id = server UUID`) + offline (`pushStatus='pending'`)
- `sync.ts pushChanges` — envia registros pending ao reconectar, atualiza `remoteId` + `number`
- Fix duplicatas: `r._raw.id = data.id` evita duplicação no sync pull; dedup por `remoteId` no observer
- `ServiceOrderSyncSerializer` — adicionados `insurer_id` e `insured_type` (logo seguradora no OSCard)
- `useInsurers` — campo `logo` correto (era `logo_url`); cache MMKV bumped para `v2`
- OSCard redesign: layout 2 colunas (info esquerda, OS# + avatar seguradora direita), placa em badge glass 18px, avatar circular 64px com padding interno

### Tema Global DS Car Mobile — Abril 2026 ✅
**Design tokens + glass style aplicados em toda a app**
- `src/constants/theme.ts` — `Colors`, `Radii`, `Spacing`, `Shadow` (fonte única de verdade)
- Todos os screens e components tokenizados: `os/index`, `os/[id]`, `checklist/*`, `nova-os/*`, `vistoria/*`, `camera`, `perfil`, `busca`, `notificacoes`, `FrostedNavBar`, `OSStatusBadge`, `OSCard`
- OSCard glass: `LinearGradient #3a3a3e → #1e1e22`, borda glint top `rgba(255,255,255,0.22)`, sombra pesada

### Refinamentos Mobile — OS Detail + Sync — Abril 2026 ✅
**OS Detail labels PT + Status Update + Sync fix + Badge reativo**

Mobile:
- `api.ts` — fix trailing slash corrompendo query string (`path.split('?')` antes de adicionar `/`)
- `useServiceOrders.ts` — `OSStatus` local substituído por `ServiceOrderStatus` de `@paddock/types`; polling foreground 60 s com `AppState` (para quando backgrounded)
- `useUpdateOSStatus.ts` — PATCH status + update WatermelonDB (`Q.where('remote_id')`) + invalida TanStack Query detail
- `OSCard.tsx` — comparador explícito no `React.memo` (checa `status`, `totalParts`, `totalServices`) — resolvia badge estagnado após update (WatermelonDB reutiliza mesma instância de modelo)
- `os/[id].tsx` — labels PT (`OS_TYPE_LABELS`, `CUSTOMER_TYPE_LABELS`); `OSTransitionLog` com campos reais (`created_at`, `changed_by_name`); `StatusUpdateModal` bottom-sheet com `VALID_TRANSITIONS`; `actionRow` com botões "Avançar Status" + "Checklist"
- `checklist/[osId].tsx` — `StatusBadge` inline substituído por `getStatusLabel/Color/BackgroundColor` de `OSStatusBadge`
- `checklist/index.tsx` + `OSCard.tsx` — removidos status obsoletos (`waiting_approval`, `approved`, `in_progress`)

Backend:
- `service_orders/views.py` — endpoint `sync/`: separado `created` (registros com `created_at >= since`) vs `updated` (existentes modificados) vs `deleted` (is_active=False) — eliminava o erro "[Sync] Server wants client to create record … but it already exists locally"

### Refinamentos UX Mobile pós-M4 — Abril 2026 ✅
**Nav/Header/Filtros Redesign**
- `FrostedNavBar.tsx` — T2 dark pill `#141414`, activeLine vermelha com glow, botão central `+` vermelho; fix HIDDEN_ROUTES/TAB_CONFIG; busca→Agenda, perfil→Config
- `os/index.tsx` — `OSHeader` DubiCars-style (`[spacer][logo centralizado][bell]`, LinearGradient `#1c1c1e→#141414`); filtros status → bottom-sheet modal (botão `options-outline` ao lado da busca) com active filter label bar
- `OSDetailHeader.tsx` — removido botão de voltar customizado (duplicava com nativo)
- `os/_layout.tsx` — `headerBackTitle: 'Voltar'` no screen `[id]`
- `useServiceOrders.ts` — busca expandida: `vehicle_plate`, `customer_name`, `vehicle_model`, `vehicle_brand` + `number`

### Sprint M4 Mobile — Abril 2026 ✅
**Checklist de Itens + Editor de Anotações nas Fotos**
- `AnnotationCanvas.tsx` — SVG dupla camada (committed + live preview), arrowhead
- `EditorToolBar.tsx` — seta/círculo/texto, 3 cores, undo/redo, salvar
- `photo-editor/index.tsx` — PanResponder, histórico 10 estados, ViewShot, expo-file-system
- `checklist-items.store.ts` — Zustand offline-first + `syncChecklistItems()`
- `ItemChecklistGrid.tsx` — 7 categorias, ciclo OK/Atenção/Crítico, `ChecklistSummaryBar`
- Backend: `ChecklistItem` model + migration `0012` + endpoints GET + bulk POST
- Correção: migrations `0012` e `customers/0003` adicionadas ao git (estavam untracked)
- Bug raiz regressão corrigido: migration `0014_vehicle_version` não aplicada → `make migrate`

### Sprint 14 — Abril 2026 ✅
**Contas a Pagar + Contas a Receber + OS Form Melhorado**
- Backend AP: `Supplier`, `PayableDocument`, `PayablePayment` + service/serializers/viewsets ✅
- Backend AR: `ReceivableDocument`, `ReceivableReceipt` + service/serializers/viewsets ✅
- Integração HR: ao fechar folha, cria `PayableDocument(origin='FOLHA')` ✅
- Apps registrados em `TENANT_APPS` e URLs em `config/urls.py` ✅
- Frontend AP/AR: types + hooks + pages (contas-pagar, contas-pagar/novo, contas-receber) ✅
- OS Form: `NewOSDrawer` (Sheet), `TypeBar`, `VehicleSection` (vehicle_version), `CustomerSearch`, `InsurerSection` com logo ✅
- Migration `0014_vehicle_version` — campo vehicle_version em ServiceOrder ✅
- **OS — Vínculo de cliente corrigido:** `ServiceOrder.customer_uuid` (UUIDField, migration `0015`); `services.py` pop+salva o UUID tanto em `create()` quanto em `update()` — antes o campo nunca era persistido ✅
- **CustomerSection redesenhada:** formulário editável completo (nome, telefone, email, nascimento, CPF mascarado readonly, endereço); PATCH ao `UnifiedCustomer` no save da OS; botão "Trocar cliente" com busca inline; `useCustomerDetail` + `useCustomerUpdate` ✅
- **`UnifiedCustomer` PATCH:** `UnifiedCustomerUpdateSerializer` + `partial_update` no viewset; `phone` retornado desmascarado para staff; `cpf_masked` como SerializerMethodField ✅
- **Histórico de OS — campo grouping:** `FIELD_LABELS` completo; `update()` cria 1 log por grupo (`customer_updated`, `vehicle_updated`, `schedule_updated`, `insurer_updated`, `updated`) em vez de 1 log monolítico; novos `ActivityType` no model; history POST aceita `activity_type` + `metadata`; `HistoryTab` com ícone/cor distintos por grupo, sem descrição verbosa — só `FieldDiff` ✅
- **Playwright E2E:** 6/6 testes passando — fix `waitForResponse` (skip 3xx), `z.preprocess` nos enums, `btn.evaluate()` para bypass de pointer interception ✅

---

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
