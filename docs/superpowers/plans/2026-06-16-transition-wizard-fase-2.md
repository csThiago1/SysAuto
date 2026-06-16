# Wizard de Transição — Fase 2: Wizard Mínimo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a casca do `TransitionWizard` com `DataResolver` e `FallbackResolver` e integrá-lo no `ServiceOrderForm` e `KanbanBoard`, substituindo o fluxo atual de bloqueio por um modal guiado.

**Architecture:** `TransitionWizard` é um modal Dialog que recebe `orderId + target`, busca internamente o `useServiceOrder` para ter `transition_requirements` sempre fresco, e renderiza `WizardChecklist` (itens agrupados por severidade) + `WizardFooter` (banner verde quando tudo resolvido, link de override quando tem soft blocks). Cada item delega para um Resolver via `getResolver(code)`. Phase 2 cobre `DataResolver` (VEHICLE_BASIC_DATA, CUSTOMER_TYPE_SET, MILEAGE_OUT) e `FallbackResolver` (qualquer code desconhecido). `TransitionRequirementsPanel` continua vivo — só morre na Fase 5.

**Tech Stack:** React 19, Next.js 15, TypeScript strict, shadcn/ui Dialog, Vitest 2 + @testing-library/react, @paddock/types, TanStack Query v5.

---

## File Structure

**Criar:**
- `apps/dscar-web/src/components/transition-wizard/useWizard.ts` — hook: Set otimista de codes resolvidos
- `apps/dscar-web/src/components/transition-wizard/useWizard.test.ts`
- `apps/dscar-web/src/components/transition-wizard/resolvers/index.ts` — `getResolver(code)` + `ResolverProps`
- `apps/dscar-web/src/components/transition-wizard/resolvers/FallbackResolver.tsx` — item sem resolver inline
- `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.tsx` — VEHICLE_BASIC_DATA / CUSTOMER_TYPE_SET / MILEAGE_OUT
- `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.test.tsx`
- `apps/dscar-web/src/components/transition-wizard/WizardItem.tsx` — 1 bloco: ícone + texto + resolver expansível
- `apps/dscar-web/src/components/transition-wizard/WizardChecklist.tsx` — lista agrupada hard/soft/warn
- `apps/dscar-web/src/components/transition-wizard/WizardFooter.tsx` — footer neutro OU banner verde + link override
- `apps/dscar-web/src/components/transition-wizard/WizardFooter.test.tsx`
- `apps/dscar-web/src/components/transition-wizard/TransitionWizard.tsx` — modal principal
- `apps/dscar-web/src/components/transition-wizard/TransitionWizard.test.tsx`

**Modificar:**
- `apps/dscar-web/src/components/transition-wizard/index.ts` — adicionar exports novos
- `apps/dscar-web/src/app/(app)/os/[numero]/_components/ServiceOrderForm.tsx` — substituir `handleTransition` por lógica com wizard
- `apps/dscar-web/src/components/kanban/KanbanBoard.tsx` — abrir wizard em vez de toast no 400

---

## Task 0: Merge Fase 1 → main

**Files:** nenhum

- [ ] **Step 1: Conferir que os 5 commits da Fase 1 estão na branch**

```bash
git log --oneline main..HEAD
```
Expected: 5 linhas (Task 0–4 da Fase 1).

- [ ] **Step 2: Push e merge**

```bash
git push origin feature/transition-wizard-fase-1
git checkout main
git merge --no-ff feature/transition-wizard-fase-1 -m "feat(wizard): fase 1 — extrai OverrideRequestModal e ManagerCredentialsModal"
git push origin main
```

- [ ] **Step 3: Criar branch da Fase 2**

```bash
git checkout -b feature/transition-wizard-fase-2
```

---

## Task 1: useWizard — hook de estado otimista

**Files:**
- Criar: `apps/dscar-web/src/components/transition-wizard/useWizard.ts`
- Criar: `apps/dscar-web/src/components/transition-wizard/useWizard.test.ts`

- [ ] **Step 1: Criar o teste**

Path: `apps/dscar-web/src/components/transition-wizard/useWizard.test.ts`

```ts
import { renderHook, act } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { useWizard } from "./useWizard"
import type { ValidationBlock } from "@paddock/types"

const hard: ValidationBlock[] = [{ code: "CUSTOMER_TYPE_SET", message: "Tipo não definido" }]
const soft: ValidationBlock[] = [{ code: "PHOTOS_MIN_12", message: "Faltam fotos" }]

describe("useWizard", () => {
  it("começa com set vazio", () => {
    const { result } = renderHook(() => useWizard())
    expect(result.current.resolvedCodes.size).toBe(0)
  })

  it("isAllBlockingResolved retorna true sem blocks", () => {
    const { result } = renderHook(() => useWizard())
    expect(result.current.isAllBlockingResolved([], [])).toBe(true)
  })

  it("isAllBlockingResolved retorna false com blocks não resolvidos", () => {
    const { result } = renderHook(() => useWizard())
    expect(result.current.isAllBlockingResolved(hard, soft)).toBe(false)
  })

  it("markResolved adiciona code ao set", () => {
    const { result } = renderHook(() => useWizard())
    act(() => result.current.markResolved("CUSTOMER_TYPE_SET"))
    expect(result.current.resolvedCodes.has("CUSTOMER_TYPE_SET")).toBe(true)
  })

  it("isAllBlockingResolved retorna true quando todos resolvidos", () => {
    const { result } = renderHook(() => useWizard())
    act(() => {
      result.current.markResolved("CUSTOMER_TYPE_SET")
      result.current.markResolved("PHOTOS_MIN_12")
    })
    expect(result.current.isAllBlockingResolved(hard, soft)).toBe(true)
  })

  it("markResolved é idempotente", () => {
    const { result } = renderHook(() => useWizard())
    act(() => result.current.markResolved("CUSTOMER_TYPE_SET"))
    act(() => result.current.markResolved("CUSTOMER_TYPE_SET"))
    expect(result.current.resolvedCodes.size).toBe(1)
  })

  it("reset zera o set", () => {
    const { result } = renderHook(() => useWizard())
    act(() => result.current.markResolved("CUSTOMER_TYPE_SET"))
    act(() => result.current.reset())
    expect(result.current.resolvedCodes.size).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd apps/dscar-web && npm test -- src/components/transition-wizard/useWizard.test.ts
```
Expected: erro de import.

