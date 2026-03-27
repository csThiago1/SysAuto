# MVP Checklist - Backend Core

## Entregue no ciclo 1

- [x] Estrutura Django inicial (`manage.py`, `config/settings.py`, `config/urls.py`)
- [x] Endpoint de saúde (`/api/v1/health/`)
- [x] App `persons` com:
  - [x] Model `Person`
  - [x] Serializer list/create/detail
  - [x] ViewSet com filtro e busca
  - [x] Rotas REST
- [x] App `service_orders` com:
  - [x] Model `ServiceOrder`
  - [x] Model `ServiceOrderStatusHistory`
  - [x] Service de mudança de status com transições válidas (15 estados)
  - [x] Action `change-status`
  - [x] Rotas REST

## Entregue no ciclo 2 (26/03/2026)

- [x] Migrations iniciais criadas para `persons` e `service_orders`.
- [x] Configuração PostgreSQL via `DATABASE_URL` (env) — docker-compose.dev.yml pronto.
- [x] Autenticação JWT via `djangorestframework-simplejwt`.
  - [x] Endpoints: `POST /api/v1/auth/token/` e `POST /api/v1/auth/token/refresh/`
  - [x] `settings.py` configurado com `SIMPLE_JWT`, `CORS`, Redis cache
- [x] App `vehicles` criado (Phase 1):
  - [x] Models: `VehicleBrand`, `VehicleModel`, `VehicleVersion`, `Vehicle`
  - [x] Migrations iniciais
  - [x] Serializers, ViewSets, URLs
  - [x] `GET /api/v1/vehicles/lookup/?plate=ABC1D23` — integração com API externa
  - [x] `services.py` com `lookup_plate()` (falha silenciosa)
- [x] `requirements.txt` atualizado: psycopg3, simplejwt, httpx, cors-headers, dotenv
- [x] `.env.example` criado para backend e frontend

## Próximo ciclo — prioridade alta

- [ ] Subir docker-compose (`make dev`) e rodar `migrate` para validar as migrations.
- [ ] Conectar frontend `apps/dscar-web` aos endpoints reais (API client já implementado).
  - [ ] Substituir mock data por chamadas reais à API
  - [ ] Implementar login JWT no frontend
- [ ] Popular catálogo FIPE local (script de importação `fipe_import.py`).
- [ ] Configurar `PLATE_LOOKUP_URL` + `PLATE_LOOKUP_KEY` para lookup de placa real.

## Próximo ciclo — conformidade

- [ ] Evoluir `Person` para o padrão completo (Document, Category, Contact, Address).
- [ ] Aplicar LGPD com criptografia de PII (`EncryptedField`).
- [ ] Preparar estrutura multitenancy (`django-tenants`, `schema_context`).
- [ ] Aplicar regra fiscal no fechamento de OS (NFS-e para cliente particular via Focus NF-e).
- [ ] Integração Cilia (BudgetSnapshot + 4 importers).
- [ ] App `authentication` — Keycloak + roles (OWNER, ADMIN, MANAGER, CONSULTANT).
