# Sprint 9 — Review & Validação

**Projeto:** DS Car ERP — Módulo de RH
**Sprint:** 09
**Data de encerramento:** 2026-04-08
**Status:** Entregue — 18/18 testes passando, 0 erros TypeScript

---

## Resumo Executivo

### Estado antes da Sprint 9

O fluxo de admissão de colaboradores era **inoperável** para o time de RH sem suporte técnico. Para cadastrar um novo colaborador, era necessário:

1. Acessar o painel administrativo do Django (área técnica restrita)
2. Criar manualmente um usuário do sistema (`GlobalUser`)
3. Copiar o código UUID gerado (um identificador com 36 caracteres como `a1b2c3d4-...`)
4. Colar esse código no formulário de admissão

Além disso, havia um bug no backend: o campo `email_hash` (código de segurança derivado do e-mail) não era gerado automaticamente ao criar usuários, causando falha silenciosa ao tentar cadastrar múltiplos colaboradores.

### Estado depois da Sprint 9

O processo de admissão passou a ser **100% self-service pelo RH**:

1. O profissional de RH acessa o sistema e clica em "Admitir colaborador"
2. Preenche nome completo e e-mail corporativo (entre outros dados trabalhistas)
3. Clica em "Admitir colaborador"
4. O sistema cria o acesso automaticamente e redireciona para a ficha do novo colaborador

Não há mais nenhuma etapa técnica manual. O sistema também passou a bloquear duplicidades de e-mail com mensagem de erro clara no próprio formulário.

### Métricas da Sprint

| Indicador | Valor |
|-----------|-------|
| Arquivos modificados | 5 |
| Testes automatizados | 18/18 passando |
| Novos testes (Sprint 9) | 4 |
| Erros TypeScript | 0 |
| Bugs corrigidos | 1 (email_hash) |
| Linhas adicionadas (estimado) | ~120 backend + ~60 frontend |

---

## O que foi Implementado

### 1. Bug Fix: GlobalUser.email_hash automático

**Arquivo:** `backend/core/apps/authentication/models.py`

**Problema:** O modelo `GlobalUser` armazena o e-mail criptografado em banco (por exigência da LGPD), mas para fazer buscas usa um hash SHA-256 do e-mail (`email_hash`). Antes da Sprint 9, esse hash não era calculado automaticamente — precisava ser passado explicitamente em cada criação de usuário. Quando omitido, a criação falhava com erro de constraint de unicidade.

**Solução:** Override do método `save()` do modelo. A cada salvamento, se o e-mail estiver preenchido e o hash ainda não existir, ele é calculado automaticamente:

```python
def save(self, *args, **kwargs) -> None:
    """Computa email_hash automaticamente antes de salvar."""
    if self.email and not self.email_hash:
        self.email_hash = hashlib.sha256(self.email.lower().encode()).hexdigest()
    super().save(*args, **kwargs)
```

A lógica `if not self.email_hash` garante idempotência: usuários já existentes (criados via Keycloak com hash explícito) não têm o hash sobrescrito.

---

### 2. Refatoração: EmployeeCreateSerializer

**Arquivo:** `backend/core/apps/hr/serializers.py` (linhas 157–270)

**Antes (Sprint 8 e anteriores):** O formulário de admissão exigia o campo `user` com o UUID do `GlobalUser` — um identificador técnico que o RH não tinha como obter sem suporte de TI.

**Depois (Sprint 9):** O serializer aceita `name` (nome completo) e `email` (e-mail corporativo) como campos de entrada. O UUID nunca é exposto ao usuário.

Principais mudanças no `EmployeeCreateSerializer`:

- Campos `name` e `email` adicionados como `write_only` (enviados na requisição, nunca retornados)
- Campo `user` removido do input — mantido apenas internamente
- Campo `id` adicionado como `read_only` na resposta (necessário para o frontend redirecionar à ficha do colaborador)
- `validate_email()`: normaliza o e-mail para minúsculas e verifica se já existe um colaborador ativo com aquele e-mail — retorna erro HTTP 400 com campo `email` em caso positivo
- `create()`: busca ou cria o `GlobalUser` pelo hash do e-mail (`get_or_create`), envolto em `transaction.atomic()` para evitar condição de corrida em admissões simultâneas

