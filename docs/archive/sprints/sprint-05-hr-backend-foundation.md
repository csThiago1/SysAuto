# Sprint 5 — HR Backend: Foundation

**Projeto:** DS Car ERP — Módulo de RH
**Sprint:** 05
**Última atualização:** 2026-04-06
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

---

## Contexto

Criação do app `apps/hr` — fundação do módulo de RH com os modelos essenciais de cadastro de colaborador.
~30 colaboradores, oficina automotiva, escala 6x1.

**Adaptações do skill vs. projeto:**
- `Department` / `Position` NÃO são models separados → usar `CharField` com choices de `persons.SetorPessoa` / `persons.CargoPessoa`
- `GlobalUser` em `authentication.GlobalUser` ✓
- `PaddockBaseModel` em `authentication.models` ✓
- `django-encrypted-model-fields` já instalado ✓
- App vai em `TENANT_APPS` (dados por empresa, não compartilhados)

---

## Escopo — Sprint 5

### Backend

#### US-HR-01 — Estrutura do App

- [x] Criar `backend/core/apps/hr/__init__.py`
- [x] Criar `backend/core/apps/hr/apps.py` — `HrConfig`
- [x] Criar `backend/core/apps/hr/admin.py`
- [x] Adicionar `"apps.hr"` em `TENANT_APPS` no `config/settings/base.py`
- [x] Incluir `path("api/v1/hr/", include("apps.hr.urls"))` em `config/urls.py`

#### US-HR-02 — Models Fundação

- [x] `Employee` — perfil trabalhista (department/position como CharField choices)
- [x] `EmployeeDocument` — documentos digitalizados (soft delete, R2/S3)
- [x] `SalaryHistory` — histórico de reajustes (imutável)

#### US-HR-03 — Serializers

- [x] `EmployeeListSerializer` — leitura resumida (list/search)
- [x] `EmployeeDetailSerializer` — leitura completa (detalhe)
- [x] `EmployeeCreateSerializer` — criação / admissão
- [x] `EmployeeUpdateSerializer` — atualização de dados
- [x] `EmployeeDocumentSerializer`
- [x] `SalaryHistorySerializer`
- [x] `SalaryHistoryCreateSerializer`

#### US-HR-04 — ViewSets + URLs

- [x] `EmployeeViewSet` — list, retrieve, create, partial_update + action `terminate`
- [x] `EmployeeDocumentViewSet` — nested em `/employees/{id}/documents/`
- [x] `SalaryHistoryViewSet` — nested em `/employees/{id}/salary-history/`
- [x] `apps/hr/urls.py` com DefaultRouter

#### US-HR-05 — Admin

- [x] `EmployeeAdmin` — listagem com filtros por setor/status
- [x] `EmployeeDocumentInline` — inline no EmployeeAdmin
- [x] `SalaryHistoryInline` — inline no EmployeeAdmin

#### US-HR-06 — Migrations

- [x] `makemigrations hr` — primeira migration (0001_initial.py)
- [x] Validar migration não tem operações destrutivas (`manage.py check` — 0 issues)

#### US-HR-07 — Testes

- [x] `apps/hr/tests/__init__.py`
- [x] `apps/hr/tests/test_models.py` — Unit (sem DB): tenure_days, cpf_hash; DB: criação, soft_delete
- [x] `apps/hr/tests/test_employee_views.py` — CRUD, terminate, permissões, salary history
- [ ] `apps/hr/tests/test_document_views.py` — upload, list, soft delete (Sprint 6)
- [x] 4 unit tests passando sem Docker; DB tests requerem `make dev`

---

## API Endpoints — Sprint 5

```
GET    /api/v1/hr/employees/                         → lista (filtro: status, department)
POST   /api/v1/hr/employees/                         → admissão
GET    /api/v1/hr/employees/{id}/                     → detalhe
PATCH  /api/v1/hr/employees/{id}/                     → atualizar dados
POST   /api/v1/hr/employees/{id}/terminate/           → desligamento

GET    /api/v1/hr/employees/{id}/documents/           → documentos
POST   /api/v1/hr/employees/{id}/documents/           → upload

GET    /api/v1/hr/employees/{id}/salary-history/      → histórico
POST   /api/v1/hr/employees/{id}/salary-history/      → novo reajuste
```

---

## Permissões

- `SELF` — colaborador vê apenas seus próprios dados
- `MANAGER` — vê colaboradores do seu setor
- `ADMIN` / `OWNER` — acesso total + reajuste salarial

---

## Definição de Pronto (DoD)

- [x] `manage.py check` — 0 issues
- [x] Migration `0001_initial.py` criada (3 models, 4 indexes)
- [x] 4 unit tests passando (sem Docker): `pytest -k Unit`
- [x] DB tests escritos — rodar com `make dev` + `make test-backend`
- [x] Nenhum dado pessoal em logs (CPF mascarado, hash para lookup)
- [ ] `make lint` + `make typecheck` — verificar com Docker rodando
