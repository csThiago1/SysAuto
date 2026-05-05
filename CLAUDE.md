# Paddock Solutions · paddock.solutions
# CLAUDE.md — Contexto Global do Monorepo
# Lido automaticamente pelo Claude Code em toda sessão.
# ─────────────────────────────────────────────────────────────────────────────

## Empresa

**Paddock Solutions** — software house focada no setor automotivo e varejo.
**Cliente:** Grupo DS Car (Manaus, AM) — centro automotivo (funilaria, pintura, polimento, lavagem).
**Repositório:** grupo-dscar (monorepo Turborepo)
**Desenvolvedor:** fundador solo + Claude Code como par de programação
**PRD:** `docs/PRD.md` — fonte da verdade do escopo do MVP

---

## Estrutura do Monorepo

```
grupo-dscar/
├── CLAUDE.md
├── turbo.json
├── package.json
├── apps/
│   ├── dscar-web/          ← ERP DS Car (Next.js 15)
│   ├── mobile/             ← App React Native + Expo
│   ├── hub/                ← Portal SSO (Next.js 15) [fora do MVP]
│   └── store-web/          ← PDV + E-commerce lojas [fora do MVP]
├── backend/
│   ├── core/               ← Django 5 — API principal
│   │   ├── apps/           ← Apps Django (ver seção Backend)
│   │   └── config/         ← Settings, URLs, ASGI
│   └── workers/            ← Node.js workers [fora do MVP]
├── packages/
│   ├── ui/                 ← Design system compartilhado
│   ├── types/              ← TypeScript types + VALID_TRANSITIONS
│   ├── auth/               ← Auth helpers (JWT, OIDC)
│   └── utils/              ← Formatters, form-styles, design tokens
├── data/
│   ├── migrations/         ← ETL legado (Box Empresa → 10k OS, 7k clientes)
│   └── seeds/              ← FIPE, dados automotivos
├── docs/
│   ├── PRD.md              ← Product Requirements Document
│   ├── backlog.md          ← Módulos pausados (inbox, motor, lojas)
│   └── sprints-delivered.md ← Histórico de entregas
└── infra/
    ├── terraform/          ← IaC AWS
    └── docker/             ← docker-compose.dev.yml + Keycloak themes
```

### Apps Django (backend/core/apps/)

**MVP ativo:**
- `authentication/` — SSO, JWT, OIDC (Keycloak)
- `tenants/` — Multitenancy (django-tenants, schema-per-tenant)
- `persons/` — Modelo unificado Person (PF/PJ, SetorPessoa/CargoPessoa)
- `customers/` — Cliente unificado + LGPD
- `service_orders/` — OS, Kanban, Checklist, Apontamentos
- `inventory/` — WMS: localização, produto comercial, movimentação, contagem
- `purchasing/` — Pedidos e Ordens de Compra
- `fiscal/` — NF-e, NFS-e, NFC-e (Focus NF-e)
- `cilia/` — Integração API Cilia (importação sinistros)
- `hr/` — RH: Employee, Payslip, TimeClock
- `accounting/` — Plano de contas, JournalEntry
- `accounts_payable/` — Contas a Pagar
- `accounts_receivable/` — Contas a Receber
- `vehicle_catalog/` — Catálogo veículos/cores FIPE (SHARED_APP)
- `insurers/` — Seguradoras (SHARED_APP)
- `experts/` — Especialistas/peritos (TENANT_APP)
- `signatures/` — Assinaturas digitais
- `documents/` — Documentos PDF (WeasyPrint)

**Fora do MVP (não deletar, apenas inativo):**
- `pricing_engine/`, `pricing_catalog/`, `pricing_profile/`, `pricing_tech/`, `pricing_benchmark/` — Motor de Precificação
- `ai/` — Claude API + RAG
- `crm/` — CRM + WhatsApp
- `store/` — PDV + E-commerce

---

## Stack Tecnológica

### Frontend Web
| Item | Tecnologia |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript (strict SEMPRE) |
| Estilo | Tailwind CSS + shadcn/ui |
| State | Zustand (global) + TanStack Query v5 (server) |
| Forms | React Hook Form + Zod |
| Auth | next-auth v5 (OIDC → Keycloak + dev-credentials) |
| DnD | @dnd-kit/core + @dnd-kit/sortable (Kanban) |
| Testes | Vitest + Playwright |

