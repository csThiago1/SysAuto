# Cadastros Consistência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar os fluxos de criação de Cliente, Colaborador e Pessoa para usar a Person API de forma consistente, com validação forte, LGPD consent e contatos obrigatórios (celular + email).

**Architecture:** Deprecar `/customers/` (legado), remover role INSURER de Person (seguradoras são modelo próprio), garantir que Employee crie PersonDocument+PersonContact na admissão, e fortalecer validação em todos os forms de criação com Zod + contatos obrigatórios.

**Tech Stack:** Django 5 + DRF (backend), Next.js 15 + React Hook Form + Zod (frontend), TanStack Query v5

---

## File Structure

### Backend changes
- **Modify:** `backend/core/apps/persons/models.py` — remover `INSURER` de `RolePessoa`
- **Modify:** `backend/core/apps/persons/serializers.py` — remover `INSURER` de choices, adicionar validação contatos obrigatórios
- **Modify:** `backend/core/apps/hr/serializers.py` — Employee criar PersonDocument + PersonContact
- **Delete:** `backend/core/apps/hr/signals.py` — signal duplicado
- **Modify:** `backend/core/apps/hr/apps.py` — remover import de signals

### Frontend changes
- **Modify:** `packages/types/src/person.types.ts` — remover `INSURER` de PersonRole
- **Modify:** `apps/dscar-web/src/app/(app)/service-orders/[id]/_hooks/useCustomerSearch.ts` — remover useCustomerCreate/useCustomerUpdate/useCustomerDetail, migrar CustomerSection para Person API
- **Modify:** `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/shared/CustomerSearch.tsx` — Zod schema, celular+email obrigatórios
- **Modify:** `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/CustomerSection.tsx` — migrar de customer API para person API
- **Modify:** `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx` — remover imports customer legados
- **Modify:** `apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx` — celular+email obrigatórios fora do useFieldArray
- **Modify:** `apps/dscar-web/src/app/(app)/rh/colaboradores/novo/page.tsx` — celular obrigatório + CEP lookup

---

## Task 1: Remover INSURER de PersonRole (backend + types)

**Files:**
- Modify: `backend/core/apps/persons/models.py:20-26`
- Modify: `backend/core/apps/persons/serializers.py:213`
- Modify: `packages/types/src/person.types.ts:6-11`
- Modify: `apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx` (toggle de roles)

- [ ] **Step 1: Remover INSURER do enum backend**

Em `backend/core/apps/persons/models.py`, alterar `RolePessoa`:

```python
class RolePessoa(models.TextChoices):
    CLIENTE = "CLIENT", "Cliente"
    CORRETOR = "BROKER", "Corretor"
    FUNCIONARIO = "EMPLOYEE", "Funcionário"
    FORNECEDOR = "SUPPLIER", "Fornecedor"
```

- [ ] **Step 2: Remover INSURER do serializer choices**

Em `backend/core/apps/persons/serializers.py`, alterar o `PersonCreateUpdateSerializer.roles`:

```python
roles = serializers.ListField(
    child=serializers.ChoiceField(
        choices=["CLIENT", "BROKER", "EMPLOYEE", "SUPPLIER"]
    ),
    write_only=True,
)
```

- [ ] **Step 3: Remover INSURER do type TS**

Em `packages/types/src/person.types.ts`:

```typescript
export type PersonRole =
  | "CLIENT"
  | "BROKER"
  | "EMPLOYEE"
  | "SUPPLIER";
```

- [ ] **Step 4: Remover INSURER do toggle no PersonFormModal**

Em `PersonFormModal.tsx`, remover "INSURER" do array de roles no seletor de toggles. Procurar o array que lista as roles disponíveis e remover a entrada INSURER.

- [ ] **Step 5: Verificar syntax**

