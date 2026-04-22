# Port Worktree Apps — Design Spec

**Branch:** `feat/port-worktree-shamir`
**Data:** 2026-04-22

## Objetivo

Portar 5 apps do worktree `mystifying-shamir-d8d8ce` para o branch principal, na ordem de dependência:

```
authz → vehicles → payments → imports → budgets
```

Cada app tem seus testes passando antes de avançar para o próximo.

## Arquitetura Geral

- Todos os apps são **TENANT_APP** (schema-per-tenant via django-tenants)
- Nenhum app existente é removido ou quebrado — port é **aditivo**
- `authz` coexiste com RBAC JWT atual (`IsConsultantOrAbove` etc.)
- `vehicles` reutiliza `vehicle_catalog.VehicleVersion` como FK — não duplica catálogo FIPE
- `imports` reutiliza parsers do `cilia` existente — não duplica código
- `budgets` usa `ItemFieldsMixin` e `NumberAllocator` do `items` existente

---

## App 1 — `authz`

### Propósito
Permissões granulares em banco de dados. Complementa o RBAC JWT com overrides por usuário e permissões nomeadas por feature.

### Modelos

```python
Permission(code: str, label: str, module: str)
# Exemplos: 'budget.approve', 'os.import_xml', 'os.cancel', 'payment.record'

Role(code: str, label: str, description: str)
# Seeds: OWNER, ADMIN, MANAGER, CONSULTANT, MECHANIC, FINANCIAL

RolePermission(role: FK, permission: FK)          # M2M through
UserRole(user: FK[GlobalUser], role: FK)          # M2M through
UserPermission(user: FK[GlobalUser], permission: FK, granted: bool)  # override individual
```

### Lógica de Resolução

`authz.services.user_has_perm(user, perm_code) -> bool`:
1. `UserPermission` existe para este user+permission? → retorna `granted` (prioridade máxima)
2. Algum `Role` do usuário tem essa permissão? → `True`
3. Caso contrário → `False`

### Migrations
- `0001_initial` — cria todos os modelos
- `0002_seed_roles` — semeia 6 roles padrão + ~20 permissões canônicas

### API
```
GET      /api/v1/authz/permissions/          # CONSULTANT+
GET      /api/v1/authz/roles/               # CONSULTANT+
GET/POST /api/v1/authz/user-roles/          # ADMIN+
GET/POST /api/v1/authz/user-permissions/    # ADMIN+
```

### Testes
- `user_has_perm` com UserPermission granted=True/False (override)
- `user_has_perm` via Role (sem override)
- Usuário sem nenhum role → False
- API leitura como CONSULTANT, escrita como ADMIN

---

## App 2 — `vehicles`

### Propósito
Instâncias físicas de veículo vinculadas a OS. Lookup de placa: base interna primeiro, API externa como fallback.

### Modelo

```python
Vehicle(
    plate: str,                     # normalizado: ABC1D23 (sem hífen, maiúsculo)
    version: FK[VehicleVersion],    # nullable — FK para vehicle_catalog.VehicleVersion
    description: str,               # fallback quando versão FIPE não encontrada
    color: str,
    year_manufacture: int | None,
    chassis: str,
    renavam: str,
    is_active: bool,
    created_at: datetime,
    updated_at: datetime,
)
```

Reutiliza `vehicle_catalog.VehicleVersion` — não duplica catálogo FIPE.

### Fluxo de Lookup

`VehicleService.lookup_plate(plate: str) -> dict | None`:

```
1. Normaliza: plate.upper().replace("-", "").strip()
2. Vehicle.objects.filter(plate=plate, is_active=True).first()
   → Encontrou? Retorna imediatamente (source="db")
3. GET https://apiplacas.com.br/api/v1/placa?placa={plate}
   Header: Authorization: Bearer {APIPLACAS_TOKEN}
4. Falha na API → log warning, retorna None (nunca explode)
5. Parse resposta → extrai marca, modelo, ano, cor, renavam, chassis, fipe_code
6. VehicleVersion.objects.filter(fipe_code=fipe_code).first() (nullable)
7. Vehicle.objects.create(...) → persiste para futuras consultas
8. Retorna dict: plate, description, color, year, version_id, source="api"
```

### Configuração

```python
# settings
APIPLACAS_TOKEN = env("APIPLACAS_TOKEN", default="")
APIPLACAS_URL = "https://apiplacas.com.br/api/v1/placa"
```

### API
```
GET /api/v1/vehicles/                       # lista (CONSULTANT+)
GET /api/v1/vehicles/{id}/                  # detalhe
POST /api/v1/vehicles/                      # criação manual (MANAGER+)
GET /api/v1/vehicles/lookup/?plate=ABC1D23  # fluxo completo DB→API (CONSULTANT+)
```

### Testes
- Lookup encontra na base → retorna sem chamar API (mock do httpx)
- Lookup não encontra → chama API, persiste, retorna com source="api"
- API externa falha → retorna None sem exceção
- Normalização de placa (hífen, minúscula, espaços)
- Placa já existente não é duplicada na base

---

## App 3 — `payments`

### Propósito
Registro de pagamentos recebidos contra OS, por bloco de pagador.

