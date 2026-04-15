# Sprint 18 — OS Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the core OS lifecycle — pagination on the list, status transitions in the form, inline edit for services, clearer delivery labels, and separate Kanban toggles for delivered vs cancelled orders.

**Architecture:** Ten independent improvements to the OS workflow layer. Tasks 1–5 and 7–10 are fully independent. Task 6 (discount toggle) depends on S17-M12 being done first (needs `formatCurrency` from `@paddock/utils`). No backend changes needed except verifying existing endpoints.

**Tech Stack:** Next.js 15 · TypeScript strict · Tailwind CSS · shadcn/ui · React Hook Form · TanStack Query v5 · `VALID_TRANSITIONS` from `@paddock/types`

---

## File Map

| File | Action |
|------|--------|
| `apps/dscar-web/src/app/(app)/service-orders/page.tsx` | Modify — pagination controls |
| `apps/dscar-web/src/hooks/useServiceOrders.ts` | Modify — page param support |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx` | Modify — status transition dropdown + isDirty indicator |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx` | Modify — inline edit + discount toggle |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx` | Modify — discount toggle |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx` | Modify — delivery label rename + callout box |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ClosingTab.tsx` | Modify — NF-e validation + tooltip |
| `apps/dscar-web/src/app/(app)/cadastros/seguradoras/_components/InsurerDialog.tsx` | Modify — CNPJ mask |
| `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx` | Modify — CNPJ formatted display |
| `apps/dscar-web/src/components/Sidebar.tsx` | Modify — separate nav from toggle |
| `apps/dscar-web/src/app/(app)/service-orders/kanban/page.tsx` | Modify — split showDelivered/showCancelled |
| `apps/dscar-web/src/components/kanban/KanbanBoard.tsx` | Modify — accept two separate props |
| `apps/dscar-web/src/components/ui/tooltip.tsx` | Create — install via shadcn CLI |

---

## Task 1: S18-C3 — Pagination on OS list

**Files:**
- Modify: `apps/dscar-web/src/hooks/useServiceOrders.ts`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/page.tsx`

- [ ] **Step 1: Install shadcn Pagination component**

```bash
cd apps/dscar-web && npx shadcn@latest add pagination
```

Expected: creates `src/components/ui/pagination.tsx`.

- [ ] **Step 2: Add page param to useServiceOrders**

In `apps/dscar-web/src/hooks/useServiceOrders.ts`, update the `filters` type to accept `page` and `page_size`:

The existing hook already accepts `filters: Record<string, string>`, so `page` can be passed as a filter string. No code change needed for the hook itself. The page.tsx will pass `page: "1"` in the filters dict.

Verify the backend returns `count`, `next`, `previous`, `results` in `PaginatedResponse<T>` — it should, since this is DRF standard.

- [ ] **Step 3: Read service-orders/page.tsx to understand current structure**

Read `apps/dscar-web/src/app/(app)/service-orders/page.tsx` to understand where the table and footer are rendered.

- [ ] **Step 4: Add page state from URL params**

In `apps/dscar-web/src/app/(app)/service-orders/page.tsx`, add page state reading from URL:

```tsx
"use client"

import { useSearchParams, useRouter } from "next/navigation"
// ... existing imports ...

export default function ServiceOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentPage = Number(searchParams.get("page") ?? "1")
  const PAGE_SIZE = 20

  // Add page to existing filters:
  const filters = {
    // ... existing filters (status, insurer, etc.) ...
    page: String(currentPage),
    page_size: String(PAGE_SIZE),
  }

  const { data, isLoading } = useServiceOrders(filters)
  const totalCount = data?.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(page))
    router.push(`?${params.toString()}`)
  }
```

- [ ] **Step 5: Add pagination controls below table**

After the `<ServiceOrderTable>` component, add:

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