### Mobile
| Item | Tecnologia |
|------|-----------|
| Framework | React Native + Expo SDK 52 |
| Roteamento | Expo Router v4 |
| Offline | WatermelonDB |
| Câmera | expo-camera + expo-image-manipulator (marca d'água) |
| State | Zustand + MMKV |
| Auth | expo-auth-session (OIDC) |

### Backend
| Item | Tecnologia |
|------|-----------|
| Framework | Django 5 + Django REST Framework |
| Linguagem | Python 3.12 (type hints OBRIGATÓRIOS) |
| Tenancy | django-tenants (schema-per-tenant) |
| Auth | mozilla-django-oidc + simplejwt + PyJWT (JWKS) |
| Tasks | Celery 5 + Redis |
| Fiscal | Focus NF-e (NF-e/NFS-e/NFC-e) |
| Testes | pytest + pytest-django + factory-boy |

### Infraestrutura
| Item | Tecnologia |
|------|-----------|
| Banco | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Storage | AWS S3 |
| SSO | Keycloak 24 (self-hosted) |
| Cloud | AWS (ECS Fargate + RDS + ElastiCache + S3) |
| CI/CD | GitHub Actions |
| Consulta placa | placa-fipe.apibrasil.com.br (gratuita, POST) |
| Monit | Sentry |

---

## Padrões de Código

### Commits (Conventional Commits — obrigatório)
```
feat(dscar): adiciona painel IA na abertura de OS
fix(auth): corrige refresh token expirado no mobile
chore(infra): atualiza terraform ECS Fargate
```

### TypeScript
- strict sempre — nunca `any`, usar `unknown` + narrowing
- Dados externos (API, forms): sempre validar com Zod — nunca `as Type`
- Retornos de funções sempre tipados explicitamente

### Python / Django
- Type hints obrigatórios em funções e métodos
- Docstrings Google Style em classes e métodos públicos
- Nunca raw SQL — usar ORM Django
- `select_related/prefetch_related` obrigatórios quando há relações
- `logger = logging.getLogger(__name__)` — nunca `print()`

---

## Armadilhas Conhecidas

### Keycloak 24 — Freemarker: `url.resourcesPath` não `resourcesPath`
```freemarker
<!-- ERRADO --> <link href="${resourcesPath}/css/login.css">
<!-- CORRETO --> <link href="${url.resourcesPath}/css/login.css">
```

### Django — Roteamento DRF com múltiplos routers
```python
# ERRADO — DefaultRouter em "" captura qualquer segmento como pk
router.register(r"", ServiceOrderViewSet)
# CORRETO — prefixo explícito + SimpleRouter
catalog_router = SimpleRouter()
urlpatterns = [
    path("service-catalog/", include(catalog_router.urls)),  # ANTES
    path("", include(router.urls)),
]
```

### Django — Migrações com número duplicado após merge
```bash
python manage.py makemigrations --merge <app_name> --no-input
python manage.py migrate_schemas
```

### Frontend — DRF paginado: extrair `.results`
```typescript
// SEMPRE usar fetchList<T> para endpoints de lista DRF
type Paginated<T> = { results: T[]; count: number; next: string | null; previous: string | null }
async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<Paginated<T> | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}
```

### Frontend — Hooks de API: sempre `/api/proxy/`
```typescript
// ERRADO: const API = "/api/service-orders"
// CORRETO: const API = "/api/proxy/service-orders"
```

### Frontend — Formulários aninhados em ServiceOrderForm
Qualquer aba dentro de ServiceOrderForm já está em `<form>`. Nunca `<form>` interno.
```tsx
// CORRETO — div + onClick
<div className="space-y-2">
  <Button type="button" onClick={() => handleSubmit(onAdd)()}>Adicionar</Button>
</div>
```

### Frontend — isDirty com zodResolver + z.preprocess
```typescript
// ERRADO: const { isDirty } = form.formState
// CORRETO:
const { dirtyFields } = form.formState
const isDirty = Object.keys(dirtyFields).length > 0
```

### Docker Dev — Django usa volume mount
Alterações em `.py` refletem via hot-reload. Exceções:
- Novas migrations → `make migrate`
- Novo pacote → `docker compose build django`

### Backend — Worktree vs Main
Dev server roda da pasta principal. Editar em `.worktrees/` não tem efeito no servidor.

### NF-e Builder — Focus v2 formato flat
```python
# ERRADO — Focus rejeita nested
payload = {"emitente": {"cnpj": "..."}}
# CORRETO — campos flat
payload = {"cnpj_emitente": "...", "logradouro_emitente": "..."}
```
- `codigo_ncm` (não "ncm")
- `valor_bruto = qty × price SEM desconto`
- `data_emissao`: SEMPRE timezone America/Manaus
- Regime Normal (3): CST para ICMS | Simples (1): CSOSN 102

### FiscalConfig — dados SEFAZ
- Razão social EXATA: `"D S CAR CENTRO AUTOMOTIVO LTDA"` (com espaço "D S")
- `regime_tributario = 3` (Regime Normal)
- `inscricao_estadual = "042906105"`
- Erros: 481=regime diverge, 980=razão social, 629=valor produto, 212=timezone

---

## Padrões de Segurança

### RBAC em ViewSets
```python
# Leitura: CONSULTANT+, escrita: MANAGER+
def get_permissions(self):
    if self.action in ("create", "update", "partial_update", "destroy"):
        return [IsAuthenticated(), IsManagerOrAbove()]
    return [IsAuthenticated(), IsConsultantOrAbove()]
```
Permissions em `apps.authentication.permissions`: `IsConsultantOrAbove`, `IsManagerOrAbove`, `IsAdminOrAbove`

### Role SEMPRE do JWT, nunca de query param
```python
from apps.authentication.permissions import _get_role
role = _get_role(request)  # extrai do token assinado
```

### Serializers: nunca somente `exclude`
Sempre `read_only_fields` para campos sensíveis (status, totais, fiscais).

### APIView: `is_active=True` obrigatório
ViewSets filtram automaticamente. APIViews separadas NÃO — incluir explicitamente.

### Erros de integração: nunca vazar `str(e)`
```python
except Exception as e:
    logger.error(f"Erro em <contexto>: {e}")
    return Response({"erro": "Erro interno."}, status=500)
```

### Proxy Next.js: nunca logar body (LGPD)
Pode conter CPF, email, telefone. Logar apenas método, URL e status.

### Mutations React Query: sempre try/catch
```typescript
try {
    await mutation.mutateAsync(payload)
    closeForm()
} catch {
    toast.error("Erro ao salvar. Tente novamente.")
}
```

---

## Regras de Negócio

### Multitenancy
```python
# Celery/scripts: context manager explícito
from django_tenants.utils import schema_context
with schema_context('tenant_dscar'):
    ServiceOrder.objects.filter(status='open')

# Tasks SEMPRE recebem tenant_schema
@shared_task
def my_task(data: dict, tenant_schema: str) -> None:
    with schema_context(tenant_schema): ...
```

### RBAC — hierarquia
```
OWNER: 5 > ADMIN: 4 > MANAGER: 3 > CONSULTANT: 2 > STOREKEEPER: 1
```

### Ordens de Serviço — 17 Status
```
reception → initial_survey → budget → waiting_auth → authorized →
waiting_parts → repair → mechanic → bodywork → painting →
assembly → polishing → washing → final_survey → ready → delivered
                                                         cancelled (terminal)
```
Transições validadas client-side (`VALID_TRANSITIONS` em `packages/types/`) E no backend.
Número da OS: gerado automaticamente (MAX + 1) — nunca enviar no POST.

### OS — Campos de data
| Campo | Significado |
|-------|-------------|
| `delivered_at` | Preenchido na transição → DELIVERED (KPIs) |
| `delivery_date` | Previsão de entrega (planejamento) |
| `client_delivery_date` | Data de retirada pelo cliente |

### Assinaturas Digitais
- **Cliente:** assina em canvas (mobile/tablet) ou via link — a cada vistoria
- **CEO/Dono:** assinatura salva uma vez no cadastro, aparece automaticamente em documentos
- **Funcionários:** assinatura salva no cadastro (RH), aparece quando fazem apontamento/vistoria

### LGPD
- CPF, email, telefone: SEMPRE `EncryptedField`
- Lookup por email: `email_hash` (SHA-256)
- Hard delete: PROIBIDO — usar anonimização
- Logs: NUNCA PII em texto claro

### Estoque
- Constraint: `CHECK (quantity >= 0)` — nunca negativo
- `select_for_update()` antes de debitar
- Barcode: `P{pk.hex}` (peça), `L{pk.hex}` (lote)
- `MovimentacaoEstoque` é IMUTÁVEL

### Fotos de OS — imutáveis
Evidência de sinistro para seguradoras. Soft delete apenas.
Marca d'água processada no device antes do upload.

### NF-e — emissão obrigatória
NF-e ou NFS-e ao fechar OS. Ambiente: homologação em dev, produção em prod.
XMLs autorizados: sempre salvar no S3.

### Seguradoras — Logo Upload
```python
# POST /api/v1/insurers/{id}/upload_logo/  multipart/form-data
# Dev: MEDIA_ROOT/insurers/logos/ | Prod: S3
# Frontend: logo (resolvida com fallback) vs logo_url (valor bruto)
```

---

## Autenticação

### Dev (dev-credentials)
- Email + senha `paddock123` → JWT HS256 → secret `dscar-dev-secret-paddock-2025`
- Backend: `DevJWTAuthentication` + `DevTenantMiddleware` (lê `X-Tenant-Domain`)
- `session.role = "ADMIN"` automático

### Prod (Keycloak 24)
- Provider Keycloak no next-auth → JWT RS256 via JWKS
- Backend: `KeycloakJWTAuthentication` (resiliente a Keycloak offline)
- Theme: `infra/docker/keycloak/themes/paddock/`
- Client ID: `paddock-frontend`
- Seed users: `admin@paddock.solutions/admin123`, `thiago@paddock.solutions/paddock123`

### JWT Claims
```json
{
  "sub": "uuid", "email": "...", "companies": ["dscar"],
  "active_company": "dscar", "role": "CONSULTANT",
  "tenant_schema": "tenant_dscar", "client_slug": "grupo-dscar"
}
```

### Proxy API Route
- `apps/dscar-web/src/app/api/proxy/[...path]/route.ts`
- Sempre trailing slash antes de repassar ao Django
- Encaminha `Authorization` + `X-Tenant-Domain`

---

## Variáveis de Ambiente

| Variável | Serviço |
|----------|---------|
| `AUTH_SECRET` | next-auth v5 |
| `DEV_JWT_SECRET` | Secret HS256 dev |
| `KEYCLOAK_CLIENT_ID` / `_SECRET` / `_ISSUER` | OIDC Keycloak |
| `FOCUSNFE_TOKEN` | NF-e/NFS-e/NFC-e |
| `DSCAR_CNPJ` / `_CERT_PATH` / `_CERT_PASSWORD` | Certificado NF-e |
| `AWS_S3_BUCKET` / `AWS_ACCESS_KEY_ID` | Storage |
| `SEFAZ_ENV` | `homologation` ou `production` |
| `SENTRY_DSN` | Monitoramento |

---

## Comandos Úteis

```bash
make dev             # sobe todos os serviços Docker
make dev-stop        # para os serviços
make migrate         # roda migrations em todos os tenants
make shell           # Django shell
make test            # todos os testes
make lint            # ESLint + Black + isort
make format          # Black + isort (correção)
make typecheck       # mypy + tsc
```

---

## Documentação Complementar

| Documento | Conteúdo |
|-----------|----------|
| `docs/PRD.md` | Escopo do MVP, personas, fluxos, requisitos |
| `docs/architecture.md` | Arquitetura técnica (multitenancy, auth, sync, infra) |
| `docs/backlog.md` | Módulos pausados (inbox, motor, lojas, hub) |
| `docs/sprints-delivered.md` | Histórico completo de sprints |

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
*Última atualização: Maio 2026*
