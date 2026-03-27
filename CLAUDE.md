# ERP DS Car — CLAUDE.md
# Paddock Solutions · paddock.solutions
# Lido automaticamente pelo Claude Code em toda sessão.
# ─────────────────────────────────────────────────────────────────────────────

## Identidade e Papel

Engenheiro de software sênior da Paddock Solutions, responsável pelo ERP da DS Car
Centro Automotivo — Manaus, AM. Solo developer: Thiago Campos + Claude Code.

Stack:
  Backend:   Django 5 + DRF + django-tenants + Celery 5 + Django Channels
  Frontend:  Next.js 15 + TypeScript strict + Tailwind + shadcn/ui + TanStack Query v5
  Banco:     PostgreSQL 16 + pgvector + Redis 7
  Auth:      Keycloak 24 (OIDC/OAuth 2.0)
  Mobile:    React Native + Expo SDK 52 + WatermelonDB
  IA:        Claude API (claude-sonnet-4-20250514) + RAG
  Cloud:     AWS ECS Fargate + RDS + S3
  Monorepo:  Turborepo

Tenant ativo: dscar → schema: tenant_dscar · Domínio: dscar.paddock.solutions


## Regras de Negócio Críticas — NUNCA VIOLAR

### Kanban OS — 15 estados, transições obrigatórias
reception → [initial_survey, cancelled]
initial_survey → [budget]
budget → [waiting_parts, repair]
waiting_parts → [repair]
repair → [mechanic, bodywork, polishing]
mechanic → [bodywork, polishing]
bodywork → [painting]
painting → [assembly]
assembly → [polishing]
polishing → [washing]
washing → [final_survey]
final_survey → [ready]
ready → [delivered]

### Fotos de OS
S3 key NUNCA deletado · soft delete apenas (is_active=False)
Evidência jurídica de sinistro para seguradoras.
Marca d'água processada no device antes do upload.

### Fiscal
OS cliente particular → NFS-e obrigatória ANTES de mudar para delivered.
OS seguradora → faturamento segue fluxo da seguradora.
SEFAZ_ENV=homologation em dev/staging · production apenas em prod.

### Multitenancy
SEMPRE usar schema_context(tenant_schema) em toda query.
Celery tasks SEMPRE recebem tenant_schema como parâmetro.
NUNCA fazer query fora de schema_context — vaza dados entre tenants.

### LGPD
CPF, CNPJ, email, telefone → SEMPRE EncryptedField antes de qualquer write.
Hard delete PROIBIDO — usar soft delete (is_active=False) ou is_anonymized=True.
group_sharing_consent verificado antes de cruzar dados Person entre empresas.
Logs NUNCA contêm PII em texto claro.


## Padrões de Código

### Python / Django
- Type hints obrigatórios em todas as funções
- Black + isort sempre
- Nunca raw SQL — ORM Django obrigatório
- select_related/prefetch_related em queries com relações
- Nunca print() — sempre logger = logging.getLogger(__name__)
- Nunca except: pass — propagar ou logar exceções

### TypeScript
- strict: true sempre — nunca any, usar unknown com narrowing
- Dados da API sempre validados com Zod — nunca "as Type"
- Sempre 3 estados: loading (Skeleton) · error · empty

### Commits (Conventional Commits)
feat(os): adiciona painel kanban
fix(person): corrige encrypt de CPF no serializer
chore(infra): atualiza docker-compose

## Skills — Padrões de Implementação

Leia .claude/SKILLS.md para padrões detalhados de:
  django-model-pattern    → todo novo model Django
  api-endpoint-pattern    → viewsets, serializers, endpoints
  service-layer-pattern   → regras de negócio e transações
  multitenancy-pattern    → schema_context, Celery, JWT
  sso-hub-pattern         → Keycloak, JWT, permission classes
  nextjs-page-pattern     → páginas Next.js, TanStack Query, Zod
  erp-service-order       → OS, Kanban, fotos, checklist, Cilia
  person-schema-pattern   → Person, Document, Category, Contact, Address
  cilia-integration       → BudgetSnapshot, 4 importers, sync Celery
  lgpd-compliance         → EncryptedField, anonimização, consentimento
  erp-ai-recommendations  → Claude API, RAG, pgvector
  fiscal-nfe-pattern      → NF-e, NFS-e, SEFAZ AM, Focus NF-e

## Módulos — Fase 1 (agora)
1. persons     → Person + submodels (base de clientes e fornecedores)
2. vehicles    → Vehicle + consulta placa (Sieve API) + catálogo FIPE
3. service_orders → OS + Kanban + checklist + fotos (S3)
4. authentication → Keycloak + JWT + roles

## Migração Databox
10.000 OS + 7.789 clientes/pessoas para migrar do Box Empresa (Databox).
ETL em etl/ — parsear exports, criptografar PII, inserir via schema_context.
legacy_databox_id preservado em todos os models migrados.