```bash
python3 -c "import py_compile; py_compile.compile('backend/core/apps/persons/models.py', doraise=True); print('OK')"
python3 -c "import py_compile; py_compile.compile('backend/core/apps/persons/serializers.py', doraise=True); print('OK')"
```

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/persons/models.py backend/core/apps/persons/serializers.py packages/types/src/person.types.ts apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx
git commit -m "refactor(persons): remove INSURER role — seguradoras são modelo próprio"
```

---

## Task 2: Validação de contatos obrigatórios no backend

**Files:**
- Modify: `backend/core/apps/persons/serializers.py:208-314` (PersonCreateUpdateSerializer)

- [ ] **Step 1: Adicionar validate_contacts no serializer**

Em `PersonCreateUpdateSerializer`, adicionar método `validate`:

```python
def validate(self, attrs: dict) -> dict:
    """Valida que ao menos 1 CELULAR e 1 EMAIL estão presentes nos contatos."""
    contacts = attrs.get("contacts", [])
    roles = attrs.get("roles", [])
    # Exigir contatos obrigatórios apenas quando roles inclui CLIENT ou EMPLOYEE
    if any(r in roles for r in ("CLIENT", "EMPLOYEE")):
        has_celular = any(c.get("contact_type") == "CELULAR" for c in contacts)
        has_email = any(c.get("contact_type") == "EMAIL" for c in contacts)
        errors = {}
        if not has_celular:
            errors["contacts"] = errors.get("contacts", [])
            errors["contacts"].append("Pelo menos um contato do tipo CELULAR é obrigatório.")
        if not has_email:
            errors["contacts"] = errors.get("contacts", [])
            errors["contacts"].append("Pelo menos um contato do tipo EMAIL é obrigatório.")
        if errors:
            raise serializers.ValidationError(errors)
    return attrs
```

- [ ] **Step 2: Verificar syntax**

```bash
python3 -c "import py_compile; py_compile.compile('backend/core/apps/persons/serializers.py', doraise=True); print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/persons/serializers.py
git commit -m "feat(persons): validação obrigatória de celular + email para CLIENT/EMPLOYEE"
```

---

## Task 3: Employee criar PersonDocument e PersonContact na admissão

**Files:**
- Modify: `backend/core/apps/hr/serializers.py:254-288` (EmployeeCreateSerializer.create)

- [ ] **Step 1: Adicionar campo phone ao serializer**

Adicionar field `phone` ao `EmployeeCreateSerializer`:

```python
phone = serializers.CharField(
    max_length=20, write_only=True, required=True,
    help_text="Celular do colaborador (obrigatório)."
)
```

Também adicionar ao `Meta.fields`.

- [ ] **Step 2: Alterar create() para criar PersonDocument e PersonContact**

Reescrever `EmployeeCreateSerializer.create()`:

```python
def create(self, validated_data: dict) -> "Employee":
    from apps.persons.models import PersonContact, PersonDocument
    from apps.persons.utils import sha256_hex

    name: str = validated_data.pop("name")
    email: str = validated_data.pop("email")
    phone: str = validated_data.pop("phone")
    cpf: str = validated_data.pop("cpf", "")
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

        # Buscar Person existente por CPF (evita duplicata)
        person = None
        if cpf:
            from apps.persons.models import PersonDocument as PD
            doc = PD.objects.filter(
                doc_type="CPF", value_hash=sha256_hex(cpf)
            ).select_related("person").first()
            if doc:
                person = doc.person

        if not person:
            person = Person.objects.create(
                person_kind="PF",
                full_name=name,
            )

        # Garantir role EMPLOYEE na Person
        PersonRole.objects.get_or_create(person=person, role="EMPLOYEE")

        # Criar PersonDocument para CPF se fornecido e não existir
        if cpf and not person.documents.filter(doc_type="CPF").exists():
            PersonDocument.objects.create(
                person=person,
                doc_type="CPF",
                value=cpf,
                value_hash=sha256_hex(cpf),
                is_primary=True,
            )

        # Criar PersonContact para celular (obrigatório)
        if not person.contacts.filter(contact_type="CELULAR").exists():
            PersonContact.objects.create(
                person=person,
                contact_type="CELULAR",
                value=phone,
                value_hash=sha256_hex(phone),
                is_primary=True,
            )

        # Criar PersonContact para email
        if not person.contacts.filter(contact_type="EMAIL").exists():
            PersonContact.objects.create(
                person=person,
                contact_type="EMAIL",
                value=email,
                value_hash=sha256_hex(email),
                is_primary=True,
            )

        return Employee.objects.create(user=user, person=person, **validated_data)