{totalPages > 1 && (
  <div className="flex items-center justify-between mt-4">
    <p className="text-sm text-neutral-500">
      Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
      {" "}({totalCount} registros)
    </p>
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => { e.preventDefault(); if (currentPage > 1) goToPage(currentPage - 1) }}
            aria-disabled={currentPage <= 1}
            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) goToPage(currentPage + 1) }}
            aria-disabled={currentPage >= totalPages}
            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  </div>
)}
```

- [ ] **Step 6: Reset page when filters change**

When any filter changes (status, insurer, search), reset to page 1:

```tsx
// Wrap filter change handlers to also reset page:
function handleStatusChange(value: string) {
  const params = new URLSearchParams(searchParams.toString())
  params.set("status", value)
  params.delete("page")  // Reset to page 1
  router.push(`?${params.toString()}`)
}
```

Apply same pattern to other filter change handlers.

- [ ] **Step 7: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add apps/dscar-web/src
git commit -m "feat(dscar): S18-C3 — pagination controls on OS list

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: S18-C5 — Status transition dropdown in ServiceOrderForm header

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx`

- [ ] **Step 1: Verify useTransitionStatus hook exists**

Read `apps/dscar-web/src/hooks/useServiceOrders.ts`. The hook `useTransitionStatus(id: string)` already exists at line 43. It calls `POST /api/proxy/service-orders/{id}/transition/` with body `{ new_status: status }` and invalidates query cache on success. Use this directly.

- [ ] **Step 2: Verify VALID_TRANSITIONS and STATUS_LABELS**

Read `packages/types/src/service-order.types.ts` to confirm `VALID_TRANSITIONS` export and find any `STATUS_LABELS` or equivalent for human-readable status names.

Also check `packages/utils/src/service-order.utils.ts` for `SERVICE_ORDER_STATUS_CONFIG` which has `label` for each status.

- [ ] **Step 3: Add dropdown imports to ServiceOrderForm.tsx**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx`, add:

```tsx
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { VALID_TRANSITIONS } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"
import { useTransitionStatus } from "@/hooks/useServiceOrders"
```

- [ ] **Step 4: Add transition mutation and dropdown state**

Inside the `ServiceOrderForm` component:

```tsx
const transitionMutation = useTransitionStatus(order.id)
const [transitionOpen, setTransitionOpen] = useState(false)

