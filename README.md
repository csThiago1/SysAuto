# ERP DS Car — Monorepo

Sistema ERP para gestão de ordens de serviço, clientes, estoque e faturamento da **DS Car Centro Automotivo** (Manaus, AM).

Desenvolvido pela **Paddock Solutions** — stack Django + React/Vite, arquitetura monorepo com Turborepo.

---

## Estrutura do repositório

```
grupo-dscar/
├── apps/
│   └── dscar-web/          # Frontend React 19 + Vite + Tailwind CSS v4
├── backend/
│   └── core/               # API Django 5 + DRF + SimpleJWT
│       ├── apps/
│       │   ├── persons/        # Pessoas (clientes, colaboradores, seguradoras)
│       │   ├── vehicles/       # Veículos + catálogo FIPE + lookup de placa
│       │   └── service_orders/ # Ordens de Serviço + Kanban 15 estados
│       ├── config/             # Settings e URLs raiz
│       ├── scripts/            # Scripts utilitários (fipe_import.py)
│       └── requirements.txt
├── infra/
│   └── docker-compose.dev.yml  # PostgreSQL 16 + Redis 7 + Keycloak 24
├── Makefile                    # Todos os comandos do projeto
└── CLAUDE.md                   # Contexto e regras para o Claude Code
```

---

## Pré-requisitos

| Ferramenta | Versão mínima | Instalação |
|---|---|---|
| Docker Desktop | qualquer | [docker.com](https://docker.com) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Python | 3.12+ | `brew install python@3.12` |
| Make | qualquer | pré-instalado no macOS/Linux |

> **macOS:** o Python do sistema (`/usr/bin/python3`) é 3.9 e não suporta Django 5.
> O Makefile usa automaticamente `python3.12` do Homebrew.

---

## Primeira execução (do zero)

### 1. Infraestrutura (Docker)

```bash
open -a Docker          # abrir Docker Desktop (macOS)
make dev                # sobe PostgreSQL, Redis e Keycloak em background
make dev-ps             # confirma que os 3 containers estão Running
```

### 2. Backend

```bash
make setup              # cria .venv com Python 3.12, instala deps e roda migrations
make createsuperuser    # cria o usuário admin (Django) — interativo
make runserver          # sobe a API em http://localhost:8000
```

> Em outro terminal, o backend fica rodando enquanto você trabalha no frontend.

### 3. Frontend

```bash
cd apps/dscar-web
npm install
npm run dev             # sobe em http://localhost:3000
```

**Login em modo demo** (sem backend obrigatório):

| Campo | Valor |
|---|---|
| Usuário | qualquer (ex: `dory`) |
| Senha | `dscar` |

> O frontend opera em **modo mock por padrão** — dados de exemplo, sem requisições ao backend.
> Para conectar ao backend real, crie `apps/dscar-web/.env` com `VITE_USE_MOCK_DATA=false`.

---

## Referência de comandos (`make`)

### Infraestrutura

| Comando | Descrição |
|---|---|
| `make dev` | Sobe PostgreSQL + Redis + Keycloak em background |
| `make dev-stop` | Para os containers (mantém dados) |
| `make dev-down` | Derruba e remove os containers |
| `make dev-ps` | Status dos containers |
| `make dev-logs` | Acompanhar logs em tempo real |

### Backend

| Comando | Descrição |
|---|---|
| `make setup` | Cria `.venv`, instala deps e roda migrations *(primeira vez)* |
| `make migrate` | Aplica novas migrations |
| `make runserver` | API em `http://localhost:8000` |
| `make createsuperuser` | Cria superusuário Django |
| `make shell` | Django shell interativo |
| `make fipe-import` | Importa catálogo FIPE (carros — ~30 min) |
| `make db-reader` | Cria usuário read-only no PostgreSQL (para ferramentas MCP) |

### Qualidade

| Comando | Descrição |
|---|---|
| `make lint` | Black + isort (backend) e ESLint (frontend) |
| `make format` | Formata código Python automaticamente |
| `make typecheck` | mypy (backend) + tsc (frontend) |
| `make test` | Todos os testes (backend + frontend) |
| `make test-backend` | Só pytest |
| `make test-web` | Só vitest |

---

## Variáveis de ambiente

### Backend (`backend/core/.env`)

```env
DEBUG=True
SECRET_KEY=dev-secret-key-troque-em-prod
DATABASE_URL=postgres://paddock:paddock@localhost:5432/paddock_dev
REDIS_URL=redis://localhost:6379/0
PLATE_LOOKUP_URL=           # URL da API de consulta de placa (opcional)
PLATE_LOOKUP_KEY=           # Chave da API de consulta de placa (opcional)
```

### Frontend (`apps/dscar-web/.env`)

```env
VITE_API_URL=http://localhost:8000/api/v1   # backend local
VITE_USE_MOCK_DATA=false                    # remove para usar mock local
```

---

## Endpoints da API

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/v1/health/` | Health check |
| `POST` | `/api/v1/auth/token/` | Login → `{access, refresh}` |
| `POST` | `/api/v1/auth/token/refresh/` | Renovar access token |
| `GET/POST` | `/api/v1/persons/` | Listar/criar pessoas |
| `GET/POST` | `/api/v1/service-orders/` | Listar/criar OS |
| `POST` | `/api/v1/service-orders/{id}/change-status/` | Mudar status da OS |
| `GET/POST` | `/api/v1/vehicles/` | Veículos |
| `GET` | `/api/v1/vehicles/lookup/?plate=ABC1234` | Consulta de placa |

---

## Fluxo Kanban — 15 estados

```
reception → initial_survey → budget → waiting_parts
                                    ↘ repair → mechanic → bodywork → painting → assembly
                                                         ↘ polishing → washing → final_survey → ready → delivered
```

Transições fora do fluxo são bloqueadas tanto no frontend quanto no backend.

---

## Arquitetura e decisões

- **Autenticação:** JWT via SimpleJWT. Access token em memória (frontend), refresh token no `localStorage`.
- **Mock data:** Frontend funciona sem backend — controlado por `VITE_USE_MOCK_DATA`. Facilita desenvolvimento paralelo de features.
- **FIPE:** Catálogo importado localmente via `make fipe-import` (fonte: BrasilAPI). Importação idempotente com cache por marca.
- **LGPD:** CPF/CNPJ/email/telefone serão criptografados com `EncryptedField` antes do go-live.
- **Multitenancy:** Arquitetura preparada para `django-tenants` — ativação na Fase 2.

---

## Regras de contribuição

- Commits no padrão [Conventional Commits](https://www.conventionalcommits.org/): `feat(os): ...`, `fix(auth): ...`
- Hard delete proibido — sempre soft delete (`is_active=False`)
- Dados sensíveis nunca em logs
- Ver `CLAUDE.md` para regras de negócio completas
