# Arquitetura do Sistema — DS Car ERP

> Documento técnico de referência. Descreve como as peças se encaixam.
> Para escopo do produto, ver `docs/PRD.md`. Para padrões de código, ver `CLAUDE.md`.

---

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                  │
├──────────────┬──────────────────┬───────────────────────────────┤
│  dscar-web   │     mobile       │       Keycloak (login)        │
│  (Next.js)   │  (Expo/RN)       │       (tema DS Car)           │
├──────────────┴──────────────────┴───────────────────────────────┤
│                    API Gateway (Proxy Next.js)                    │
├─────────────────────────────────────────────────────────────────┤
│                    Django REST Framework                          │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────┐ ┌───────────┐  │
│  │   OS    │ │ Estoque  │ │ Fiscal │ │ Cilia │ │  HR/Fin   │  │
│  └─────────┘ └──────────┘ └────────┘ └───────┘ └───────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL 16         │  Redis 7        │  S3 (fotos/XMLs)     │
│  (schema-per-tenant)   │  (cache+filas)  │                      │
└────────────────────────┴─────────────────┴──────────────────────┘
```

---

## Multitenancy

### Modelo: Schema-per-Tenant (django-tenants)

Cada empresa do Grupo DS Car opera em um schema PostgreSQL isolado.

```
PostgreSQL paddock_dev
├── public (schema)        ← SHARED_APPS
│   ├── Company (tenant)
│   ├── Domain
│   ├── GlobalUser
│   ├── Insurer
│   └── VehicleCatalog (FIPE)
│
├── tenant_dscar (schema)  ← TENANT_APPS
│   ├── Person
│   ├── ServiceOrder
│   ├── Inventory
│   ├── Fiscal
│   └── ... (todo o resto)
│
└── keycloak (schema)      ← Keycloak internal
```

### Roteamento de Tenant

**Em produção (Keycloak):**
- `Host: dscar.paddock.solutions` → `TenantMainMiddleware` resolve o schema

**Em desenvolvimento:**
- Node.js fetch ignora header `Host` customizado
- Proxy Next.js envia `X-Tenant-Domain: dscar.localhost`
- `DevTenantMiddleware` lê `X-Tenant-Domain` antes de usar Host padrão

### SHARED_APPS vs TENANT_APPS

| Tipo | Schema | Exemplos |
|------|--------|----------|
| SHARED_APPS | `public` | auth, tenants, customers, insurers, vehicle_catalog |
| TENANT_APPS | `tenant_*` | service_orders, inventory, fiscal, hr, purchasing, accounting |

### Celery + Tenancy

```python
# Tasks SEMPRE recebem tenant_schema
@shared_task
def task_exemplo(data: dict, tenant_schema: str) -> None:
    with schema_context(tenant_schema):
        # código aqui opera no schema correto
        ...
```

---

## Autenticação

### Fluxo Completo

```
                     ┌───────────────┐
                     │   Keycloak    │ (prod)
                     │   RS256 JWT   │
                     └───────┬───────┘
                             │
┌──────────┐    OIDC    ┌────┴─────┐   Bearer    ┌─────────┐
│ Browser  │ ────────── │ next-auth │ ──────────── │  Django │
│ / Mobile │            │   v5     │   + X-Tenant │   DRF   │
└──────────┘            └────┬─────┘              └─────────┘
                             │
                     ┌───────┴───────┐
                     │dev-credentials│ (dev)
                     │   HS256 JWT   │
                     └───────────────┘
