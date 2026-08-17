# Grupo DS Car — Monorepo

> ERP automotivo multiempresa (web + mobile) construído pela **Paddock Solutions** para o Grupo DS Car (Manaus/AM).
> Monorepo Turborepo com backend Django 5, frontend Next.js 15 e app React Native + Expo.

---

## Sumário

- [Visão geral](#visão-geral)
- [Pré-requisitos](#pré-requisitos)
- [Passo a passo de instalação](#passo-a-passo-de-instalação)
- [Subindo os apps](#subindo-os-apps)
- [URLs e portas locais](#urls-e-portas-locais)
- [Credenciais de desenvolvimento](#credenciais-de-desenvolvimento)
- [Comandos úteis (Makefile)](#comandos-úteis-makefile)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Troubleshooting](#troubleshooting)
- [Documentação complementar](#documentação-complementar)

---

## Visão geral

| Camada | Stack |
|---|---|
| Frontend web | Next.js 15, TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand |
| Mobile | React Native 0.83, Expo SDK 55, Expo Router v4, WatermelonDB |
| Backend | Django 5 + DRF, Python 3.12, django-tenants (schema-per-tenant), Celery 5 |
| Auth | Keycloak 24 (OIDC, prod) + dev-credentials HS256 (dev) |
| Banco / Cache | PostgreSQL 16 + pgvector, Redis 7 |
| Infra | Docker Compose (dev), AWS ECS Fargate + RDS + ElastiCache + S3 (prod) |

---

## Pré-requisitos

Instale na sua máquina antes de seguir o passo a passo:

| Ferramenta | Versão mínima | Observação |
|---|---|---|
| **Node.js** | `>= 20.0.0` | Recomendado 22.x (ver `docs/mobile-setup.md`) |
| **npm** | `>= 10.0.0` | Vem com Node 20+ |
| **Python** | `3.12.x` | Para o backend Django |
| **Docker** | recente | Com **Docker Compose v2** (`docker compose ...`) |
| **make** | qualquer | Atalhos do `Makefile` |
| **git** | recente | Clonar o monorepo |

Opcional para mobile:
- **Expo Go** no iOS/Android para rodar o app físico
- **Xcode** (macOS) para simulador iOS / **Android Studio** para emulador Android

---

## Passo a passo de instalação

### 1. Clonar o repositório

```bash
git clone <url-do-repo> grupo-dscar
cd grupo-dscar
```

### 2. Copiar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` se já tiver tokens reais (Focus NF-e, Anthropic, AWS etc.). Para subir o ambiente local pela primeira vez, os defaults do `.env.example` já funcionam — as integrações externas só são exigidas quando você for usá-las.

> ⚠️ Nunca commite `.env` com valores reais.

### 3. Setup completo (atalho)

A receita `setup` do `Makefile` cria a venv do Python, instala as dependências Node e sobe os serviços Docker:

```bash
make setup
```

O que ele faz, na ordem:
1. `make setup-python` — cria `backend/core/.venv` e instala `requirements/dev.txt`
2. `make setup-node` — roda `npm install` (instala todos os workspaces)
3. `make dev` — sobe os containers Docker em background

Se preferir rodar cada etapa manualmente, veja abaixo.

#### 3a. Setup manual do Python

```bash
cd backend/core
python3.12 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements/dev.txt
cd ../..
```

#### 3b. Setup manual do Node

```bash
npm install
```

### 4. Subir os serviços Docker

```bash
make dev
```

Sobe PostgreSQL 16 (+pgvector), Redis 7, Keycloak 24, Django, Celery worker e Celery beat — todos definidos em `infra/docker/docker-compose.dev.yml`.

Confira com:

```bash
make dev-ps
make dev-logs   # ctrl+c para sair
```

### 5. Rodar migrations

O container Django roda `migrate_schemas` na inicialização, mas você pode forçar a qualquer momento:

```bash
make migrate          # todos os tenants
make migrate-shared   # apenas schema public
```

### 6. Criar os tenants iniciais (primeira vez)

```bash
make dev-seed
```

Cria:
- `public` → domínio `localhost`
- `tenant_dscar` (DS Car Centro Automotivo) → domínio `dscar.localhost`

> Adicione `127.0.0.1 dscar.localhost` ao seu `/etc/hosts` se for acessar pelo navegador via `dscar.localhost`.

---

## Subindo os apps

Depois que o Docker está rodando e as migrations foram aplicadas:

### Backend Django

Já está em pé no container (porta 8000). Se quiser rodar fora do Docker (hot-reload local):

```bash
make dev-api
```

### Frontend — DS Car ERP (principal)

```bash
make dev-dscar
# ou: npm -w apps/dscar-web run dev
```

Disponível em **http://localhost:3001**.

### Frontend — Hub (SSO portal)

```bash
make dev-hub
# ou: npm -w apps/hub run dev
```

Disponível em **http://localhost:3000**.

### Todos os apps Next.js em paralelo

```bash
make dev-web
```

Mata portas 3000–3002 antes de subir tudo via Turborepo.

### Mobile (Expo)

```bash
npm run mobile          # Expo Dev Server (escolhe iOS/Android/Web no menu)
npm run mobile:ios      # simulador iOS
npm run mobile:web      # web preview
```

Veja `docs/mobile-setup.md` para detalhes de versões e troubleshooting.

---

## URLs e portas locais

| Serviço | URL |
|---|---|
| Django API | http://localhost:8000 |
| Schema OpenAPI | http://localhost:8000/api/schema/ |
| DS Car ERP (Next.js) | http://localhost:3001 |
| Hub (Next.js) | http://localhost:3000 |
| Keycloak | http://localhost:8080 (`admin` / `admin`) |
| PostgreSQL | `localhost:5432` (`paddock` / `paddock` / `paddock_dev`) |
| Redis | `localhost:6379` |
| Mailhog (opcional) | http://localhost:8025 (suba com `docker compose --profile tools up -d mailhog`) |

---

## Credenciais de desenvolvimento

### Dev (sem Keycloak — JWT HS256)
Faça login na web com qualquer email e senha **`paddock123`**. Role atribuída automaticamente: `ADMIN`.

### Prod / Keycloak local
- `admin@paddock.solutions` / `admin123`
- `thiago@paddock.solutions` / `paddock123`

---

## Comandos úteis (Makefile)

```bash
make help              # lista todos os targets com descrição

# Desenvolvimento
make dev               # sobe Docker (postgres, redis, keycloak, django, celery)
make dev-stop          # para os containers
make dev-ps            # status dos containers
make dev-logs          # logs em tempo real
make dev-reset         # apaga volumes (zera banco) — exige novo make dev-seed
make dev-seed          # cria tenants public + tenant_dscar
make dev-kill-ports    # libera portas 3000–3002

# Apps
make dev-api           # Django local (fora do Docker)
make dev-dscar         # Next.js DS Car (porta 3001)
make dev-hub           # Next.js Hub (porta 3000)
make dev-web           # todos os Next.js via Turborepo

# Banco
make migrate           # migrate_schemas em todos os tenants
make migrate-shared    # migrate só no public
make shell             # Django shell dentro do container

# Qualidade
make test              # backend + web
make test-backend      # pytest
make test-web          # vitest
make lint              # ESLint + Black + isort (check)
make format            # Black + isort (fix)
make typecheck         # mypy + tsc
```

---

## Estrutura do repositório

```
grupo-dscar/
├── apps/
│   ├── dscar-web/      # ERP DS Car (Next.js 15) — porta 3001
│   ├── hub/            # Portal SSO (Next.js 15) — porta 3000
│   ├── store-web/      # PDV + e-commerce (fora do MVP)
│   └── mobile/         # App React Native + Expo SDK 55
├── backend/
│   └── core/           # Django 5 + DRF
│       ├── apps/       # apps Django (authentication, tenants, service_orders, ...)
│       ├── config/     # settings/urls/asgi
│       └── requirements/
├── packages/
│   ├── ui/             # design system compartilhado
│   ├── types/          # tipos TypeScript + VALID_TRANSITIONS
│   ├── auth/           # helpers JWT/OIDC
│   └── utils/          # formatters, tokens, etc.
├── data/
│   ├── migrations/     # ETL legado (Box Empresa)
│   └── seeds/          # FIPE, dados automotivos
├── infra/
│   ├── docker/         # docker-compose.dev.yml + temas Keycloak
│   └── terraform/      # IaC AWS
├── docs/               # PRD, arquitetura, sprints, manuais
├── scripts/            # baseline de sprint, close de sprint, hooks
├── Makefile
├── turbo.json
├── package.json
└── .env.example
```

---

## Troubleshooting

**`docker compose` não encontrado**
Atualize o Docker Desktop ou instale o plugin Compose v2.

**Portas 3000/3001 ocupadas**
```bash
make dev-kill-ports
```

**Migrations conflitantes após merge**
```bash
make shell
# dentro do shell:
# python manage.py makemigrations --merge <app_name> --no-input
make migrate
```

**Banco corrompido / quero começar do zero**
```bash
make dev-reset    # apaga volumes
make dev          # sobe de novo
make dev-seed     # recria tenants
```

**Mobile — Expo reclamando de versão de pacote**
Veja a tabela de versões resolvidas em `docs/mobile-setup.md` e o bloco `overrides` no `package.json` raiz.

**Keycloak — login não carrega CSS do tema `paddock`**
O Freemarker do Keycloak 24 usa `${url.resourcesPath}`, **não** `${resourcesPath}`. Veja `CLAUDE.md` → "Armadilhas Conhecidas".

**Frontend — erro 404 em rotas de API**
Sempre prefixe chamadas com `/api/proxy/` (o proxy Next.js encaminha para o Django com `Authorization` + `X-Tenant-Domain`).

---

## Documentação complementar

| Documento | Conteúdo |
|---|---|
| `CLAUDE.md` | Contexto global do monorepo, padrões, armadilhas |
| `docs/PRD.md` | Escopo do MVP, personas, fluxos |
| `docs/architecture.md` | Arquitetura técnica (multitenancy, auth, sync, infra) |
| `docs/mobile-setup.md` | Versões e setup do app Expo |
| `docs/backlog.md` | Módulos pausados (motor de precificação, IA, lojas, hub) |
| `docs/sprints-delivered.md` | Histórico de sprints |

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
