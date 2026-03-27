COMPOSE = docker compose -f infra/docker-compose.dev.yml

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
# setup: instala deps e cria tabelas (primeira execução)
setup:
	cd backend/core && pip install -r requirements.txt && python manage.py migrate

migrate:
	cd backend/core && python manage.py migrate

# Quando multitenancy estiver ativo:
# migrate: cd backend/core && python manage.py migrate_schemas
# migrate-tenant: cd backend/core && python manage.py migrate_schemas --schema=$(t)

createsuperuser:
	cd backend/core && python manage.py createsuperuser

fipe-import:
	cd backend/core && python scripts/fipe_import.py

shell:
	cd backend/core && python manage.py shell

db-reader:
	docker exec -it paddock-postgres psql -U paddock -d paddock_dev -c "\
		CREATE USER mcp_reader WITH PASSWORD 'mcp_readonly_2025'; \
		GRANT CONNECT ON DATABASE paddock_dev TO mcp_reader; \
		GRANT USAGE ON SCHEMA public TO mcp_reader; \
		GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_reader;"

# ── Qualidade ─────────────────────────────────────────────────────────────────
lint:
	cd backend/core && black --check . && isort --check-only .
	cd apps/dscar-web && npx eslint .

format:
	cd backend/core && black . && isort .

typecheck:
	cd backend/core && mypy .
	cd apps/dscar-web && npx tsc --noEmit

# ── Testes ────────────────────────────────────────────────────────────────────
test:
	cd backend/core && pytest
	cd apps/dscar-web && npx vitest run

test-backend:
	cd backend/core && pytest

test-web:
	cd apps/dscar-web && npx vitest run

test-cov:
	cd backend/core && pytest --cov=. --cov-report=html

.PHONY: dev dev-stop dev-down dev-ps dev-logs \
        migrate migrate-tenant shell db-reader \
        lint format typecheck \
        test test-backend test-web test-cov