```python
def create(self, validated_data: dict) -> "Employee":
    name: str = validated_data.pop("name")
    email: str = validated_data.pop("email")
    email_hash = hashlib.sha256(email.encode()).hexdigest()

    with transaction.atomic():
        user, created = GlobalUser.objects.get_or_create(
            email_hash=email_hash,
            defaults={"name": name, "email": email},
        )
        if not created and user.name != name:
            user.name = name
            user.save(update_fields=["name", "updated_at"])

        logger.info(
            "Employee onboarding: GlobalUser %s (%s)",
            user.pk,
            "created" if created else "existing",
        )
        return Employee.objects.create(user=user, **validated_data)
```

**Por que `get_or_create` e não `update_or_create`?** Para não sobrescrever dados de usuários que eventualmente já existam no Keycloak (SSO). Apenas o `name` é atualizado se divergente, pois é o campo mais sujeito a mudanças de cadastro pelo RH.

---

### 3. Correções de Qualidade (pós code review)

Três ajustes aplicados após revisão de código, antes do merge:

**a) Type hints `*args`/`**kwargs` no `GlobalUser.save()`**

O Django não tipifica os parâmetros de `save()`. Anotações como `*args: object` e `**kwargs: object` causavam incompatibilidade com mypy. A assinatura foi mantida sem anotações nesses parâmetros:

```python
def save(self, *args, **kwargs) -> None:
```

**b) Race condition com `transaction.atomic()`**

Sem a transação atômica, dois processos simultâneos tentando admitir colaboradores com o mesmo e-mail poderiam ambos passar pela verificação de duplicidade e tentar criar o mesmo `GlobalUser` — resultando em erro de unique constraint não tratado. O `transaction.atomic()` ao redor de `get_or_create` + `Employee.objects.create` resolve o problema.

**c) `z.enum()` e padrão `FormDraft` no frontend**

No formulário React, campos de seleção (`select`) precisam de `""` como valor inicial para exibir o placeholder "Selecione...". Porém o Zod schema tipifica esses campos como union types (`HRDepartment`, `HRPosition`, `ContractType`) — incompatível com `""`.

Solução adotada:

- `FormDraft`: tipo do estado do formulário, com `department | position | contract_type` como `string` (aceita `""`)
- `FormData = z.infer<typeof admissionSchema>`: tipo do payload validado, com enums corretos
- `z.enum(HR_DEPARTMENTS)` no schema Zod garante o narrowing automático no `safeParse()` — sem necessidade de casts `as HRDepartment`

```typescript
type FormDraft = Omit<FormData, "department" | "position" | "contract_type"> & {
  department: string;
  position: string;
  contract_type: string;
};
```

---

### 4. Testes: TenantTestCase + 4 novos casos

**Arquivo:** `backend/core/apps/hr/tests/test_employee_views.py`

**Migração da infraestrutura de testes:**

A suite anterior usava `APITestCase` (Django padrão), que roda no schema `public` do PostgreSQL. O app `hr` é um `TENANT_APP` — suas tabelas só existem em schemas de tenant. Isso causava erros de "tabela não encontrada" ao rodar os testes fora do Docker.

Solução: migração para `TenantTestCase` (do pacote `django-tenants`), com uma classe base `HRTestCase`:

```python
class HRTestCase(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
```

O `APIClient` com `force_authenticate` é necessário porque o DRF usa apenas `JWTAuthentication` — o `TenantClient.force_login` usa autenticação por sessão, que o DRF ignora.

**Lista completa dos 18 testes:**