```

### Dev (dev-credentials)

1. Login com qualquer email + senha `paddock123`
2. next-auth gera JWT HS256 (secret: `dscar-dev-secret-paddock-2025`)
3. Claims: `{ email, role: "ADMIN", jti, companies, active_company, tenant_schema }`
4. Backend: `DevJWTAuthentication` valida HS256, `get_or_create` GlobalUser por `email_hash`
5. `DevTenantMiddleware` lê `X-Tenant-Domain` para resolver schema

### Prod (Keycloak 24)

1. Login via Keycloak (tema customizado DS Car)
2. next-auth recebe tokens OIDC, extrai claims dos Protocol Mappers
3. JWT RS256 validado pelo backend via JWKS endpoint
4. `KeycloakJWTAuthentication` — fallback graceful se Keycloak offline (warn, não crash)
5. `TenantMainMiddleware` resolve schema pelo `Host` header

### JWT Claims (ambos ambientes)

```json
{
  "sub": "uuid",
  "email": "user@email.com",
  "companies": ["dscar"],
  "active_company": "dscar",
  "role": "CONSULTANT",
  "tenant_schema": "tenant_dscar",
  "client_slug": "grupo-dscar"
}
```

### RBAC (5 níveis)

```
OWNER (5) > ADMIN (4) > MANAGER (3) > CONSULTANT (2) > STOREKEEPER (1)
```

Backend: `get_permissions()` por ViewSet (ver `CLAUDE.md` Padrões de Segurança).
Frontend: `<PermissionGate role="MANAGER">` + `usePermission("MANAGER")`.

---

## Proxy API (Next.js → Django)

**Arquivo:** `apps/dscar-web/src/app/api/proxy/[...path]/route.ts`

```
Browser → /api/proxy/service-orders/?status=open
                    ↓
Proxy Route:
  1. Extrai session (token + activeCompany)
  2. Constrói URL: http://localhost:8000/api/v1/service-orders/?status=open
     (sempre trailing slash ANTES da query string)
  3. Headers:
     - Authorization: Bearer {token}
     - X-Tenant-Domain: {activeCompany}.localhost
     - Content-Type: preservado (multipart boundaries intactos)
  4. Encaminha request
  5. Retorna response (JSON, PDF, XML, ou 204 vazio)