### Modelo

```python
Payment(
    service_order: FK[ServiceOrder],   # PROTECT
    payer_block: str,                  # SEGURADORA / COMPLEMENTO_PARTICULAR / FRANQUIA / PARTICULAR
    amount: Decimal(12, 2),
    method: str,                       # PIX / BOLETO / DINHEIRO / CARTAO / TRANSFERENCIA
    reference: str,                    # texto livre: txid PIX, nº boleto, etc.
    received_at: datetime,             # preenchido automaticamente no record()
    received_by: str,                  # nome do operador
    fiscal_doc_ref: str,               # nullable — nº NF-e/NFS-e vinculada
    status: str,                       # pending / received / refunded
    created_at: datetime,
)
```

### Service

```python
@classmethod
@transaction.atomic
def record(cls, *, service_order, payer_block, amount, method,
           reference="", received_by="") -> Payment:
    payment = Payment.objects.create(
        service_order=service_order,
        payer_block=payer_block,
        amount=amount,
        method=method,
        reference=reference,
        received_at=now(),
        received_by=received_by,
        status="received",
    )
    OSEventLogger.log_event(
        service_order, "PAYMENT_RECORDED",
        payload={"amount": str(amount), "method": method, "payer_block": payer_block},
        swallow_errors=True,
    )
    return payment
```

### API
```
GET  /api/v1/service-orders/{id}/payments/   # lista pagamentos da OS (CONSULTANT+)
POST /api/v1/service-orders/{id}/payments/   # registra pagamento (MANAGER+)
```

### Testes
- `record()` cria Payment com status=received e received_at preenchido
- `record()` loga evento PAYMENT_RECORDED via OSEventLogger
- API GET retorna apenas pagamentos da OS correta
- API POST retorna 201 com dados completos
- RBAC: GET como CONSULTANT, POST como MANAGER

---

## App 4 — `imports`

### Propósito
Orquestrador de importações multi-fonte (Cília API + XML IFX). Audit trail completo via `ImportAttempt`. Deduplicação por hash. Integra com `ServiceOrderService.create_new_version_from_import()`.

### Modelo

```python
ImportAttempt(
    source: str,              # cilia / hdi / xml_porto / xml_azul / xml_itau
    trigger: str,             # polling / upload_manual / user_requested
    casualty_number: str,
    budget_number: str,
    version_number: str,
    http_status: int | None,  # nullable para uploads XML
    parsed_ok: bool,
    error_message: str,
    error_type: str,          # parse_error / network_error / duplicate / auth_error
    raw_payload: JSONField,
    payload_hash: str,        # SHA256 — chave de deduplicação
    duplicate_of: FK[self],   # nullable — aponta para attempt original
    service_order: FK[ServiceOrder],        # nullable
    service_order_version: FK[ServiceOrderVersion],  # nullable
    duration_ms: int,
    created_at: datetime,
)
```

### Reutilização do `cilia` existente

`ImportService` usa **sem duplicar**:
- `cilia.client.CiliaClient` → chamadas HTTP à API Cília
- `cilia.sources.cilia_parser.CiliaParser` → JSON → `ParsedBudget`
- `cilia.sources.xml_ifx_parser.XmlIfxParser` → XML → `ParsedBudget`

### Service

```python
ImportService.fetch_cilia_budget(casualty_number, budget_number, version_number, trigger)
  → CiliaClient.get_budget() → CiliaParser.parse()
  → ImportAttempt(source="cilia")
  → _deduplicate(hash) → se duplicata: ImportAttempt(duplicate_of=original), retorna
  → ServiceOrderService.create_new_version_from_import()

ImportService.import_xml_ifx(file_bytes, insurer_code, trigger)
  → XmlIfxParser.parse()
  → ImportAttempt(source=insurer_code)
  → mesma lógica de deduplicação e persist

_deduplicate(payload_hash) -> ImportAttempt | None
_persist(parsed_budget, attempt) -> ServiceOrderVersion
```

### Celery Tasks
```python
poll_cilia_budget(service_order_id)
  # Busca v+1 da versão ativa da OS
  # Pula se: não é SEGURADORA / OS fechada / sem casualty_number / versão em status terminal

sync_active_cilia_os()
  # Encontra todas OS elegíveis → dispara poll_cilia_budget para cada uma
```

### API
```
GET  /api/v1/imports/attempts/                   # lista com filtros (CONSULTANT+)
POST /api/v1/imports/attempts/cilia/fetch/       # fetch manual (MANAGER+)
POST /api/v1/imports/attempts/xml/upload/        # upload XML multipart (MANAGER+)
```

### Testes
- `fetch_cilia_budget` cria `ImportAttempt` com `parsed_ok=True`
- Duplicata por hash → `duplicate_of` preenchido, sem nova versão criada
- `import_xml_ifx` parseia e persiste
- Erro de rede → `ImportAttempt(parsed_ok=False, error_type="network_error")`, sem exceção propagada
- `poll_cilia_budget` pula OS sem casualty_number

---

## App 5 — `budgets`

### Propósito
Orçamentos para clientes particulares (não seguradora) com versionamento imutável, máquina de estados, geração de PDF e conversão para OS.