| # | Classe | Teste | O que valida |
|---|--------|-------|-------------|
| 1 | `TestEmployeeListView` | `test_list_employees_authenticated` | Listagem retorna 200 e contém o campo `results` |
| 2 | `TestEmployeeListView` | `test_list_unauthenticated_returns_401` | Sem token retorna 401 |
| 3 | `TestEmployeeListView` | `test_filter_by_status` | Filtro `?status=active` retorna apenas ativos |
| 4 | `TestEmployeeListView` | `test_filter_by_department` | Filtro `?department=reception` retorna apenas recepção |
| 5 | `TestEmployeeCreateView` | `test_create_employee_creates_global_user_automatically` | Admissão por e-mail cria o GlobalUser automaticamente |
| 6 | `TestEmployeeCreateView` | `test_create_employee_returns_id` | Resposta de criação inclui o `id` do colaborador para redirect |
| 7 | `TestEmployeeCreateView` | `test_create_employee_reuses_existing_global_user` | GlobalUser já existente é reutilizado — não duplica |
| 8 | `TestEmployeeCreateView` | `test_create_employee_duplicate_email_returns_400` | E-mail com colaborador ativo bloqueia com HTTP 400 |
| 9 | `TestEmployeeCreateView` | `test_create_employee_negative_salary_returns_400` | Salário negativo retorna erro no campo `base_salary` |
| 10 | `TestEmployeeCreateView` | `test_create_employee_duplicate_registration_returns_400` | Matrícula duplicada retorna HTTP 400 |
| 11 | `TestEmployeeRetrieveView` | `test_retrieve_employee` | Detalhe retorna dados corretos e CPF mascarado (LGPD) |
| 12 | `TestEmployeeRetrieveView` | `test_retrieve_nonexistent_returns_404` | UUID inexistente retorna 404 |
| 13 | `TestEmployeeUpdateView` | `test_partial_update_department` | PATCH atualiza o setor e persiste no banco |
| 14 | `TestEmployeeTerminateAction` | `test_terminate_employee` | Ação de desligamento muda status e registra data |
| 15 | `TestEmployeeTerminateAction` | `test_terminate_already_terminated_returns_400` | Desligar colaborador já desligado retorna 400 |
| 16 | `TestSalaryHistoryViews` | `test_list_salary_history` | Histórico salarial retorna 200 |
| 17 | `TestSalaryHistoryViews` | `test_create_salary_history_updates_base_salary` | Reajuste registrado atualiza o salário base do colaborador |
| 18 | `TestSalaryHistoryViews` | `test_create_salary_history_zero_salary_returns_400` | Salário zero retorna erro no campo `new_salary` |

Os testes 5, 6, 7 e 8 são os novos da Sprint 9. Os demais existiam desde a Sprint 5 e foram migrados para `TenantTestCase`.

---

## Guia de Validação Humana

Esta seção descreve como testar manualmente o que foi entregue. Os cenários foram escritos para qualquer pessoa do RH — não é necessário conhecimento técnico.

### Pré-requisitos

- Sistema rodando em `http://localhost:3000`
- Login: qualquer e-mail + senha `paddock123`
- Ter em mãos: nome e e-mail de um colaborador fictício para os testes

---

### Cenário 1 — Admitir novo colaborador (caminho feliz)

Este é o fluxo principal que o RH usará no dia a dia.

**Passo a passo:**

1. Acesse `http://localhost:3000` e faça login
2. No menu lateral, clique em **Recursos Humanos**
3. Clique em **Colaboradores**
4. Clique no botão **Admitir colaborador** (canto superior direito)
5. Você verá o formulário de admissão dividido em seções. Preencha:

   **Seção "Identificação":**
   - Nome completo: `Carlos Eduardo Lima`
   - E-mail corporativo: `carlos.lima@dscar.com.br`

   **Seção "Dados trabalhistas":**
   - Matrícula: `DS099`
   - Setor: `Funilaria`
   - Cargo: `Funileiro`
   - Tipo de contrato: `CLT`
   - Data de admissão: a data de hoje
   - Salário base: `2800`
   - Carga horária semanal: `44`
   - Escala: `6x1`

   As seções "Dados pessoais" e "Endereço" são opcionais — podem ficar em branco neste teste.

6. Clique em **Admitir colaborador**

**O que deve acontecer:**
- O botão muda para "Admitindo..." enquanto processa
- Após 1–2 segundos, o sistema redireciona automaticamente para a ficha do novo colaborador (URL: `/rh/colaboradores/[código]`)
- A ficha exibe o nome "Carlos Eduardo Lima" no topo
- O status aparece como **Ativo**

