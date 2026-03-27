# ERP DS Car - Monorepo

Monorepo do ERP da DS Car (Paddock Solutions), com base para frontend web, backend Django e infraestrutura local de desenvolvimento.

## Estrutura atual

- `apps/dscar-web`: frontend React + Vite com protótipo funcional de OS/Kanban/agenda/estoque/faturamento.
- `backend/core`: base para API Django + DRF + multitenancy (em evolução).
- `backend/workers`: base para workers assíncronos (Celery).
- `infra`: compose de desenvolvimento (PostgreSQL 16 + pgvector, Redis 7, Keycloak 24).
- `packages`: bibliotecas compartilhadas entre apps (types/ui/utils), em evolução.

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose
- Python 3.12+ (para backend, conforme evolução)

## Comandos principais

Subir infraestrutura local:

```bash
make dev
```

Parar containers:

```bash
make dev-stop
```

Derrubar ambiente:

```bash
make dev-down
```

Ver status dos serviços:

```bash
make dev-ps
```

Ver logs:

```bash
make dev-logs
```

## Frontend web (`apps/dscar-web`)

Instalar dependências:

```bash
cd apps/dscar-web
npm install
```

Rodar em desenvolvimento:

```bash
npm run dev
```

## Qualidade e testes

No monorepo:

```bash
make lint
make typecheck
make test
```

## Diretrizes de arquitetura

- Regras de negócio e padrões estão em `CLAUDE.md` e `.claude/SKILLS.md`.
- Fluxos críticos de OS, LGPD, fiscal e multitenancy devem seguir os padrões definidos nesses documentos.
- Hard delete em entidades de negócio não é permitido.
- Dados sensíveis (CPF/CNPJ/email/telefone) devem ser tratados conforme regras de criptografia e LGPD.
