# OS UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar 3 superfícies do DS Car ERP — Nova OS vira drawer lateral, Aba Abertura vira 2 colunas compactas, CustomerSearch ganha chip pattern — mais campos de endereço separados e campo versão do veículo.

**Architecture:** Backend adiciona 2 migrações (address split + vehicle_version) e atualiza serializers. Frontend atualiza interfaces, schemas Zod, redesenha CustomerSearch/CustomerSection/VehicleSection/EntrySection, cria TypeBar + PrazosSection, refatora OpeningTab para 2 colunas e cria NewOSDrawer (Sheet shadcn).

**Tech Stack:** Django 5 + DRF, Next.js 15 App Router, shadcn/ui Sheet, React Hook Form, Zod, TanStack Query v5, Vitest + @testing-library/react

---

## File Map

### Criar
| Arquivo | Responsabilidade |
|---------|-----------------|
| `backend/core/apps/customers/migrations/0004_address_split.py` | Migration address → 7 campos individuais |
| `backend/core/apps/service_orders/migrations/0013_vehicle_version.py` | Migration campo versão do veículo |
| `apps/dscar-web/src/components/ui/sheet.tsx` | Componente Sheet shadcn (via CLI) |
| `apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx` | Drawer lateral "Nova OS" |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/TypeBar.tsx` | Barra tipo: pill toggle + seletores em 1 linha |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx` | Prazos + entrega (merge de Scheduling + FinalSurvey) |
| `apps/dscar-web/src/app/(app)/service-orders/new/_schemas/new-os.schema.test.ts` | Testes Zod do schema de criação |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_schemas/service-order.schema.test.ts` | Testes Zod do schema de edição |

### Modificar
| Arquivo | O que muda |
|---------|-----------|
| `backend/core/apps/customers/models.py` | Adiciona 7 campos de endereço; `address` vira `@property` |
| `backend/core/apps/customers/serializers.py` | Detail/Create: 7 campos de endereço; remove campo `address` |
| `backend/core/apps/customers/tests.py` | Testes serializer address split |
| `backend/core/apps/service_orders/models.py` | Adiciona `vehicle_version` |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_hooks/useCustomerSearch.ts` | Interface `CustomerDetail` com 7 campos de endereço; `CustomerCreateInput` sem `address` |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_schemas/service-order.schema.ts` | Adiciona `vehicle_version` |
| `apps/dscar-web/src/app/(app)/service-orders/new/_schemas/new-os.schema.ts` | `make`/`model` obrigatórios; adiciona `vehicle_version`; validação CPF/email no form inline |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/shared/CustomerSearch.tsx` | Chip pattern; CPF/email obrigatórios no form inline |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/CustomerSection.tsx` | Chip, 7 campos endereço readonly, sem "Nome na OS" |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/VehicleSection.tsx` | Slot visual 56px, campo versão, `mileage_in` move para EntrySection, inputs `h-8` |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/EntrySection.tsx` | Adiciona `mileage_in` + `scheduling_date`, labels compactos, inputs `h-8` |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/OpeningTab.tsx` | Layout 2 colunas: TypeBar (full width) + grid |
| `apps/dscar-web/src/app/(app)/service-orders/page.tsx` | Botão "Nova OS" abre drawer (substitui Link) |
| `apps/dscar-web/src/app/(app)/service-orders/kanban/page.tsx` | Idem |
| `apps/dscar-web/src/app/(app)/service-orders/new/page.tsx` | Redireciona para `/service-orders` |

### Deletar (sem referências após o redesign)
- `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/OpeningInfoSection.tsx`
- `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrivateSection.tsx`
- `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/SchedulingSection.tsx`
- `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/FinalSurveySection.tsx`
- `apps/dscar-web/src/app/(app)/service-orders/new/_components/NewOSForm.tsx`
- `apps/dscar-web/src/app/(app)/service-orders/new/page.tsx` ← substituída por redirect

---

## Task 1: Setup — Instalar Sheet (shadcn/ui)

**Files:**
- Create: `apps/dscar-web/src/components/ui/sheet.tsx`

- [ ] **Step 1: Instalar Sheet via shadcn CLI**

```bash
cd apps/dscar-web
npx shadcn@latest add sheet --yes
```

- [ ] **Step 2: Verificar que sheet.tsx existe**

```bash
ls apps/dscar-web/src/components/ui/sheet.tsx
```

Expected: arquivo listado (sem erro).

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/components/ui/sheet.tsx
git add apps/dscar-web/components.json
git commit -m "feat(dscar-web): instala Sheet shadcn/ui para drawer Nova OS"
```

---

## Task 2: Backend — UnifiedCustomer address split

**Files:**
- Modify: `backend/core/apps/customers/models.py:36`
- Create: `backend/core/apps/customers/migrations/0004_address_split.py` (auto-generated)

- [ ] **Step 1: Escrever o teste que vai falhar**

Em `backend/core/apps/customers/tests.py`:

```python
"""Testes da app customers."""
import pytest
from django.test import TestCase

from apps.customers.models import UnifiedCustomer


class UnifiedCustomerAddressTest(TestCase):
    """Verifica que os campos de endereço individuais existem e que a
    property `address` computa corretamente."""

    def _make_customer(self, **kwargs) -> UnifiedCustomer:
        defaults = {
            "name": "Test",
            "phone": "92999990000",
            "lgpd_consent_version": "1.0",
        }
        defaults.update(kwargs)
        return UnifiedCustomer(**defaults)

    def test_address_fields_exist(self) -> None:
        c = self._make_customer(
            zip_code="69000-000",
            street="Rua das Flores",
            street_number="100",
            complement="Ap 2",
            neighborhood="Centro",
            city="Manaus",
            state="AM",
        )
        self.assertEqual(c.zip_code, "69000-000")
        self.assertEqual(c.street, "Rua das Flores")
        self.assertEqual(c.street_number, "100")
        self.assertEqual(c.complement, "Ap 2")
        self.assertEqual(c.neighborhood, "Centro")
        self.assertEqual(c.city, "Manaus")
        self.assertEqual(c.state, "AM")

    def test_address_property_computes(self) -> None:
        c = self._make_customer(
            street="Av. Eduardo Ribeiro",
            street_number="520",
            neighborhood="Centro",
        )
        addr = c.address  # type: ignore[attr-defined]
        self.assertIn("Av. Eduardo Ribeiro", addr)
        self.assertIn("520", addr)

    def test_address_property_empty_when_no_street(self) -> None:
        c = self._make_customer()
        self.assertEqual(c.address, "")  # type: ignore[attr-defined]
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd backend/core
python manage.py test apps.customers.tests.UnifiedCustomerAddressTest --verbosity=2
```

Expected: FAIL — `AttributeError: type object 'UnifiedCustomer' has no attribute 'zip_code'`

- [ ] **Step 3: Modificar o modelo**

Em `backend/core/apps/customers/models.py`, substituir a linha 36:
```python
    address = models.CharField(max_length=300, blank=True, default="", verbose_name="Endereço")
