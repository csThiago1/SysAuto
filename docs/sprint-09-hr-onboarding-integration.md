# Sprint 9 — HR: Integração Person↔Employee (Admissão sem UUID)

**Projeto:** DS Car ERP — Módulo de RH
**Sprint:** 09
**Data:** 2026-04-08
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

**Pré-requisito:** Sprints 5–8 concluídos (HR backend + frontend completos)

---

## Contexto e Motivação

O fluxo original de admissão exigia que o RH:
1. Fosse ao Django admin criar um `GlobalUser` manualmente
2. Copiasse o UUID gerado
3. Colasse no formulário de admissão do sistema

Isso tornava o processo **inoperável** para usuários de RH sem acesso técnico.
Além disso, foi descoberto um **bug**: `GlobalUser.save()` não computava `email_hash` automaticamente, causando falha na `unique constraint` ao criar múltiplos usuários.

---

## Escopo — Sprint 9

### US-HR-BE-09 — Admissão auto-cria GlobalUser

- [x] `GlobalUser.save()` — override que computa `email_hash` automaticamente
  - `if self.email and not self.email_hash: self.email_hash = sha256(email)`
  - Corrige bug pré-existente: `create_user()` não computava o hash

- [x] `EmployeeCreateSerializer` — aceita `name` + `email` em vez de UUID
  - Campos `name` (write_only) e `email` (write_only) adicionados
  - Campo `user` removido do input (mantido read_only no backend)
  - Campo `id` adicionado como read_only na resposta (necessário para redirect)
  - `validate_email()`: normaliza para lowercase, bloqueia e-mail com colaborador ativo
  - `create()`: `GlobalUser.get_or_create(email_hash=...)` — cria ou reutiliza; atualiza `name` se divergente; loga criação/reutilização

### US-HR-FE-09 — Formulário de admissão com nome + e-mail

- [x] `CreateEmployeePayload` (types) — `user: string` substituído por `name: string` + `email: string`
- [x] `UpdateEmployeePayload` (types) — `Omit` atualizado para excluir `name`/`email`/`registration_number`
- [x] `/rh/colaboradores/novo/page.tsx` — formulário atualizado:
  - Nova seção "Identificação" com campos: Nome completo + E-mail corporativo
  - Hint: "Acesso ao sistema criado automaticamente com o e-mail informado"
  - Removido campo UUID (era inutilizável para RH)
  - Erro da API exibido inline no formulário
  - Zod schema atualizado (sem `user`, com `name` + `email`)

### US-HR-TEST-09 — Infraestrutura de testes HR

- [x] `test_employee_views.py` — migrado de `APITestCase` para `TenantTestCase`
  - Classe base `HRTestCase`: `TenantTestCase` + `APIClient` com `force_authenticate`
  - `self.client.defaults['SERVER_NAME']` = domínio do tenant de teste
  - Resolve: tabelas `TENANT_APPS` inexistentes no schema público durante testes
  - `make_user()` — computa `email_hash` explicitamente (compatível com e sem `save()` override)
  - 18/18 testes passando

- [x] Novos testes Sprint 9:
  - `test_create_employee_creates_global_user_automatically` — GlobalUser criado por e-mail
  - `test_create_employee_returns_id` — resposta inclui `id` para redirect
  - `test_create_employee_reuses_existing_global_user` — sem duplicação de GlobalUser
  - `test_create_employee_duplicate_email_returns_400` — e-mail com colaborador ativo bloqueia

---

## Arquivos Modificados

```
backend/core/
├── apps/authentication/models.py        ✅ GlobalUser.save() — computa email_hash
├── apps/hr/serializers.py               ✅ EmployeeCreateSerializer refatorado
└── apps/hr/tests/test_employee_views.py ✅ TenantTestCase + novos testes Sprint 9

packages/types/src/hr.types.ts          ✅ CreateEmployeePayload: name+email
apps/dscar-web/src/app/(app)/rh/
└── colaboradores/novo/page.tsx          ✅ Formulário com nome+email
```

---

## Definição de Pronto (DoD)

- [x] `python -m pytest apps/hr/tests/test_employee_views.py` — 18/18 passando
- [x] `npx tsc --noEmit` — 0 erros (TypeScript strict)
- [x] GlobalUser criado automaticamente ao admitir colaborador
- [x] GlobalUser reutilizado se e-mail já existe
- [x] E-mail duplicado (com colaborador ativo) retorna 400 com campo `email`
- [x] Resposta de criação inclui `id` do Employee
- [x] Formulário frontend sem campo UUID
- [x] Testes HR rodam em schema isolado (TenantTestCase)

## Notas Técnicas

- **Por que `TenantTestCase` + `APIClient` (não `TenantClient`)**: DRF usa apenas `JWTAuthentication` (sem session). `TenantClient.force_login` usa session auth que o DRF ignora. Solução: `APIClient.force_authenticate` (bypass DRF auth) + `defaults['SERVER_NAME']` para que o `TenantMiddleware` roteie ao schema correto.
- **`email_hash` em `save()`**: usa `if not self.email_hash` para não sobrescrever hash já definido (idempotente). Garante compatibilidade com criações legadas via `create_user(..., email_hash=hash)`. Type hints `*args: object` / `**kwargs: object` removidos — Django não tipi­fica esses parâmetros (incompatível com mypy).
- **`get_or_create` vs `update_or_create`**: usa `get_or_create` para não sobrescrever dados de usuários existentes (ex: Keycloak). Apenas `name` é atualizado se divergente, pois é o campo mais sujeito a mudanças de RH.
- **`transaction.atomic()` em `create()`**: envolve `get_or_create` + `Employee.objects.create` em transação atômica para evitar race condition em admissões simultâneas com o mesmo e-mail (unique constraint em `email_hash`).
- **`FormDraft` vs `FormData` (frontend)**: `FormData = z.infer<typeof admissionSchema>` tem `department/position/contract_type` tipados como union types. Como `e.target.value` é sempre `string` e selects precisam de `""` inicial, usamos `FormDraft` (campos de select como `string`) para o estado do formulário. `admissionSchema.safeParse(draft)` retorna `FormData` com tipos corretos no submit — sem `as Type` casts.
- **`z.enum()` no schema Zod**: substitui `z.string().min(1)` para `department`, `position` e `contract_type`. Garante narrowing automático para `HRDepartment`, `HRPosition` e `ContractType` no output do safeParse — elimina casts inseguros no payload.