### Modelos

```python
Budget(
    number: str,              # ORC-2026-000001 (NumberAllocator do items)
    customer: FK[Person],
    vehicle_plate: str,
    vehicle_description: str,
    cloned_from: FK[self],    # nullable — origem da clonagem
    service_order: FK[ServiceOrder],  # nullable — preenchido após approve()
    is_active: bool,
    created_at, updated_at,
)

BudgetVersion(
    budget: FK,
    version_number: int,      # 1, 2, 3...
    status: str,              # draft/sent/approved/rejected/expired/revision/superseded
    valid_until: date,        # 30 dias após send_to_customer()
    subtotal: Decimal,
    discount_total: Decimal,
    net_total: Decimal,
    labor_total: Decimal,
    parts_total: Decimal,
    content_hash: str,        # SHA256 dos itens — valida imutabilidade
    pdf_s3_key: str,
    created_by: str,
    sent_at: datetime | None,
    approved_at: datetime | None,
    approved_by: str,
)

BudgetVersionItem(
    version: FK[BudgetVersion],
    # herda ItemFieldsMixin:
    #   bucket, payer_block, impact_area
    #   item_type (PART/SERVICE), description, external_code
    #   quantity, unit_price, net_price
    #   flag_abaixo_padrao, sort_order
    operations: M2M[ItemOperation],
)
```

### Máquina de Estados

```
draft ──send_to_customer()──→ sent ──approve()──→ approved → cria ServiceOrder
                                  └──reject()──→ rejected
                                  └──revision()→ revision → novo draft v+1 com itens copiados

rejected/expired ──clone()──→ novo Budget v1 draft
Celery diário: sent com valid_until vencido → expired
approved → versões irmãs → superseded
```

### Regras Críticas
- **Draft** → mutável (PATCH em items liberado)
- **Sent+** → **imutável** — qualquer PATCH em itens retorna HTTP 400
- `approve()` → `@transaction.atomic`: cria `ServiceOrder`, marca versões irmãs como `superseded`
- `content_hash` calculado no `send_to_customer()`, verificado no `approve()`
- PDF gerado via `pdf_engine` existente (stub em dev, S3 em prod)
- `NumberAllocator` (já em `apps.items`) gera números sequenciais por ano

### API
```
GET/POST /api/v1/budgets/                                    # CONSULTANT+
GET      /api/v1/budgets/{id}/
POST     /api/v1/budgets/{id}/clone/
GET/POST /api/v1/budgets/{id}/versions/
GET      /api/v1/budgets/{id}/versions/{v}/
GET/POST /api/v1/budgets/{id}/versions/{v}/items/            # POST bloqueado se sent+
PATCH    /api/v1/budgets/{id}/versions/{v}/items/{i}/        # bloqueado se sent+
POST     /api/v1/budgets/{id}/versions/{v}/send/             # CONSULTANT+
POST     /api/v1/budgets/{id}/versions/{v}/approve/          # MANAGER+
POST     /api/v1/budgets/{id}/versions/{v}/reject/           # MANAGER+
POST     /api/v1/budgets/{id}/versions/{v}/revision/         # MANAGER+
GET      /api/v1/budgets/{id}/versions/{v}/pdf/              # CONSULTANT+
```

### Testes
- `create()` gera número sequencial + versão draft
- Draft mutável (PATCH 200), Sent imutável (PATCH 400)
- `approve()` cria ServiceOrder + marca versões irmãs como superseded
- `clone()` cria novo Budget v1 com itens copiados
- `revision()` cria draft v+1 com itens copiados da versão enviada
- Celery `expire_stale_budgets()` marca sent com valid_until vencido como expired

---

## Dependências entre Apps

```
authz       → nenhuma (independente)
vehicles    → vehicle_catalog (VehicleVersion FK), httpx
payments    → service_orders (ServiceOrder, OSEventLogger)
imports     → cilia (client + parsers), service_orders (ServiceOrderService)
budgets     → items (ItemFieldsMixin, NumberAllocator, ItemOperation)
            → persons (Person)
            → service_orders (ServiceOrder)
            → pdf_engine (PDFService)
```

## Ordem de Implementação por Dependência

```
1. authz       → sem dependências internas
2. vehicles    → vehicle_catalog já existe
3. payments    → service_orders já existe
4. imports     → cilia já existe, service_orders já existe
5. budgets     → items, persons, service_orders, pdf_engine já existem
```

## Configurações Necessárias (settings)

```python
APIPLACAS_TOKEN = env("APIPLACAS_TOKEN", default="")
APIPLACAS_URL = "https://apiplacas.com.br/api/v1/placa"
```

## Padrões do Projeto a Seguir

- Type hints obrigatórios em todas as funções e métodos
- `select_related` / `prefetch_related` em todos os querysets com relações
- `@transaction.atomic` em todo service method que escreve
- `OSEventLogger.log_event(..., swallow_errors=True)` para não interromper fluxo principal
- `TenantTestCase` + `HTTP_X_TENANT_DOMAIN` + `token={"role":"ADMIN"}` em testes de API
- Commits Conventional Commits por app
