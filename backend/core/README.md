# Backend Core - ERP DS Car

Base inicial do backend Django/DRF para o MVP do ERP DS Car.

## Objetivo deste pacote

- Estruturar a API do monorepo em `backend/core`.
- Iniciar módulos de Fase 1: `persons` e `service_orders`.
- Preparar o terreno para multitenancy (`django-tenants`) e integrações futuras.

## Estrutura inicial

- `manage.py`
- `config/`: settings e urls da API.
- `apps/persons/`: cadastro base de pessoas.
- `apps/service_orders/`: ordens de serviço e transições de status.

## Como rodar localmente (MVP)

1. Criar ambiente virtual Python:
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
2. Instalar dependências:
   - `pip install -r requirements.txt`
3. Rodar migrações:
   - `python manage.py migrate`
4. Subir API:
   - `python manage.py runserver 0.0.0.0:8000`

## Endpoints iniciais

- `GET /api/v1/health/`
- `GET /api/v1/persons/`
- `POST /api/v1/persons/`
- `GET /api/v1/service-orders/`
- `POST /api/v1/service-orders/`
- `POST /api/v1/service-orders/{id}/change-status/`

## Módulo de Orçamentação (Ciclo 01 — Foundation)

Fundação de dados entregue. Services/API/UI virão nos próximos ciclos.

### Apps novos
- `apps/items/` — tabelas de referência (ItemOperationType, LaborCategory, NumberSequence, ItemOperation, ItemFieldsMixin)
- `apps/authz/` — Role/Permission/UserRole/UserPermission + `user_has_perm()` helper
- `apps/budgets/` — Budget + BudgetVersion + BudgetVersionItem (particular pré-OS)

### Apps evoluídos
- `apps/service_orders/` — ServiceOrder (+ customer_type, insurer, casualty_number, source_budget, franchise_amount, etc), ServiceOrderVersion, ServiceOrderVersionItem, ServiceOrderEvent (timeline), ServiceOrderParecer, ImpactAreaLabel, Insurer

### Números atômicos
```python
from apps.items.services import NumberAllocator
or_number = NumberAllocator.allocate("BUDGET")           # → "OR-000042"
os_number = NumberAllocator.allocate("SERVICE_ORDER")    # → "OS-000088"
```

### Smoke test
```bash
python manage.py shell < scripts/smoke_foundation.py
```

### Seeds aplicadas via data migrations
- 7 ItemOperationType: TROCA, RECUPERACAO, OVERLAP, R_I, PINTURA, MONTAGEM_DESMONTAGEM, DNC
- 9 LaborCategory: FUNILARIA, PINTURA, MECANICA, ELETRICA, TAPECARIA, ACABAMENTO, VIDRACARIA, REPARACAO, SERVICOS
- 10 Insurer: yelum, porto, azul, itau, hdi, mapfre, tokio, bradesco, allianz, suhai
- 18 Permission agrupadas em 6 Role (OWNER, ADMIN, MANAGER, CONSULTANT, MECHANIC, FINANCIAL)

### Admin
Todos os models registrados em `/admin/` (user superadmin).

## Módulo de Orçamentação (Ciclo 02 — Core Services)

Services completos implementados em cima da fundação do Ciclo 01.

### Uso típico

```python
from decimal import Decimal
from apps.budgets.services import BudgetService
from apps.service_orders.services import ServiceOrderService, ComplementoParticularService
from apps.payments.services import PaymentService
from apps.service_orders.events import OSEventLogger

# Fluxo particular completo
budget = BudgetService.create(
    customer=person, vehicle_plate="ABC1D23",
    vehicle_description="Honda Fit 2019", created_by="alice",
)
# ... adicionar items + operations via ORM direto (Ciclo 3 traz endpoints)
BudgetService.send_to_customer(version=budget.active_version, sent_by="alice")
os_instance = BudgetService.approve(
    version=budget.active_version,
    approved_by="cliente-whatsapp",
    evidence_s3_key="whatsapp://ok.jpg",
)

# Kanban
ServiceOrderService.change_status(
    service_order=os_instance, new_status="initial_survey", changed_by="alice",
)

# Complemento particular em OS seguradora
new_v = ComplementoParticularService.add_complement(
    service_order=os_seg,
    items_data=[{
        "description": "Pintura extra",
        "quantity": Decimal("1"),
        "unit_price": Decimal("300"),
        "net_price": Decimal("300"),
        "item_type": "SERVICE",
    }],
    approved_by="alice",
)

# Pagamento
PaymentService.record(
    service_order=os_instance, payer_block="PARTICULAR",
    amount=Decimal("1000"), method="PIX",
    reference="pix-ABC-123", received_by="alice",
)

# Evento manual (ex: foto uploadada, assinatura capturada)
OSEventLogger.log_event(os_instance, "PHOTO_UPLOADED", actor="alice", payload={"s3_key": "..."})
```

### Celery task

```bash
# Expira budgets vencidos (>30 dias sem resposta) — roda 1x/dia via beat
celery -A config call apps.budgets.tasks.expire_stale_budgets

# Worker + beat
celery -A config worker -l info
celery -A config beat -l info
```

### Smoke test de integração

```bash
python manage.py shell < scripts/smoke_ciclo2.py
```

## Módulo de Orçamentação (Ciclo 03A — API REST + PDF)

API REST exposta em `/api/v1/`. Docs interativos em `/api/v1/schema/swagger/`.

### Endpoints principais

```
# Reference data (ReadOnly)
GET  /api/v1/items/operation-types/
GET  /api/v1/items/labor-categories/
GET  /api/v1/insurers/

# Budget
GET/POST /api/v1/budgets/
GET/POST /api/v1/budgets/{id}/versions/
GET/POST /api/v1/budgets/{id}/versions/{v}/items/
POST /api/v1/budgets/{id}/versions/{v}/send/
POST /api/v1/budgets/{id}/versions/{v}/approve/
POST /api/v1/budgets/{id}/versions/{v}/reject/
POST /api/v1/budgets/{id}/versions/{v}/revision/
POST /api/v1/budgets/{id}/clone/
GET  /api/v1/budgets/{id}/versions/{v}/pdf/

# ServiceOrder
GET  /api/v1/service-orders/
POST /api/v1/service-orders/{id}/change-status/
POST /api/v1/service-orders/{id}/complement/
GET  /api/v1/service-orders/{id}/events/
GET/POST /api/v1/service-orders/{id}/pareceres/
POST /api/v1/service-orders/{id}/versions/{v}/approve/

# Payment (nested sob ServiceOrder)
GET/POST /api/v1/service-orders/{id}/payments/
```

### Smoke E2E

```bash
python manage.py shell < scripts/smoke_ciclo3a.py
```

### OpenAPI

- Schema: `GET /api/v1/schema/`
- Swagger UI: `/api/v1/schema/swagger/`

## Observações importantes

- Esta base é o primeiro passo do MVP backend.
- Regras de LGPD, fiscal e multitenancy ainda serão aprofundadas nas próximas iterações.
- O fluxo de status de OS segue as transições obrigatórias definidas no projeto.