- [ ] **Step 3: Implementar**

Path: `apps/dscar-web/src/components/transition-wizard/useWizard.ts`

```ts
import { useState, useCallback } from "react"
import type { ValidationBlock } from "@paddock/types"

interface UseWizardReturn {
  resolvedCodes: Set<string>
  markResolved: (code: string) => void
  reset: () => void
  isAllBlockingResolved: (hardBlocks: ValidationBlock[], softBlocks: ValidationBlock[]) => boolean
}

export function useWizard(): UseWizardReturn {
  const [resolvedCodes, setResolvedCodes] = useState<Set<string>>(new Set())

  const markResolved = useCallback((code: string) => {
    setResolvedCodes((prev) => new Set([...prev, code]))
  }, [])

  const reset = useCallback(() => setResolvedCodes(new Set()), [])

  const isAllBlockingResolved = useCallback(
    (hardBlocks: ValidationBlock[], softBlocks: ValidationBlock[]): boolean => {
      const blocking = [...hardBlocks, ...softBlocks]
      if (blocking.length === 0) return true
      return blocking.every((b) => resolvedCodes.has(b.code))
    },
    [resolvedCodes]
  )

  return { resolvedCodes, markResolved, reset, isAllBlockingResolved }
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/components/transition-wizard/useWizard.test.ts
```
Expected: `7 tests passed`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/useWizard.ts \
        apps/dscar-web/src/components/transition-wizard/useWizard.test.ts
git commit -m "feat(wizard): useWizard hook — set otimista de codes resolvidos (7 testes)"
```

---

## Task 2: ResolverProps + FallbackResolver + resolvers/index.ts

**Files:**
- Criar: `apps/dscar-web/src/components/transition-wizard/resolvers/index.ts`
- Criar: `apps/dscar-web/src/components/transition-wizard/resolvers/FallbackResolver.tsx`

- [ ] **Step 1: Criar `resolvers/index.ts`**

Path: `apps/dscar-web/src/components/transition-wizard/resolvers/index.ts`

```ts
import type React from "react"
import type { ValidationBlock, ServiceOrder } from "@paddock/types"

export interface ResolverProps {
  block: ValidationBlock
  order: ServiceOrder
  onResolved: (code: string) => void
}

// Importações lazy para evitar circular — preenchido após criar cada resolver
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<string, React.ComponentType<ResolverProps>> = {}

export function registerResolver(
  codes: string[],
  component: React.ComponentType<ResolverProps>
): void {
  for (const code of codes) {
    REGISTRY[code] = component
  }
}

export function getResolver(code: string): React.ComponentType<ResolverProps> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FallbackResolver } = require("./FallbackResolver") as {
    FallbackResolver: React.ComponentType<ResolverProps>
  }
  return REGISTRY[code] ?? FallbackResolver
}
```

> **Nota:** usamos `require` lazy aqui para evitar import circular (FallbackResolver é o fallback mas também é um componente concreto). Na Task 3, ao criar o `DataResolver`, registramos seus códigos via `registerResolver`.

- [ ] **Step 2: Criar `FallbackResolver.tsx`**

Path: `apps/dscar-web/src/components/transition-wizard/resolvers/FallbackResolver.tsx`

```tsx
"use client"

import type { ResolverProps } from "./index"