**Estado esperado da tela após o cadastro:**
- Página da ficha do colaborador aberta
- Abas visíveis: Dados Pessoais, Documentos, Salário, Bonificações, Vales, Descontos
- Na aba "Dados Pessoais", o setor e cargo preenchidos aparecem corretamente

---

### Cenário 2 — Tentar admitir com e-mail duplicado

O sistema deve impedir que o mesmo e-mail seja usado para dois colaboradores ativos ao mesmo tempo.

**Pré-requisito:** O Cenário 1 foi executado (Carlos Lima já está cadastrado com o e-mail `carlos.lima@dscar.com.br`).

**Passo a passo:**

1. Acesse novamente o formulário: **RH > Colaboradores > Admitir colaborador**
2. Preencha os campos mínimos:
   - Nome completo: `Carlos Lima Junior`
   - E-mail corporativo: `carlos.lima@dscar.com.br` _(mesmo e-mail do Cenário 1)_
   - Matrícula: `DS100`
   - Setor: qualquer um
   - Cargo: qualquer um
   - Tipo de contrato: qualquer um
   - Data de admissão: qualquer data
   - Salário base: `2000`
3. Clique em **Admitir colaborador**

**O que deve acontecer:**
- O sistema NÃO redireciona
- Abaixo do campo "E-mail corporativo" aparece a mensagem em vermelho: **"Este e-mail já possui um perfil de colaborador ativo."**
- O formulário permanece aberto com os dados preenchidos para correção

**Estado esperado da tela:**
- Formulário ainda visível
- Campo e-mail com borda vermelha e mensagem de erro abaixo
- Botão "Admitir colaborador" disponível para nova tentativa após corrigir o e-mail

---

### Cenário 3 — Admitir colaborador que já tem acesso ao sistema (reaproveitamento)

Este cenário simula uma situação onde um colaborador já tinha acesso ao sistema (por exemplo, por ter trabalhado em outra empresa do grupo) e está sendo readmitido ou admitido na DS Car.

**Objetivo:** Confirmar que o sistema reutiliza o acesso existente — sem criar um acesso duplicado.

**Como simular:**

Para este teste, precisamos de um colaborador que existia no sistema mas que **não está ativo como colaborador** (apenas tem cadastro de usuário). Em ambiente de desenvolvimento, o próprio login gera esse perfil automaticamente.

1. Faça login no sistema com o e-mail `teste.reaproveitamento@dscar.com.br` e senha `paddock123`
   - Isso cria automaticamente um usuário no sistema com esse e-mail
2. Saia do sistema (logout) e faça login novamente com qualquer outro e-mail (ex: o seu)
3. Acesse **RH > Colaboradores > Admitir colaborador**
4. Preencha:
   - Nome completo: `Teste Reaproveitamento`
   - E-mail corporativo: `teste.reaproveitamento@dscar.com.br` _(mesmo usado no passo 1)_
   - Matrícula: `DS101`
   - Demais campos: preencha à vontade
5. Clique em **Admitir colaborador**

**O que deve acontecer:**
- O sistema admite o colaborador com sucesso (redireciona para a ficha)
- Nos logs do sistema (se acessível), aparece a mensagem "existing" — indicando que o acesso foi reutilizado, não duplicado
- O comportamento externo é idêntico ao Cenário 1

---

### Cenário 4 — Validar campos obrigatórios

O formulário não deve permitir envio com campos obrigatórios em branco.

**Passo a passo:**

1. Acesse **RH > Colaboradores > Admitir colaborador**
2. **Não preencha nada** — deixe todos os campos em branco
3. Clique em **Admitir colaborador**

**O que deve acontecer:**
- O sistema NÃO envia nada ao servidor
- Mensagens de erro aparecem em vermelho abaixo de cada campo obrigatório:
  - Nome completo: "Nome deve ter pelo menos 2 caracteres"
  - E-mail corporativo: "E-mail inválido"
  - Matrícula: "Matrícula obrigatória"
  - Setor: "Setor obrigatório"
  - Cargo: "Cargo obrigatório"
  - Tipo de contrato: "Tipo de contrato obrigatório"
  - Data de admissão: "Data de admissão obrigatória"

