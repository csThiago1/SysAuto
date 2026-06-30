# Sprint 11 — Módulo Financeiro: Fundação Contábil
# ERP DS Car · Paddock Solutions · Revisão Técnica
# ─────────────────────────────────────────────────────────────────────────────
# Data: Abril 2026

## Status: ✅ Entregue

---

## O que foi implementado

### App Django: `apps.accounting` (TENANT_APPS)

#### Models (7 modelos)

| Model | Arquivo | Descrição |
|-------|---------|-----------|
| `ChartOfAccount` | `models/chart_of_accounts.py` | Plano de contas hierárquico (5 níveis, SPED ECD) |
| `CostCenter` | `models/chart_of_accounts.py` | Centro de custo com hierarquia e mapeamento os_type |
| `FiscalYear` | `models/fiscal_period.py` | Exercício fiscal anual |
| `FiscalPeriod` | `models/fiscal_period.py` | Período contábil mensal (1-12 + ajuste 13) |
| `JournalEntry` | `models/journal_entry.py` | Lançamento contábil com GenericFK |
| `JournalEntryLine` | `models/journal_entry.py` | Linha do lançamento (partida dobrada) |
| `NumberSequence` | `models/sequences.py` | Sequência numérica thread-safe |

#### Services (4 serviços)

| Service | Métodos principais |
|---------|-------------------|
| `JournalEntryService` | `create_entry()`, `approve_entry()`, `reverse_entry()`, `create_from_service_order()` |
| `NumberingService` | `next(key)`, `peek_next(key)` — thread-safe com `select_for_update()` |
| `AccountBalanceService` | `get_balance()` (com subárvore), `get_trial_balance()` |
| `FiscalPeriodService` | `get_or_create_period()`, `close_period()`, `get_current_period()` |

#### API Endpoints

| Endpoint | ViewSet | Actions extras |
|----------|---------|----------------|
| `GET/POST /api/v1/accounting/chart-of-accounts/` | ChartOfAccountViewSet | `tree`, `balance` |
| `GET/POST /api/v1/accounting/cost-centers/` | CostCenterViewSet | — |
| `GET/POST /api/v1/accounting/fiscal-years/` | FiscalYearViewSet | — |
| `GET/POST /api/v1/accounting/fiscal-periods/` | FiscalPeriodViewSet | `close`, `current` |
| `GET/POST /api/v1/accounting/journal-entries/` | JournalEntryViewSet | `approve`, `reverse` |

**Nota:** `DELETE /api/v1/accounting/journal-entries/{id}/` retorna **HTTP 405** — lançamentos são imutáveis.

#### Fixture: Plano de Contas DS Car

- **84 contas** em `fixtures/chart_of_accounts_dscar.py`
- Cobrem grupos 1 (Ativo) → 7 (Outras Receitas/Despesas)
- Contas analíticas (`is_analytical=True`) em nível 4
- Compatível com SPED ECD (`sped_code` preenchido nos grupos principais)

#### Management Command

```bash
# Inicializa plano de contas para o tenant atual
python manage.py setup_chart_of_accounts

# Recria contas existentes sem afetar lançamentos
python manage.py setup_chart_of_accounts --reset
```

#### Migration

```
apps/accounting/migrations/0001_initial.py
  - 7 models criados
  - 10 índices otimizados:
    code, (account_type, is_analytical), parent
    (competence_date), origin, fiscal_period, (content_type, object_id), (is_approved, competence_date)
    (account, entry), cost_center
```

#### Testes: 93 testes em 3 arquivos

| Arquivo | Qtd | Cobertura |
|---------|-----|-----------|
| `tests/test_models.py` | 28 | Validações `clean()`, constraints, `can_post()`, `is_balanced` |
| `tests/test_services.py` | 32 | NumberingService, JournalEntryService, BalanceService, FiscalPeriodService |
| `tests/test_views.py` | 33 | Todos ViewSets, filtros, actions, HTTP 401/404/405 |

**Para rodar os testes:**
```bash
make dev  # inicia Docker com PostgreSQL
python manage.py test apps.accounting --settings=config.settings.test -v 2
```

---

## Configurações adicionadas

### `config/settings/base.py`
```python
TENANT_APPS = [
    # ...
    "apps.hr",
    "apps.accounting",   # ← adicionado
]

CELERY_BEAT_SCHEDULE = {
    "accounting-update-overdue": {
        "task": "apps.accounting.tasks.update_overdue_entries",
        "schedule": crontab(hour=6, minute=0),
    },
}
```

### `config/urls.py`
```python
path("api/v1/accounting/", include("apps.accounting.urls")),
```

### `requirements/base.txt`
```
ofxparse==0.21      # OFX bancário (Sprint 13)
ofxtools==0.9.4     # OFX completo (Sprint 13)
reportlab==4.2.2    # PDF relatórios (Sprint 14)
openpyxl==3.1.2     # XLSX export (Sprint 14)
```

---

## Verificações

| Check | Resultado |
|-------|-----------|
| `manage.py check` | ✅ 0 issues |
| `makemigrations` | ✅ 0001_initial.py gerado |
| Sintaxe Python (37 arquivos) | ✅ 0 erros, 0 SyntaxWarnings |

---

## Guia de Validação Humana

Após `make dev` e `make migrate`:

### 1. Popular plano de contas
```bash
python manage.py setup_chart_of_accounts --settings=config.settings.dev
# Esperado: "Criadas 84 contas para schema tenant_dscar"
```

### 2. Testar criação de lançamento via API
```bash
# Criar lançamento manual balanceado
POST /api/v1/accounting/journal-entries/
{
  "description": "Teste lançamento manual",
  "competence_date": "2026-04-09",
  "origin": "MAN",
  "lines": [
    {"account_id": "<id_conta_devedora>", "debit_amount": "1000.00", "credit_amount": "0.00"},
    {"account_id": "<id_conta_credora>", "debit_amount": "0.00", "credit_amount": "1000.00"}
  ]
}
# Esperado: HTTP 201, lançamento criado com number="JE000001"
```

### 3. Testar validação de balanceamento
```bash
# Lançamento desbalanceado deve falhar
POST /api/v1/accounting/journal-entries/
{ "lines": [{"debit_amount": "1000.00"}, {"credit_amount": "500.00"}] }
# Esperado: HTTP 400, "Lançamento desbalanceado: débitos != créditos"
```

### 4. Testar bloqueio de DELETE
```bash
DELETE /api/v1/accounting/journal-entries/<id>/
# Esperado: HTTP 405 Method Not Allowed
```

### 5. Testar árvore do plano de contas
```bash
GET /api/v1/accounting/chart-of-accounts/tree/
# Esperado: JSON hierárquico com contas aninhadas (groups com children)
```

### 6. Rodar testes
```bash
python manage.py test apps.accounting --settings=config.settings.test
# Esperado: 93 testes, 0 falhas
```

---

## Próxima Sprint: Sprint 12 — Contas a Pagar e Receber

**Escopo:**
- App `accounts_payable`: `AccountsPayable`, `PayablePayment`, `ApprovalRule`
- App `accounts_receivable`: `AccountsReceivable`, `ReceivableReceipt`
- `AsaasService`: `create_charge()`, `process_webhook()`
- Webhook endpoint `/api/v1/receivables/webhook/asaas/`
- Celery tasks: `update_overdue_receivables`, `update_overdue_payables`
- Lançamentos contábeis automáticos integrados ao `JournalEntryService`

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
*Sprint 11 — Abril 2026*