```

- [ ] **Step 3: Verificar syntax**

```bash
python3 -c "import py_compile; py_compile.compile('backend/core/apps/hr/serializers.py', doraise=True); print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/hr/serializers.py
git commit -m "feat(hr): admissão cria PersonDocument(CPF) + PersonContact(CELULAR/EMAIL) na Person"
```

---

## Task 4: Remover signal duplicado do HR

**Files:**
- Delete: `backend/core/apps/hr/signals.py`
- Modify: `backend/core/apps/hr/apps.py` — remover import de signals

- [ ] **Step 1: Ler apps.py para verificar como signals é importado**

Ler `backend/core/apps/hr/apps.py` e remover a linha `import .signals` ou `ready()` que conecta o signal.

- [ ] **Step 2: Deletar signals.py**

```bash
rm backend/core/apps/hr/signals.py
```

- [ ] **Step 3: Remover ready() ou import em apps.py**

Remover o método `ready()` que importava signals, ou a linha de import.

- [ ] **Step 4: Verificar syntax**

```bash
python3 -c "import py_compile; py_compile.compile('backend/core/apps/hr/apps.py', doraise=True); print('OK')"
```

- [ ] **Step 5: Commit**

```bash
git add -u backend/core/apps/hr/signals.py backend/core/apps/hr/apps.py
git commit -m "refactor(hr): remove signal duplicado sync_employee_to_person — lógica movida para serializer"
```

---

## Task 5: Deprecar legacy Customer API no frontend

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_hooks/useCustomerSearch.ts`

- [ ] **Step 1: Remover useCustomerCreate, useCustomerDetail, useCustomerUpdate e tipos legados**

Remover do arquivo `useCustomerSearch.ts`:
- Interface `CustomerResult` (linhas 9-14)
- Interface `CustomerDetail` (linhas 16-32)
- Interface `CustomerUpdateInput` (linhas 34-46)
- Interface `SearchResponse` (linhas 48-51)
- `useCustomerSearch()` (linhas 53-63)
- Interface `CustomerCreateInput` (linhas 65-78)
- `useCustomerDetail()` (linhas 80-87)
- `useCustomerCreate()` (linhas 89-107)
- `useCustomerUpdate()` (linhas 281-297)

Manter apenas:
- `PersonResult`, `PersonListItem`, `PersonListResponse`, `PersonSearchResponse`
- `usePersonSearch()`, `usePersonCreate()`, `usePersonDetail()`, `usePersonUpdate()`
- `PersonDetail`, `PersonDetailContact`, `PersonDetailAddress`, `PersonContactPatch`, `PersonAddressPatch`, `PersonPatch`

- [ ] **Step 2: Atualizar CustomerSection para usar Person API**

Em `CustomerSection.tsx`, substituir imports de `useCustomerDetail`/`useCustomerUpdate`/`CustomerDetail`/`CustomerUpdateInput` pelos equivalentes Person:
- `useCustomerDetail(customerId)` → `usePersonDetail(personId)` (já existe no arquivo)
- `useCustomerUpdate(customerId)` → `usePersonUpdate(personId)`
- Ajustar os campos do formulário de edição para usar a estrutura de contacts/addresses do Person em vez dos campos flat do Customer

- [ ] **Step 3: Atualizar ServiceOrderForm.tsx**

Remover imports de `useCustomerUpdate`, `CustomerUpdateInput` e substituir por Person equivalents.

- [ ] **Step 4: Verificar build**

```bash
npx tsc --noEmit --project apps/dscar-web/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/
git commit -m "refactor(os): depreca legacy Customer API — toda criação/edição via Person API"
```

---

## Task 6: Fortalecer validação no CustomerSearch inline (OS)

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/shared/CustomerSearch.tsx`

- [ ] **Step 1: Adicionar Zod schema e campos obrigatórios**

Substituir a validação inline `canCreate` por Zod schema. Adicionar campos celular e email como obrigatórios:

```typescript
import { z } from "zod"
import { isValidCPF } from "@paddock/utils"

const inlineCustomerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().min(10, "Celular deve ter pelo menos 10 dígitos").regex(/^\d{10,11}$/, "Celular inválido"),
  cpf: z.string().refine((v) => !v || isValidCPF(v), "CPF inválido").optional(),
  email: z.string().email("E-mail inválido"),
  birth_date: z.string().optional(),
})
```

- [ ] **Step 2: Atualizar handleCreate para enviar contatos**

Alterar `handleCreate()` para enviar `contacts` e `roles` junto com os dados:

```typescript
async function handleCreate() {
  setCreateError(null)
  const digits = newCpf.trim().replace(/\D/g, "")
  const parsed = inlineCustomerSchema.safeParse({
    name: newName.trim(),
    phone: newPhone.trim().replace(/\D/g, ""),
    cpf: digits || undefined,
    email: newEmail.trim(),
    birth_date: newBirthDate || undefined,
  })
  if (!parsed.success) {
    setCreateError(parsed.error.errors[0]?.message ?? "Dados inválidos")
    return
  }
  try {
    const customer = await createMutation.mutateAsync({
      name: parsed.data.name,
      cpf: parsed.data.cpf,
      phone: parsed.data.phone,
      email: parsed.data.email,
      birth_date: parsed.data.birth_date,
    })
    onChange({ id: customer.id, name: customer.name, phone_masked: customer.phone_masked, cpf_masked: customer.cpf_masked })
    setMode("search")
    setNewName(""); setNewPhone(""); setNewCpf(""); setNewEmail(""); setNewBirthDate("")
  } catch (err) {
    setCreateError(err instanceof Error ? err.message : "Erro ao cadastrar.")
  }
}
```

- [ ] **Step 3: Atualizar usePersonCreate para enviar contacts + roles**

Em `useCustomerSearch.ts`, alterar `usePersonCreate` para incluir `contacts` e `roles` no payload:

```typescript
export function usePersonCreate() {
  const qc = useQueryClient()
  return useMutation<PersonResult, Error, PersonCreateInput>({
    mutationFn: async (data) => {
      const payload: Record<string, unknown> = {
        full_name: data.name,
        person_kind: "PF",
        roles: ["CLIENT"],
        contacts: [
          { contact_type: "CELULAR", value: data.phone, is_primary: true },
          { contact_type: "EMAIL", value: data.email, is_primary: true },
        ],
      }
      if (data.cpf) payload.documents = [{ doc_type: "CPF", value: data.cpf, is_primary: true }]
      const res = await apiFetch<PersonDetailResponse>(`${API}/persons/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      return { id: res.id, name: res.full_name, cpf_masked: null, phone_masked: data.phone?.slice(-4) ? `****${data.phone.slice(-4)}` : null }
    },
    onSuccess: (person) => {
      void qc.invalidateQueries({ queryKey: ["persons-search"] })
      void qc.invalidateQueries({ queryKey: ["persons"] })
      toast.success(`Cliente "${person.name}" cadastrado!`)
    },
    onError: (err) => {
      toast.error(`Erro ao cadastrar cliente: ${err.message}`)
    },
  })
}
```

Atualizar `PersonCreateInput` para incluir `phone` e `email` obrigatórios:

```typescript
interface PersonCreateInput {
  name: string
  phone: string   // obrigatório
  email: string   // obrigatório
  cpf?: string
  birth_date?: string | null
}
```

- [ ] **Step 4: Tornar celular e email obrigatórios no form inline**

Atualizar a condição `canCreate` e os labels dos campos para indicar obrigatoriedade:
- Campo "Celular" com `required` e placeholder "(92) 99999-1234"
- Campo "E-mail" com `required` e placeholder "cliente@email.com"

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/
git commit -m "feat(os): validação Zod + celular/email obrigatórios no cadastro inline de cliente"
```

---

## Task 7: Celular + email obrigatórios no PersonFormModal

**Files:**
- Modify: `apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx`

- [ ] **Step 1: Extrair celular e email primários como campos fixos**

Adicionar dois campos obrigatórios fixos ACIMA do `useFieldArray` de contatos:
- "Celular principal" — sempre visível, obrigatório quando role inclui CLIENT ou EMPLOYEE
- "E-mail principal" — sempre visível, obrigatório quando role inclui CLIENT ou EMPLOYEE

Esses campos devem ser `primary_phone` e `primary_email` no form state, e ser combinados com os contatos adicionais no submit:

```typescript
// No onSubmit, antes de enviar:
const primaryContacts = [
  { contact_type: "CELULAR" as const, value: data.primary_phone, is_primary: true },
  { contact_type: "EMAIL" as const, value: data.primary_email, is_primary: true },
]
const additionalContacts = (data.contacts ?? []).map(c => ({ ...c, is_primary: false }))
payload.contacts = [...primaryContacts, ...additionalContacts]
```

- [ ] **Step 2: Validação condicional**

No form, celular e email são obrigatórios quando `selectedRoles` inclui `CLIENT` ou `EMPLOYEE`. Para `BROKER` e `SUPPLIER` são opcionais.

- [ ] **Step 3: Pré-popular em modo edição**

Quando editando, extrair o contato primário CELULAR e EMAIL da Person e pré-popular os campos fixos. Os contatos restantes vão para o `useFieldArray`.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx
git commit -m "feat(cadastros): celular e email primários obrigatórios no PersonFormModal"
```

---

## Task 8: Celular obrigatório + CEP lookup na admissão de colaborador

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/rh/colaboradores/novo/page.tsx`
- Modify: `packages/types/src/hr.types.ts` (adicionar phone ao CreateEmployeePayload)

- [ ] **Step 1: Adicionar campo phone ao schema Zod**

```typescript
const admissionSchema = z.object({
  // ... campos existentes ...
  phone: z.string().min(10, "Celular deve ter pelo menos 10 dígitos"),
  // ... resto ...
})
```

- [ ] **Step 2: Adicionar campo celular ao formulário**

Na seção "Identificação", abaixo do email, adicionar:

```tsx
<div>
  <label className={FORM_LABEL}>Celular *</label>
  <input
    {...register("phone")}
    type="tel"
    placeholder="(92) 99999-1234"
    className={FORM_INPUT}
  />
  {errors.phone && <p className={FORM_ERROR}>{errors.phone.message}</p>}
</div>
```

- [ ] **Step 3: Adicionar CEP lookup**

Importar `useCepLookup` e adicionar handler no campo `address_zip`:

```typescript
import { useCepLookup } from "@/hooks"

// Dentro do componente:
const cepLookup = useCepLookup()

async function handleCepBlur() {
  const cep = getValues("address_zip")?.replace(/\D/g, "")
  if (cep?.length === 8) {
    try {
      const data = await cepLookup.mutateAsync(cep)
      setValue("address_street", data.street)
      setValue("address_neighborhood", data.neighborhood)
      setValue("address_city", data.city)
      setValue("address_state", data.state)
    } catch { /* silencioso — preenchimento manual */ }
  }
}
```

Adicionar `onBlur={handleCepBlur}` no input de CEP.

- [ ] **Step 4: Atualizar CreateEmployeePayload**

Em `packages/types/src/hr.types.ts`, adicionar `phone: string` ao `CreateEmployeePayload`.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/(app)/rh/colaboradores/novo/page.tsx packages/types/src/hr.types.ts
git commit -m "feat(hr): celular obrigatório na admissão + CEP lookup no endereço"
```

---

## Task 9: Verificação final e teste end-to-end

**Files:** Nenhum novo — apenas verificação

- [ ] **Step 1: Verificar TypeScript**

```bash
npx tsc --noEmit --project apps/dscar-web/tsconfig.json 2>&1 | grep -c "error" || echo "0 errors"
```

- [ ] **Step 2: Verificar Python syntax**

```bash
python3 -c "
import py_compile
for f in [
    'backend/core/apps/persons/models.py',
    'backend/core/apps/persons/serializers.py',
    'backend/core/apps/hr/serializers.py',
    'backend/core/apps/hr/apps.py',
]:
    py_compile.compile(f, doraise=True)
print('ALL OK')
"
```

- [ ] **Step 3: Rodar testes fiscais (regressão)**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec -T django python -m pytest apps/fiscal/tests/ --ignore=apps/fiscal/tests/test_tasks.py -v --tb=short 2>&1 | tail -10
```

- [ ] **Step 4: Testar criação de Person via API**

```bash
# POST com celular + email obrigatórios
curl -s -X POST http://localhost:8000/api/v1/persons/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Domain: dscar.localhost" \
  -d '{
    "person_kind": "PF",
    "full_name": "Teste Contatos Obrigatórios",
    "roles": ["CLIENT"],
    "contacts": [
      {"contact_type": "CELULAR", "value": "92999991234", "is_primary": true},
      {"contact_type": "EMAIL", "value": "teste@email.com", "is_primary": true}
    ]
  }' | python3 -m json.tool
```

- [ ] **Step 5: Testar rejeição sem contatos**

```bash
# POST sem contatos — deve retornar 400
curl -s -X POST http://localhost:8000/api/v1/persons/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Domain: dscar.localhost" \
  -d '{
    "person_kind": "PF",
    "full_name": "Teste Sem Contatos",
    "roles": ["CLIENT"]
  }' | python3 -m json.tool
```

- [ ] **Step 6: Commit final**

```bash
git commit --allow-empty -m "test(cadastros): verificação end-to-end da consistência de cadastros"
```