```
por:
```python
    # Endereço — campos individuais (migração 0004)
    zip_code = models.CharField(max_length=9, blank=True, default="", verbose_name="CEP")
    street = models.CharField(max_length=200, blank=True, default="", verbose_name="Rua / Av.")
    street_number = models.CharField(max_length=20, blank=True, default="", verbose_name="Número")
    complement = models.CharField(max_length=100, blank=True, default="", verbose_name="Complemento")
    neighborhood = models.CharField(max_length=100, blank=True, default="", verbose_name="Bairro")
    city = models.CharField(max_length=100, blank=True, default="", verbose_name="Cidade")
    state = models.CharField(max_length=2, blank=True, default="", verbose_name="UF")

    @property
    def address(self) -> str:
        """Backward-compat: retorna endereço formatado a partir dos campos individuais."""
        parts = [p for p in [self.street, self.street_number, self.neighborhood] if p]
        return ", ".join(parts) if parts else ""
```

- [ ] **Step 4: Gerar e aplicar a migration**

```bash
cd backend/core
python manage.py makemigrations customers --name=address_split
python manage.py migrate
```

Expected: migration criada em `0004_address_split.py` e aplicada sem erros.

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```bash
python manage.py test apps.customers.tests.UnifiedCustomerAddressTest --verbosity=2
```

Expected: 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/customers/models.py
git add backend/core/apps/customers/migrations/0004_address_split.py
git add backend/core/apps/customers/tests.py
git commit -m "feat(backend): split address em 7 campos no UnifiedCustomer (migração 0004)"
```

---

## Task 3: Backend — ServiceOrder vehicle_version

**Files:**
- Modify: `backend/core/apps/service_orders/models.py`
- Create: `backend/core/apps/service_orders/migrations/0013_vehicle_version.py` (auto-generated)

- [ ] **Step 1: Encontrar o campo correto no modelo**

```bash
grep -n "vehicle_" backend/core/apps/service_orders/models.py | head -20
```

Localizar onde estão os campos do veículo (plate, make, model, year, etc.) para inserir `vehicle_version` logo após `model`.

- [ ] **Step 2: Adicionar o campo no modelo**

Após o campo `model` (normalmente seguido de `year`), adicionar:

```python
    vehicle_version = models.CharField(
        max_length=50, blank=True, default="", verbose_name="Versão"
    )
```

- [ ] **Step 3: Gerar e aplicar a migration**

```bash
cd backend/core
python manage.py makemigrations service_orders --name=vehicle_version
python manage.py migrate
```

Expected: `0013_vehicle_version.py` criada e aplicada.

- [ ] **Step 4: Atualizar o serializer de ServiceOrder para expor vehicle_version**

Localizar `backend/core/apps/service_orders/serializers.py` e nos serializers de criação e update (normalmente `ServiceOrderCreateSerializer` e `ServiceOrderSerializer`), adicionar `"vehicle_version"` à lista `fields`. Exemplo:

```python
# Em qualquer serializer que já tem "make" e "model" nos fields:
fields = [
    # ... campos existentes ...
    "make",
    "model",
    "vehicle_version",   # ← adicionar aqui
    "year",
    # ...
]
```

- [ ] **Step 5: Verificar que manage.py check passa**

```bash
cd backend/core
python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/service_orders/models.py
git add backend/core/apps/service_orders/migrations/0013_vehicle_version.py
git add backend/core/apps/service_orders/serializers.py
git commit -m "feat(backend): adiciona campo vehicle_version em ServiceOrder — model, migration e serializer"
```

---

## Task 4: Backend — Atualizar serializers de customers

**Files:**
- Modify: `backend/core/apps/customers/serializers.py`
- Modify: `backend/core/apps/customers/tests.py`

- [ ] **Step 1: Escrever os testes que vão falhar**

Adicionar ao final de `backend/core/apps/customers/tests.py`:

```python
from apps.customers.serializers import (
    UnifiedCustomerDetailSerializer,
    UnifiedCustomerCreateSerializer,
)


class UnifiedCustomerDetailSerializerTest(TestCase):
    """Verifica que o serializer detail expõe os 7 campos de endereço."""

    def test_address_fields_in_detail_serializer(self) -> None:
        c = UnifiedCustomer(
            name="Ana",
            phone="92999990001",
            zip_code="69000-000",
            street="Rua A",
            street_number="1",
            complement="",
            neighborhood="Centro",
            city="Manaus",
            state="AM",
        )
        data = UnifiedCustomerDetailSerializer(c).data
        for field in ["zip_code", "street", "street_number", "complement",
                      "neighborhood", "city", "state"]:
            self.assertIn(field, data)
        # 'address' não deve mais ser um campo direto no serializer
        self.assertNotIn("address", data)

    def test_address_fields_are_blank_by_default(self) -> None:
        c = UnifiedCustomer(name="Bob", phone="92999990002")
        data = UnifiedCustomerDetailSerializer(c).data
        self.assertEqual(data["zip_code"], "")
        self.assertEqual(data["street"], "")
        self.assertEqual(data["state"], "")


class UnifiedCustomerCreateSerializerTest(TestCase):
    """Verifica que o serializer de criação aceita os 7 campos de endereço."""

    def test_create_with_address_fields(self) -> None:
        payload = {
            "name": "Carlos",
            "phone": "92988880001",
            "lgpd_consent": True,
            "zip_code": "69010-050",
            "street": "Av. Getúlio Vargas",
            "street_number": "100",
            "city": "Manaus",
            "state": "AM",
        }
        s = UnifiedCustomerCreateSerializer(data=payload)
        self.assertTrue(s.is_valid(), s.errors)

    def test_create_without_address_fields_is_valid(self) -> None:
        payload = {
            "name": "Daniela",
            "phone": "92977770001",
            "lgpd_consent": True,
        }
        s = UnifiedCustomerCreateSerializer(data=payload)
        self.assertTrue(s.is_valid(), s.errors)
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
cd backend/core
python manage.py test apps.customers.tests.UnifiedCustomerDetailSerializerTest apps.customers.tests.UnifiedCustomerCreateSerializerTest --verbosity=2
```

Expected: FAIL — campos de endereço não expostos.

- [ ] **Step 3: Atualizar UnifiedCustomerDetailSerializer**

Em `backend/core/apps/customers/serializers.py`, na classe `UnifiedCustomerDetailSerializer`, substituir o campo `"address"` nos fields por:

```python
    class Meta:
        model = UnifiedCustomer
        fields = [
            "id",
            "name",
            "cpf_masked",
            "email",
            "phone_masked",
            "birth_date",
            "zip_code",
            "street",
            "street_number",
            "complement",
            "neighborhood",
            "city",
            "state",
            "lgpd_consent_version",
            "lgpd_consent_date",
            "lgpd_consent_ip",
            "group_sharing_consent",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
```

- [ ] **Step 4: Atualizar UnifiedCustomerCreateSerializer**

Na classe `UnifiedCustomerCreateSerializer`, substituir `"address"` nos fields e adicionar os novos campos opcionais:

```python
    class Meta:
        model = UnifiedCustomer
        fields = [
            "name", "cpf", "phone", "email", "birth_date",
            "zip_code", "street", "street_number", "complement",
            "neighborhood", "city", "state",
            "lgpd_consent",
        ]
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

```bash
cd backend/core
python manage.py test apps.customers.tests --verbosity=2
```

Expected: 5 tests passing.

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/customers/serializers.py backend/core/apps/customers/tests.py
git commit -m "feat(backend): serializers de customer com 7 campos de endereço individuais"
```

---

## Task 5: Frontend — Atualizar interfaces em useCustomerSearch.ts

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_hooks/useCustomerSearch.ts`

- [ ] **Step 1: Atualizar a interface `CustomerDetail`**

Substituir a definição atual de `CustomerDetail` (linhas 16-24) por:

```typescript
export interface CustomerDetail {
  id: string
  name: string
  cpf_masked: string | null
  phone_masked: string | null
  email: string | null
  birth_date: string | null
  // Endereço — campos individuais (migração 0004)
  zip_code: string
  street: string
  street_number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}
