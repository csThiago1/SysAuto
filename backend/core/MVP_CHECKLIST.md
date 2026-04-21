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

## Entregue no ciclo 3 — Módulo de Orçamentação (Foundation)

- [x] Apps Django novos: `items`, `authz`, `budgets`
- [x] Models de referência: `ItemOperationType`, `LaborCategory`, `NumberSequence`, `Insurer`
- [x] `ItemFieldsMixin` abstract compartilhado entre Budget e OS
- [x] `ItemOperation` polimórfica (FK nullable Budget/OS)
- [x] `Budget` + `BudgetVersion` + `BudgetVersionItem`
- [x] Evolução de `ServiceOrder` (customer_type, source_budget, insurer, casualty, franquia)
- [x] `ServiceOrderVersion` + `ServiceOrderVersionItem`
- [x] `ServiceOrderEvent` (timeline universal)
- [x] `ServiceOrderParecer` + `ImpactAreaLabel`
- [x] Data migration `ServiceOrderStatusHistory` → `ServiceOrderEvent`
- [x] Seeds: operation types, labor categories, insurers (10), permissions (18), roles (6)
- [x] `NumberAllocator` atômico (SELECT FOR UPDATE)
- [x] `user_has_perm()` helper com precedência override
- [x] Admin registrado pra debug
- [x] Smoke test `scripts/smoke_foundation.py`

## Entregue no ciclo 4 — Módulo de Orçamentação (Core Services)

- [x] `OSEventLogger` helper centralizado para timeline unificada
- [x] `kanban.py` com `VALID_TRANSITIONS` + re-entrada em budget dos 7 estados de reparo
- [x] `BudgetService`: create, send_to_customer, approve, reject, request_revision, clone, expire_stale_versions
- [x] Celery task `expire_stale_budgets` (beat diário) + config Celery
- [x] `ServiceOrderService`: change_status evoluído via OSEventLogger com is_auto + previous_status + trava `_can_deliver`, create_from_budget, create_new_version_from_import, approve_version com auto-return
- [x] `ComplementoParticularService.add_complement` com copy + recalculate totais por bloco
- [x] App `payments` com Payment model + PaymentService.record atômico
- [x] pdf_stub (substituído por WeasyPrint real no Ciclo 5)
- [x] 140 testes PASS (60 Ciclo 01 + 80 Ciclo 02)
- [x] Smoke integration `scripts/smoke_ciclo2.py`

## Entregue no Ciclo 05 — Módulo de Orçamentação (API REST + PDF)

- [x] drf-spectacular (OpenAPI) + SwaggerUI em `/api/v1/schema/swagger/`
- [x] Reference endpoints: operation-types, labor-categories, insurers (15 endpoints)
- [x] BudgetViewSet + nested versions + items (CRUD + actions send/approve/reject/revision/clone + PDF download)
- [x] ServiceOrderViewSet + actions (change-status, complement, events, pareceres, approve-version)
- [x] PaymentViewSet (nested sob ServiceOrder)
- [x] PDF engine real (WeasyPrint) com templates DS Car + fallback HTML
- [x] 174 testes PASS (60 Ciclo 01 + 80 Ciclo 02 + 34 Ciclo 03A)
- [x] Smoke E2E `scripts/smoke_ciclo3a.py` via APIClient

## Entregue no Ciclo 06 — Frontend Integration (03B)

- [x] TanStack Query v5 + Zod schemas espelhando API
- [x] API modules: budgets, serviceOrdersV2, payments, referenceData
- [x] Hooks: useBudget (+ mutations), useServiceOrderV2, useOSEvents, usePayments, useReferenceData
- [x] Budget UI completa: BudgetList, BudgetDetail, BudgetItemEditor, BudgetActionsPanel, BudgetStatusBadge
- [x] OS V2 UI: OSDetailV2 com 4 tabs (Versões, Timeline, Pagamentos, Complemento), OSVersionsTab, OSTimeline, OSPaymentsTab, OSComplementForm
- [x] KanbanV2 conectado à API real (useServiceOrdersV2 + useChangeStatusV2)
- [x] App.tsx integrado: views "budgets", "budget-detail", "os-v2" adicionadas
- [x] Sidebar com item "Orçamentos" (FileText icon)
- [x] mockData.ts legado preservado (coexistência)
- [x] Smoke manual documentado em `apps/dscar-web/src/__smoke__/smoke_ciclo3b.md`
- [x] .env.example com VITE_API_URL + VITE_USE_MOCK_DATA=false

## Entregue no Ciclo 07 — Importador Cilia (04)

- [x] App `imports` + `ImportAttempt` com auditoria completa (source/trigger/http_status/error_type/duration_ms/duplicate_of)
- [x] Snapshot em `ServiceOrderVersion`: `raw_payload` + `report_pdf_base64` + `report_html_base64` + external IDs (budget_id, version_id, flow_number)
- [x] `CiliaClient` httpx (token fixo via query param) + 13 testes com respx
- [x] `CiliaParser` mapeando 11 status + 5 conclusion keys + 4 part types + 5 labor cats + 10 seguradoras (24 tests com fixtures reais)
- [x] `ImportService.fetch_cilia_budget()` com dedup por `raw_hash` + idempotência por `external_version_id` (10 integration tests)
- [x] `ServiceOrderService.create_new_version_from_import` expandido pra persistir items + operations + pareceres + snapshot + recalcular totais
- [x] Celery task `poll_cilia_budget(os_id)` — incremental v+1, para em terminal (refused/finalized) ou 404
- [x] Celery task `sync_active_cilia_os` — beat 15min, filtra OS elegíveis e dispara polling
- [x] Endpoints: `POST /imports/attempts/cilia/fetch/` + `GET /imports/attempts/` (filtro por parsed_ok, casualty, source)
- [x] Frontend `CiliaImporter.tsx` com form + histórico real-time (refetch 30s) + link pra abrir OS criada
- [x] Schemas Zod `ImportAttemptSchema` + hooks `useFetchCilia`, `useImportAttempts`
- [x] 52 novos testes no Ciclo 04 — total ~260 PASS
- [x] Smoke live `scripts/smoke_ciclo4.py` com par real `406571903/1446508` (v1 NEGADO, v2 AUTORIZADO, v3 404)
- [x] Fixtures reais capturadas de prod (1MB × 2 versões) em `apps/imports/tests/fixtures/`

## Próximo — Ciclo 04B: XML IFX (Porto/Azul/Itaú)
- [ ] XmlIfxParser (schema unificado IFX/finalizacaoOrcamentoVO) usando lxml
- [ ] Endpoint `POST /imports/xml/upload/` (multipart)
- [ ] Frontend dropzone no mesmo CiliaImporter (renomear pra ImportCenter)
- [ ] Fixtures XML já disponíveis: QZP8B26 e TAF7C72

## Próximo — Ciclo 04C: HDI HTML
- [ ] HdiImporter BeautifulSoup (aguardar amostra real do usuário)

## Próximo ciclo — API + Frontend base (Ciclo 3)

- [ ] ViewSets DRF + serializers (Budget, OS, Payment)
- [ ] Endpoints REST conforme §8 da spec
- [ ] Frontend Next.js consumindo API real (substituir mockData)
- [ ] PDF engine real (WeasyPrint) substituindo pdf_stub
- [ ] Zod schemas frontend + hooks TanStack Query

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
