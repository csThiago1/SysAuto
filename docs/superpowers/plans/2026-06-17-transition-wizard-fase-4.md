# Wizard de Transição — Fase 4: Resolvers Restantes (Plano de Implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 9 resolvers inline ao Wizard de Transição (`VEHICLE_COLOR`, `VEHICLE_YEAR`, `DEDUCTIBLE_SET`, `CASUALTY_NUMBER`, `AUTH_DATE_SET`, `ENTRY_DATE_SET`, `INSURER_DATA`, `BUDGET_PDF_INSURER`, `CANCEL_JUSTIFICATION`) eliminando o `FallbackResolver` para todos os codes triviais e médios identificados no backend.

**Architecture:** 8 dos 9 resolvers seguem o padrão da Fase 2 (`onResolved()` após PATCH com `invalidateQueries`). `CANCEL_JUSTIFICATION` é caso especial: usa `JustificationContext` (React Context) para propagar o texto do resolver para o `TransitionWizard.handleAdvance`, que injeta `justification` no payload da transição quando `target === 'cancelled'`. Sem migration backend.

**Tech Stack:** React 19, Next.js 16, TypeScript strict, Vitest 2, @testing-library/react, TanStack Query v5, shadcn/ui Button, sonner toast.

**Spec:** `docs/superpowers/specs/2026-06-17-transition-wizard-fase-4-design.md`

---

## File Structure

**Criar:**
- `apps/dscar-web/src/components/transition-wizard/JustificationContext.tsx` — Context + Provider para CANCEL_JUSTIFICATION
- `apps/dscar-web/src/components/transition-wizard/resolvers/InsurerResolver.tsx` — busca + select de seguradora
- `apps/dscar-web/src/components/transition-wizard/resolvers/FileResolver.tsx` — upload PDF para BUDGET_PDF_INSURER
- `apps/dscar-web/src/components/transition-wizard/resolvers/CancelJustificationResolver.tsx` — textarea via Context
- `apps/dscar-web/src/components/transition-wizard/resolvers/InsurerResolver.test.tsx`
- `apps/dscar-web/src/components/transition-wizard/resolvers/FileResolver.test.tsx`
- `apps/dscar-web/src/components/transition-wizard/resolvers/CancelJustificationResolver.test.tsx`

**Modificar:**
- `apps/dscar-web/src/app/(app)/os/[numero]/_utils/form-defaults.ts` — exportar `toLocalDatetime`
- `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.tsx` — adicionar 4 sub-forms novos + expandir `VehicleDataForm`
- `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.test.tsx` — testes dos 4 novos sub-forms + 2 campos expandidos
- `apps/dscar-web/src/components/transition-wizard/resolvers/index.ts` — registra os 9 novos codes
- `apps/dscar-web/src/components/transition-wizard/TransitionWizard.tsx` — JustificationContext.Provider + injeta `justification` no `handleAdvance`

---

## Task 0: Setup — branch + sanity check

**Files:** nenhum

- [ ] **Step 1: Confirma branch main atualizada**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git checkout main
git pull origin main
```
Expected: `Already up to date` ou fast-forward sem conflitos.

- [ ] **Step 2: Cria branch da Fase 4**

```bash
git checkout -b feature/transition-wizard-fase-4
```

- [ ] **Step 3: Rodar suite existente para baseline**

```bash
cd apps/dscar-web && npm test -- src/components/transition-wizard/
```
Expected: `46 passed (46)`.

---

## Task 1: Exportar `toLocalDatetime`

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_utils/form-defaults.ts`

`toLocalDatetime` é função local no arquivo. Vamos exportar para reusar nos resolvers de datetime.

- [ ] **Step 1: Trocar `function` por `export function`**

No arquivo `apps/dscar-web/src/app/(app)/os/[numero]/_utils/form-defaults.ts`, linha 15, substituir:

```ts
function toLocalDatetime(iso: string | null | undefined): string | undefined {
```

Por:

```ts
export function toLocalDatetime(iso: string | null | undefined): string | undefined {
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/dscar-web && npm run typecheck
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add apps/dscar-web/src/app/\(app\)/os/\[numero\]/_utils/form-defaults.ts
git commit -m "chore(web): exporta toLocalDatetime para reuso em resolvers"
```

---

## Task 2: Expandir `VehicleDataForm` (VEHICLE_COLOR + VEHICLE_YEAR)

**Files:**
- Modify: `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.tsx`
- Modify: `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.test.tsx`

O `VehicleDataForm` atual edita `plate + make + model` para `VEHICLE_BASIC_DATA`. Vamos:
1. Adicionar campos `color` e `year` ao form.
2. Validar segundo o `block.code` (cada code requer um subset dos campos).

- [ ] **Step 1: Adicionar testes para os novos casos**