```

- [ ] **Step 2: Atualizar a interface `CustomerCreateInput`**

Substituir a definição atual de `CustomerCreateInput` (linhas 43-50) por:

```typescript
interface CustomerCreateInput {
  name: string
  phone?: string
  cpf?: string
  email?: string
  birth_date?: string
  zip_code?: string
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}
```

- [ ] **Step 3: Verificar que o TypeScript não tem erros**

```bash
cd apps/dscar-web
npx tsc --noEmit 2>&1 | grep useCustomerSearch
```

Expected: sem linhas de erro.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/[id]/_hooks/useCustomerSearch.ts
git commit -m "feat(dscar-web): CustomerDetail com 7 campos de endereço individuais"
```

---

## Task 6: Frontend — Atualizar schemas Zod

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_schemas/service-order.schema.ts`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/new/_schemas/new-os.schema.ts`
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_schemas/service-order.schema.test.ts`
- Create: `apps/dscar-web/src/app/(app)/service-orders/new/_schemas/new-os.schema.test.ts`

- [ ] **Step 1: Escrever o teste do service-order.schema que vai falhar**

Criar `apps/dscar-web/src/app/(app)/service-orders/[id]/_schemas/service-order.schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { serviceOrderUpdateSchema } from "./service-order.schema"