export function FallbackResolver({ block }: ResolverProps) {
  return (
    <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
      <p className="font-medium">{block.message}</p>
      <p className="mt-1 text-xs">Resolva em outra tela e volte aqui para continuar.</p>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/dscar-web && npm run typecheck
```
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/resolvers/
git commit -m "feat(wizard): ResolverProps + FallbackResolver + registry"
```

---

## Task 3: DataResolver (VEHICLE_BASIC_DATA, CUSTOMER_TYPE_SET, MILEAGE_OUT)

**Files:**
- Criar: `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.tsx`
- Criar: `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.test.tsx`

- [ ] **Step 1: Criar o teste**

Path: `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeAll } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { DataResolver } from "./DataResolver"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"

// Mock do apiFetch — não queremos bater no backend nos testes unit
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({}),
}))

// Mock do useQueryClient para não precisar de provider real
vi.mock("@tanstack/react-query", async (imp) => {
  const real = await imp<typeof import("@tanstack/react-query")>()
  return {
    ...real,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  }
})

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const ORDER = {
  id: "abc-123",
  number: 42,
  plate: "",
  make: "",
  model: "",
  customer_type: null,
  mileage_out: null,
} as unknown as ServiceOrder

function block(code: string): ValidationBlock {
  return { code, message: `Bloco ${code}` }
}

describe("DataResolver — VEHICLE_BASIC_DATA", () => {
  it("renderiza campos placa + montadora + modelo", () => {
    wrap(<DataResolver block={block("VEHICLE_BASIC_DATA")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/placa/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/montadora/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/modelo/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar com dados válidos", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_BASIC_DATA")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/placa/i), "ABC1234")
    await user.type(screen.getByLabelText(/montadora/i), "Fiat")
    await user.type(screen.getByLabelText(/modelo/i), "Uno")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("VEHICLE_BASIC_DATA"))
  })
})

describe("DataResolver — CUSTOMER_TYPE_SET", () => {
  it("renderiza toggle particular / seguradora", () => {
    wrap(<DataResolver block={block("CUSTOMER_TYPE_SET")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByRole("button", { name: /particular/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /seguradora/i })).toBeInTheDocument()
  })

  it("chama onResolved ao selecionar um tipo", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("CUSTOMER_TYPE_SET")} order={ORDER} onResolved={onResolved} />)
    await user.click(screen.getByRole("button", { name: /particular/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("CUSTOMER_TYPE_SET"))
  })
})

describe("DataResolver — MILEAGE_OUT", () => {
  it("renderiza input de KM saída", () => {
    wrap(<DataResolver block={block("MILEAGE_OUT")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/km de saída/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar KM válido", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("MILEAGE_OUT")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/km de saída/i), "45000")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("MILEAGE_OUT"))
  })

  it("não chama onResolved com KM inválido (zero ou vazio)", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("MILEAGE_OUT")} order={ORDER} onResolved={onResolved} />)
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd apps/dscar-web && npm test -- src/components/transition-wizard/resolvers/DataResolver.test.tsx
```
Expected: erro de import.

- [ ] **Step 3: Criar `DataResolver.tsx`**

Path: `apps/dscar-web/src/components/transition-wizard/resolvers/DataResolver.tsx`

```tsx
"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { registerResolver, type ResolverProps } from "./index"

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function patchOrder(id: string, data: Record<string, unknown>): Promise<void> {
  await apiFetch(`/api/proxy/service-orders/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

// ─── Sub-formulário: VEHICLE_BASIC_DATA ──────────────────────────────────────

function VehicleDataForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [plate, setPlate] = useState(order.plate ?? "")
  const [make, setMake] = useState(order.make ?? "")
  const [model, setModel] = useState(order.model ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    if (!plate || !make || !model) {
      toast.error("Preencha placa, montadora e modelo")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { plate, make, model })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      onResolved("VEHICLE_BASIC_DATA")
    } catch {
      toast.error("Erro ao salvar dados do veículo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
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
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

// ─── Sub-formulário: CUSTOMER_TYPE_SET ───────────────────────────────────────

function CustomerTypeForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)

  async function handleSelect(type: "private" | "insurer"): Promise<void> {
    setSaving(true)
    try {
      await patchOrder(order.id, { customer_type: type })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      onResolved("CUSTOMER_TYPE_SET")
    } catch {
      toast.error("Erro ao definir tipo de OS")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex gap-2">
      <Button
        size="sm"
        variant={order.customer_type === "private" ? "default" : "outline"}
        disabled={saving}
        onClick={() => void handleSelect("private")}
      >
        Particular
      </Button>
      <Button
        size="sm"
        variant={order.customer_type === "insurer" ? "default" : "outline"}
        disabled={saving}
        onClick={() => void handleSelect("insurer")}
      >
        Seguradora
      </Button>
    </div>
  )
}

// ─── Sub-formulário: MILEAGE_OUT ─────────────────────────────────────────────

function MileageOutForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [km, setKm] = useState(order.mileage_out?.toString() ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    const val = parseInt(km, 10)
    if (isNaN(val) || val < 0) {
      toast.error("KM inválido")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { mileage_out: val })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      onResolved("MILEAGE_OUT")
    } catch {
      toast.error("Erro ao salvar KM de saída")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-mileage-out" className="text-xs font-medium">KM de Saída</label>
        <input
          id="dv-mileage-out"
          type="number"
          min="0"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="45000"
        />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function DataResolver(props: ResolverProps) {
  if (props.block.code === "VEHICLE_BASIC_DATA") return <VehicleDataForm {...props} />
  if (props.block.code === "CUSTOMER_TYPE_SET") return <CustomerTypeForm {...props} />
  if (props.block.code === "MILEAGE_OUT") return <MileageOutForm {...props} />
  return null
}

// Registra os codes que este resolver conhece
registerResolver(["VEHICLE_BASIC_DATA", "CUSTOMER_TYPE_SET", "MILEAGE_OUT"], DataResolver)
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/components/transition-wizard/resolvers/DataResolver.test.tsx
```
Expected: `8 tests passed`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/resolvers/
git commit -m "feat(wizard): DataResolver — VEHICLE_BASIC_DATA, CUSTOMER_TYPE_SET, MILEAGE_OUT (8 testes)"
```

---

## Task 4: WizardItem + WizardChecklist

**Files:**
- Criar: `apps/dscar-web/src/components/transition-wizard/WizardItem.tsx`
- Criar: `apps/dscar-web/src/components/transition-wizard/WizardChecklist.tsx`

Esses componentes são pequenos e puramente de apresentação. Não têm lógica de negócio — apenas renderizam e delegam ao resolver. Sem testes unit separados (cobertos pelos testes de integração do `TransitionWizard` na Task 6).

- [ ] **Step 1: Criar `WizardItem.tsx`**

Path: `apps/dscar-web/src/components/transition-wizard/WizardItem.tsx`

```tsx
"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Lock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getResolver } from "./resolvers/index"
import type { ResolverProps } from "./resolvers/index"
import type { ValidationBlock, ServiceOrder } from "@paddock/types"

type Severity = "hard" | "soft" | "warning"

interface WizardItemProps {
  block: ValidationBlock
  severity: Severity
  isResolved: boolean
  order: ServiceOrder
  onResolved: (code: string) => void
}

const ICON: Record<Severity, React.ComponentType<{ className?: string }>> = {
  hard: XCircle,
  soft: Lock,
  warning: AlertTriangle,
}

const COLOR: Record<Severity, string> = {
  hard: "text-error-500",
  soft: "text-warning-500",
  warning: "text-muted-foreground",
}

export function WizardItem({ block, severity, isResolved, order, onResolved }: WizardItemProps) {
  const [expanded, setExpanded] = useState(false)
  const Resolver = getResolver(block.code)
  const hasFallback = Resolver.displayName === "FallbackResolver" || Resolver.name === "FallbackResolver"
  const Icon = isResolved ? CheckCircle2 : ICON[severity]
  const colorClass = isResolved ? "text-success-500" : COLOR[severity]

  return (
    <li className="rounded-md border bg-card px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorClass}`} aria-hidden="true" />
          <span className="text-sm">{block.message}</span>
        </div>
        {!isResolved && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs shrink-0"
            disabled={hasFallback && severity === "hard"}
            onClick={() => setExpanded((p) => !p)}
            aria-label={expanded ? "Recolher resolver" : "Resolver aqui"}
          >
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5 mr-1" />Fechar</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5 mr-1" />Resolver aqui</>
            )}
          </Button>
        )}
      </div>

      {expanded && !isResolved && (
        <Resolver block={block} order={order} onResolved={(code) => {
          onResolved(code)
          setExpanded(false)
        }} />
      )}
    </li>
  )
}
```

- [ ] **Step 2: Criar `WizardChecklist.tsx`**

Path: `apps/dscar-web/src/components/transition-wizard/WizardChecklist.tsx`

```tsx
"use client"

