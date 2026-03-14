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
│   ├── types/                        ← TypeScript types
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
Auth:        next-auth v5 (OIDC → Keycloak)
Testes:      Vitest + Playwright
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
Auth:        mozilla-django-oidc + simplejwt
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
Consulta placa: Sieve API
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

### LGPD — dados pessoais
```python
# CPF, email, telefone: SEMPRE EncryptedField
# group_sharing_consent: SEMPRE verificar antes de cruzar dados entre empresas
# Logs: NUNCA incluir CPF, email ou telefone em texto claro
# Hard delete de clientes: PROIBIDO — usar erasure (anonimização)
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

## 🔌 Variáveis de Ambiente

| Variável | Serviço |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API (IA) |
| `EVOLUTION_API_URL` / `_KEY` | WhatsApp |
| `SIEVE_API_KEY` | Consulta de placa |
| `DSCAR_CNPJ` / `_CERT_PATH` / `_CERT_PASSWORD` | NF-e DS Car |
| `FOCUSNFE_TOKEN` | NFS-e |
| `ASAAS_API_KEY` / `_ENV` | Pagamentos |
| `AWS_S3_BUCKET` / `AWS_ACCESS_KEY_ID` | Storage |
| `DW_S3_BUCKET` | Data Warehouse |
| `SEFAZ_ENV` | `homologation` ou `production` |
| `SENTRY_DSN` | Monitoramento |

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
# Modelo padrão:   claude-sonnet-4-5 (custo-benefício)
# Modelo pesado:   claude-opus-4-5 (tarefas complexas)
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

*Paddock Solutions · paddock.solutions · Manaus, AM*
*Última atualização: Março 2025*
