# ─────────────────────────────────────────────────────────────────────────────
# Grupo DS Car — Makefile
# ─────────────────────────────────────────────────────────────────────────────

COMPOSE = docker compose -f infra/docker/docker-compose.dev.yml
BACKEND  = cd backend/core

.PHONY: dev dev-stop dev-ps dev-logs migrate shell \
        test test-backend test-web lint format typecheck help

## ─ Desenvolvimento ──────────────────────────────────────────────────────────

dev: ## Sobe todos os serviços Docker + apps em modo dev
	$(COMPOSE) up -d
	@echo "✅  Serviços Docker subindo..."
	@echo "   PostgreSQL : http://localhost:5432"
	@echo "   Redis      : http://localhost:6379"
	@echo "   Keycloak   : http://localhost:8080"
	@echo "   Django API : http://localhost:8000 (rode: make dev-api)"
	@echo "   Hub        : http://localhost:3000 (rode: make dev-hub)"

dev-api: ## Inicia o servidor Django
	$(BACKEND) && .venv/bin/python manage.py runserver --settings=config.settings.dev

dev-hub: ## Inicia o app Hub (Next.js)
	cd apps/hub && npm run dev

dev-dscar: ## Inicia o app DS Car ERP (Next.js)
	cd apps/dscar-web && npm run dev

dev-store: ## Inicia o app Store (Next.js)
	cd apps/store-web && npm run dev

dev-stop: ## Para todos os serviços Docker
	$(COMPOSE) down

dev-ps: ## Status dos serviços Docker
	$(COMPOSE) ps

dev-logs: ## Logs em tempo real dos serviços Docker
	$(COMPOSE) logs -f

dev-reset: ## Para e remove volumes (limpa banco)
	$(COMPOSE) down -v

## ─ Banco de dados ───────────────────────────────────────────────────────────

migrate: ## Roda migrations em todos os tenants
	$(BACKEND) && .venv/bin/python manage.py migrate_schemas --settings=config.settings.dev

migrate-shared: ## Roda migrations apenas no schema public
	$(BACKEND) && .venv/bin/python manage.py migrate_schemas --shared --settings=config.settings.dev

shell: ## Django shell com contexto de tenant
	$(BACKEND) && .venv/bin/python manage.py shell --settings=config.settings.dev

## ─ Testes ───────────────────────────────────────────────────────────────────

test: test-backend test-web ## Todos os testes

test-backend: ## Apenas pytest (backend Django)
	$(BACKEND) && .venv/bin/pytest --tb=short -q

test-web: ## Vitest + Playwright (frontend)
	npm run test --workspace=dscar-web

## ─ Qualidade de código ──────────────────────────────────────────────────────

lint: ## ESLint + Black + isort (verificação)
	npm run lint
	$(BACKEND) && .venv/bin/black --check . && .venv/bin/isort --check-only .

format: ## Black + isort (correção automática)
	$(BACKEND) && .venv/bin/black . && .venv/bin/isort .

typecheck: ## mypy + tsc
	$(BACKEND) && .venv/bin/mypy .
	npm run typecheck

## ─ Setup inicial ────────────────────────────────────────────────────────────

setup: ## Configura o ambiente pela primeira vez
	@echo "🏁 Configurando ambiente Paddock Solutions..."
	@$(MAKE) setup-python
	@$(MAKE) setup-node
	@$(MAKE) dev
	@echo "✅  Ambiente pronto! Rode 'make migrate' para criar o banco."

setup-python: ## Configura o ambiente Python
	@echo "🐍 Configurando Python..."
	cd backend/core && python3 -m venv .venv
	cd backend/core && .venv/bin/pip install --upgrade pip
	cd backend/core && .venv/bin/pip install -r requirements/dev.txt

setup-node: ## Instala dependências Node.js
	@echo "📦 Instalando dependências Node.js..."
	npm install

## ─ Git / Sprint ─────────────────────────────────────────────────────────────

sprint-close: ## Fecha sprint com commits por domínio. Uso: make sprint-close SPRINT=14
	@bash scripts/sprint-close.sh $(SPRINT)

install-hooks: ## Instala git hooks do projeto (pre-commit)
	@cp -f scripts/sprint-close.sh scripts/sprint-close.sh
	@chmod +x .git/hooks/pre-commit
	@echo "✅  Hooks instalados."

## ─ Help ─────────────────────────────────────────────────────────────────────

help: ## Mostra esta mensagem de ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