const allowedTransitions = (VALID_TRANSITIONS[order.status] ?? []) as ServiceOrderStatus[]
```

- [ ] **Step 5: Add status transition UI in the form header**

Find where the `<StatusBadge status={order.status} />` is rendered (in the form header area). Add the transition dropdown immediately after it:

```tsx
{allowedTransitions.length > 0 && (
  <div className="relative">
    <button
      type="button"
      onClick={() => setTransitionOpen((v) => !v)}
      disabled={transitionMutation.isPending}
      className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
    >
      {transitionMutation.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <>Avançar <ChevronDown className="h-3.5 w-3.5" /></>
      )}
    </button>
    {transitionOpen && (
      <div className="absolute right-0 top-full mt-1 z-10 w-44 rounded-md border border-neutral-200 bg-white shadow-dropdown">
        {allowedTransitions.map((status) => {
          const cfg = SERVICE_ORDER_STATUS_CONFIG[status]
          return (
            <button
              key={status}
              type="button"
              onClick={async () => {
                setTransitionOpen(false)
                try {
                  await transitionMutation.mutateAsync(status)
                  toast.success(`Status alterado para ${cfg.label}`)
                } catch {
                  toast.error("Não foi possível alterar o status.")
                }
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </button>
          )
        })}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6: Close dropdown on outside click**

Add a click-outside handler via `useEffect`:

```tsx
const dropdownRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setTransitionOpen(false)
    }
  }
  if (transitionOpen) {
    document.addEventListener("mousedown", handleClickOutside)
  }
  return () => document.removeEventListener("mousedown", handleClickOutside)
}, [transitionOpen])
```

Wrap the dropdown `<div className="relative">` in `<div ref={dropdownRef}>`.

- [ ] **Step 7: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/ServiceOrderForm.tsx
git commit -m "feat(dscar): S18-C5 — status transition dropdown in OS form header

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: S18-A1 — Unsaved changes indicator (isDirty)

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx`

- [ ] **Step 1: Extract isDirty from formState**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx`, the form already uses React Hook Form. Add `isDirty` to the destructured `formState`:

```tsx
const { register, handleSubmit, reset, watch, setValue, control,
  formState: { isSubmitting, isDirty }
} = useForm(...)
```

- [ ] **Step 2: Add dirty indicator to "Abertura" tab trigger**

Find the tab trigger that renders "Abertura" (the main form tab). Add a dot:

```tsx
// Before:
<TabsTrigger value="abertura">Abertura</TabsTrigger>

// After:
<TabsTrigger value="abertura" className="relative">
  Abertura
  {isDirty && (
    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-warning-500" />
  )}
</TabsTrigger>
```

- [ ] **Step 3: Highlight save button when dirty**

Find the save button in the form header. Add conditional styling:

```tsx
// Before:
<Button type="submit" disabled={isSubmitting}>
  Salvar
</Button>

// After:
<Button
  type="submit"
  disabled={isSubmitting}
  className={isDirty ? "ring-2 ring-warning-400 ring-offset-1" : ""}
>
  {isDirty ? "Salvar alterações" : "Salvar"}
</Button>
```

- [ ] **Step 4: Verify isDirty resets after save**

The `onSuccess` callback in the form's submit handler should call `reset(savedValues)` to clear the dirty state. Read the existing `onSubmit` handler and confirm this is done. If not, add:

```tsx
// In onSuccess of the mutation:
reset(savedValues, { keepValues: true })
// OR:
reset(response)  // Pass the API response to reset to saved values
```

- [ ] **Step 5: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/ServiceOrderForm.tsx
git commit -m "feat(dscar): S18-A1 — isDirty indicator on Abertura tab and save button

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: S18-A4 — Inline edit in ServicesTab (mirror of PartsTab)

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`

- [ ] **Step 1: Understand the PartsTab inline edit pattern**

Read `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx` lines 36–88 to understand:
- `editingId: string | null` state
- `startEdit(part)` populates form values
- `cancelForm()` resets editingId
- On submit: if `editingId` → update, else → add

- [ ] **Step 2: Verify useOSLaborUpdate exists**

Read `apps/dscar-web/src/hooks/useServiceCatalog.ts`. The hook `useOSLaborUpdate(osId)` exists at line 120 and accepts `{ laborId, payload }`. Import it.

- [ ] **Step 3: Add inline edit state to ServicesTab**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`:

```tsx
import { Pencil } from "lucide-react"
import { useOSLaborUpdate } from "@/hooks/useServiceCatalog"

// Inside component:
const [editingId, setEditingId] = useState<string | null>(null)
const [editForm, setEditForm] = useState({ quantity: "1", unit_price: "0", discount: "0" })
const updateLabor = useOSLaborUpdate(orderId ?? "")

function startEdit(labor: ServiceOrderLabor) {
  setEditingId(labor.id)
  setEditForm({
    quantity: String(labor.quantity),
    unit_price: String(labor.unit_price),
    discount: String(labor.discount),
  })
}

function cancelEdit() {
  setEditingId(null)
  setEditForm({ quantity: "1", unit_price: "0", discount: "0" })
}

async function saveEdit() {
  if (!editingId || !orderId) return
  try {
    await updateLabor.mutateAsync({
      laborId: editingId,
      payload: {
        quantity: parseFloat(editForm.quantity) || 1,
        unit_price: parseFloat(editForm.unit_price) || 0,
        discount: parseFloat(editForm.discount) || 0,
      },
    })
    cancelEdit()
  } catch {
    toast.error("Erro ao salvar serviço. Tente novamente.")
  }
}
```

- [ ] **Step 4: Add inline edit row rendering**

In the table rows for services, replace the row JSX with conditional rendering:

```tsx
{labors.map((labor) => (
  editingId === labor.id ? (
    <TableRow key={labor.id} className="bg-warning-50">
      <TableCell colSpan={2} className="font-medium text-neutral-900">
        {labor.description}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={editForm.quantity}
          onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
          className="h-7 w-16 text-right"
          min="0.01"
          step="0.01"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={editForm.unit_price}
          onChange={(e) => setEditForm((f) => ({ ...f, unit_price: e.target.value }))}
          className="h-7 w-24 text-right"
          min="0"
          step="0.01"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={editForm.discount}
          onChange={(e) => setEditForm((f) => ({ ...f, discount: e.target.value }))}
          className="h-7 w-20 text-right"
          min="0"
          step="0.01"
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={saveEdit}
            disabled={updateLabor.isPending}
            className="p-1.5 rounded text-success-600 hover:bg-success-50"
            title="Salvar"
          >
            {updateLabor.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Check className="h-3.5 w-3.5" />
            }
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="p-1.5 rounded text-neutral-400 hover:bg-neutral-100"
            title="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  ) : (
    <TableRow key={labor.id} className="hover:bg-neutral-50">
      {/* ... existing display row ... */}
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => startEdit(labor)}
            className="p-1.5 rounded text-neutral-400 hover:text-primary-600 hover:bg-neutral-100"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {/* ... existing delete button ... */}
        </div>
      </TableCell>
    </TableRow>
  )
))}
```

Add imports: `import { Check, X, Loader2 } from "lucide-react"`

- [ ] **Step 5: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/tabs/ServicesTab.tsx
git commit -m "feat(dscar): S18-A4 — inline edit for services, mirrors PartsTab pattern

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: S18-A7 — Rename delivery fields in PrazosSection

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx`

- [ ] **Step 1: Read PrazosSection.tsx**

Read `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx` in full to understand the current label names and the hint structure.

- [ ] **Step 2: Rename delivery_date label**

Find the field label for `delivery_date` and update:

```tsx
// Before (approximate):
<span className={LABEL}>Retirada pelo cliente</span>

// After:
<span className={LABEL}>Data de retirada (agenda)</span>
<p className="text-[10px] text-neutral-400 -mt-0.5">Aparece na agenda de agendamentos</p>
```

- [ ] **Step 3: Replace amber hint with callout box for client_delivery_date**

Find the `client_delivery_date` field and its hint. Replace the amber text hint with a proper callout:

```tsx
// Before (amber hint):
<p className="text-xs text-amber-600 mt-1">Muda status → Entregue</p>
// OR:
<p className="text-[9px] text-amber-500 ...">Preencher muda status → Entregue</p>

// After:
<span className={LABEL}>Confirmar entrega ao cliente</span>
<div className="flex items-start gap-2 rounded-md bg-warning-50 border border-warning-200 px-3 py-2 text-xs text-warning-800 mt-1 mb-2">
  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning-600" />
  <span>Preencher este campo muda o status da OS para <strong>Entregue</strong></span>
</div>
```

Add import: `import { AlertTriangle } from "lucide-react"`

- [ ] **Step 4: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/sections/PrazosSection.tsx
git commit -m "fix(dscar): S18-A7 — rename confusing delivery labels, replace hint with callout

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: S18-M7 — Discount R$/% toggle in PartsTab and ServicesTab

**Prerequisite:** S17-M12 must be completed first (`formatCurrency` with `compact` option available in `@paddock/utils`).

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`

- [ ] **Step 1: Add discountMode state to PartsTab**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`:

```tsx
const [discountMode, setDiscountMode] = useState<"R$" | "%">("R$")
```

Reset `discountMode` to `"R$"` in `cancelForm()`.

- [ ] **Step 2: Replace discount field in PartsTab add/edit form**

Find the discount `<Input>` field in the add/edit form and wrap it:

```tsx
import { formatCurrency } from "@paddock/utils"

// Replace the discount field div:
<div>
  <Label className="text-xs">Desconto</Label>
  <div className="flex items-center gap-1">
    <select
      value={discountMode}
      onChange={(e) => setDiscountMode(e.target.value as "R$" | "%")}
      className="h-9 rounded-md border border-neutral-200 text-xs px-1.5 bg-white"
    >
      <option value="R$">R$</option>
      <option value="%">%</option>
    </select>
    <Input
      {...register("discount")}
      type="number"
      min="0"
      step={discountMode === "%" ? "1" : "0.01"}
      max={discountMode === "%" ? "100" : undefined}
      placeholder={discountMode === "%" ? "0" : "0,00"}
      className="flex-1"
    />
  </div>
  {discountMode === "%" && watch("unit_price") && watch("quantity") && (
    <p className="text-[10px] text-neutral-400 mt-0.5">
      = {formatCurrency(
        parseFloat(watch("unit_price") || "0") *
        parseFloat(watch("quantity") || "1") *
        (parseFloat(watch("discount") || "0") / 100)
      )}
    </p>
  )}
</div>
```

- [ ] **Step 3: Convert % to R$ before submit in PartsTab**

In the `onSubmit` function of PartsTab, before building the payload:

```tsx
async function onSubmit(values: FormValues) {
  if (!orderId) return

  // Convert percentage discount to absolute value
  const discountValue = discountMode === "%"
    ? (parseFloat(values.unit_price) || 0) * (parseFloat(values.quantity) || 1) * ((parseFloat(values.discount) || 0) / 100)
    : parseFloat(values.discount) || 0

  const payload: CreatePartPayload = {
    description: values.description.trim(),
    part_number: values.part_number.trim(),
    quantity: parseFloat(values.quantity) || 1,
    unit_price: parseFloat(values.unit_price) || 0,
    discount: discountValue,  // Always submit as R$
  }
  // ... rest unchanged
}
```

- [ ] **Step 4: Apply same pattern to ServicesTab**

Repeat Steps 1–3 for `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`. The inline edit form also needs the discount mode toggle for editing existing services.

- [ ] **Step 5: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/tabs/
git commit -m "feat(dscar): S18-M7 — R$/% toggle for discount fields in PartsTab and ServicesTab

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: S18-M8 — NF-e validation + tooltip on blocked delivery button

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ClosingTab.tsx`

- [ ] **Step 1: Install shadcn Tooltip**

```bash
cd apps/dscar-web && npx shadcn@latest add tooltip
```

Expected: creates `src/components/ui/tooltip.tsx`.

- [ ] **Step 2: Read ClosingTab.tsx**

Read `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ClosingTab.tsx` to understand:
- Where `nfe_key` field is defined and its current validation
- Where `canDeliver` is computed
- Where the disabled deliver button is rendered

- [ ] **Step 3: Add NF-e validation to Zod schema**

In the form schema (if using Zod) or directly in RHF's validate option:

```tsx
// In Zod schema:
nfe_key: z.string()
  .transform((v) => v.replace(/[\s\-]/g, ""))  // Strip spaces and hyphens on submit
  .pipe(
    z.string()
      .length(44, "Chave NF-e deve ter 44 dígitos numéricos")
      .regex(/^\d{44}$/, "Chave NF-e deve conter apenas números")
  )
  .optional()
  .or(z.literal(""))
```

- [ ] **Step 4: Add onPaste handler to strip formatting**

On the NF-e key input element:

```tsx
<Input
  {...register("nfe_key")}
  placeholder="00000000000000000000000000000000000000000000"
  maxLength={44}
  onPaste={(e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/[\s\-]/g, "")
    e.currentTarget.value = pasted.slice(0, 44)
    // Trigger RHF change:
    register("nfe_key").onChange({ target: e.currentTarget } as React.ChangeEvent<HTMLInputElement>)
  }}
/>
```

- [ ] **Step 5: Add tooltip to disabled delivery button**

Import and wrap the disabled button:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Compute tooltip message:
const deliverBlockedReason = !order.nfe_key && !order.nfse_number
  ? "Informe a chave NF-e ou número NFS-e para continuar"
  : order.status !== "ready"
  ? "A OS precisa estar no status Pronto para Entrega"
  : null

// Wrap button:
{canDeliver ? (
  <Button onClick={handleDeliver}>Confirmar Entrega</Button>
) : (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span>  {/* Wrapper needed — disabled button doesn't fire tooltip events */}
          <Button disabled>Confirmar Entrega</Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{deliverBlockedReason}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

- [ ] **Step 6: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/tabs/ClosingTab.tsx apps/dscar-web/src/components/ui/tooltip.tsx
git commit -m "feat(dscar): S18-M8 — NF-e key validation + tooltip on blocked delivery button

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: S18-M10 — CNPJ mask in InsurerDialog

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/cadastros/seguradoras/_components/InsurerDialog.tsx`
- Modify: `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx`

- [ ] **Step 1: Check existing masked-input infrastructure**

Read `apps/dscar-web/src/components/ui/masked-input.tsx`. The project already has `CpfCnpjInput`. Check if it handles CNPJ formatting, or if a simpler inline mask function is needed.

- [ ] **Step 2: Create maskCNPJ utility function**

Add to `InsurerDialog.tsx` (or `@/lib/masks.ts` if preferred):

```typescript
function maskCNPJ(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

function formatCNPJDisplay(digits: string): string {
  return maskCNPJ(digits)
}
```

- [ ] **Step 3: Apply mask to CNPJ field in InsurerDialog**

In the InsurerDialog form, update the CNPJ field:

```tsx
// State for display value (formatted)
const [cnpjDisplay, setCnpjDisplay] = useState(maskCNPJ(defaultValues?.cnpj ?? ""))

// CNPJ Input:
<Input
  value={cnpjDisplay}
  onChange={(e) => {
    const masked = maskCNPJ(e.target.value)
    setCnpjDisplay(masked)
    // Store only digits in RHF:
    setValue("cnpj", masked.replace(/\D/g, ""), { shouldValidate: true })
  }}
  placeholder="00.000.000/0000-00"
  maxLength={18}
/>
```

- [ ] **Step 4: Update Zod validation for CNPJ**

```typescript
cnpj: z.string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().length(14, "CNPJ deve ter 14 dígitos").optional().or(z.string().length(0)))
  .optional(),
```

The backend expects digits-only CNPJ (backend model stores without mask).

- [ ] **Step 5: Display formatted CNPJ in seguradoras table**

In `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx`, add a formatCNPJDisplay helper and apply to the CNPJ column:

```tsx
function formatCNPJDisplay(digits: string): string {
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

// In table cell:
<TableCell>{insurer.cnpj ? formatCNPJDisplay(insurer.cnpj) : "—"}</TableCell>
```

- [ ] **Step 6: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/cadastros/seguradoras/
git commit -m "feat(dscar): S18-M10 — CNPJ mask in InsurerDialog and formatted display in table

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: S18-B1 — Separate nav from toggle in Sidebar

**Files:**
- Modify: `apps/dscar-web/src/components/Sidebar.tsx`

- [ ] **Step 1: Read Sidebar.tsx**

Read `apps/dscar-web/src/components/Sidebar.tsx` to understand the current click handler for items with `children + href`. Note the fix from a previous session: items now collapse correctly. The remaining issue is that the label area also triggers navigation + expand simultaneously.

- [ ] **Step 2: Identify items with children**

Items like "Cadastros", "Financeiro", "Recursos Humanos" have both `children` and `href`. The current behavior when clicking the label: navigates to `href` AND expands the group.

The simplest fix: for items with `children`, remove the href navigation from the label — the label should only toggle the group. Access the parent route via its first child.

- [ ] **Step 3: Separate click areas**

In the click handler for nav items with children, update the logic:

```tsx
// For items WITH children: clicking label/icon only toggles group, does NOT navigate
// For items WITHOUT children: clicking navigates directly

// Current structure (approximate):
<button onClick={() => { if (item.children) toggleGroup(item.id); else handleNav(item.href) }}>
  <Icon /> {item.label}
  {item.children && <ChevronIcon />}
</button>

// New structure:
<div className="flex items-center">
  {item.children ? (
    // Label is a toggle button only (no navigation)
    <button
      type="button"
      onClick={() => toggleGroup(item.id)}
      className="flex flex-1 items-center gap-2 ..."
    >
      <Icon /> {item.label}
    </button>
  ) : (
    // Label navigates
    <button
      type="button"
      onClick={() => handleNav(item.href)}
      className="flex flex-1 items-center gap-2 ..."
    >
      <Icon /> {item.label}
    </button>
  )}
  {item.children && (
    // Chevron always just toggles
    <button
      type="button"
      onClick={() => toggleGroup(item.id)}
      className="p-1 ..."
    >
      <ChevronIcon />
    </button>
  )}
</div>
```

The existing collapse fix (checking `expandedGroups.includes(item.id)` before toggling) must be preserved.

- [ ] **Step 4: Verify active group indicator still works**

After the change, confirm that `isGroupActive` computation and the active state styling on group labels still work correctly. The visual active state should show when any child route is active.

- [ ] **Step 5: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/components/Sidebar.tsx
git commit -m "fix(dscar): S18-B1 — separate sidebar group toggle from label navigation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: S18-M1 — Kanban split toggle: delivered vs cancelled

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/kanban/page.tsx`
- Modify: `apps/dscar-web/src/components/kanban/KanbanBoard.tsx`

Note: `KanbanColumn` already has count badge (`{orders.length}`) and empty state (`"Vazia"`) — no changes needed there.

- [ ] **Step 1: Add showCancelled state to kanban/page.tsx**

In `apps/dscar-web/src/app/(app)/service-orders/kanban/page.tsx`:

```tsx
// Before:
const [showDelivered, setShowDelivered] = useState(false)

// After:
const [showDelivered, setShowDelivered] = useState(false)
const [showCancelled, setShowCancelled] = useState(false)
```

- [ ] **Step 2: Update the API query logic**

```tsx
// Before:
const { data, isLoading, isError, error } = useServiceOrders(
  showDelivered
    ? { is_active: "true", page_size: "200", ordering: "-opened_at" }
    : { is_active: "true", exclude_closed: "true", page_size: "150", ordering: "-opened_at" }
)

// After:
const showAny = showDelivered || showCancelled
const { data, isLoading, isError, error } = useServiceOrders(
  showAny
    ? { is_active: "true", page_size: "200", ordering: "-opened_at" }
    : { is_active: "true", exclude_closed: "true", page_size: "150", ordering: "-opened_at" }
)
```

- [ ] **Step 3: Pass both props to KanbanBoard**

```tsx
// Before:
<KanbanBoard orders={orders} isLoading={isLoading} showHidden={showDelivered} />

// After:
<KanbanBoard
  orders={orders}
  isLoading={isLoading}
  showDelivered={showDelivered}
  showCancelled={showCancelled}
/>
```

- [ ] **Step 4: Update KanbanBoard.tsx interface and column filter**

In `apps/dscar-web/src/components/kanban/KanbanBoard.tsx`:

```tsx
// Before:
interface KanbanBoardProps {
  orders: ServiceOrder[]
  isLoading: boolean
  showHidden?: boolean
}

export function KanbanBoard({
  orders, isLoading, showHidden = false,
}: KanbanBoardProps) {
  const columns = useMemo(
    () =>
      showHidden
        ? KANBAN_COLUMNS_ORDER
        : KANBAN_COLUMNS_ORDER.filter((s) => !KANBAN_HIDDEN_BY_DEFAULT.includes(s)),
    [showHidden]
  )

// After:
interface KanbanBoardProps {
  orders: ServiceOrder[]
  isLoading: boolean
  showDelivered?: boolean
  showCancelled?: boolean
}

export function KanbanBoard({
  orders, isLoading, showDelivered = false, showCancelled = false,
}: KanbanBoardProps) {
  const columns = useMemo(
    () =>
      KANBAN_COLUMNS_ORDER.filter((s) => {
        if (s === "delivered") return showDelivered
        if (s === "cancelled") return showCancelled
        return true
      }),
    [showDelivered, showCancelled]
  )
```

- [ ] **Step 5: Update toggle UI in kanban/page.tsx**

Replace the single toggle button with two independent toggles:

```tsx
// Before:
<button
  type="button"
  onClick={() => setShowDelivered((v) => !v)}
  className={cn(
    "flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
    showDelivered
      ? "border-green-300 bg-green-50 text-green-700"
      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
  )}
>
  {showDelivered ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
  Entregues
</button>

// After:
<button
  type="button"
  onClick={() => setShowDelivered((v) => !v)}
  className={cn(
    "flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
    showDelivered
      ? "border-success-300 bg-success-50 text-success-700"
      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
  )}
>
  {showDelivered ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
  Entregues
</button>
<button
  type="button"
  onClick={() => setShowCancelled((v) => !v)}
  className={cn(
    "flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
    showCancelled
      ? "border-error-300 bg-error-50 text-error-700"
      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
  )}
>
  {showCancelled ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
  Canceladas
</button>
```

- [ ] **Step 6: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/kanban/page.tsx apps/dscar-web/src/components/kanban/KanbanBoard.tsx
git commit -m "feat(dscar): S18-M1 — split Kanban toggle into delivered/cancelled independently

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Sprint 18 Completion Checklist

- [ ] Pagination visible on OS list when count > 20
- [ ] URL updates to `?page=N` when navigating pages
- [ ] Status transition dropdown visible in OS form header
- [ ] `isDirty` dot visible on "Abertura" tab when form is dirty
- [ ] Pencil/edit icon on each row in ServicesTab
- [ ] Inline edit row appears when pencil clicked in ServicesTab
- [ ] `delivery_date` label reads "Data de retirada (agenda)"
- [ ] `client_delivery_date` has warning callout box
- [ ] NF-e input strips spaces/hyphens on paste
- [ ] NF-e validates 44-digit format
- [ ] Tooltip appears on disabled delivery button
- [ ] CNPJ mask applied in InsurerDialog
- [ ] CNPJ formatted in seguradoras table
- [ ] Kanban has separate "Entregues" and "Canceladas" toggles
- [ ] `npx tsc --noEmit` → 0 errors