Em `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.test.tsx`, ao final do arquivo (antes do último `})` de fechamento global, adicionar:

```tsx
describe("DataResolver — VEHICLE_COLOR", () => {
  it("renderiza input de cor quando code=VEHICLE_COLOR", () => {
    wrap(<DataResolver block={block("VEHICLE_COLOR")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/cor/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar cor", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_COLOR")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/cor/i), "Vermelho")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })

  it("não chama onResolved com cor vazia", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_COLOR")} order={ORDER} onResolved={onResolved} />)
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
  })
})

describe("DataResolver — VEHICLE_YEAR", () => {
  it("renderiza input de ano quando code=VEHICLE_YEAR", () => {
    wrap(<DataResolver block={block("VEHICLE_YEAR")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/ano/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar ano válido", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_YEAR")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/ano/i), "2023")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })

  it("não chama onResolved com ano inválido (<1900)", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_YEAR")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/ano/i), "1899")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar testes (esperar falha)**

```bash
cd apps/dscar-web && npm test -- src/components/transition-wizard/resolvers/DataResolver.test.tsx
```
Expected: 6 testes novos falham por "input não encontrado".

- [ ] **Step 3: Substituir o `VehicleDataForm` no DataResolver.tsx**

Em `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.tsx`, substituir a função `VehicleDataForm` inteira (linhas 19-83 aproximadamente) por:

```tsx
function VehicleDataForm({ block, order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const code = block.code
  const [plate, setPlate] = useState(order.plate ?? "")
  const [make, setMake] = useState(order.make ?? "")
  const [model, setModel] = useState(order.model ?? "")
  const [color, setColor] = useState(order.color ?? "")
  const [year, setYear] = useState(order.year?.toString() ?? "")
  const [saving, setSaving] = useState(false)

  // Quais campos cada code precisa
  const needsBasic = code === "VEHICLE_BASIC_DATA"
  const needsColor = code === "VEHICLE_COLOR"
  const needsYear = code === "VEHICLE_YEAR"

  async function handleSave(): Promise<void> {
    const payload: Record<string, unknown> = {}

    if (needsBasic) {
      if (!plate || !make || !model) {
        toast.error("Preencha placa, montadora e modelo")
        return
      }
      payload.plate = plate
      payload.make = make
      payload.model = model
    }
    if (needsColor) {
      if (!color.trim()) {
        toast.error("Informe a cor do veículo")
        return
      }
      payload.color = color.trim()
    }
    if (needsYear) {
      const parsed = parseInt(year, 10)
      if (isNaN(parsed) || parsed < 1900 || parsed > 2100) {
        toast.error("Ano inválido (1900-2100)")
        return
      }
      payload.year = parsed
    }

    setSaving(true)
    try {
      await patchOrder(order.id, payload)
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar dados do veículo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {needsBasic && (
        <>
          <div>
            <label htmlFor="dv-plate" className="text-xs font-medium">Placa</label>
            <input
              id="dv-plate"
              className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC1234"
              maxLength={8}
            />
          </div>
          <div>
            <label htmlFor="dv-make" className="text-xs font-medium">Montadora</label>
            <input
              id="dv-make"
              className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Fiat"
            />
          </div>
          <div>
            <label htmlFor="dv-model" className="text-xs font-medium">Modelo</label>
            <input
              id="dv-model"
              className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Uno"
            />
          </div>
        </>
      )}

      {needsColor && (
        <div>
          <label htmlFor="dv-color" className="text-xs font-medium">Cor</label>
          <input
            id="dv-color"
            className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Vermelho"
          />
        </div>
      )}

      {needsYear && (
        <div>
          <label htmlFor="dv-year" className="text-xs font-medium">Ano</label>
          <input
            id="dv-year"
            type="number"
            min="1900"
            max="2100"
            className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2023"
          />
        </div>
      )}

      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Atualizar dispatcher**

No mesmo arquivo, na função `DataResolver` (no final do arquivo), adicionar os 2 novos codes ao branch do `VehicleDataForm`:

```tsx
export function DataResolver(props: ResolverProps) {
  const code = props.block.code
  if (code === "VEHICLE_BASIC_DATA" || code === "VEHICLE_COLOR" || code === "VEHICLE_YEAR") {
    return <VehicleDataForm {...props} />
  }
  if (code === "CUSTOMER_TYPE_SET") return <CustomerTypeForm {...props} />
  if (code === "MILEAGE_OUT") return <MileageOutForm {...props} />
  if (code === "FUEL_TYPE") return <FuelTypeForm {...props} />
  if (code === "MILEAGE_IN") return <MileageInForm {...props} />
  if (code === "CUSTOMER_LINKED") return <CustomerLinkedForm {...props} />
  return null
}
```

- [ ] **Step 5: Rodar testes (esperar passar)**

```bash
npm test -- src/components/transition-wizard/resolvers/DataResolver.test.tsx
```
Expected: `14 passed` (8 existentes + 6 novos).

- [ ] **Step 6: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.tsx \
        apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.test.tsx
git commit -m "feat(wizard): VehicleDataForm cobre VEHICLE_COLOR e VEHICLE_YEAR (6 testes novos)"
```

---

## Task 3: 4 novos sub-forms — DEDUCTIBLE, CASUALTY, AUTH_DATE, ENTRY_DATE

**Files:**
- Modify: `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.tsx`
- Modify: `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.test.tsx`

- [ ] **Step 1: Adicionar testes dos 4 sub-forms**

Em `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.test.tsx`, ao final do arquivo (antes do último `})` de fechamento), adicionar:

```tsx
describe("DataResolver — DEDUCTIBLE_SET", () => {
  it("renderiza input de franquia", () => {
    wrap(<DataResolver block={block("DEDUCTIBLE_SET")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/franquia/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar valor válido", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("DEDUCTIBLE_SET")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/franquia/i), "1500.50")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })

  it("não chama onResolved com valor inválido (zero)", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("DEDUCTIBLE_SET")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/franquia/i), "0")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
  })
})

describe("DataResolver — CASUALTY_NUMBER", () => {
  it("renderiza input do número de sinistro", () => {
    wrap(<DataResolver block={block("CASUALTY_NUMBER")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/sinistro/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar número", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("CASUALTY_NUMBER")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/sinistro/i), "SIN-12345")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })
})

describe("DataResolver — AUTH_DATE_SET", () => {
  it("renderiza input datetime de autorização", () => {
    wrap(<DataResolver block={block("AUTH_DATE_SET")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/data de autorização/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar data", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("AUTH_DATE_SET")} order={ORDER} onResolved={onResolved} />)
    const input = screen.getByLabelText(/data de autorização/i) as HTMLInputElement
    await user.type(input, "2026-06-17T10:00")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })
})

describe("DataResolver — ENTRY_DATE_SET", () => {
  it("renderiza input datetime de entrada", () => {
    wrap(<DataResolver block={block("ENTRY_DATE_SET")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/data de entrada/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar data", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("ENTRY_DATE_SET")} order={ORDER} onResolved={onResolved} />)
    const input = screen.getByLabelText(/data de entrada/i) as HTMLInputElement
    await user.type(input, "2026-06-15T08:30")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 2: Rodar testes (esperar falha)**

```bash
cd apps/dscar-web && npm test -- src/components/transition-wizard/resolvers/DataResolver.test.tsx
```
Expected: 8 testes novos falham.

- [ ] **Step 3: Importar `toLocalDatetime` no DataResolver.tsx**

No topo do arquivo `DataResolver.tsx`, após os outros imports, adicionar:

```ts
import { toLocalDatetime } from "@/app/(app)/os/[numero]/_utils/form-defaults"
```

- [ ] **Step 4: Adicionar os 4 sub-forms no DataResolver.tsx**

No arquivo `DataResolver.tsx`, antes da função `export function DataResolver(...)` final, adicionar os 4 sub-forms:

```tsx
function DeductibleSetForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [val, setVal] = useState(order.deductible_amount ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    const parsed = parseFloat(val.toString().replace(",", "."))
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Valor inválido")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { deductible_amount: parsed.toFixed(2) })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar franquia")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-deductible" className="text-xs font-medium">Valor da Franquia (R$)</label>
        <input
          id="dv-deductible"
          type="number"
          min="0"
          step="0.01"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={val.toString()}
          onChange={(e) => setVal(e.target.value)}
          placeholder="1500.00"
        />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

function CasualtyNumberForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [val, setVal] = useState(order.casualty_number ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    const trimmed = val.trim()
    if (!trimmed) {
      toast.error("Informe o número do sinistro")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { casualty_number: trimmed })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar número do sinistro")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-casualty" className="text-xs font-medium">Número do Sinistro</label>
        <input
          id="dv-casualty"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="SIN-12345"
        />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

function AuthDateForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [val, setVal] = useState(toLocalDatetime(order.authorization_date) ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    if (!val) {
      toast.error("Informe a data de autorização")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { authorization_date: val })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar data de autorização")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-auth-date" className="text-xs font-medium">Data de Autorização</label>
        <input
          id="dv-auth-date"
          type="datetime-local"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

function EntryDateForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [val, setVal] = useState(toLocalDatetime(order.entry_date) ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    if (!val) {
      toast.error("Informe a data de entrada")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { entry_date: val })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar data de entrada")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-entry-date" className="text-xs font-medium">Data de Entrada</label>
        <input
          id="dv-entry-date"
          type="datetime-local"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Atualizar dispatcher**

Substituir a função `DataResolver` no final do arquivo por:

```tsx
export function DataResolver(props: ResolverProps) {
  const code = props.block.code
  if (code === "VEHICLE_BASIC_DATA" || code === "VEHICLE_COLOR" || code === "VEHICLE_YEAR") {
    return <VehicleDataForm {...props} />
  }
  if (code === "CUSTOMER_TYPE_SET") return <CustomerTypeForm {...props} />
  if (code === "MILEAGE_OUT") return <MileageOutForm {...props} />
  if (code === "FUEL_TYPE") return <FuelTypeForm {...props} />
  if (code === "MILEAGE_IN") return <MileageInForm {...props} />
  if (code === "CUSTOMER_LINKED") return <CustomerLinkedForm {...props} />
  if (code === "DEDUCTIBLE_SET") return <DeductibleSetForm {...props} />
  if (code === "CASUALTY_NUMBER") return <CasualtyNumberForm {...props} />
  if (code === "AUTH_DATE_SET") return <AuthDateForm {...props} />
  if (code === "ENTRY_DATE_SET") return <EntryDateForm {...props} />
  return null
}
```

- [ ] **Step 6: Rodar testes (esperar passar)**

```bash
npm test -- src/components/transition-wizard/resolvers/DataResolver.test.tsx
```
Expected: `22 passed`.

- [ ] **Step 7: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.tsx \
        apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.test.tsx
git commit -m "feat(wizard): DataResolver — DEDUCTIBLE_SET, CASUALTY_NUMBER, AUTH_DATE_SET, ENTRY_DATE_SET (8 testes novos)"
```

---

## Task 4: InsurerResolver (busca + select de seguradora)

**Files:**
- Create: `apps/dscar-web/src/components/transition-wizard/resolvers/InsurerResolver.tsx`
- Create: `apps/dscar-web/src/components/transition-wizard/resolvers/InsurerResolver.test.tsx`

- [ ] **Step 1: Criar o arquivo de teste**

Path: `apps/dscar-web/src/components/transition-wizard/resolvers/InsurerResolver.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { InsurerResolver } from "./InsurerResolver"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn().mockResolvedValue({}) }))

vi.mock("@/hooks/useInsurers", () => ({
  useInsurers: (q: string) => ({
    data: q.length >= 2 ? {
      count: 1,
      next: null,
      previous: null,
      results: [
        { id: "ins-1", name: "Porto Seguro", display_name: "Porto Seguro", trade_name: "Porto", cnpj: "00", abbreviation: "PS", brand_color: "#fff", logo: null, logo_url: "", uses_cilia: false, is_active: true },
      ],
    } : undefined,
    isFetching: false,
  }),
}))

vi.mock("@tanstack/react-query", async (imp) => {
  const real = await imp<typeof import("@tanstack/react-query")>()
  return { ...real, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})

function wrap(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

const ORDER = { id: "os-1", insurer: null } as unknown as ServiceOrder
const BLOCK: ValidationBlock = { code: "INSURER_DATA", message: "Seguradora não vinculada" }

describe("InsurerResolver", () => {
  it("renderiza input de busca de seguradora", () => {
    wrap(<InsurerResolver block={BLOCK} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByPlaceholderText(/buscar seguradora/i)).toBeInTheDocument()
  })

  it("mostra resultados quando user digita 2+ caracteres", async () => {
    const user = userEvent.setup()
    wrap(<InsurerResolver block={BLOCK} order={ORDER} onResolved={vi.fn()} />)
    await user.type(screen.getByPlaceholderText(/buscar seguradora/i), "Po")
    expect(await screen.findByText(/Porto Seguro/)).toBeInTheDocument()
  })

  it("chama onResolved ao clicar em seguradora", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<InsurerResolver block={BLOCK} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByPlaceholderText(/buscar seguradora/i), "Po")
    await user.click(await screen.findByText(/Porto Seguro/))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 2: Rodar (esperar falha)**

```bash
cd apps/dscar-web && npm test -- src/components/transition-wizard/resolvers/InsurerResolver.test.tsx
```
Expected: erro de import.

- [ ] **Step 3: Criar `InsurerResolver.tsx`**

Path: `apps/dscar-web/src/components/transition-wizard/resolvers/InsurerResolver.tsx`

```tsx
"use client"

import { useState } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { useInsurers } from "@/hooks/useInsurers"
import type { ResolverProps } from "./index"

async function patchOrder(id: string, data: Record<string, unknown>): Promise<void> {
  await apiFetch(`/api/proxy/service-orders/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export function InsurerResolver({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [q, setQ] = useState("")
  const [saving, setSaving] = useState(false)
  const { data, isFetching } = useInsurers(q.length >= 2 ? q : "")

  async function handleSelect(insurerId: string): Promise<void> {
    setSaving(true)
    try {
      await patchOrder(order.id, { insurer: insurerId })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao vincular seguradora")
    } finally {
      setSaving(false)
    }
  }

  const results = data?.results ?? []
  const showResults = q.length >= 2 && !isFetching

  return (
    <div className="mt-2 space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          className="w-full rounded-md border bg-background pl-7 pr-2 py-1.5 text-sm"
          placeholder="Buscar seguradora por nome..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {showResults && results.length > 0 && (
        <ul className="rounded-md border divide-y max-h-40 overflow-y-auto">
          {results.map((ins) => (
            <li key={ins.id}>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                disabled={saving}
                onClick={() => void handleSelect(ins.id)}
              >
                <span className="font-medium">{ins.display_name}</span>
                {ins.cnpj && (
                  <span className="ml-2 text-xs text-muted-foreground">{ins.cnpj}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showResults && results.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma seguradora encontrada.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar testes (esperar passar)**

```bash
npm test -- src/components/transition-wizard/resolvers/InsurerResolver.test.tsx
```
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/resolvers/InsurerResolver.tsx \
        apps/dscar-web/src/components/transition-wizard/resolvers/InsurerResolver.test.tsx
git commit -m "feat(wizard): InsurerResolver — busca + vincula seguradora (3 testes)"
```

---

## Task 5: FileResolver (upload PDF para BUDGET_PDF_INSURER)

**Files:**
- Create: `apps/dscar-web/src/components/transition-wizard/resolvers/FileResolver.tsx`
- Create: `apps/dscar-web/src/components/transition-wizard/resolvers/FileResolver.test.tsx`

- [ ] **Step 1: Criar o teste**

Path: `apps/dscar-web/src/components/transition-wizard/resolvers/FileResolver.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FileResolver } from "./FileResolver"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"

const mockMutateAsync = vi.fn().mockResolvedValue({})

vi.mock("@/app/(app)/os/[numero]/_hooks/useOSItems", () => ({
  useUploadPhoto: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}))

vi.mock("@tanstack/react-query", async (imp) => {
  const real = await imp<typeof import("@tanstack/react-query")>()
  return { ...real, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})

function wrap(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

const ORDER = { id: "os-1" } as unknown as ServiceOrder
const BLOCK: ValidationBlock = { code: "BUDGET_PDF_INSURER", message: "PDF do orçamento não enviado" }

describe("FileResolver", () => {
  it("renderiza zona de upload com instrução de PDF", () => {
    wrap(<FileResolver block={BLOCK} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByText(/selecionar pdf/i)).toBeInTheDocument()
  })

  it("chama mutateAsync e onResolved após upload de PDF", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    mockMutateAsync.mockClear()
    wrap(<FileResolver block={BLOCK} order={ORDER} onResolved={onResolved} />)

    const file = new File(["pdf-content"], "orcamento.pdf", { type: "application/pdf" })
    const input = screen.getByTestId("file-input") as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))

    const fd = mockMutateAsync.mock.calls[0][0] as FormData
    expect(fd.get("folder")).toBe("orcamentos")
    expect(fd.get("file")).toBe(file)
  })
})
```

- [ ] **Step 2: Rodar (esperar falha)**

```bash
npm test -- src/components/transition-wizard/resolvers/FileResolver.test.tsx
```
Expected: erro de import.

- [ ] **Step 3: Criar `FileResolver.tsx`**

Path: `apps/dscar-web/src/components/transition-wizard/resolvers/FileResolver.tsx`

```tsx
"use client"

import { useRef, useState } from "react"
import { FileText, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { useUploadPhoto } from "@/app/(app)/os/[numero]/_hooks/useOSItems"
import type { ResolverProps } from "./index"

export function FileResolver({ block, order, onResolved }: ResolverProps) {
  const uploadMutation = useUploadPhoto(order.id)
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList): Promise<void> {
    const file = files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "orcamentos")
      await uploadMutation.mutateAsync(fd)
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      void qc.invalidateQueries({ queryKey: ["os-photos", order.id] })
      toast.success("PDF enviado.")
      onResolved()
    } catch {
      toast.error("Erro ao enviar PDF")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-muted-foreground">{block.message}</p>

      <div
        className="rounded-md border-2 border-dashed border-border bg-muted/20 p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-1">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Enviando PDF...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">Toque para selecionar PDF</span>
            <span className="text-xs text-muted-foreground">Apenas .pdf</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        data-testid="file-input"
        onChange={(e) => { if (e.target.files) void handleFiles(e.target.files) }}
      />

      {!uploading && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          Selecionar PDF
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar testes (esperar passar)**

```bash
npm test -- src/components/transition-wizard/resolvers/FileResolver.test.tsx
```
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/resolvers/FileResolver.tsx \
        apps/dscar-web/src/components/transition-wizard/resolvers/FileResolver.test.tsx
git commit -m "feat(wizard): FileResolver — upload PDF para BUDGET_PDF_INSURER (2 testes)"
```

---

## Task 6: JustificationContext + Provider no TransitionWizard

**Files:**
- Create: `apps/dscar-web/src/components/transition-wizard/JustificationContext.tsx`
- Modify: `apps/dscar-web/src/components/transition-wizard/TransitionWizard.tsx`

- [ ] **Step 1: Criar `JustificationContext.tsx`**

Path: `apps/dscar-web/src/components/transition-wizard/JustificationContext.tsx`

```tsx
"use client"

import { createContext, useContext } from "react"

interface JustificationContextValue {
  justification: string
  setJustification: (next: string) => void
}

const JustificationContext = createContext<JustificationContextValue>({
  justification: "",
  setJustification: () => {},
})

export const JustificationProvider = JustificationContext.Provider

export function useJustification(): JustificationContextValue {
  return useContext(JustificationContext)
}
```

- [ ] **Step 2: Wrap o conteúdo do TransitionWizard com o Provider**

No arquivo `apps/dscar-web/src/components/transition-wizard/TransitionWizard.tsx`:

**2a.** Adicionar import logo após os outros imports:

```ts
import { JustificationProvider } from "./JustificationContext"
```

**2b.** Adicionar state logo após `const [managerPassword, setManagerPassword] = useState("")` (≈ linha 44):

```ts
const [justification, setJustification] = useState("")
```

**2c.** Modificar `handleClose` para limpar a justificativa:

Substituir:
```ts
function handleClose(): void {
  reset()
  onClose()
}
```

Por:
```ts
function handleClose(): void {
  reset()
  setJustification("")
  onClose()
}
```

**2d.** Envolver o `return ( <> ... </> )` final com o Provider:

Substituir o início do return:
```tsx
return (
  <>
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
```

Por:
```tsx
return (
  <JustificationProvider value={{ justification, setJustification }}>
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
```

E substituir o fim:
```tsx
      <ManagerCredentialsModal
        ...
      />
    </>
  )
}
```

Por:
```tsx
      <ManagerCredentialsModal
        ...
      />
    </JustificationProvider>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/dscar-web && npm run typecheck
```
Expected: zero erros.

- [ ] **Step 4: Rodar testes existentes (esperar passar)**

```bash
npm test -- src/components/transition-wizard/TransitionWizard.test.tsx
```
Expected: `5 passed` (sem regressão).

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/JustificationContext.tsx \
        apps/dscar-web/src/components/transition-wizard/TransitionWizard.tsx
git commit -m "feat(wizard): JustificationContext + Provider no TransitionWizard"
```

---

## Task 7: CancelJustificationResolver

**Files:**
- Create: `apps/dscar-web/src/components/transition-wizard/resolvers/CancelJustificationResolver.tsx`
- Create: `apps/dscar-web/src/components/transition-wizard/resolvers/CancelJustificationResolver.test.tsx`

- [ ] **Step 1: Criar o teste**

Path: `apps/dscar-web/src/components/transition-wizard/resolvers/CancelJustificationResolver.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { CancelJustificationResolver } from "./CancelJustificationResolver"
import { JustificationProvider } from "../JustificationContext"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"
import { useState } from "react"

const ORDER = { id: "os-1" } as unknown as ServiceOrder
const BLOCK: ValidationBlock = { code: "CANCEL_JUSTIFICATION", message: "Justificativa obrigatória" }

function Wrapper({ children }: { children: React.ReactNode }) {
  const [justification, setJustification] = useState("")
  return (
    <JustificationProvider value={{ justification, setJustification }}>
      {children}
    </JustificationProvider>
  )
}

describe("CancelJustificationResolver", () => {
  it("renderiza textarea com placeholder", () => {
    render(
      <Wrapper>
        <CancelJustificationResolver block={BLOCK} order={ORDER} onResolved={vi.fn()} />
      </Wrapper>
    )
    expect(screen.getByRole("textbox", { name: /motivo do cancelamento/i })).toBeInTheDocument()
  })

  it("não chama onResolved com texto curto (<10 chars)", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    render(
      <Wrapper>
        <CancelJustificationResolver block={BLOCK} order={ORDER} onResolved={onResolved} />
      </Wrapper>
    )
    await user.type(screen.getByRole("textbox", { name: /motivo do cancelamento/i }), "curto")
    expect(onResolved).not.toHaveBeenCalled()
  })

  it("chama onResolved quando texto >= 10 chars", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    render(
      <Wrapper>
        <CancelJustificationResolver block={BLOCK} order={ORDER} onResolved={onResolved} />
      </Wrapper>
    )
    await user.type(screen.getByRole("textbox", { name: /motivo do cancelamento/i }), "cliente desistiu")
    expect(onResolved).toHaveBeenCalled()
  })

  it("mostra contador de caracteres", async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <CancelJustificationResolver block={BLOCK} order={ORDER} onResolved={vi.fn()} />
      </Wrapper>
    )
    await user.type(screen.getByRole("textbox", { name: /motivo do cancelamento/i }), "abc")
    expect(screen.getByText(/3.*10/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar (esperar falha)**

```bash
cd apps/dscar-web && npm test -- src/components/transition-wizard/resolvers/CancelJustificationResolver.test.tsx
```
Expected: erro de import.

- [ ] **Step 3: Criar `CancelJustificationResolver.tsx`**

Path: `apps/dscar-web/src/components/transition-wizard/resolvers/CancelJustificationResolver.tsx`

```tsx
"use client"

import { useEffect } from "react"
import { useJustification } from "../JustificationContext"
import type { ResolverProps } from "./index"

const MIN_LENGTH = 10

export function CancelJustificationResolver({ onResolved }: ResolverProps) {
  const { justification, setJustification } = useJustification()
  const len = justification.trim().length
  const isValid = len >= MIN_LENGTH

  useEffect(() => {
    if (isValid) onResolved()
  }, [isValid, onResolved])

  return (
    <div className="mt-2 space-y-1">
      <textarea
        aria-label="Motivo do cancelamento"
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        rows={3}
        placeholder="Explique o motivo do cancelamento (mínimo 10 caracteres)..."
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
      />
      <p className={`text-xs ${isValid ? "text-success-500" : "text-muted-foreground"}`}>
        {len}/{MIN_LENGTH} caracteres
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Rodar testes (esperar passar)**

```bash
npm test -- src/components/transition-wizard/resolvers/CancelJustificationResolver.test.tsx
```
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/resolvers/CancelJustificationResolver.tsx \
        apps/dscar-web/src/components/transition-wizard/resolvers/CancelJustificationResolver.test.tsx
git commit -m "feat(wizard): CancelJustificationResolver — textarea via Context (4 testes)"
```

---

## Task 8: Atualizar registry com os 9 novos codes

**Files:**
- Modify: `apps/dscar-web/src/components/transition-wizard/resolvers/index.ts`

- [ ] **Step 1: Adicionar imports e registros**

Substituir o conteúdo final do arquivo `apps/dscar-web/src/components/transition-wizard/resolvers/index.ts` por:

```ts
import type React from "react"
import type { ValidationBlock, ServiceOrder } from "@paddock/types"
import { FallbackResolver } from "./FallbackResolver"
import { DataResolver } from "./DataResolver"
import { PhotoResolver } from "./PhotoResolver"
import { InsurerResolver } from "./InsurerResolver"
import { FileResolver } from "./FileResolver"
import { CancelJustificationResolver } from "./CancelJustificationResolver"

export interface ResolverProps {
  block: ValidationBlock
  order: ServiceOrder
  onResolved: () => void
}

const REGISTRY = new Map<string, React.ComponentType<ResolverProps>>()

export function registerResolver(
  codes: readonly string[],
  component: React.ComponentType<ResolverProps>,
): void {
  for (const code of codes) REGISTRY.set(code, component)
}

export function getResolver(code: string): React.ComponentType<ResolverProps> {
  return REGISTRY.get(code) ?? FallbackResolver
}

export function hasResolverFor(code: string): boolean {
  return REGISTRY.has(code)
}

// Fase 2 (entregue)
registerResolver(
  ["VEHICLE_BASIC_DATA", "CUSTOMER_TYPE_SET", "MILEAGE_OUT", "FUEL_TYPE", "MILEAGE_IN", "CUSTOMER_LINKED"],
  DataResolver,
)
registerResolver(["PHOTOS_MIN_12", "FINAL_PHOTOS_12", "PROGRESS_PHOTO"], PhotoResolver)

// Fase 4 — 9 novos codes
registerResolver(
  ["VEHICLE_COLOR", "VEHICLE_YEAR", "DEDUCTIBLE_SET", "CASUALTY_NUMBER", "AUTH_DATE_SET", "ENTRY_DATE_SET"],
  DataResolver,
)
registerResolver(["INSURER_DATA"], InsurerResolver)
registerResolver(["BUDGET_PDF_INSURER"], FileResolver)
registerResolver(["CANCEL_JUSTIFICATION"], CancelJustificationResolver)
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/dscar-web && npm run typecheck
```
Expected: zero erros.

- [ ] **Step 3: Rodar toda suite do wizard**

```bash
npm test -- src/components/transition-wizard/
```
Expected: 46 (Fase 2) + 6 (color/year) + 8 (4 sub-forms) + 3 (Insurer) + 2 (File) + 4 (Cancel) = **69 testes passando**.

- [ ] **Step 4: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/resolvers/index.ts
git commit -m "feat(wizard): registra 9 novos codes da Fase 4 no registry"
```

---

## Task 9: Injeta `justification` no `handleAdvance`

**Files:**
- Modify: `apps/dscar-web/src/components/transition-wizard/TransitionWizard.tsx`

O `handleAdvance` atual chama `transitionMutation.mutateAsync({ new_status: target })`. Vamos injetar `justification` quando `target === "cancelled"`.

- [ ] **Step 1: Localizar handleAdvance**

No arquivo `TransitionWizard.tsx`, localizar:

```ts
async function handleAdvance(): Promise<void> {
  try {
    await transitionMutation.mutateAsync({ new_status: target })
    ...
```

- [ ] **Step 2: Substituir o `handleAdvance` por:**

```ts
async function handleAdvance(): Promise<void> {
  try {
    const payload: { new_status: ServiceOrderStatus; justification?: string } = { new_status: target }
    if (target === "cancelled" && justification.trim()) {
      payload.justification = justification.trim()
    }
    await transitionMutation.mutateAsync(payload)
    toast.success(`Status atualizado para "${targetLabel}"`)
    reset()
    setJustification("")
    onSuccess()
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Erro ao avançar status — tente novamente")
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/dscar-web && npm run typecheck
```
Expected: zero erros.

- [ ] **Step 4: Adicionar teste de integração no TransitionWizard.test.tsx**

No arquivo `apps/dscar-web/src/components/transition-wizard/TransitionWizard.test.tsx`, no topo (junto com os outros mocks), substituir o mock de `useTransitionWithValidation` para expor o `mutateAsync`:

Substituir:
```ts
vi.mock("@/hooks/useTransitionValidation", () => ({
  useTransitionWithValidation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useRequestOverride: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}))
```

Por:
```ts
const mockTransitionMutate = vi.fn().mockResolvedValue({})
vi.mock("@/hooks/useTransitionValidation", () => ({
  useTransitionWithValidation: () => ({
    mutateAsync: mockTransitionMutate,
    isPending: false,
  }),
  useRequestOverride: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}))
```

Adicionar um novo describe no final do arquivo (antes do `})` global) com cenário de cancelamento:

```tsx
describe("TransitionWizard — cancelamento com justificativa", () => {
  it("injeta justification no payload quando target=cancelled", async () => {
    mockTransitionMutate.mockClear()

    // Mock order que pode ir para cancelled sem outros blocks
    const cancelOrder = {
      id: "os-c",
      number: 99,
      status: "reception",
      transition_requirements: {
        cancelled: {
          can_proceed: false,
          hard_blocks: [{ code: "CANCEL_JUSTIFICATION", message: "Justificativa obrigatória" }],
          soft_blocks: [],
          warnings: [],
          has_pending_override: false,
        },
      },
    }
    // Reimport useServiceOrder mock — usar vi.mocked para ajustar return
    const useServiceOrderMock = (await import("@/app/(app)/os/[numero]/_hooks/useServiceOrder")).useServiceOrder as ReturnType<typeof vi.fn>
    useServiceOrderMock.mockReturnValueOnce({ data: cancelOrder, isLoading: false })

    const user = userEvent.setup()
    wrap(<TransitionWizard orderId="os-c" target="cancelled" onClose={vi.fn()} onSuccess={vi.fn()} />)

    // Expande o resolver e preenche justificativa
    await user.click(await screen.findByRole("button", { name: /resolver aqui/i }))
    const textarea = screen.getByRole("textbox", { name: /motivo do cancelamento/i })
    await user.type(textarea, "Cliente desistiu do serviço")

    // Clica em Avançar
    await user.click(screen.getByRole("button", { name: /avançar para cancelado/i }))

    expect(mockTransitionMutate).toHaveBeenCalledWith({
      new_status: "cancelled",
      justification: "Cliente desistiu do serviço",
    })
  })
})
```

> **Nota:** este teste assume que `SERVICE_ORDER_STATUS_CONFIG.cancelled.label === "Cancelado"`. Se o label real for diferente, ajustar o regex `/avançar para cancelado/i` para o label correto.

- [ ] **Step 5: Rodar testes (esperar passar)**

```bash
npm test -- src/components/transition-wizard/
```
Expected: 70 testes passando (69 + 1 novo).

- [ ] **Step 6: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/TransitionWizard.tsx \
        apps/dscar-web/src/components/transition-wizard/TransitionWizard.test.tsx
git commit -m "feat(wizard): handleAdvance injeta justification quando target=cancelled (1 teste integração)"
```

---

## Task 10: Smoke manual + push + PR

**Files:** nenhum

- [ ] **Step 1: Confirmar branch tem todos os commits**

```bash
git log --oneline main..HEAD
```
Expected: 10 commits (Task 1-9).

- [ ] **Step 2: Subir Next.js dev server**

```bash
cd apps/dscar-web && npm run dev > /tmp/dscar-dev.log 2>&1 &
sleep 3
grep "Ready in" /tmp/dscar-dev.log
```
Expected: `✓ Ready in ...`.

- [ ] **Step 3: Smoke — VEHICLE_COLOR / VEHICLE_YEAR**

1. Abrir `http://localhost:3001` no browser anônimo.
2. Logar com `admin@paddock.solutions` / `paddock123`.
3. Navegar para uma OS com pendência `VEHICLE_COLOR` ou `VEHICLE_YEAR` (ou criar uma sem cor/ano via admin Django).
4. Tentar avançar status → wizard abre → expandir o item → preencher → Salvar → item fica verde.

- [ ] **Step 4: Smoke — DEDUCTIBLE / CASUALTY**

Repetir o fluxo acima numa OS de seguradora (`customer_type=insurer`) sem `deductible_amount` e `casualty_number`. Wizard deve mostrar 2 resolvers, ambos resolvíveis inline.

- [ ] **Step 5: Smoke — AUTH_DATE / ENTRY_DATE**

OS sem `authorization_date` ou `entry_date` deve mostrar os resolvers de data. Inserir um datetime-local, salvar, confirmar que o item fica verde e a OS reflete a data após refetch.

- [ ] **Step 6: Smoke — INSURER_DATA**

OS de seguradora sem `insurer` vinculada. Wizard mostra busca → digite "Po" → clica em "Porto Seguro" → vincula → item verde.

- [ ] **Step 7: Smoke — BUDGET_PDF_INSURER**

OS de seguradora sem PDF de orçamento. Wizard mostra zona de upload PDF → seleciona arquivo .pdf → upload → item verde.

> **Nota:** sem R2 configurado, o PDF salva mas pode não ser servido. Para o smoke, confirme apenas que `onResolved()` foi chamado (item verde) e que o backend retornou 200.

- [ ] **Step 8: Smoke — CANCEL_JUSTIFICATION**

1. Qualquer OS ativa.
2. Tentar transicionar para `cancelled` (via dropdown de status).
3. Wizard abre → resolver `CANCEL_JUSTIFICATION` aparece → textarea visível → digite "Cliente desistiu do orçamento" → contador mostra "27/10" → item verde.
4. Banner verde aparece → clica "Avançar para Cancelado" → toast success → OS fica com status `cancelled`.

- [ ] **Step 9: Smoke — FallbackResolver ainda funciona para codes Complexos**

OS com pendência tipo `PARTS_PENDING` ou `TIMESHEET_CLOSED`. Item mostra "Resolva em outra tela e volte aqui" (FallbackResolver) — comportamento intacto.

- [ ] **Step 10: Matar dev server**

```bash
pkill -f "next dev"
```

- [ ] **Step 11: Push e PR**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git push origin feature/transition-wizard-fase-4
gh pr create --title "feat(wizard): Wizard de Transição — Fase 4 (9 resolvers)" \
  --body "$(cat <<'EOF'
## Resumo

- 9 novos resolvers inline: \`VEHICLE_COLOR\`, \`VEHICLE_YEAR\`, \`DEDUCTIBLE_SET\`, \`CASUALTY_NUMBER\`, \`AUTH_DATE_SET\`, \`ENTRY_DATE_SET\`, \`INSURER_DATA\`, \`BUDGET_PDF_INSURER\`, \`CANCEL_JUSTIFICATION\`
- \`CANCEL_JUSTIFICATION\` via JustificationContext (caso especial — payload da transição, sem migration)
- Reusa hooks existentes: \`useInsurers\`, \`useUploadPhoto\` (com folder='orcamentos' para PDF), \`toLocalDatetime\`
- Zero migration backend

## Cobertura de testes

- DataResolver: +14 testes (8 → 22)
- InsurerResolver: 3 testes novos
- FileResolver: 2 testes novos
- CancelJustificationResolver: 4 testes novos
- TransitionWizard: +1 teste de integração de cancelamento
- Total Fase 4: **24 testes novos** (46 → 70 na suite)

## Spec

\`docs/superpowers/specs/2026-06-17-transition-wizard-fase-4-design.md\`

## Fora de escopo

- \`SIGNATURE_APPROVAL\` (Sprint B — depende de SignatureCanvas)
- \`EXIT_CHECKLIST\` (sprint dedicada)
- Codes Complexos (PARTS_*, TIMESHEET_*, NFCE_ISSUED, etc.)
- Remoção do TransitionRequirementsPanel (Fase 5, sprint dedicada)
- Cloudflare R2 storage (Sprint A — pendente)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage** — Cada decisão da spec mapeada a uma task:

| Spec | Task |
|---|---|
| §2 #1 VEHICLE_COLOR | Task 2 |
| §2 #2 VEHICLE_YEAR | Task 2 |
| §2 #3 DEDUCTIBLE_SET | Task 3 |
| §2 #4 CASUALTY_NUMBER | Task 3 |
| §2 #5 AUTH_DATE_SET | Task 3 |
| §2 #6 ENTRY_DATE_SET | Task 3 |
| §2 #7 INSURER_DATA | Task 4 |
| §2 #8 BUDGET_PDF_INSURER | Task 5 |
| §2 #9 CANCEL_JUSTIFICATION | Tasks 6 + 7 + 9 |
| §3.1 JustificationContext + handleAdvance | Tasks 6 + 9 |
| §3.2 Expandir VehicleDataForm | Task 2 |
| §3.3 Sub-forms triviais | Task 3 |
| §3.4 Datetime via toLocalDatetime | Tasks 1 + 3 |
| §3.5 InsurerResolver | Task 4 |
| §3.6 FileResolver | Task 5 |
| §3.7 Validação client-side | Embutida nos resolvers de cada task |
| §4.3 Registry update | Task 8 |
| §6 Estratégia de testes | Cada task TDD + Task 10 smoke |

**Placeholder scan** — zero TBD/TODO. Toda nota técnica é informação concreta (ex: "ajustar regex se label real diferir").

**Type consistency** — `ResolverProps`, `useInsurers`, `useUploadPhoto`, `toLocalDatetime`, `JustificationContextValue`, `patchOrder` — consistentes entre tasks.

**Risco:** Task 9 step 4 assume label `"Cancelado"` para o status `cancelled` em `SERVICE_ORDER_STATUS_CONFIG`. Anotado na nota — se label diferente, ajustar regex no teste.

---

## Plano completo finalizado

Após Task 10, a Fase 4 está entregue: 9 codes a mais resolvidos inline no wizard, totalizando 18 codes resolvidos vs FallbackResolver. Os codes Complexos restantes (`PARTS_*`, `TIMESHEET_*`, `NFCE_ISSUED`, `RECEIVABLE_CREATED`, `BUDGET_ITEMS_PRIVATE`, `COMPLEMENT_BILLED`, `VERSION_AUTHORIZED`, `EXIT_CHECKLIST`, `SIGNATURE_APPROVAL`) ficam para sprints dedicadas.
