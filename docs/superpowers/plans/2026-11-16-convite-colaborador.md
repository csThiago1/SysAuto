# Convite de colaborador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin gera link de convite individual; a pessoa se cadastra sozinha e vira GlobalUser + Employee (CNH opcional no R2).

**Architecture:** Model `Invite` no app `authentication` (schema public) com hash do token. Views novas em
`apps/authentication/invites.py`. A criação do Employee reaproveita `EmployeeCreateSerializer` (CPF, Person, contatos)
e depois troca a senha (o serializer põe senha = CPF) e o papel. Front: diálogo novo em Configurações → Usuários e
página pública `(auth)/convite/[token]`.

**Tech Stack:** Django 5 + DRF + django-tenants · Next.js 15 + TanStack Query v5 + Zod · pytest (TenantTestCase).

**Spec:** `docs/superpowers/specs/2026-11-16-convite-colaborador-design.md`

## Global Constraints

- Token: `secrets.token_urlsafe(32)`; banco guarda só `sha256(token)`. Validade **7 dias**. Uso único.
- Papéis válidos: `GlobalUser.Role` (`OWNER, ADMIN, MANAGER, CONSULTANT, STOREKEEPER`).
- Employee do convite: `department="administrative"`, `position="administrative"`, `contract_type="clt"`, `hire_date=hoje`, `role=invite.role`.
- Matrícula: `EMP-AAAAMM-NNN` (mesma regra do `RegisterView`).
- CNH: opcional, ≤ **10 MB**, `application/pdf`, `image/jpeg`, `image/png`; `default_storage.save("hr/employees/<employee_id>/cnh/<uuid4><ext>")`; `EmployeeDocument(document_type="cnh")`.
- Senha validada por `django.contrib.auth.password_validation.validate_password`.
- Nada de PII em log (só ids). Sem hard delete. Type hints em tudo; `logger`, nunca `print`.
- Testes de backend: rodar só os arquivos tocados, `docker exec paddock_django timeout 1800 pytest <paths> -q -p no:cacheprovider -o addopts=""`.

## Review Focus

1. Mesmo link enviado duas vezes (duplo clique / dois aparelhos) → só uma conta; segundo envio recebe 410. Teste em Task 2 (`test_accept_twice_returns_410`).
2. E-mail já com conta (ex.: admin) ou CPF já de outro funcionário → 400 com mensagem no campo, convite **não** consumido. Teste em Task 2.
3. Falha ao salvar a CNH no storage → nada criado, convite intacto, 503 com mensagem. Teste em Task 2 (`test_storage_failure_rolls_back`).
4. Convite vencido ou revogado aberto na página → mensagem "convite inválido ou vencido", sem formulário. Teste em Task 2 (GET 410) e estado na Task 5.
5. E-mail com maiúsculas/espaços → login depois funciona (hash em minúsculas). Teste em Task 2 (`test_accept_creates_user_employee_and_login_works`, e-mail `" Novo@Teste.com "`).

---

### Task 1: Model `Invite` + migração + matrícula compartilhada

**Files:**
- Modify: `backend/core/apps/authentication/models.py` (novo model no fim)
- Create: `backend/core/apps/authentication/migrations/0006_invite.py` (via `makemigrations authentication -n invite`)
- Modify: `backend/core/apps/hr/services.py` (função nova)
- Modify: `backend/core/apps/authentication/views.py` (`RegisterView` usa a função nova, remove o bloco inline de matrícula)
- Test: `backend/core/apps/authentication/tests/test_invites.py`

**Interfaces:**
- Produces: `Invite(PaddockBaseModel)` com `token_hash: CharField(64, unique)`, `role: CharField(20, choices=GlobalUser.Role.choices)`,
  `tenant_schema: CharField(63)`, `expires_at: DateTimeField`, `used_at: DateTimeField(null)`, `used_by: FK GlobalUser(null, SET_NULL, related_name="+")`,
  `revoked_at: DateTimeField(null)`; property `is_usable -> bool` (não usado, não revogado, `expires_at > now`);
  classmethod `Invite.issue(role: str, tenant_schema: str, created_by: GlobalUser) -> tuple[Invite, str]` (retorna o token cru);
  classmethod `Invite.find(token: str) -> Invite | None`.
- Produces: `apps.hr.services.next_registration_number() -> str` (usa o schema corrente).

- [ ] **Step 1: testes** em `test_invites.py` (classe `TestInviteModel(TenantTestCase)`):
  `test_issue_stores_only_hash` (token cru ≠ `token_hash`, `Invite.find(token)` devolve o convite, `find("x")` é `None`);
  `test_is_usable_false_when_expired_used_or_revoked` (três casos); e em `apps/hr/tests/test_services_unit.py`
  `test_next_registration_number_sequence` (sem Employee → `EMP-<AAAAMM>-001`; com um `-001` → `-002`).