describe("serviceOrderUpdateSchema", () => {
  it("aceita vehicle_version", () => {
    const result = serviceOrderUpdateSchema.safeParse({
      vehicle_version: "EX 2.0",
    })
    expect(result.success).toBe(true)
  })

  it("vehicle_version é opcional — parse sem ele funciona", () => {
    const result = serviceOrderUpdateSchema.safeParse({
      plate: "ABC1D23",
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/dscar-web
npx vitest run src/app/\(app\)/service-orders/\[id\]/_schemas/service-order.schema.test.ts
```

Expected: FAIL — `vehicle_version` não existe no schema.

- [ ] **Step 3: Atualizar service-order.schema.ts**

Adicionar `vehicle_version` após `model` na seção "Cliente e veículo":

```typescript
  model: z.string().optional().default(""),
  vehicle_version: z.string().optional().default(""),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
```

- [ ] **Step 4: Rodar o teste do service-order.schema e confirmar que passa**

```bash
cd apps/dscar-web
npx vitest run src/app/\(app\)/service-orders/\[id\]/_schemas/service-order.schema.test.ts
```

Expected: 2 tests passing.

- [ ] **Step 5: Escrever o teste do new-os.schema que vai falhar**

Criar `apps/dscar-web/src/app/(app)/service-orders/new/_schemas/new-os.schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { newOSSchema } from "./new-os.schema"

const baseValid = {
  customer_type: "private" as const,
  customer: "550e8400-e29b-41d4-a716-446655440000",
  customer_name: "João",
  plate: "ABC1D23",
  make: "Honda",
  model: "Civic",
}

describe("newOSSchema", () => {
  it("aceita vehicle_version opcional", () => {
    const r = newOSSchema.safeParse({ ...baseValid, vehicle_version: "EX" })
    expect(r.success).toBe(true)
  })

  it("rejeita make vazio", () => {
    const r = newOSSchema.safeParse({ ...baseValid, make: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0])
      expect(paths).toContain("make")
    }
  })

  it("rejeita model vazio", () => {
    const r = newOSSchema.safeParse({ ...baseValid, model: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0])
      expect(paths).toContain("model")
    }
  })

  it("rejeita plate com menos de 7 chars", () => {
    const r = newOSSchema.safeParse({ ...baseValid, plate: "ABC123" })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 6: Rodar o teste do new-os.schema e confirmar que falha**

```bash
cd apps/dscar-web
npx vitest run src/app/\(app\)/service-orders/new/_schemas/new-os.schema.test.ts
```

Expected: FAILs nos testes de `make` e `model` (atualmente são opcionais, portanto `""` passa).

- [ ] **Step 7: Atualizar new-os.schema.ts**

Substituir o schema completo por:

```typescript
import { z } from "zod"

export const newOSSchema = z
  .object({
    customer_type: z.enum(["insurer", "private"], {
      required_error: "Selecione o tipo de atendimento",
    }),
    os_type: z
      .enum(["bodywork", "warranty", "rework", "mechanical", "aesthetic"])
      .optional()
      .nullable(),

    // Seguradora (obrigatório só quando customer_type === "insurer")
    insurer: z.string().uuid().optional().nullable(),
    insured_type: z.enum(["insured", "third"]).optional().nullable(),

    // Cliente
    customer: z.string().uuid().optional().nullable(),
    customer_name: z.string().min(1, "Selecione ou cadastre um cliente"),

    // Veículo
    plate: z
      .string()
      .min(7, "Placa inválida — mínimo 7 caracteres")
      .max(8, "Placa inválida — máximo 8 caracteres")
      .regex(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/, "Formato de placa inválido"),
    make: z.string().min(1, "Montadora é obrigatória"),
    model: z.string().min(1, "Modelo é obrigatório"),
    vehicle_version: z.string().optional().default(""),
    year: z.preprocess(
      (v) => (v === "" || v === null || (typeof v === "number" && isNaN(v)) ? undefined : v),
      z.number().int().min(1900).max(2100).optional().nullable()
    ),
    color: z.string().optional().default(""),
    fuel_type: z.string().optional().default(""),
    chassis: z.string().max(17).optional().default(""),
  })
  .refine(
    (data) => {
      if (data.customer_type === "insurer") {
        return !!data.insurer && !!data.insured_type
      }
      return true
    },
    {
      message: "Seguradora e tipo de segurado são obrigatórios",
      path: ["insurer"],
    }
  )

export type NewOSInput = z.infer<typeof newOSSchema>
```

- [ ] **Step 8: Rodar todos os testes de schema e confirmar que passam**

```bash
cd apps/dscar-web
npx vitest run src/app/\(app\)/service-orders/new/_schemas/new-os.schema.test.ts
npx vitest run src/app/\(app\)/service-orders/\[id\]/_schemas/service-order.schema.test.ts
```

Expected: 4 + 2 = 6 tests passing.

- [ ] **Step 9: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_schemas/
git add apps/dscar-web/src/app/\(app\)/service-orders/new/_schemas/
git commit -m "feat(dscar-web): schemas Zod — vehicle_version + make/model obrigatórios na criação"
```

---

## Task 7: Frontend — CustomerSearch chip redesign

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/shared/CustomerSearch.tsx`

O redesign tem 3 modos:
1. **search** — input + botão "+ Novo"
2. **selected** (chip) — chip verde com nome + ✕ + "ou buscar outro"
3. **create** — form inline com CPF/email/telefone obrigatórios

- [ ] **Step 1: Reescrever CustomerSearch.tsx**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Search, UserPlus, X, CheckCircle2 } from "lucide-react"
import { useCustomerSearch, useCustomerCreate } from "../../_hooks/useCustomerSearch"
import { useDebounce } from "@/hooks/useDebounce"

export interface SelectedCustomer {
  id: string
  name: string
  phone_masked?: string | null
  cpf_masked?: string | null
}

interface CustomerSearchProps {
  value: SelectedCustomer | null
  onChange: (customer: SelectedCustomer | null) => void
  disabled?: boolean
}

const INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

export function CustomerSearch({ value, onChange, disabled }: CustomerSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"search" | "create">("search")
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newCpf, setNewCpf] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newBirthDate, setNewBirthDate] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedQuery = useDebounce(query, 350)
  const { data, isFetching, isError } = useCustomerSearch(debouncedQuery)
  const createMutation = useCustomerCreate()
  const results = data?.results ?? []

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  function openCreateForm(prefill = "") {
    setMode("create")
    setNewName(prefill)
    setNewPhone("")
    setNewCpf("")
    setNewEmail("")
    setNewBirthDate("")
    setCreateError(null)
    setOpen(false)
  }

  function handleSelect(c: SelectedCustomer) {
    onChange(c)
    setQuery("")
    setOpen(false)
    setMode("search")
  }

  function handleClear() {
    onChange(null)
    setQuery("")
    setMode("search")
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleBuscarOutro() {
    onChange(null)
    setQuery("")
    setMode("search")
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleCreate() {
    setCreateError(null)
    try {
      const customer = await createMutation.mutateAsync({
        name: newName.trim(),
        cpf: newCpf.trim().replace(/\D/g, "") || undefined,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        birth_date: newBirthDate || undefined,
      })
      onChange({
        id: customer.id,
        name: customer.name,
        phone_masked: customer.phone_masked,
        cpf_masked: customer.cpf_masked,
      })
      setMode("search")
      setNewName(""); setNewPhone(""); setNewCpf(""); setNewEmail(""); setNewBirthDate("")
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao cadastrar.")
    }
  }

  const canCreate =
    newName.trim().length > 0 &&
    newCpf.replace(/\D/g, "").length === 11 &&
    newPhone.trim().length >= 10 &&
    newEmail.trim().includes("@")

  // ── Modo: chip (selecionado) ─────────────────────────────────────
  if (value) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2.5 py-1 text-[12px] font-medium text-green-800">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>{value.name}</span>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="ml-1 rounded-full p-0.5 text-green-600 hover:text-green-900 hover:bg-green-100"
              title="Remover cliente"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleBuscarOutro}
            className="text-[11px] text-neutral-400 hover:text-neutral-600 underline"
          >
            ou buscar outro
          </button>
        )}
      </div>
    )
  }

  // ── Modo: criar novo cliente ─────────────────────────────────────
  if (mode === "create") {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
            <UserPlus className="h-3 w-3" />
            Novo cliente
          </span>
          <button
            type="button"
            onClick={() => setMode("search")}
            className="text-[11px] text-neutral-400 hover:text-neutral-600"
          >
            ← Voltar
          </button>
        </div>

        {/* Nome */}
        <input
          type="text"
          placeholder="Nome completo *"
          autoFocus
          className={INPUT}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        {/* CPF + Telefone */}
        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="text"
            placeholder="CPF * (11 dígitos)"
            className={INPUT}
            value={newCpf}
            onChange={(e) => setNewCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
          />
          <input
            type="tel"
            placeholder="Telefone *"
            className={INPUT}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
        </div>

        {/* Email */}
        <input
          type="email"
          placeholder="E-mail *"
          className={INPUT}
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />

        {/* Nascimento (opcional) */}
        <input
          type="date"
          className={INPUT}
          value={newBirthDate}
          onChange={(e) => setNewBirthDate(e.target.value)}
          title="Data de nascimento (opcional)"
        />

        {createError && (
          <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
            {createError}
          </p>
        )}

        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setMode("search")}
            className="rounded border border-neutral-300 px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate || createMutation.isPending}
            className="flex items-center gap-1 rounded bg-[#ea0e03] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            {createMutation.isPending ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </div>
    )
  }

  // ── Modo: busca ──────────────────────────────────────────────────
  const showDropdown = open && debouncedQuery.length >= 3
  const showEmpty = showDropdown && !isFetching && !isError && results.length === 0
  const showResults = showDropdown && results.length > 0

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar por nome, CPF ou telefone..."
            className={`${INPUT} pl-8`}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => { if (query.length >= 3) setOpen(true) }}
            disabled={disabled}
            autoComplete="off"
          />
          {isFetching && (
            <Loader2 className="absolute right-2.5 top-2 h-3.5 w-3.5 animate-spin text-neutral-400" />
          )}
        </div>
        <button
          type="button"
          onClick={() => openCreateForm(query)}
          className="shrink-0 flex items-center gap-1 rounded border border-dashed border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 h-8"
        >
          <UserPlus className="h-3 w-3" />
          Novo
        </button>
      </div>

      {showResults && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg overflow-hidden">
          <ul>
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-neutral-50 transition-colors"
                  onClick={() =>
                    handleSelect({
                      id: c.id,
                      name: c.name,
                      phone_masked: c.phone_masked,
                      cpf_masked: c.cpf_masked,
                    })
                  }
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{c.name}</p>
                    {(c.cpf_masked || c.phone_masked) && (
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {[c.cpf_masked, c.phone_masked].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => openCreateForm(query)}
            className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-xs font-medium text-[#ea0e03] hover:bg-red-50 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Cadastrar novo cliente
          </button>
        </div>
      )}

      {showEmpty && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="px-3 py-2 text-center">
            <p className="text-sm text-neutral-500">Nenhum cliente encontrado.</p>
          </div>
          <button
            type="button"
            onClick={() => openCreateForm(query)}
            className="flex w-full items-center justify-center gap-2 border-t border-neutral-100 px-3 py-2 text-sm font-medium text-[#ea0e03] hover:bg-red-50 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Cadastrar &quot;{query}&quot;
          </button>
        </div>
      )}

      {showDropdown && isError && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 shadow-lg">
          <p className="text-xs text-red-600">Erro ao buscar. Tente novamente.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/dscar-web
npx tsc --noEmit 2>&1 | grep CustomerSearch
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/shared/CustomerSearch.tsx
git commit -m "feat(dscar-web): CustomerSearch com chip pattern e CPF/email obrigatórios no form inline"
```

---

## Task 8: Frontend — CustomerSection redesign

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/CustomerSection.tsx`

Mudanças:
- Remove campo "Nome na OS" (editable)
- `customer_name` é populado via `setValue` no `onChange` do CustomerSearch (não visível)
- Remove `quotation_date` (vai para TypeBar)
- Mostra 7 campos de endereço readonly quando cliente selecionado
- Mantém CPF, telefone, email, nascimento readonly

- [ ] **Step 1: Reescrever CustomerSection.tsx**

```tsx
"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { CustomerSearch } from "../shared/CustomerSearch"
import { useCustomerDetail } from "../../_hooks/useCustomerSearch"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT_DISPLAY =
  "flex h-8 w-full rounded-md border border-neutral-100 bg-neutral-50 px-2.5 py-1 text-sm text-neutral-600 cursor-default select-all"

interface CustomerSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function CustomerSection({ form }: CustomerSectionProps) {
  const { control, setValue, watch } = form
  const customerId = watch("customer")

  const { data: detail } = useCustomerDetail(customerId ?? null)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={SECTION_TITLE}>Dados do Cliente</span>
      </div>

      {/* Busca / chip */}
      <Controller
        name="customer"
        control={control}
        render={({ field }) => (
          <CustomerSearch
            value={
              field.value
                ? {
                    id: field.value,
                    name: watch("customer_name") ?? "",
                    phone_masked: detail?.phone_masked ?? null,
                    cpf_masked: detail?.cpf_masked ?? null,
                  }
                : null
            }
            onChange={(customer) => {
              field.onChange(customer?.id ?? null)
              setValue("customer_name", customer?.name ?? "")
            }}
          />
        )}
      />

      {/* Campos do cliente — visíveis apenas quando selecionado */}
      {customerId && detail && (
        <>
          {/* Linha 1: CPF | Telefone | Nascimento | Email */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className={LABEL}>CPF</label>
              <input className={INPUT_DISPLAY} readOnly value={detail.cpf_masked ?? ""} placeholder="—" />
            </div>
            <div>
              <label className={LABEL}>Telefone</label>
              <input className={INPUT_DISPLAY} readOnly value={detail.phone_masked ?? ""} placeholder="—" />
            </div>
            <div>
              <label className={LABEL}>Nascimento</label>
              <input
                className={INPUT_DISPLAY}
                readOnly
                value={
                  detail.birth_date
                    ? new Date(detail.birth_date + "T00:00:00").toLocaleDateString("pt-BR")
                    : ""
                }
                placeholder="—"
              />
            </div>
            <div>
              <label className={LABEL}>E-mail</label>
              <input className={INPUT_DISPLAY} readOnly value={detail.email ?? ""} placeholder="—" />
            </div>
          </div>

          {/* Endereço — 7 campos */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-[72px_1fr_52px] gap-2">
              <div>
                <label className={LABEL}>CEP</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.zip_code} placeholder="—" />
              </div>
              <div>
                <label className={LABEL}>Rua / Av.</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.street} placeholder="—" />
              </div>
              <div>
                <label className={LABEL}>Nº</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.street_number} placeholder="—" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>Complemento</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.complement} placeholder="—" />
              </div>
              <div>
                <label className={LABEL}>Bairro</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.neighborhood} placeholder="—" />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_44px] gap-2">
              <div>
                <label className={LABEL}>Cidade</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.city} placeholder="—" />
              </div>
              <div>
                <label className={LABEL}>UF</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.state} placeholder="—" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/dscar-web
npx tsc --noEmit 2>&1 | grep CustomerSection
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/CustomerSection.tsx
git commit -m "feat(dscar-web): CustomerSection com chip, 7 campos endereço, sem 'Nome na OS'"
```

---

## Task 9: Frontend — VehicleSection + EntrySection update

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/VehicleSection.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/EntrySection.tsx`

### VehicleSection: slot visual + versão + h-8 + remove mileage_in

- [ ] **Step 1: Reescrever VehicleSection.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { usePlateLookup } from "../../_hooks/useVehicleCatalog"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { ColorSelect } from "../shared/ColorSelect"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface VehicleSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function VehicleSection({ form }: VehicleSectionProps) {
  const { register, control, setValue, watch, formState: { errors } } = form
  const [plateQuery, setPlateQuery] = useState("")
  const { data: plateData, isFetching, error } = usePlateLookup(plateQuery)

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    setValue("plate", v)
    if (v.length >= 7) setPlateQuery(v)
  }

  useEffect(() => {
    if (!plateData || !plateQuery || isFetching) return
    const currentMake = watch("make")
    if (!currentMake && plateData.make) {
      setValue("make", plateData.make)
      setValue("model", plateData.model)
      if (plateData.year) setValue("year", plateData.year)
      if (plateData.chassis) setValue("chassis", plateData.chassis)
      toast.success("Dados do veículo preenchidos pela placa!")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateData, isFetching])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={SECTION_TITLE}>Dados do Veículo</span>
      </div>

      {/* Header: slot visual + placa destaque */}
      <div className="flex items-start gap-3">
        {/* Slot visual 56×56px — futuro: logo da montadora */}
        <div className="h-14 w-14 shrink-0 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 flex items-center justify-center">
          <span className="text-2xl">🚗</span>
        </div>

        {/* Placa destaque */}
        <div className="flex-1">
          <label className={LABEL}>Placa *</label>
          <div className="flex items-center gap-2">
            <input
              className="flex h-9 w-32 rounded-md border-2 border-input bg-background px-3 py-1 text-base font-bold font-mono tracking-widest shadow-sm focus:outline-none focus:ring-1 focus:ring-ring uppercase"
              type="text"
              placeholder="ABC1D23"
              maxLength={8}
              {...register("plate")}
              onChange={handlePlateChange}
            />
            {isFetching && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#ea0e03]" />
            )}
          </div>
          {errors.plate && (
            <p className="mt-0.5 text-[10px] text-red-600">{errors.plate.message}</p>
          )}
          {error && (
            <p className="mt-0.5 text-[10px] text-amber-600">Placa não encontrada — preencha manualmente</p>
          )}
        </div>
      </div>

      {/* Grid campos */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={LABEL}>Montadora</label>
          <input className={INPUT} type="text" placeholder="Honda" {...register("make")} />
        </div>
        <div>
          <label className={LABEL}>Modelo</label>
          <input className={INPUT} type="text" placeholder="Civic" {...register("model")} />
        </div>
        <div>
          <label className={LABEL}>Versão</label>
          <input className={INPUT} type="text" placeholder="EX 2.0" {...register("vehicle_version")} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={LABEL}>Ano</label>
          <input
            className={INPUT}
            type="number"
            min={1900}
            max={2100}
            placeholder="2024"
            {...register("year", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className={LABEL}>Cor</label>
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <ColorSelect value={field.value ?? ""} onChange={field.onChange} />
            )}
          />
        </div>
        <div>
          <label className={LABEL}>Combustível</label>
          <input className={INPUT} type="text" placeholder="Flex" {...register("fuel_type")} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-2">
        <div>
          <label className={LABEL}>Chassi</label>
          <input className={INPUT} type="text" maxLength={17} placeholder="17 caracteres" {...register("chassis")} />
        </div>
        <div>
          <label className={LABEL}>FIPE (R$)</label>
          <input
            className={INPUT}
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            {...register("fipe_value", { valueAsNumber: true })}
          />
        </div>
      </div>
    </div>
  )
}
```

### EntrySection: adiciona mileage_in + scheduling_date, inputs h-8

- [ ] **Step 2: Reescrever EntrySection.tsx**

```tsx
"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { DateTimeNow } from "../shared/DateTimeNow"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const SELECT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
const INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface EntrySectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function EntrySection({ form }: EntrySectionProps) {
  const { register, control } = form

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={SECTION_TITLE}>Entrada</span>
      </div>

      {/* Linha 1: Data | KM | Local */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={LABEL}>Data / hora entrada</label>
          <Controller
            name="entry_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
              />
            )}
          />
          <p className="mt-0.5 text-[9px] text-amber-600">Preencher muda status</p>
        </div>
        <div>
          <label className={LABEL}>KM entrada</label>
          <input
            className={INPUT}
            type="number"
            min="0"
            placeholder="0"
            {...register("mileage_in", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className={LABEL}>Localização</label>
          <select className={SELECT} {...register("vehicle_location")}>
            <option value="workshop">Na Oficina</option>
            <option value="in_transit">Em Trânsito</option>
          </select>
        </div>
      </div>

      {/* Linha 2: Autorização | Agendamento */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Autorização do serviço</label>
          <Controller
            name="service_authorization_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
              />
            )}
          />
        </div>
        <div>
          <label className={LABEL}>Agendamento</label>
          <Controller
            name="scheduling_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
              />
            )}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd apps/dscar-web
npx tsc --noEmit 2>&1 | grep -E "VehicleSection|EntrySection"
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/VehicleSection.tsx
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/EntrySection.tsx
git commit -m "feat(dscar-web): VehicleSection com slot visual e versão; EntrySection com KM e agendamento"
```

---

## Task 10: Frontend — TypeBar + PrazosSection (novos componentes)

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/TypeBar.tsx`
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx`

### TypeBar

Substitui `OpeningInfoSection` + `PrivateSection`. 1 linha compacta: pill toggle Particular/Seguradora + Tipo OS + Consultor + Data orçamento (condicional).

- [ ] **Step 1: Criar TypeBar.tsx**

```tsx
"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { Loader2 } from "lucide-react"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { useConsultants } from "../../_hooks/useStaff"

const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const SELECT =
  "flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface TypeBarProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  consultantName?: string
}

const OS_TYPES = [
  { value: "bodywork", label: "Chapeação" },
  { value: "warranty", label: "Garantia" },
  { value: "rework", label: "Retrabalho" },
  { value: "mechanical", label: "Mecânica" },
  { value: "aesthetic", label: "Estética" },
] as const

export function TypeBar({ form, consultantName: _consultantName }: TypeBarProps) {
  const { register, control, watch } = form
  const customerType = watch("customer_type")
  const { data: consultants = [], isLoading: loadingConsultants } = useConsultants()

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">

      {/* Pill toggle Particular / Seguradora */}
      <div>
        <label className={LABEL}>Atendimento *</label>
        <Controller
          name="customer_type"
          control={control}
          render={({ field }) => (
            <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
              {(["private", "insurer"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => field.onChange(type)}
                  className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-colors ${
                    field.value === type
                      ? "bg-[#ea0e03] text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {type === "private" ? "Particular" : "Seguradora"}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Tipo OS */}
      <div>
        <label className={LABEL}>Tipo OS</label>
        <select className={SELECT} {...register("os_type")}>
          <option value="">Selecionar...</option>
          {OS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Consultor */}
      <div>
        <label className={LABEL}>
          Consultor
          {loadingConsultants && (
            <Loader2 className="inline ml-1 h-2.5 w-2.5 animate-spin text-neutral-400" />
          )}
        </label>
        <Controller
          name="consultant_id"
          control={control}
          render={({ field }) => (
            <select
              className={SELECT}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value || null)}
              disabled={loadingConsultants}
            >
              <option value="">Selecionar...</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.job_title_display ? ` (${c.job_title_display})` : ""}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Data orçamento — só quando Particular */}
      {customerType === "private" && (
        <div>
          <label className={LABEL}>Data orçamento</label>
          <input
            className={`${SELECT} w-[140px]`}
            type="date"
            {...register("quotation_date")}
          />
        </div>
      )}
    </div>
  )
}
```

### PrazosSection

Substitui `SchedulingSection` + `FinalSurveySection`. Mantém auto-cálculo de `estimated_delivery_date`.

- [ ] **Step 2: Criar PrazosSection.tsx**

```tsx
"use client"

import { useEffect } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { DateTimeNow } from "../shared/DateTimeNow"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface PrazosSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function PrazosSection({ form }: PrazosSectionProps) {
  const { register, control, watch, setValue } = form
  const entryDate = watch("entry_date")
  const repairDays = watch("repair_days")

  // Auto-calcula previsão de entrega
  useEffect(() => {
    if (entryDate && repairDays && repairDays > 0) {
      const entry = new Date(entryDate)
      entry.setDate(entry.getDate() + repairDays)
      const yyyy = entry.getFullYear()
      const mm = String(entry.getMonth() + 1).padStart(2, "0")
      const dd = String(entry.getDate()).padStart(2, "0")
      setValue("estimated_delivery_date", `${yyyy}-${mm}-${dd}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryDate, repairDays, setValue])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={SECTION_TITLE}>Prazos e Entrega</span>
      </div>

      {/* Dias de reparo | Previsão (auto) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Dias de reparo</label>
          <input
            className={INPUT}
            type="number"
            min="1"
            placeholder="Ex: 10"
            {...register("repair_days", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className={LABEL}>Previsão de entrega</label>
          <input
            className={`${INPUT} bg-neutral-50 cursor-default`}
            type="date"
            readOnly
            {...register("estimated_delivery_date")}
          />
          <p className="mt-0.5 text-[9px] text-neutral-400">Entrada + dias de reparo</p>
        </div>
      </div>

      {/* Vistoria final | Entrega ao cliente */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Vistoria final</label>
          <Controller
            name="final_survey_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
              />
            )}
          />
          <p className="mt-0.5 text-[9px] text-amber-600">Muda status → Vistoria Final</p>
        </div>
        <div>
          <label className={LABEL}>Entrega ao cliente</label>
          <Controller
            name="client_delivery_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
              />
            )}
          />
          <p className="mt-0.5 text-[9px] text-amber-600">Muda status → Entregue</p>
        </div>
      </div>

      {/* Entrega real (delivery_date) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Data real de entrega</label>
          <Controller
            name="delivery_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
              />
            )}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd apps/dscar-web
npx tsc --noEmit 2>&1 | grep -E "TypeBar|PrazosSection"
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/TypeBar.tsx
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/PrazosSection.tsx
git commit -m "feat(dscar-web): TypeBar (pill toggle + selects) e PrazosSection (prazos + entregas)"
```

---

## Task 11: Frontend — OpeningTab layout duas colunas

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/OpeningTab.tsx`

Substitui: `OpeningInfoSection`, `PrivateSection`, `SchedulingSection`, `FinalSurveySection`
Adiciona: `TypeBar`, `PrazosSection`
Layout: TypeBar (full width) + `grid-cols-1 lg:grid-cols-2`

- [ ] **Step 1: Reescrever OpeningTab.tsx**

```tsx
"use client"

import { type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { TypeBar } from "../sections/TypeBar"
import { InsurerSection } from "../sections/InsurerSection"
import { CustomerSection } from "../sections/CustomerSection"
import { VehicleSection } from "../sections/VehicleSection"
import { EntrySection } from "../sections/EntrySection"
import { PrazosSection } from "../sections/PrazosSection"

interface OpeningTabProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  consultantName?: string
}

export function OpeningTab({ form, consultantName }: OpeningTabProps) {
  const customerType = form.watch("customer_type")

  return (
    <div className="space-y-3 py-4">
      {/* Barra tipo — full width */}
      <TypeBar form={form} consultantName={consultantName} />

      {/* Duas colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coluna esquerda */}
        <div className="space-y-3">
          <CustomerSection form={form} />
          {customerType === "insurer" && <InsurerSection form={form} />}
          <EntrySection form={form} />
        </div>
        {/* Coluna direita */}
        <div className="space-y-3">
          <VehicleSection form={form} />
          <PrazosSection form={form} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/dscar-web