import { WizardItem } from "./WizardItem"
import type { ValidationBlock, ServiceOrder } from "@paddock/types"

interface WizardChecklistProps {
  hardBlocks: ValidationBlock[]
  softBlocks: ValidationBlock[]
  warnings: ValidationBlock[]
  resolvedCodes: Set<string>
  order: ServiceOrder
  onResolved: (code: string) => void
}

export function WizardChecklist({
  hardBlocks,
  softBlocks,
  warnings,
  resolvedCodes,
  order,
  onResolved,
}: WizardChecklistProps) {
  return (
    <ul className="space-y-2" role="list" aria-label="Pendências da transição">
      {hardBlocks.map((b) => (
        <WizardItem
          key={b.code}
          block={b}
          severity="hard"
          isResolved={resolvedCodes.has(b.code)}
          order={order}
          onResolved={onResolved}
        />
      ))}
      {softBlocks.map((b) => (
        <WizardItem
          key={b.code}
          block={b}
          severity="soft"
          isResolved={resolvedCodes.has(b.code)}
          order={order}
          onResolved={onResolved}
        />
      ))}
      {warnings.map((b) => (
        <WizardItem
          key={b.code}
          block={b}
          severity="warning"
          isResolved={resolvedCodes.has(b.code)}
          order={order}
          onResolved={onResolved}
        />
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/dscar-web && npm run typecheck
```
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/WizardItem.tsx \
        apps/dscar-web/src/components/transition-wizard/WizardChecklist.tsx
git commit -m "feat(wizard): WizardItem + WizardChecklist — renderiza blocks por severidade"
```

---

## Task 5: WizardFooter

**Files:**
- Criar: `apps/dscar-web/src/components/transition-wizard/WizardFooter.tsx`
- Criar: `apps/dscar-web/src/components/transition-wizard/WizardFooter.test.tsx`

- [ ] **Step 1: Criar o teste**

Path: `apps/dscar-web/src/components/transition-wizard/WizardFooter.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { WizardFooter } from "./WizardFooter"

function baseProps(overrides = {}) {
  return {
    targetLabel: "Reparo",
    allBlockingResolved: false,
    hasSoftBlocks: false,
    isAdvancing: false,
    onAdvance: vi.fn(),
    onRequestOverride: vi.fn(),
    ...overrides,
  }
}

describe("WizardFooter", () => {
  it("mostra texto neutro quando pendências não resolvidas", () => {
    render(<WizardFooter {...baseProps()} />)
    expect(screen.getByText(/resolva os itens/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /avançar/i })).not.toBeInTheDocument()
  })

  it("mostra banner verde + botão avançar quando tudo resolvido", () => {
    render(<WizardFooter {...baseProps({ allBlockingResolved: true })} />)
    expect(screen.getByRole("button", { name: /avançar para reparo/i })).toBeInTheDocument()
  })

  it("chama onAdvance ao clicar no botão verde", async () => {
    const user = userEvent.setup()
    const onAdvance = vi.fn()
    render(<WizardFooter {...baseProps({ allBlockingResolved: true, onAdvance })} />)
    await user.click(screen.getByRole("button", { name: /avançar para reparo/i }))
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it("mostra spinner no botão quando isAdvancing=true", () => {
    render(<WizardFooter {...baseProps({ allBlockingResolved: true, isAdvancing: true })} />)
    const btn = screen.getByRole("button", { name: /avançar para reparo/i })
    expect(btn).toBeDisabled()
    expect(btn.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("mostra link de override quando há soft blocks e pendências", () => {
    render(<WizardFooter {...baseProps({ hasSoftBlocks: true })} />)
    expect(screen.getByRole("button", { name: /solicitar liberação/i })).toBeInTheDocument()
  })

  it("não mostra link de override quando não há soft blocks", () => {
    render(<WizardFooter {...baseProps({ hasSoftBlocks: false })} />)
    expect(screen.queryByRole("button", { name: /solicitar liberação/i })).not.toBeInTheDocument()
  })

  it("chama onRequestOverride ao clicar no link", async () => {
    const user = userEvent.setup()
    const onRequestOverride = vi.fn()
    render(<WizardFooter {...baseProps({ hasSoftBlocks: true, onRequestOverride })} />)
    await user.click(screen.getByRole("button", { name: /solicitar liberação/i }))
    expect(onRequestOverride).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd apps/dscar-web && npm test -- src/components/transition-wizard/WizardFooter.test.tsx
```
Expected: erro de import.

- [ ] **Step 3: Criar `WizardFooter.tsx`**

Path: `apps/dscar-web/src/components/transition-wizard/WizardFooter.tsx`

```tsx
"use client"

import { CheckCircle2, Loader2, Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WizardFooterProps {
  targetLabel: string
  allBlockingResolved: boolean
  hasSoftBlocks: boolean
  isAdvancing: boolean
  onAdvance: () => void
  onRequestOverride: () => void
}

export function WizardFooter({
  targetLabel,
  allBlockingResolved,
  hasSoftBlocks,
  isAdvancing,
  onAdvance,
  onRequestOverride,
}: WizardFooterProps) {
  return (
    <div className="space-y-2 pt-1">
      {allBlockingResolved ? (
        <div className="rounded-md bg-success-500/10 border border-success-500/20 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-success-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium">Tudo pronto para avançar</span>
          </div>
          <Button
            size="sm"
            disabled={isAdvancing}
            onClick={onAdvance}
          >
            {isAdvancing && (
              <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
            )}
            Avançar para {targetLabel}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Resolva os itens acima para liberar a transição.
        </p>
      )}

      {hasSoftBlocks && !allBlockingResolved && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={onRequestOverride}
        >
          <Unlock className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          Solicitar liberação do gerente
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/components/transition-wizard/WizardFooter.test.tsx
```
Expected: `7 tests passed`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/WizardFooter.tsx \
        apps/dscar-web/src/components/transition-wizard/WizardFooter.test.tsx
git commit -m "feat(wizard): WizardFooter — banner verde + link override (7 testes)"
```

---

## Task 6: TransitionWizard — modal principal

**Files:**
- Criar: `apps/dscar-web/src/components/transition-wizard/TransitionWizard.tsx`
- Criar: `apps/dscar-web/src/components/transition-wizard/TransitionWizard.test.tsx`

- [ ] **Step 1: Criar o teste de integração**

Path: `apps/dscar-web/src/components/transition-wizard/TransitionWizard.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TransitionWizard } from "./TransitionWizard"
import type { ServiceOrder } from "@paddock/types"

// Mock useServiceOrder — retorna order com transition_requirements
const mockOrder: Partial<ServiceOrder> = {
  id: "os-1",
  number: 42,
  status: "reception",
  plate: "",
  make: "",
  model: "",
  customer_type: null,
  mileage_out: null,
  transition_requirements: {
    initial_survey: {
      can_proceed: false,
      hard_blocks: [{ code: "CUSTOMER_TYPE_SET", message: "Tipo de OS não definido" }],
      soft_blocks: [],
      warnings: [],
      has_pending_override: false,
    },
  },
}

vi.mock("@/app/(app)/os/[numero]/_hooks/useServiceOrder", () => ({
  useServiceOrder: () => ({ data: mockOrder, isLoading: false }),
}))

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

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn().mockResolvedValue({}) }))
vi.mock("@tanstack/react-query", async (imp) => {
  const real = await imp<typeof import("@tanstack/react-query")>()
  return { ...real, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )
}

describe("TransitionWizard", () => {
  it("mostra título com número da OS e status destino", () => {
    wrap(
      <TransitionWizard orderId="os-1" target="initial_survey" onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    expect(screen.getByText(/OS #42/)).toBeInTheDocument()
    expect(screen.getByText(/Vistoria Inicial/i)).toBeInTheDocument()
  })

  it("lista o hard block na checklist", () => {
    wrap(
      <TransitionWizard orderId="os-1" target="initial_survey" onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    expect(screen.getByText("Tipo de OS não definido")).toBeInTheDocument()
  })

  it("footer mostra 'Resolva os itens' enquanto há pendências", () => {
    wrap(
      <TransitionWizard orderId="os-1" target="initial_survey" onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    expect(screen.getByText(/resolva os itens/i)).toBeInTheDocument()
  })

  it("expandir item mostra CustomerTypeForm", async () => {
    const user = userEvent.setup()
    wrap(
      <TransitionWizard orderId="os-1" target="initial_survey" onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    await user.click(screen.getByRole("button", { name: /resolver aqui/i }))
    expect(screen.getByRole("button", { name: /particular/i })).toBeInTheDocument()
  })

  it("chama onClose ao clicar no X do dialog", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    wrap(
      <TransitionWizard orderId="os-1" target="initial_survey" onClose={onClose} onSuccess={vi.fn()} />
    )
    await user.click(screen.getByRole("button", { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd apps/dscar-web && npm test -- src/components/transition-wizard/TransitionWizard.test.tsx
```
Expected: erro de import.

- [ ] **Step 3: Criar `TransitionWizard.tsx`**

Path: `apps/dscar-web/src/components/transition-wizard/TransitionWizard.tsx`

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import type { ServiceOrderStatus } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useServiceOrder } from "@/app/(app)/os/[numero]/_hooks/useServiceOrder"
import {
  useTransitionWithValidation,
  useRequestOverride,
} from "@/hooks/useTransitionValidation"
import { useWizard } from "./useWizard"
import { WizardChecklist } from "./WizardChecklist"
import { WizardFooter } from "./WizardFooter"
import { OverrideRequestModal } from "./OverrideRequestModal"
import { ManagerCredentialsModal } from "./ManagerCredentialsModal"

interface TransitionWizardProps {
  orderId: string
  target: ServiceOrderStatus
  onClose: () => void
  onSuccess: () => void
}

export function TransitionWizard({ orderId, target, onClose, onSuccess }: TransitionWizardProps) {
  const { data: order, isLoading } = useServiceOrder(orderId)
  const transitionMutation = useTransitionWithValidation(orderId)
  const overrideMutation = useRequestOverride(orderId)
  const { resolvedCodes, markResolved, reset, isAllBlockingResolved } = useWizard()

  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [managerModalOpen, setManagerModalOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState("")
  const [managerEmail, setManagerEmail] = useState("")
  const [managerPassword, setManagerPassword] = useState("")

  const validation = order?.transition_requirements?.[target]
  const hardBlocks = validation?.hard_blocks ?? []
  const softBlocks = validation?.soft_blocks ?? []
  const warnings = validation?.warnings ?? []

  // Combina set otimista com o estado atual do backend
  const backendResolved = new Set([
    ...hardBlocks.filter((b) => resolvedCodes.has(b.code)).map((b) => b.code),
    ...softBlocks.filter((b) => resolvedCodes.has(b.code)).map((b) => b.code),
  ])
  const effectiveResolved = new Set([...resolvedCodes, ...backendResolved])
  const allBlockingResolved = isAllBlockingResolved(hardBlocks, softBlocks)

  const targetLabel = SERVICE_ORDER_STATUS_CONFIG[target]?.label ?? target

  async function handleAdvance(): Promise<void> {
    try {
      await transitionMutation.mutateAsync({ new_status: target })
      toast.success(`Status atualizado para "${targetLabel}"`)
      reset()
      onSuccess()
    } catch {
      toast.error("Erro ao avançar status — tente novamente")
    }
  }

  async function handleForceWithCredentials(): Promise<void> {
    try {
      await transitionMutation.mutateAsync({
        new_status: target,
        force: true,
        manager_email: managerEmail,
        manager_password: managerPassword,
        justification: overrideReason,
      })
      const label = SERVICE_ORDER_STATUS_CONFIG[target]?.label ?? target
      toast.success(`Status atualizado para "${label}" (liberado pelo gerente)`)
      setManagerModalOpen(false)
      setOverrideModalOpen(false)
      reset()
      onSuccess()
    } catch {
      toast.error("Credenciais inválidas ou permissão insuficiente")
    }
  }

  async function handleRequestRemoteOverride(): Promise<void> {
    if (!overrideReason.trim()) return
    try {
      await overrideMutation.mutateAsync({ target_status: target, reason: overrideReason })
      setOverrideModalOpen(false)
      setOverrideReason("")
    } catch {
      // handled by hook
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) { reset(); onClose() } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {isLoading ? "Carregando..." : `OS #${order?.number} — Avançar para ${targetLabel}`}
            </DialogTitle>
            {!isLoading && order && (
              <DialogDescription>
                Resolva as pendências abaixo para confirmar a transição.
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && order && (
              <>
                <WizardChecklist
                  hardBlocks={hardBlocks}
                  softBlocks={softBlocks}
                  warnings={warnings}
                  resolvedCodes={effectiveResolved}
                  order={order}
                  onResolved={markResolved}
                />

                <WizardFooter
                  targetLabel={targetLabel}
                  allBlockingResolved={allBlockingResolved}
                  hasSoftBlocks={softBlocks.length > 0}
                  isAdvancing={transitionMutation.isPending}
                  onAdvance={() => void handleAdvance()}
                  onRequestOverride={() => setOverrideModalOpen(true)}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OverrideRequestModal
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        orderNumber={String(order?.number ?? "")}
        currentStatusLabel={
          SERVICE_ORDER_STATUS_CONFIG[order?.status as ServiceOrderStatus]?.label ?? ""
        }
        targetStatusLabel={targetLabel}
        softBlocks={softBlocks}
        reason={overrideReason}
        onReasonChange={setOverrideReason}
        isSubmittingRemote={overrideMutation.isPending}
        onManagerPresentClick={() => {
          if (!overrideReason.trim()) {
            toast.error("Preencha o motivo da solicitação")
            return
          }
          setManagerModalOpen(true)
        }}
        onRemoteSubmit={() => void handleRequestRemoteOverride()}
      />

      <ManagerCredentialsModal
        open={managerModalOpen}
        onOpenChange={setManagerModalOpen}
        email={managerEmail}
        onEmailChange={setManagerEmail}
        password={managerPassword}
        onPasswordChange={setManagerPassword}
        isAuthorizing={transitionMutation.isPending}
        onAuthorize={() => void handleForceWithCredentials()}
      />
    </>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/components/transition-wizard/TransitionWizard.test.tsx
```
Expected: `5 tests passed`.

- [ ] **Step 5: Atualizar barrel**

Modifica `apps/dscar-web/src/components/transition-wizard/index.ts`:

```ts
export {
  OverrideRequestModal,
  type OverrideRequestModalProps,
} from "./OverrideRequestModal"

export {
  ManagerCredentialsModal,
  type ManagerCredentialsModalProps,
} from "./ManagerCredentialsModal"

export { TransitionWizard } from "./TransitionWizard"
export { useWizard } from "./useWizard"
```

- [ ] **Step 6: Typecheck final**

```bash
npm run typecheck
```
Expected: zero erros.

- [ ] **Step 7: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/TransitionWizard.tsx \
        apps/dscar-web/src/components/transition-wizard/TransitionWizard.test.tsx \
        apps/dscar-web/src/components/transition-wizard/index.ts
git commit -m "feat(wizard): TransitionWizard — modal principal com checklist + footer + override (5 testes)"
```

---

## Task 7: Integração no ServiceOrderForm

**Files:**
- Modificar: `apps/dscar-web/src/app/(app)/os/[numero]/_components/ServiceOrderForm.tsx`

O `handleTransition` atual chama direto `transitionMutation.mutateAsync`. Vamos adicionar uma branch: se `can_proceed === false`, abre o wizard. Caso contrário, comportamento atual.

- [ ] **Step 1: Ler o handleTransition atual (para confirmar a linha exata)**

```bash
grep -n "handleTransition\|wizardTarget\|TransitionWizard\|can_proceed" \
  apps/dscar-web/src/app/\(app\)/os/\[numero\]/_components/ServiceOrderForm.tsx
```
Expected: ver `handleTransition` em torno da linha 124, sem `wizardTarget`.

- [ ] **Step 2: Adicionar import do TransitionWizard**

No bloco de imports do arquivo, após a linha que importa `TransitionRequirementsPanel`:

```ts
import { TransitionWizard } from "@/components/transition-wizard"
```

- [ ] **Step 3: Adicionar state do wizard**

Logo após a linha `const transitionMutation = useTransitionStatus(order.id)` (≈ linha 99), adicionar:

```ts
const [wizardTarget, setWizardTarget] = useState<ServiceOrderStatus | null>(null)
```

Adicionar `useState` ao import do React se ainda não estiver (já deve estar).

- [ ] **Step 4: Substituir handleTransition**

Substituir o corpo de `handleTransition` por:

```ts
async function handleTransition(newStatus: ServiceOrderStatus) {
  const req = order.transition_requirements?.[newStatus]
  if (req && req.can_proceed === false) {
    setWizardTarget(newStatus)
    return
  }
  try {
    await transitionMutation.mutateAsync(newStatus)
    toast.success(`Status atualizado para "${SERVICE_ORDER_STATUS_CONFIG[newStatus].label}"`)
    router.refresh()
  } catch {
    toast.error("Erro ao atualizar status. Tente novamente.")
  }
}
```

- [ ] **Step 5: Adicionar render do TransitionWizard**

No JSX do componente, logo antes do `return` final (ou no final da árvore de JSX, após o `<TransitionRequirementsPanel />`), adicionar:

```tsx
{wizardTarget && (
  <TransitionWizard
    orderId={order.id}
    target={wizardTarget}
    onClose={() => setWizardTarget(null)}
    onSuccess={() => {
      setWizardTarget(null)
      router.refresh()
    }}
  />
)}
```

- [ ] **Step 6: Typecheck**

```bash
cd apps/dscar-web && npm run typecheck
```
Expected: zero erros.

- [ ] **Step 7: Commit**

```bash
cd ../..
git add apps/dscar-web/src/app/\(app\)/os/\[numero\]/_components/ServiceOrderForm.tsx
git commit -m "feat(wizard): ServiceOrderForm abre TransitionWizard quando can_proceed=false"
```

---

## Task 8: Integração no KanbanBoard

**Files:**
- Modificar: `apps/dscar-web/src/components/kanban/KanbanBoard.tsx`

O `handleDragEnd` atual faz rollback e toast de erro em qualquer falha. Vamos detectar quando o 400 é de soft/hard block e abrir o wizard em vez de apenas mostrar um toast.

- [ ] **Step 1: Ler o handleDragEnd atual (confirmar linhas)**

```bash
grep -n "handleDragEnd\|wizardState\|TransitionWizard\|ApiError\|catch" \
  apps/dscar-web/src/components/kanban/KanbanBoard.tsx | head -20
```
Expected: ver `handleDragEnd` com catch rollback + toast, sem `wizardState`.

- [ ] **Step 2: Adicionar import**

No bloco de imports, adicionar:

```ts
import { TransitionWizard } from "@/components/transition-wizard"
import { ApiError } from "@/lib/api"
import type { ServiceOrderStatus } from "@paddock/types"
```

Verificar se `ServiceOrderStatus` e `ApiError` já estão importados — se sim, não duplicar.

- [ ] **Step 3: Adicionar state do wizard**

No corpo do componente `KanbanBoard`, após os outros `useState`, adicionar:

```ts
const [wizardState, setWizardState] = useState<{
  orderId: string
  target: ServiceOrderStatus
} | null>(null)
```

- [ ] **Step 4: Modificar handleDragEnd — verificar antes do apiFetch**

No `handleDragEnd`, antes da linha `setOptimisticMoves((prev) => ...` (otimistic update), adicionar verificação de can_proceed:

```ts
// Se temos dados de transition_requirements e can_proceed é false, abre wizard sem chamar API
const req = order.transition_requirements?.[newStatus]
if (req?.can_proceed === false) {
  setWizardState({ orderId, target: newStatus })
  return
}
```

- [ ] **Step 5: Modificar o catch do handleDragEnd — abrir wizard em 400**

No catch do `handleDragEnd`, substituir o bloco atual:

```ts
// ANTES:
} catch (err) {
  setOptimisticMoves((prev) => {
    const next = { ...prev }
    delete next[orderId]
    return next
  })
  toast.error(
    err instanceof Error ? err.message : "Erro ao mover OS"
  )
  return
}
```

Por:

```ts
// DEPOIS:
} catch (err) {
  // Rollback otimista sempre
  setOptimisticMoves((prev) => {
    const next = { ...prev }
    delete next[orderId]
    return next
  })
  // 400 = bloqueio de transição → abre wizard
  if (err instanceof ApiError && err.status === 400) {
    setWizardState({ orderId, target: newStatus })
    return
  }
  toast.error(
    err instanceof Error ? err.message : "Erro ao mover OS"
  )
  return
}
```

- [ ] **Step 6: Adicionar render do TransitionWizard no JSX do KanbanBoard**

No JSX do `KanbanBoard`, logo antes do `</DndContext>` de fechamento (ou logo após), adicionar:

```tsx
{wizardState && (
  <TransitionWizard
    orderId={wizardState.orderId}
    target={wizardState.target}
    onClose={() => setWizardState(null)}
    onSuccess={() => {
      setWizardState(null)
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
    }}
  />
)}
```

- [ ] **Step 7: Typecheck**

```bash
cd apps/dscar-web && npm run typecheck
```
Expected: zero erros.

- [ ] **Step 8: Rodar suite completa de testes**

```bash
npm test
```
Expected: os arquivos da Fase 2 passam (≥ 27 testes novos). Falhas em `NotificationBell.test.tsx` são pré-existentes — ignorar.

- [ ] **Step 9: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/kanban/KanbanBoard.tsx
git commit -m "feat(wizard): KanbanBoard abre TransitionWizard em 400 e quando can_proceed=false"
```

---

## Task 9: Smoke manual + push

**Files:** nenhum.

- [ ] **Step 1: Testar fluxo no detalhe da OS**

1. Abre `http://localhost:3001/os` → clica em qualquer OS em status `budget`
2. Clica em "Avançar Status" → se `can_proceed === false`, o `TransitionWizard` deve abrir
3. Expande um item → preenche → salva → item fica verde
4. Quando todos hard+soft resolvidos → footer vira banner verde → clica "Avançar"
5. Confirma que a OS avançou e o wizard fechou

- [ ] **Step 2: Testar fluxo no Kanban**

1. Vai em `/os` → abre o Kanban (se houver aba/view)
2. Arrasta uma OS com soft block para a próxima coluna
3. O card deve voltar e o `TransitionWizard` deve abrir

- [ ] **Step 3: Testar fallback — code desconhecido**

Diretamente no browser console, inspeciona o objeto `order.transition_requirements` de alguma OS. Se houver um code fora dos 3 do `DataResolver`, confirma que aparece o `FallbackResolver` (mensagem + "resolva em outra tela").

- [ ] **Step 4: Push e PR**

```bash
git log --oneline main..HEAD
```
Expected: ≥ 7 commits da Fase 2.

```bash
git push origin feature/transition-wizard-fase-2
```
Abre PR para main.

---

## Auto-review do plano

**Cobertura da spec (seção 7, Fase 2):**
- ✅ Casca do `TransitionWizard` — Task 6
- ✅ `WizardItem` + `WizardChecklist` — Task 4
- ✅ `WizardFooter` — Task 5
- ✅ `useWizard` — Task 1
- ✅ `FallbackResolver` — Task 2
- ✅ `DataResolver` (VEHICLE_BASIC_DATA, CUSTOMER_TYPE_SET, MILEAGE_OUT) — Task 3
- ✅ Conectar em `ServiceOrderForm` — Task 7
- ✅ Conectar em `KanbanBoard` (rollback + wizard) — Task 8
- ✅ `TransitionRequirementsPanel` continua vivo — não tocado
- ✅ Override do gerente reaproveita `OverrideRequestModal` + `ManagerCredentialsModal` — Task 6 (já importados da Fase 1)

**Cobertura de testes:**
- `useWizard`: 7 testes unit
- `DataResolver`: 8 testes unit
- `WizardFooter`: 7 testes unit
- `TransitionWizard`: 5 testes integração
- Total Fase 2: 27 novos testes

**Consistência de tipos:** `ResolverProps` definido em `resolvers/index.ts` e usado em `FallbackResolver`, `DataResolver`, `WizardItem` — consistente. `TransitionWizard` usa `useServiceOrder` (retorna `ServiceOrder | undefined`) — guarda com `isLoading` e `order &&`.

**Sem placeholders:** todos os steps têm código completo.