- [ ] **Step 2:** rodar, ver falhar.
- [ ] **Step 3:** implementar model, `makemigrations`, `next_registration_number`, trocar o bloco do `RegisterView` pela chamada.
- [ ] **Step 4:** rodar os dois arquivos, passar.
- [ ] **Step 5:** commit `feat(auth): model Invite e matrícula compartilhada`.

### Task 2: Endpoints do convite

**Files:**
- Create: `backend/core/apps/authentication/invites.py`
- Modify: `backend/core/apps/authentication/urls.py`
- Test: `backend/core/apps/authentication/tests/test_invites.py` (classe `TestInviteEndpoints(TenantTestCase)`, cliente como em `apps/hr/tests/test_employee_admission.py`: `HTTP_HOST=self.domain.domain`, `force_authenticate(user, token={"role": "ADMIN"})`)

**Interfaces:**
- Consumes: `Invite`, `next_registration_number`, `EmployeeCreateSerializer`, `EmployeeDocument`, `IsAdminOrAbove`, `AuthRateThrottle`.
- Produces (rotas sob `/api/v1/auth/`):
  - `invites/` GET (pendentes: `[{id, role, role_display, expires_at, created_at}]`) · POST `{role}` → 201 `{id, token, role, expires_at}` — `IsAdminOrAbove`.
  - `invites/<uuid:pk>/` DELETE → 204 (marca `revoked_at`) — `IsAdminOrAbove`.
  - `invites/token/<str:token>/` GET → 200 `{role_display, expires_at}` · 410 `{"detail": "Convite inválido ou vencido."}` — `AllowAny`, `AuthRateThrottle`, `authentication_classes=[]`.
  - `invites/token/<str:token>/accept/` POST multipart `{full_name, email, cpf, phone, password, cnh?}` → 201 `{"detail": "Cadastro concluído."}` — mesmas permissões do GET.
- `accept_invite(invite: Invite, data: dict[str, str], cnh: UploadedFile | None) -> GlobalUser` em `invites.py`:
  `select_for_update` no convite dentro de `transaction.atomic()` + `schema_context(invite.tenant_schema)`; 409/410 se não utilizável;
  400 se e-mail (hash em minúsculas, `strip`) já tiver GlobalUser; roda `EmployeeCreateSerializer(data={name, email, phone, cpf,
  department, position, contract_type, hire_date, registration_number})` (erros dele viram 400 com os mesmos campos);
  `user.set_password(password)`, `user.role = invite.role`, `employee.role = invite.role`; salva CNH; marca `used_at/used_by`.
  Falha no `default_storage.save` → `transaction.set_rollback(True)` e 503 `{"detail": "Não foi possível enviar a CNH. Tente de novo ou envie sem ela."}`.

- [ ] **Step 1: testes**
  - `test_create_requires_admin` (token `{"role": "CONSULTANT"}` → 403) e `test_create_and_list_pending` (POST `{"role": "CONSULTANT"}` → 201 com `token`; GET lista 1).
  - `test_revoke_makes_token_410`.
  - `test_get_token_ok_and_expired_410`.
  - `test_accept_creates_user_employee_and_login_works`: e-mail `" Novo@Teste.com "`, CPF válido `"529.982.247-25"`, telefone `"(92) 99999-0000"`, senha `"Oficina#2026x"`, papel `CONSULTANT` →
    201; `GlobalUser` com `role="CONSULTANT"` e `check_password("Oficina#2026x")` e **não** `check_password("52998224725")`;
    `Employee` com `department="administrative"`, `role="CONSULTANT"`, `cpf_hash` = sha256 dos dígitos; `POST /api/v1/auth/login/` com `"novo@teste.com"` → 200.
  - `test_accept_twice_returns_410`.
  - `test_accept_existing_email_400_and_invite_still_usable`; `test_accept_invalid_cpf_400`; `test_accept_weak_password_400` (`"123"`).
  - `test_accept_with_cnh_creates_document` (`SimpleUploadedFile("cnh.pdf", b"%PDF-1.4", "application/pdf")`, storage = `override_settings` com `FileSystemStorage` em tmp) → `EmployeeDocument(document_type="cnh")` com `file_key` começando por `hr/employees/`.
  - `test_cnh_wrong_type_or_too_big_400` (`text/plain`; 10 MB + 1 byte).
  - `test_storage_failure_rolls_back` (`patch("apps.authentication.invites.default_storage.save", side_effect=OSError)`) → 503, nenhum GlobalUser novo, convite `is_usable`.