npx tsc --noEmit 2>&1 | grep OpeningTab
```

Expected: sem erros.

- [ ] **Step 3: Deletar arquivos não mais utilizados**

```bash
rm apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/OpeningInfoSection.tsx
rm apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/PrivateSection.tsx
rm apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/SchedulingSection.tsx
rm apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/FinalSurveySection.tsx
```

- [ ] **Step 4: Verificar que não há imports quebrados**

```bash
cd apps/dscar-web
npx tsc --noEmit 2>&1 | head -30
```

Expected: sem erros (ou apenas erros pré-existentes não relacionados).

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/tabs/OpeningTab.tsx
git rm apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/OpeningInfoSection.tsx
git rm apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/PrivateSection.tsx
git rm apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/SchedulingSection.tsx
git rm apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/FinalSurveySection.tsx
git commit -m "feat(dscar-web): OpeningTab duas colunas com TypeBar e PrazosSection; remove seções obsoletas"
```

---

## Task 12: Frontend — NewOSDrawer + atualização das páginas

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/page.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/kanban/page.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/new/page.tsx`

### NewOSDrawer

Sheet sliding da direita (420px). Form inline: pill toggle + seguradora condicional + CustomerSearch + vehicle compacto.

- [ ] **Step 1: Criar pasta _components (se não existir) e criar NewOSDrawer.tsx**

```bash
mkdir -p apps/dscar-web/src/app/\(app\)/service-orders/_components
```

```tsx
// apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx
"use client"

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2, X } from "lucide-react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { newOSSchema, type NewOSInput } from "../new/_schemas/new-os.schema"
import { useServiceOrderCreate } from "../[id]/_hooks/useServiceOrder"
import { CustomerSearch } from "../[id]/_components/shared/CustomerSearch"
import { InsurerSelect } from "../[id]/_components/shared/InsurerSelect"
import { ColorSelect } from "../[id]/_components/shared/ColorSelect"
import { usePlateLookup } from "../[id]/_hooks/useVehicleCatalog"
import { ApiError } from "@/lib/api"

