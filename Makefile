COMPOSE  = docker compose -f infra/docker-compose.dev.yml
PYTHON   = python3.12
VENV     = backend/core/.venv
PY       = $(VENV)/bin/python
PIP      = $(VENV)/bin/pip
MANAGE   = cd backend/core && $(abspath $(PY)) manage.py

# ── Ambiente ──────────────────────────────────────────────────────────────────
dev:
	$(COMPOSE) up -d

dev-stop:
	$(COMPOSE) stop

dev-down:
	$(COMPOSE) down

dev-ps:
	$(COMPOSE) ps

dev-logs:
	$(COMPOSE) logs -f

# ── Banco de dados ────────────────────────────────────────────────────────────
# setup: cria venv, instala deps e roda migrations (primeira execução)
$(VENV):
	$(PYTHON) -m venv $(VENV)

setup: $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r backend/core/requirements.txt
	$(MANAGE) migrate

migrate: $(VENV)
	$(MANAGE) migrate

# Quando multitenancy estiver ativo:
# migrate: $(MANAGE) migrate_schemas
# migrate-tenant: $(MANAGE) migrate_schemas --schema=$(t)

createsuperuser: $(VENV)
	$(MANAGE) createsuperuser

fipe-import: $(VENV)
	cd backend/core && $(abspath $(PY)) scripts/fipe_import.py

runserver: $(VENV)
	$(MANAGE) runserver 0.0.0.0:8000

shell: $(VENV)
	$(MANAGE) shell

db-reader:
	docker exec -it paddock-postgres psql -U paddock -d paddock_dev -c "\
		CREATE USER mcp_reader WITH PASSWORD 'mcp_readonly_2025'; \
		GRANT CONNECT ON DATABASE paddock_dev TO mcp_reader; \
		GRANT USAGE ON SCHEMA public TO mcp_reader; \
		GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_reader;"

# ── Qualidade ─────────────────────────────────────────────────────────────────
lint: $(VENV)
	cd backend/core && $(abspath $(PY)) -m black --check . && $(abspath $(PY)) -m isort --check-only .
	cd apps/dscar-web && npx eslint .

format: $(VENV)
	cd backend/core && $(abspath $(PY)) -m black . && $(abspath $(PY)) -m isort .

typecheck: $(VENV)
	cd backend/core && $(abspath $(PY)) -m mypy .
	cd apps/dscar-web && npx tsc --noEmit

# ── Testes ────────────────────────────────────────────────────────────────────
test: $(VENV)
	cd backend/core && $(abspath $(PY)) -m pytest
	cd apps/dscar-web && npx vitest run

test-backend: $(VENV)
	cd backend/core && $(abspath $(PY)) -m pytest

test-web:
	cd apps/dscar-web && npx vitest run

test-cov: $(VENV)
	cd backend/core && $(abspath $(PY)) -m pytest --cov=. --cov-report=html

.PHONY: dev dev-stop dev-down dev-ps dev-logs \
        setup migrate createsuperuser fipe-import runserver shell db-reader \
        lint format typecheck \
        test test-backend test-web test-cov