```

**Regras:**
- Trailing slash obrigatório (Django APPEND_SLASH=True)
- Body nunca logado (LGPD)
- 204 retorna null body (DELETE do DRF)
- Binários (PDF/XML) passam direto com Content-Disposition

---

## Mobile (Expo + WatermelonDB)

### Arquitetura Offline-First

```
┌──────────────────────────────────────┐
│           App Mobile (Expo)           │
├──────────────────────────────────────┤
│  UI Layer (Expo Router v4)           │
│  ├── os/ (lista, detalhe)           │
│  ├── nova-os/ (wizard 4 steps)      │
│  ├── vistoria/ (entrada, saída)     │
│  ├── checklist/ (itens)             │
│  └── camera/ + photo-editor/        │
├──────────────────────────────────────┤
│  State Layer                         │
│  ├── Zustand (UI state)             │
│  ├── MMKV (cache: placa, insurers)  │
│  └── WatermelonDB (OS offline)      │
├──────────────────────────────────────┤
│  Sync Layer (db/sync.ts)            │
│  ├── Pull: GET /sync/?since=...     │
│  └── Push: POST /service-orders/    │
├──────────────────────────────────────┤
│  Photo Pipeline                      │
│  ├── expo-camera (captura)          │
│  ├── expo-image-manipulator (watermark)│
│  └── photo.store.ts (upload queue)  │
└──────────────────────────────────────┘
```

### Sync (WatermelonDB ↔ Backend)

**Pull (servidor → device):**
```
GET /api/v1/service-orders/sync/?since={ISO_TIMESTAMP}
Response: { changes: { service_orders: { created, updated, deleted } }, timestamp }
```

**Push (device → servidor):**
- Busca registros com `push_status='pending'`
- POST individual para cada OS
- Sucesso: guarda `remoteId` + `number` do servidor, marca `push_status='synced'`
- Atualiza photo.store com remoteId (fotos vinculadas ao UUID local migram para o ID real)

**Polling:** foreground 60s via `AppState` listener (para quando app vai para background)

### Fotos

1. Captura via `expo-camera`
2. Marca d'água local via `expo-image-manipulator` (data + OS#)
3. Armazenada no `photo.store.ts` com UUID local da OS
4. Upload assíncrono (fetch + FormData) quando online
5. Guard: pula fotos de OS ainda não sincronizadas (`if (!osId) continue`)
6. Imutáveis após upload (evidência para seguradoras)

---

## Backend (Django DRF)

### Camadas

```
┌─────────────────────────────┐
│  Views / ViewSets           │  ← HTTP, validação, RBAC
├─────────────────────────────┤
│  Serializers                │  ← Validação de dados, transformação
├─────────────────────────────┤
│  Services                   │  ← Regras de negócio (toda lógica aqui)
├─────────────────────────────┤
│  Models                     │  ← ORM, constraints, computed fields
├─────────────────────────────┤
│  Tasks (Celery)             │  ← Async: fiscal, push, sync
└─────────────────────────────┘
```

**Regra:** ViewSets não contêm lógica de negócio. Apenas chamam Services.

### Celery (Filas)

| Fila | Módulos | Uso |
|------|---------|-----|
| `default` | Geral | Push notifications, sync |
| `fiscal` | `apps.fiscal.*` | Emissão NF-e, polling Focus |
| `crm` | `apps.crm.*` | WhatsApp [futuro] |
| `ai` | `apps.ai.*` | IA [futuro] |

**Worker:** `celery -A config worker --concurrency=4 -Q celery,fiscal,crm,ai`

**Beat Schedule:**
- `accounting-update-overdue` — diário 06:00
- `ap-refresh-overdue-payables` — diário 06:15
- `ar-refresh-overdue-receivables` — diário 06:15

### Endpoints principais (MVP)

| Prefixo | App | Uso |
|---------|-----|-----|
| `/api/v1/service-orders/` | service_orders | CRUD OS, transições, sync, fotos |
| `/api/v1/inventory/` | inventory | Unidades, lotes, movimentações, contagens |
| `/api/v1/purchasing/` | purchasing | Pedidos, OC, itens |
| `/api/v1/fiscal/` | fiscal | Emissão NF-e/NFS-e, NF-e recebidas |
| `/api/v1/cilia/` | cilia | Importação sinistros |
| `/api/v1/persons/` | persons | CRUD pessoas |
| `/api/v1/customers/` | customers | CRUD clientes |
| `/api/v1/insurers/` | insurers | CRUD seguradoras + upload logo |
| `/api/v1/hr/` | hr | Funcionários, ponto |
| `/api/v1/accounting/` | accounting | Plano de contas, lançamentos |
| `/api/v1/accounts-payable/` | accounts_payable | AP |
| `/api/v1/accounts-receivable/` | accounts_receivable | AR |

---

## Infraestrutura (Docker Dev)

### Serviços

| Serviço | Imagem | Porta | Função |
|---------|--------|-------|--------|
| **postgres** | pgvector/pgvector:pg16 | 5432 | Banco principal (schemas) |
| **redis** | redis:7-alpine | 6379 | Cache + filas Celery + Channels |
| **keycloak** | keycloak:24.0 | 8080 | SSO/OIDC |
| **django** | paddock-django:dev | 8000 | API (runserver + hot-reload) |
| **celery** | paddock-django:dev | — | Worker (4 queues) |
| **celery-beat** | paddock-django:dev | — | Scheduler |
| **mailhog** | mailhog (opt-in) | 8025 | Email testing |

### Startup Order

```
postgres (healthy) ──┐
                     ├──→ django (healthy) ──→ celery + celery-beat
redis (healthy) ─────┘         │
                               └──→ keycloak (healthy, usa postgres)