const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
const INPUT_ERROR =
  "flex h-8 w-full rounded-md border border-red-400 bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-red-400"
const SELECT = INPUT

const OS_TYPES = [
  { value: "bodywork", label: "Chapeação" },
  { value: "warranty", label: "Garantia" },
  { value: "rework", label: "Retrabalho" },
  { value: "mechanical", label: "Mecânica" },
  { value: "aesthetic", label: "Estética" },
] as const

interface NewOSDrawerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function NewOSDrawer({ open, onOpenChange }: NewOSDrawerProps) {
  const router = useRouter()
  const createMutation = useServiceOrderCreate()
  const [plateQuery, setPlateQuery] = useState("")
  const { data: plateData, isFetching: plateFetching } = usePlateLookup(plateQuery)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    control,
    watch,
    setValue,
    setError,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewOSInput>({
    resolver: zodResolver(newOSSchema),
    defaultValues: {
      customer_type: "private",
      customer_name: "",
      plate: "",
      make: "",
      model: "",
      vehicle_version: "",
      color: "",
      fuel_type: "",
      chassis: "",
    },
  })

  const customerType = watch("customer_type")

  // Fecha e reseta o form
  function handleClose() {
    onOpenChange(false)
    setTimeout(() => {
      reset()
      setServerError(null)
    }, 300)
  }