- [ ] **Step 2:** rodar, ver falhar.
- [ ] **Step 3:** implementar `invites.py` e rotas.
- [ ] **Step 4:** rodar `apps/authentication/tests/test_invites.py apps/hr/tests/test_employee_admission.py`, passar.
- [ ] **Step 5:** commit `feat(auth): convite de colaborador por link de uso único`.

### Task 3: Perfil de funcionário para quem já tem conta

**Files:**
- Create: `backend/core/apps/hr/management/commands/ensure_employee_profiles.py`
- Test: `backend/core/apps/hr/tests/test_ensure_employee_profiles.py`

**Interfaces:**
- Consumes: `next_registration_number`.
- Produces: `manage.py ensure_employee_profiles --schema <tenant_schema>` (default `tenant_dscar`): para cada `GlobalUser(is_active=True)` sem `Employee` naquele schema,
  cria `Employee(user, role=user.role or "CONSULTANT", department="administrative", position="administrative", hire_date=hoje, registration_number=next_registration_number())`;
  imprime só a contagem (`"N perfis criados"`). Idempotente.

- [ ] **Step 1: teste** `test_creates_missing_profiles_once` (2 usuários, 1 já com Employee → cria 1; rodar de novo → 0).
- [ ] **Step 2:** falhar. **Step 3:** implementar. **Step 4:** passar.
- [ ] **Step 5:** commit `feat(hr): comando ensure_employee_profiles`.

### Task 4: Painel — gerar, copiar e revogar convites

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/configuracoes/usuarios/page.tsx`

**Interfaces:**
- Consumes: rotas da Task 2 via `/api/proxy/auth/invites/...`.
- Produces: o Sheet "Convidar Usuario" passa a pedir só o papel; em sucesso mostra o link `${window.location.origin}/convite/${token}`
  com botões **Copiar** (`navigator.clipboard.writeText`, toast "Link copiado") e **Enviar no WhatsApp**
  (`https://wa.me/?text=` + `encodeURIComponent("Seu convite para o sistema da DS Car: <link>")`). Seção "Convites pendentes"
  (papel, vence em) com **Revogar** (AlertDialog). Respostas validadas com Zod; loading com Skeleton; erro e vazio tratados.
  O fluxo antigo `auth/register/` sai da tela (o endpoint fica).

- [ ] **Step 1:** implementar. **Step 2:** `npx tsc --noEmit` e `npm run lint` no app sem erros novos.
- [ ] **Step 3:** conferir no navegador (dev em 3001): gerar convite CONSULTANT, copiar, revogar.
- [ ] **Step 4:** commit `feat(web): convite por link em Configurações → Usuários`.

### Task 5: Página pública `/convite/[token]`

**Files:**
- Create: `apps/dscar-web/src/app/(auth)/convite/[token]/page.tsx` (seguir `(auth)/redefinir-senha/[token]/page.tsx`)
- Modify: `apps/dscar-web/src/middleware.ts` (`/convite` entra em `isAuthPage`)

**Interfaces:**
- Consumes: `GET`/`POST /api/proxy/auth/invites/token/<token>/[accept/]` (sem sessão; o proxy manda o tenant padrão).
- Produces: estados: carregando (Skeleton) · inválido/vencido (410: "Este convite é inválido ou já venceu. Peça um novo ao responsável.") ·
  formulário (Nome completo, E-mail, CPF com máscara `000.000.000-00`, Telefone `(00) 00000-0000`, Senha + Confirmar senha, CNH opcional
  `accept="application/pdf,image/jpeg,image/png"`, aviso "Cópia da CNH para o termo do RH (opcional)") · erros do backend por campo ·
  sucesso → `router.push("/login?convite=ok")`. Envio em `FormData`. Validação Zod no cliente (senhas iguais, ≥ 8, CPF 11 dígitos, arquivo ≤ 10 MB).

- [ ] **Step 1:** implementar. **Step 2:** `npx tsc --noEmit` e lint.
- [ ] **Step 3:** no navegador, deslogado: convite da Task 4 → cadastro com CNH → login com a conta nova; reabrir o link → tela de inválido.
- [ ] **Step 4:** commit `feat(web): página pública de aceite de convite`.

### Task 6: Entrega

- [ ] Push do branch, PR para `main` com resumo e o passo de deploy: `bash infra/oracle/deploy.sh` (migration `authentication.0006`) e depois
  `manage.py ensure_employee_profiles` na Oracle; front sobe sozinho na Vercel ao mergear.
