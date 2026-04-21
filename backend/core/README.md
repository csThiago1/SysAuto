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

## Observações importantes

- Esta base é o primeiro passo do MVP backend.
- Regras de LGPD, fiscal e multitenancy ainda serão aprofundadas nas próximas iterações.
- O fluxo de status de OS segue as transições obrigatórias definidas no projeto.