  // Auto-preenche campos do veículo ao consultar placa
  useEffect(() => {
    if (!plateData || !plateQuery || plateFetching) return
    const currentMake = watch("make")
    if (!currentMake && plateData.make) {
      setValue("make", plateData.make)
      setValue("model", plateData.model ?? "")
      if (plateData.year) setValue("year", plateData.year)
      toast.success("Dados do veículo preenchidos pela placa.")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateData, plateFetching])

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    setValue("plate", raw, { shouldValidate: raw.length >= 7 })
    if (raw.length >= 7) setPlateQuery(raw)
  }

  async function onSubmit(data: NewOSInput) {
    setServerError(null)
    try {
      const created = await createMutation.mutateAsync(data)
      handleClose()
      router.push(`/service-orders/${created.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors) {
          Object.entries(err.fieldErrors).forEach(([field, messages]) => {
            setError(field as keyof NewOSInput, { message: messages[0] })
          })
        }
        setServerError(
          err.fieldErrors
            ? `Erro nos campos: ${Object.entries(err.fieldErrors)
                .map(([k, v]) => `${k}: ${v[0]}`)
                .join("; ")}`
            : (err.nonFieldErrors?.[0] ?? err.message)
        )
      } else {
        setServerError("Erro inesperado. Tente novamente.")
      }
    }
  }

  const isPending = isSubmitting || createMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] sm:max-w-[420px] p-0 flex flex-col"
      >
        {/* Header fixo */}
        <SheetHeader className="flex flex-row items-start justify-between px-4 py-3 border-b shrink-0">
          <div>
            <SheetTitle className="text-sm font-bold text-neutral-900">Nova OS</SheetTitle>
            <p className="text-[10px] text-neutral-400 mt-0.5">* campos obrigatórios</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-neutral-400 hover:text-neutral-600 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        {/* Body com scroll */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

            {/* ── TIPO DE ATENDIMENTO ──────────────────────────── */}
            <div className="pb-3 border-b border-neutral-100">
              <label className={LABEL}>Tipo de atendimento *</label>
              <div className="flex items-center gap-2 mt-1">
                {/* Pill toggle */}
                <Controller
                  name="customer_type"
                  control={control}
                  render={({ field }) => (
                    <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
                      {(["private", "insurer"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => field.onChange(type)}
                          className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-colors ${
                            field.value === type
                              ? "bg-[#ea0e03] text-white shadow-sm"
                              : "text-neutral-500 hover:text-neutral-700"
                          }`}
                        >
                          {type === "private" ? "Particular" : "Seguradora"}
                        </button>
                      ))}
                    </div>
                  )}
                />

                {/* Tipo OS */}
                <select
                  className={`${SELECT} flex-1`}
                  {...register("os_type")}
                  defaultValue=""
                >
                  <option value="">Tipo OS...</option>
                  {OS_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── SEGURADORA (condicional) ─────────────────────── */}
            {customerType === "insurer" && (
              <div className="pb-3 border-b border-neutral-100 space-y-2">
                <label className={LABEL}>Seguradora *</label>
                <Controller
                  name="insurer"
                  control={control}
                  render={({ field }) => (
                    <InsurerSelect
                      value={field.value ?? null}
                      onChange={(id) => field.onChange(id)}
                    />
                  )}
                />
                {errors.insurer && (
                  <p className="text-[11px] text-red-600">{errors.insurer.message}</p>
                )}

                <label className={LABEL}>Segurado ou Terceiro *</label>
                <Controller
                  name="insured_type"
                  control={control}
                  render={({ field }) => (
                    <select
                      className={SELECT}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    >
                      <option value="">Selecionar...</option>
                      <option value="insured">Segurado</option>
                      <option value="third">Terceiro</option>
                    </select>
                  )}
                />
                {errors.insured_type && (
                  <p className="text-[11px] text-red-600">{errors.insured_type.message}</p>
                )}
              </div>
            )}

            {/* ── CLIENTE ─────────────────────────────────────── */}
            <div className="pb-3 border-b border-neutral-100">
              <label className={LABEL}>Cliente</label>
              <div className="mt-1">
                {/* customer_name hidden — populado via CustomerSearch */}
                <input type="hidden" {...register("customer_name")} />
                <Controller
                  name="customer"
                  control={control}
                  render={({ field }) => (
                    <CustomerSearch
                      value={
                        field.value
                          ? { id: field.value, name: watch("customer_name") }
                          : null
                      }
                      onChange={(c) => {
                        field.onChange(c?.id ?? null)
                        setValue("customer_name", c?.name ?? "", { shouldValidate: true })
                      }}
                    />
                  )}
                />
                {errors.customer_name && (
                  <p className="mt-1 text-[11px] text-red-600">{errors.customer_name.message}</p>
                )}
              </div>
            </div>

            {/* ── VEÍCULO ─────────────────────────────────────── */}
            <div className="space-y-2">
              <label className={LABEL}>Veículo</label>

              {/* Placa */}
              <div>
                <label className={LABEL}>Placa *</label>
                <div className="relative">
                  <input
                    className={`flex h-9 w-36 rounded-md border-2 ${errors.plate ? "border-red-400" : "border-input"} bg-background px-3 py-1 text-base font-bold font-mono tracking-widest shadow-sm focus:outline-none focus:ring-1 focus:ring-ring uppercase`}
                    type="text"
                    placeholder="ABC1D23"
                    maxLength={8}
                    {...register("plate")}
                    onChange={handlePlateChange}
                  />
                  {plateFetching && (
                    <Loader2 className="absolute left-40 top-2 h-4 w-4 animate-spin text-neutral-400" />
                  )}
                </div>
                {errors.plate && (
                  <p className="mt-0.5 text-[11px] text-red-600">{errors.plate.message}</p>
                )}
              </div>

              {/* Montadora + Modelo */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL}>Montadora *</label>
                  <input
                    className={errors.make ? INPUT_ERROR : INPUT}
                    type="text"
                    placeholder="Honda"
                    {...register("make")}
                  />
                  {errors.make && (
                    <p className="mt-0.5 text-[11px] text-red-600">{errors.make.message}</p>
                  )}
                </div>
                <div>
                  <label className={LABEL}>Modelo *</label>
                  <input
                    className={errors.model ? INPUT_ERROR : INPUT}
                    type="text"
                    placeholder="Civic"
                    {...register("model")}
                  />
                  {errors.model && (
                    <p className="mt-0.5 text-[11px] text-red-600">{errors.model.message}</p>
                  )}
                </div>
              </div>

              {/* Versão + Ano + Cor */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={LABEL}>Versão</label>
                  <input className={INPUT} type="text" placeholder="EX 2.0" {...register("vehicle_version")} />
                </div>
                <div>
                  <label className={LABEL}>Ano</label>
                  <input
                    className={INPUT}
                    type="number"
                    min={1900}
                    max={2100}
                    placeholder={String(new Date().getFullYear())}
                    {...register("year", { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <label className={LABEL}>Cor</label>
                  <Controller
                    name="color"
                    control={control}
                    render={({ field }) => (
                      <ColorSelect value={field.value ?? ""} onChange={field.onChange} />
                    )}
                  />
                </div>
              </div>

              {/* Combustível (opcional) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL}>Combustível</label>
                  <input className={INPUT} type="text" placeholder="Flex" {...register("fuel_type")} />
                </div>
                <div>
                  <label className={LABEL}>Chassi</label>
                  <input className={INPUT} type="text" maxLength={17} placeholder="17 chars" {...register("chassis")} />
                </div>
              </div>
            </div>

            {/* Erros servidor */}
            {serverError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-[11px] font-medium text-red-700">{serverError}</p>
              </div>
            )}
          </div>

          {/* Footer fixo */}
          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-4 py-3 shrink-0 bg-white">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-md bg-[#ea0e03] px-5 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Criando..." : "Criar OS →"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Atualizar service-orders/page.tsx**

Adicionar import e state no topo (logo após `useState` existente):

```typescript
import { NewOSDrawer } from "./_components/NewOSDrawer"
```

No corpo do componente `ServiceOrdersPage`, adicionar estado:
```typescript
const [newOSOpen, setNewOSOpen] = useState(false)
```

Localizar o botão/link "Nova OS" existente:
```tsx
// Remover:
<Link href="/service-orders/new">Nova OS</Link>
// ou qualquer variante com href="/service-orders/new"

// Substituir por:
<button
  onClick={() => setNewOSOpen(true)}
  className="..."  // manter as mesmas classes do elemento original
>
  Nova OS
</button>
```

Antes do `return` principal, adicionar o drawer:
```tsx
return (
  <>
    <NewOSDrawer open={newOSOpen} onOpenChange={setNewOSOpen} />
    {/* ... resto do JSX existente */}
  </>
)
```

- [ ] **Step 3: Atualizar kanban/page.tsx**

Mesma mudança do Step 2, no arquivo `kanban/page.tsx`:
- Import `NewOSDrawer`
- Adicionar `const [newOSOpen, setNewOSOpen] = useState(false)`
- Substituir Link "Nova OS" por button com `onClick={() => setNewOSOpen(true)}`
- Envolver return com Fragment e adicionar `<NewOSDrawer open={newOSOpen} onOpenChange={setNewOSOpen} />`

- [ ] **Step 4: Atualizar new/page.tsx (redirect)**

Substituir todo o conteúdo de `apps/dscar-web/src/app/(app)/service-orders/new/page.tsx` por:

```typescript
import { redirect } from "next/navigation"

export default function NewServiceOrderPage() {
  redirect("/service-orders")
}

export const metadata = { title: "Nova OS — DS Car" }
```

- [ ] **Step 5: Deletar NewOSForm.tsx (não mais necessário)**

```bash
rm apps/dscar-web/src/app/\(app\)/service-orders/new/_components/NewOSForm.tsx
```

Verificar que não há mais imports de NewOSForm:

```bash
grep -r "NewOSForm" apps/dscar-web/src/ --include="*.tsx" --include="*.ts"
```

Expected: sem resultados.

- [ ] **Step 6: Verificar TypeScript**

```bash
cd apps/dscar-web
npx tsc --noEmit 2>&1 | head -40
```

Expected: sem erros (ou apenas erros pré-existentes não relacionados ao redesign).

- [ ] **Step 7: Rodar todos os testes**

```bash
cd apps/dscar-web
npx vitest run
```

Expected: todos os testes passando.

- [ ] **Step 8: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/_components/NewOSDrawer.tsx
git add apps/dscar-web/src/app/\(app\)/service-orders/page.tsx
git add apps/dscar-web/src/app/\(app\)/service-orders/kanban/page.tsx
git add apps/dscar-web/src/app/\(app\)/service-orders/new/page.tsx
git rm apps/dscar-web/src/app/\(app\)/service-orders/new/_components/NewOSForm.tsx
git commit -m "feat(dscar-web): NewOSDrawer Sheet lateral; páginas usam drawer em vez de rota /new"
```

---

## Verificação Final

- [ ] **Confirmar que make dev funciona**

```bash
make dev
```

- [ ] **Testar criação de OS via drawer**
  - Abrir `/service-orders` ou `/service-orders/kanban`
  - Clicar "Nova OS" → drawer abre da direita
  - Selecionar tipo Particular / Seguradora (pill toggle)
  - Buscar cliente existente → chip verde aparece
  - Clicar "+ Novo" → form inline com CPF/email obrigatórios
  - Preencher placa → auto-fill de montadora/modelo
  - Criar OS → redireciona para `/service-orders/{id}`

- [ ] **Testar aba Abertura da OS**
  - Abrir qualquer OS existente
  - Aba "Abertura" deve mostrar layout 2 colunas em telas lg
  - Coluna esquerda: Cliente (chip) + Seguradora (condicional) + Entrada
  - Coluna direita: Veículo (com slot visual) + Prazos e Entrega
  - Pill toggle Particular/Seguradora na barra superior

- [ ] **Testar /service-orders/new**
  - Acessar `/service-orders/new` diretamente → redireciona para `/service-orders`