```

### Volumes

- `postgres_data` — dados persistentes PostgreSQL
- `redis_data` — dados persistentes Redis
- `backend/core:/app` — mount para hot-reload Django (sem rebuild)

---

## Frontend Web (Next.js 15)

### Estrutura de Pastas

```
apps/dscar-web/src/
├── app/
│   ├── (app)/              ← Layout autenticado (sidebar + content)
│   │   ├── os/             ← Lista + Kanban + Detalhe OS
│   │   ├── agenda/         ← Calendário (Mês/Semana/Dia)
│   │   ├── orcamentos/     ← Orçamentos
│   │   ├── cadastros/      ← Pessoas, serviços, seguradoras, etc.
│   │   ├── financeiro/     ← AP, AR, plano de contas
│   │   ├── fiscal/         ← Documentos, emissão, NF-e recebidas
│   │   ├── estoque/        ← WMS completo
│   │   ├── compras/        ← Pedidos + Ordens de Compra
│   │   └── rh/             ← Funcionários
│   ├── (auth)/             ← Login
│   └── api/proxy/          ← Proxy → Django
├── components/             ← Componentes reutilizáveis
├── features/               ← Features complexas (create-os)
├── hooks/                  ← TanStack Query hooks por domínio
└── lib/                    ← Auth, utils, constants
```

### Padrões de State

| Tipo | Ferramenta | Exemplo |
|------|-----------|---------|
| Server state | TanStack Query v5 | `useServiceOrders()`, `useInsurers()` |
| Global UI | Zustand | sidebar, modals |
| Forms | React Hook Form + Zod | OS form, cadastros |
| URL state | Next.js searchParams | filtros, paginação |

### Design System

- **Base:** Tailwind CSS + shadcn/ui
- **Tema:** Dark fintech (bg escuro, `white/opacity`, label-mono, section-divider)
- **Tokens:** `packages/utils/src/design-tokens.ts` + `form-styles.ts`
- **Regra:** Nunca cores brutas (emerald, blue) — sempre tokens semânticos (success-*, info-*, error-*)

---

## Integrações Externas

### Cilia (Sinistros)

```
Cilia API ──→ apps.cilia.client ──→ OrcamentoCilia (cache) ──→ ServiceOrder
                                     ImportAttempt (audit)
```

- Importa orçamentos de seguradoras
- Cria OS em `waiting_auth`
- Atualiza status quando seguradora autoriza

### Focus NF-e (Fiscal)

```
apps.fiscal ──→ Focus v2 API ──→ SEFAZ-AM
     │              │
     │         (polling async)
     │              │
     └── CalculoCustoSnapshot (XML autorizado → S3)
```

- Payload FLAT (não aninhado) — armadilha crítica
- Polling via Celery task (`poll_fiscal_document`, 10s, max 60 retries)
- Builders: `NFeBuilder`, `ManausNfseBuilder`, `ManualNfseBuilder`

### placa-fipe (Consulta veicular)

```
Mobile/Web ──→ POST placa-fipe.apibrasil.com.br/placa/consulta
               { placa: "ABC1234" }
               → { marca, modelo, ano, cor, combustivel }
```

- Sem chave de API (público)
- Mobile cacheia em MMKV (7 dias, max 50 placas)

---

## Assinaturas Digitais

### Modelo

```
┌──────────────┐
│  Signature   │  (apps.signatures)
├──────────────┤
│ person FK    │  ← quem assinou
│ image        │  ← imagem da assinatura (PNG/SVG)
│ type         │  ← CEO / EMPLOYEE / CLIENT
│ is_default   │  ← assinatura principal (CEO e funcionários)
│ created_at   │
└──────────────┘
```

### Fluxo

| Quem | Captura | Uso |
|------|---------|-----|
| Cliente | Canvas no tablet OU link remoto | Cada vistoria (inicial + final) |
| CEO | Salva uma vez no cadastro | Automático em documentos oficiais |
| Funcionários | Salva no cadastro (RH) | Automático em apontamentos/vistorias que realizam |

### Posicionamento em Documentos

Documentos (Termo de Vistoria, relatórios) posicionam assinaturas automaticamente:
- Bloco "DS CAR Centro Automotivo" → assinatura do CEO
- Bloco "Responsável técnico" → assinatura do funcionário que fez a vistoria/apontamento
- Bloco "Cliente" → assinatura capturada no momento

---

*Última atualização: Maio 2026*