4. Preencha apenas o nome com uma letra (ex: `A`) e clique novamente em **Admitir colaborador**

**O que deve acontecer:**
- Erro no campo nome: "Nome deve ter pelo menos 2 caracteres"
- Os demais erros permanecem

5. Preencha um e-mail inválido (ex: `nao-e-email`) e clique em **Admitir colaborador**

**O que deve acontecer:**
- Erro no campo e-mail: "E-mail inválido"

---

### Checklist de Aceitação

Para o gestor ou PO assinar após validar os cenários acima:

- [ ] O RH consegue admitir um colaborador sem precisar de ajuda do setor de TI
- [ ] O acesso ao sistema (login) é criado automaticamente no momento da admissão, sem etapas adicionais
- [ ] O sistema redireciona automaticamente para a ficha do colaborador após a admissão bem-sucedida
- [ ] Não é possível cadastrar dois colaboradores ativos com o mesmo e-mail — o sistema exibe mensagem de erro clara
- [ ] A mensagem de erro de e-mail duplicado aparece no próprio campo, sem sair da página
- [ ] Todos os campos obrigatórios são validados antes do envio — o formulário não aceita dados incompletos
- [ ] Um colaborador que já tinha acesso ao sistema pode ser admitido sem duplicação de cadastro
- [ ] Os dados pessoais (CPF, endereço) são opcionais na admissão e podem ser preenchidos depois na ficha do colaborador

---

## Problemas Conhecidos / Limitações

As seguintes funcionalidades **não foram implementadas** nesta Sprint e estão previstas para Sprint 10 ou posteriores:

1. **Envio de e-mail de boas-vindas:** Após a admissão, o colaborador não recebe nenhuma comunicação automática com suas credenciais de acesso. O envio desse e-mail (com senha provisória ou link de primeiro acesso) está fora do escopo da Sprint 9.

2. **Integração com Keycloak (SSO):** O acesso criado na admissão é um usuário local do sistema. A integração com o Keycloak (autenticação centralizada) é um projeto separado — por enquanto o colaborador usa o login local com senha `paddock123`.

3. **Reativação de colaborador desligado:** O cenário de um colaborador que foi desligado e está sendo readmitido não está coberto. Atualmente, se o e-mail pertence a um colaborador **inativo** (status `terminated`), o sistema **permite** a readmissão (cria um novo registro `Employee`). O comportamento está correto, mas não há fluxo guiado ou confirmação explícita.

4. **Foto de perfil na admissão:** O formulário não possui campo para foto. A foto pode ser adicionada posteriormente na ficha do colaborador — mas essa funcionalidade ainda não existe no frontend.

5. **Preenchimento automático de endereço por CEP:** O campo de CEP existe no formulário, mas não faz a busca automática via API dos Correios. O endereço precisa ser digitado manualmente.

6. **Validação de CPF (dígitos verificadores):** O sistema armazena o CPF informado mas não valida matematicamente se os dígitos são válidos — apenas verifica duplicidade.

---

## Métricas da Sprint

| Indicador | Valor |
|-----------|-------|
| Arquivos modificados | 5 |
| `backend/core/apps/authentication/models.py` | Bug fix `GlobalUser.save()` |
| `backend/core/apps/hr/serializers.py` | Refatoração `EmployeeCreateSerializer` |
| `backend/core/apps/hr/tests/test_employee_views.py` | Migração + 4 novos testes |
| `packages/types/src/hr.types.ts` | `CreateEmployeePayload` + `UpdateEmployeePayload` |
| `apps/dscar-web/src/app/(app)/rh/colaboradores/novo/page.tsx` | Formulário completo |
| Linhas adicionadas (estimado) | ~120 backend + ~60 frontend |
| Testes automatizados | 18/18 passando |
| Novos testes (Sprint 9) | 4 |
| Erros TypeScript (`tsc --noEmit`) | 0 |
| Bugs corrigidos | 1 (`email_hash` não calculado em `GlobalUser.save()`) |
| Histórias de usuário entregues | 3 (US-HR-BE-09, US-HR-FE-09, US-HR-TEST-09) |
