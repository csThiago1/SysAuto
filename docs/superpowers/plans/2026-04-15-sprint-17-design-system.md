# Sprint 17 — Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify brand colors, fix accessibility violations in labels, create reusable UI components, and eliminate duplicated utility code across the DS Car ERP.

**Architecture:** Ten independent improvements to the token/component layer. Tasks 1–9 can run in parallel; Task 10 (shared constants) depends on Task 2 (label size fix). Each task is a focused refactor with no behavioral changes.

**Tech Stack:** Next.js 15 · TypeScript strict · Tailwind CSS · shadcn/ui · `@paddock/utils` · React Hook Form · Zod

---

## File Map

| File | Action |
|------|--------|
| `apps/dscar-web/tailwind.config.ts` | Modify — fix primary-600/700 |
| `packages/utils/src/formatters.ts` | Modify — add compact option to formatCurrency |
| `apps/dscar-web/src/components/ui/alert-dialog.tsx` | Create — install via shadcn CLI |
| `apps/dscar-web/src/components/ui/confirm-dialog.tsx` | Create — new ConfirmDialog |
| `apps/dscar-web/src/components/ui/index.ts` | Modify — export ConfirmDialog |
| `apps/dscar-web/src/lib/form-styles.ts` | Create — shared LABEL/SECTION_TITLE constants |
| `apps/dscar-web/src/app/(app)/dashboard/_components/BillingByTypeChart.tsx` | Modify — fix legend + migrate formatCurrency |
| `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx` | Modify — migrate formatCurrency |
| `apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx` | Modify — shadcn Table |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx` | Modify — ConfirmDialog, shadcn Table, formatCurrency, form-styles |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx` | Modify — ConfirmDialog, shadcn Table, colors, panel style, form-styles |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/EntrySection.tsx` | Modify — label size, form-styles |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx` | Modify — label size, form-styles |
| `apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx` | Modify — label size, form-styles |
| `apps/dscar-web/src/app/(app)/service-orders/page.tsx` | Modify — hardcoded color |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx` | Modify — hardcoded colors |
| `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx` | Modify — ConfirmDialog, shadcn Table, TableSkeleton, hardcoded color |
| `apps/dscar-web/src/app/(app)/cadastros/seguradoras/_components/InsurerDialog.tsx` | Modify — brand_color fix, label size |
| `apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx` | Modify — hardcoded color |
| `apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx` | Modify — hardcoded color |
| `apps/dscar-web/src/components/Sidebar.tsx` | Modify — hardcoded colors |
| `apps/dscar-web/src/app/(app)/dashboard/page.tsx` | Modify — hardcoded colors |

---

## Task 1: S17-C1 — Unify brand color to primary-600

**Files:**
- Modify: `apps/dscar-web/tailwind.config.ts`
- Modify: 8 TSX files (listed in steps below)

- [ ] **Step 1: Fix primary-600 and primary-700 in tailwind.config.ts**

In `apps/dscar-web/tailwind.config.ts`, lines 48–49, change:
```typescript
// Before:
"600": "#e31b1b",
"700": "#c01212",

// After:
"600": "#ea0e03",
"700": "#c50b02",
```

- [ ] **Step 2: List all hardcoded color occurrences**

```bash
cd apps/dscar-web && grep -rn "#ea0e03\|#e31b1b\|hover:bg-red-700\|bg-red-600\|text-red-600\|border-red-600" src --include="*.tsx" --include="*.ts"
```

Expected: hits in Sidebar.tsx, ServiceOrderForm.tsx, ServicesTab.tsx, WeekView.tsx, DayView.tsx, service-orders/page.tsx, dashboard/page.tsx, cadastros/seguradoras/page.tsx.

- [ ] **Step 3: Fix Sidebar.tsx**

Replace ALL occurrences of hardcoded colors in `apps/dscar-web/src/components/Sidebar.tsx`:
- `bg-[#ea0e03]` → `bg-primary-600`
- `text-[#ea0e03]` → `text-primary-600`
- `border-[#ea0e03]` → `border-primary-600`
- `bg-[#ea0e03]/[0.12]` → `bg-primary-600/[0.12]`
- `bg-[#ea0e03]/[0.08]` → `bg-primary-600/[0.08]`
- `hover:bg-red-700` → `hover:bg-primary-700`

- [ ] **Step 4: Fix ServicesTab.tsx**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`:
- `bg-[#ea0e03]` → `bg-primary-600`
- `hover:bg-red-700` → `hover:bg-primary-700`

- [ ] **Step 5: Fix ServiceOrderForm.tsx**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx`:
- `bg-[#ea0e03]` → `bg-primary-600`
- `text-[#ea0e03]` → `text-primary-600`
- `border-[#ea0e03]` → `border-primary-600`
- `hover:bg-red-700` → `hover:bg-primary-700`

- [ ] **Step 6: Fix agenda components and OS list**

In `apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx`:
- `text-[#ea0e03]` → `text-primary-600`

In `apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx`:
- `text-[#ea0e03]` → `text-primary-600`

In `apps/dscar-web/src/app/(app)/service-orders/page.tsx`:
- `bg-[#ea0e03]` → `bg-primary-600`
- `hover:bg-red-700` → `hover:bg-primary-700`

- [ ] **Step 7: Fix dashboard/page.tsx**

In `apps/dscar-web/src/app/(app)/dashboard/page.tsx`, all three "Nova OS" buttons (lines 76, 99, 123):
- `bg-[#ea0e03]` → `bg-primary-600`
- `hover:bg-red-700` → `hover:bg-primary-700`

- [ ] **Step 8: Fix cadastros/seguradoras/page.tsx**

In `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx`:
- Any `bg-[#ea0e03]` → `bg-primary-600`

- [ ] **Step 9: Verify no remaining occurrences**

```bash
cd apps/dscar-web && grep -rn "#ea0e03\|#e31b1b\|hover:bg-red-700\|bg-red-600" src --include="*.tsx" --include="*.ts"
```

Expected: 0 results.

- [ ] **Step 10: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 11: Commit**

```bash
git add apps/dscar-web/tailwind.config.ts apps/dscar-web/src
git commit -m "feat(dscar): S17-C1 — unify brand color to primary-600 (#ea0e03)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: S17-C2 — Fix labels 9px → text-xs (WCAG minimum)

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/EntrySection.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/CustomerSection.tsx`
- Modify: `apps/dscar-web/src/app/(app)/cadastros/seguradoras/_components/InsurerDialog.tsx`

- [ ] **Step 1: List all small-text occurrences**

```bash
cd apps/dscar-web && grep -rn "text-\[9px\]\|text-\[10px\]\|text-\[11px\]" src --include="*.tsx"
```

- [ ] **Step 2: Fix EntrySection.tsx**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/EntrySection.tsx`, change the local `LABEL` and `SECTION_TITLE` constants:
```typescript
// Before:
const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"

// After:
const LABEL = "block text-xs font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-neutral-500"
```

- [ ] **Step 3: Fix PrazosSection.tsx**

Same change in `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx`:
```typescript
// Before:
const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"

// After:
const LABEL = "block text-xs font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-neutral-500"
```

- [ ] **Step 4: Fix ServicesTab.tsx inline label**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`, find the `LABEL` constant and any inline `text-[9px]` or `text-[10px]`:
```typescript
// Before (wherever LABEL is defined):
const LABEL = "block text-[9px] font-bold uppercase tracking-wide ..."
// OR inline:
<span className="text-[10px] font-semibold uppercase tracking-wide ...">

// After:
const LABEL = "block text-xs font-bold uppercase tracking-wide ..."
// OR:
<span className="text-xs font-semibold uppercase tracking-wide ...">
```

- [ ] **Step 5: Fix remaining files**

Read `NewOSDrawer.tsx` and `CustomerSection.tsx` for any `text-[9px]` or `text-[10px]` and replace with `text-xs`. Also fix `InsurerDialog.tsx` if it has any.

- [ ] **Step 6: Verify**

```bash
cd apps/dscar-web && grep -rn "text-\[9px\]\|text-\[10px\]" src --include="*.tsx"
```

Expected: 0 results in label/form contexts (badges and other non-form contexts may still use small text if intentional).

- [ ] **Step 7: Commit**

```bash
git add apps/dscar-web/src
git commit -m "fix(dscar): S17-C2 — fix WCAG violation, labels 9px → text-xs

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: S17-C4 — ConfirmDialog component + replace window.confirm()

**Files:**
- Create: `apps/dscar-web/src/components/ui/alert-dialog.tsx`
- Create: `apps/dscar-web/src/components/ui/confirm-dialog.tsx`
- Modify: `apps/dscar-web/src/components/ui/index.ts`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx`

- [ ] **Step 1: Install shadcn alert-dialog**

```bash
cd apps/dscar-web && npx shadcn@latest add alert-dialog
```

Expected: creates `src/components/ui/alert-dialog.tsx`.

- [ ] **Step 2: Create confirm-dialog.tsx**

Create `apps/dscar-web/src/components/ui/confirm-dialog.tsx`:

```tsx
"use client"

import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  confirmVariant?: "destructive" | "default"
  onConfirm: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  confirmVariant = "destructive",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={loading}
            className={cn(
              confirmVariant === "destructive" &&
                "bg-error-600 text-white hover:bg-error-700 focus:ring-error-500"
            )}
          >
            {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 3: Export from ui/index.ts**

In `apps/dscar-web/src/components/ui/index.ts`, add after the existing exports:
```typescript
export { ConfirmDialog } from "./confirm-dialog"
```

- [ ] **Step 4: Replace confirm() in PartsTab.tsx**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`:

Add state and import at the top:
```tsx
import { ConfirmDialog } from "@/components/ui"

// Inside the component, add state:
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
```

Replace the `handleDelete` function:
```tsx
// Before:
async function handleDelete(partId: string) {
  if (!confirm("Remover esta peça?")) return
  await deletePart.mutateAsync(partId)
}

// After:
function handleDelete(partId: string) {
  setConfirmDeleteId(partId)
}

async function confirmDelete() {
  if (!confirmDeleteId) return
  try {
    await deletePart.mutateAsync(confirmDeleteId)
  } catch {
    toast.error("Erro ao remover peça. Tente novamente.")
  } finally {
    setConfirmDeleteId(null)
  }
}
```

Add `<ConfirmDialog>` at the end of the returned JSX (before the closing `</div>`):
```tsx
<ConfirmDialog
  open={confirmDeleteId !== null}
  onOpenChange={(open) => !open && setConfirmDeleteId(null)}
  title="Remover peça"
  description="Esta ação não pode ser desfeita."
  confirmLabel="Remover"
  onConfirm={confirmDelete}
  loading={deletePart.isPending}
/>
```

- [ ] **Step 5: Replace confirm() in ServicesTab.tsx**

Same pattern in `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`:

```tsx
import { ConfirmDialog } from "@/components/ui"

// State:
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

// Replace confirm() handler:
function handleDelete(laborId: string) {
  setConfirmDeleteId(laborId)
}

async function confirmDelete() {
  if (!confirmDeleteId) return
  try {
    await deleteLabor.mutateAsync(confirmDeleteId)
  } catch {
    toast.error("Erro ao remover serviço. Tente novamente.")
  } finally {
    setConfirmDeleteId(null)
  }
}

// Add at end of JSX:
<ConfirmDialog
  open={confirmDeleteId !== null}
  onOpenChange={(open) => !open && setConfirmDeleteId(null)}
  title="Remover serviço"
  description="Esta ação não pode ser desfeita."
  confirmLabel="Remover"
  onConfirm={confirmDelete}
  loading={deleteLabor.isPending}
/>
```

- [ ] **Step 6: Replace confirm() in seguradoras/page.tsx**

In `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx`:

```tsx
import { ConfirmDialog } from "@/components/ui"

// State:
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

// Replace confirm() with:
function handleDelete(id: string) {
  setConfirmDeleteId(id)
}

async function confirmDelete() {
  if (!confirmDeleteId) return
  try {
    await deleteMutation.mutateAsync(confirmDeleteId)
  } catch {
    toast.error("Erro ao remover seguradora.")
  } finally {
    setConfirmDeleteId(null)
  }
}

// Add at end of JSX:
<ConfirmDialog
  open={confirmDeleteId !== null}
  onOpenChange={(open) => !open && setConfirmDeleteId(null)}
  title="Remover seguradora"
  description="Esta ação não pode ser desfeita."
  confirmLabel="Remover"
  onConfirm={confirmDelete}
  loading={deleteMutation.isPending}
/>
```

- [ ] **Step 7: Verify no confirm() remains**

```bash
cd apps/dscar-web && grep -rn "window\.confirm\|[^/]confirm(" src --include="*.tsx"
```

Expected: 0 results.

- [ ] **Step 8: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add apps/dscar-web/src
git commit -m "feat(dscar): S17-C4 — ConfirmDialog replaces window.confirm() in 3 locations

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: S17-A2 — Fix brand_color double registration in InsurerDialog

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/cadastros/seguradoras/_components/InsurerDialog.tsx`

- [ ] **Step 1: Read InsurerDialog.tsx**

Read `apps/dscar-web/src/app/(app)/cadastros/seguradoras/_components/InsurerDialog.tsx` to understand the current form structure and how `brand_color` is registered.

- [ ] **Step 2: Add Zod validation for brand_color**

In the form schema (Zod), update the `brand_color` field:
```typescript
brand_color: z.string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use formato #rrggbb)")
  .optional()
  .or(z.literal("")),
```

- [ ] **Step 3: Replace double register with watch + setValue pattern**

Remove both `{...register("brand_color")}` from the color picker and text input. Add `watch` to the form destructuring:

```tsx
const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm(...)

const brandColor = watch("brand_color") ?? "#6b7280"
```

Replace the color picker JSX:
```tsx
<input
  type="color"
  value={brandColor}
  onChange={(e) => setValue("brand_color", e.target.value, { shouldValidate: true })}
  className="h-9 w-14 cursor-pointer rounded border border-neutral-200 p-0.5"
/>
```

Replace the text input JSX:
```tsx
<Input
  value={brandColor}
  onChange={(e) => setValue("brand_color", e.target.value, { shouldValidate: true })}
  placeholder="#6b7280"
  maxLength={7}
/>
{errors.brand_color && (
  <p className="text-xs text-error-600 mt-0.5">{errors.brand_color.message}</p>
)}
```

- [ ] **Step 4: Verify synchronized behavior**

Manually test: change color picker → text field updates; type `#ff0000` → picker updates; type `#zzz` → validation error appears but form doesn't crash.

- [ ] **Step 5: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/cadastros/seguradoras/_components/InsurerDialog.tsx
git commit -m "fix(dscar): S17-A2 — fix brand_color double registration in InsurerDialog

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: S17-A3 — Fix BillingByTypeChart misleading legend

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/BillingByTypeChart.tsx`

- [ ] **Step 1: Understand current data shape**

The component receives `byType: { insurer: string; private: string }` (aggregate totals) but `data: BillingMonthPoint[]` only has `{ month, amount }` (total per month, no split). The single bar chart has a two-color legend implying a stacked chart that doesn't exist.

- [ ] **Step 2: Replace split legend with single legend**

In `apps/dscar-web/src/app/(app)/dashboard/_components/BillingByTypeChart.tsx`, replace the legend section:

```tsx
// Before (lines 31-40):
<div className="flex gap-3 text-xs text-neutral-500">
  <span className="flex items-center gap-1">
    <span className="inline-block w-2.5 h-2.5 rounded bg-blue-500" />
    Seguradora {insurerPct}%
  </span>
  <span className="flex items-center gap-1">
    <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500" />
    Particular {100 - insurerPct}%
  </span>
</div>

// After:
<div className="flex gap-3 text-xs text-neutral-500">
  <span className="flex items-center gap-1">
    <span className="inline-block w-2.5 h-2.5 rounded bg-info-500" />
    Faturamento Mensal
  </span>
  {insurerPct > 0 && (
    <span className="text-neutral-400">
      Seguradora: {insurerPct}% · Particular: {100 - insurerPct}%
    </span>
  )}
</div>
```

- [ ] **Step 3: Fix bar color to use token**

In the `<Bar>` component, change `fill="#3b82f6"` to `fill="var(--color-info-500, #3b82f6)"` or simply use the tailwind token-aligned hex `fill="#3b82f6"` (info-500 is `#3b82f6` in the design system — same value, no change needed here).

Actually, update the bar fill to use `bg-info-500`:
```tsx
<Bar dataKey="valor" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Faturamento Mensal" />
```
The fill stays `#3b82f6` (info-500) — rename the legend label to "Faturamento Mensal".

- [ ] **Step 4: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/dashboard/_components/BillingByTypeChart.tsx
git commit -m "fix(dscar): S17-A3 — fix BillingByTypeChart misleading legend

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: S17-A5 — Standardize tables to shadcn Table components

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx`
- Modify: `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx`

- [ ] **Step 1: Migrate PartsTab.tsx table**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`, add imports:
```tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui"
```

Replace the raw `<table>` structure (inside the `div.bg-white.border...`):
```tsx
// Before:
<div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
  <table className="w-full text-sm">
    <thead className="bg-neutral-50 border-b border-neutral-200">
      <tr>
        <th className="text-left px-4 py-2.5 font-medium text-neutral-600">Descrição</th>
        ...
      </tr>
    </thead>
    <tbody className="divide-y divide-neutral-100">
      {parts.map((part) => (
        <tr key={part.id} className="hover:bg-neutral-50 transition-colors">
          <td className="px-4 py-3 text-neutral-900 font-medium">{part.description}</td>
          ...
        </tr>
      ))}
    </tbody>
  </table>
</div>

// After:
<div className="rounded-md border bg-white overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="bg-neutral-50 hover:bg-neutral-50 border-b border-neutral-200">
        <TableHead className="font-semibold text-neutral-600">Descrição</TableHead>
        <TableHead className="font-semibold text-neutral-600 hidden sm:table-cell">Código</TableHead>
        <TableHead className="text-right font-semibold text-neutral-600">Qtd</TableHead>
        <TableHead className="text-right font-semibold text-neutral-600">Unit.</TableHead>
        <TableHead className="text-right font-semibold text-neutral-600 hidden md:table-cell">Desconto</TableHead>
        <TableHead className="text-right font-semibold text-neutral-600">Total</TableHead>
        <TableHead className="w-20" />
      </TableRow>
    </TableHeader>
    <TableBody>
      {parts.map((part) => (
        <TableRow key={part.id} className="hover:bg-neutral-50">
          <TableCell className="font-medium text-neutral-900">{part.description}</TableCell>
          <TableCell className="text-neutral-500 hidden sm:table-cell">{part.part_number || "—"}</TableCell>
          <TableCell className="text-right text-neutral-700">{part.quantity}</TableCell>
          <TableCell className="text-right text-neutral-700">{formatCurrency(part.unit_price)}</TableCell>
          <TableCell className="text-right text-neutral-500 hidden md:table-cell">
            {parseFloat(part.discount) > 0 ? formatCurrency(part.discount) : "—"}
          </TableCell>
          <TableCell className="text-right font-semibold text-neutral-900">{formatCurrency(part.total)}</TableCell>
          <TableCell>
            <div className="flex items-center justify-end gap-1">
              {/* Keep existing edit/delete buttons unchanged */}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

- [ ] **Step 2: Migrate ServicesTab.tsx table**

Same migration in `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`. Add the same imports and convert `<table>` → `<Table>` keeping all existing logic unchanged.

- [ ] **Step 3: Migrate TeamProductivityTable.tsx**

In `apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx`:

```tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui"

// Replace:
<table className="w-full text-sm">
  <thead className="bg-neutral-50">
    <tr className="text-[11px] font-semibold uppercase text-neutral-400">
      <th className="px-4 py-2.5 text-left">Colaborador</th>
      <th className="px-4 py-2.5 text-right">OS Abertas</th>
      <th className="px-4 py-2.5 text-right">Entregues (mês)</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-neutral-100">
    {members.map((m) => (
      <tr key={m.name} className="hover:bg-neutral-50">
        <td className="px-4 py-2.5 font-medium text-neutral-800">{m.name}</td>
        <td className="px-4 py-2.5 text-right text-neutral-600">{m.open_count}</td>
        <td className="px-4 py-2.5 text-right">
          <span className="font-semibold text-emerald-700">{m.delivered_month}</span>
        </td>
      </tr>
    ))}
  </tbody>
</table>

// With:
<Table>
  <TableHeader>
    <TableRow className="bg-neutral-50 hover:bg-neutral-50">
      <TableHead className="font-semibold text-neutral-600">Colaborador</TableHead>
      <TableHead className="text-right font-semibold text-neutral-600">OS Abertas</TableHead>
      <TableHead className="text-right font-semibold text-neutral-600">Entregues (mês)</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {members.map((m) => (
      <TableRow key={m.name}>
        <TableCell className="font-medium text-neutral-800">{m.name}</TableCell>
        <TableCell className="text-right text-neutral-600">{m.open_count}</TableCell>
        <TableCell className="text-right">
          <span className="font-semibold text-success-700">{m.delivered_month}</span>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

Note: `text-emerald-700` → `text-success-700` (token migration, also part of S19-B4).

- [ ] **Step 4: Migrate seguradoras/page.tsx table**

In `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx`, convert the insurers table from raw `<table>` to shadcn `<Table>` keeping all click handlers and logo display logic unchanged.

- [ ] **Step 5: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src
git commit -m "refactor(dscar): S17-A5 — standardize all tables to shadcn Table components

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: S17-A6 — TableSkeleton for all loading states

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx`

- [ ] **Step 1: Fix PartsTab.tsx loading state**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`, replace the Loader2 loading state:

```tsx
import { TableSkeleton } from "@/components/ui"

// Before (line 156-157):
{isLoading ? (
  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-neutral-400 h-5 w-5" /></div>
) : ...}

// After:
{isLoading ? (
  <TableSkeleton rows={4} />
) : ...}
```

Remove unused `Loader2` import if it's no longer used elsewhere in the file.

- [ ] **Step 2: Fix seguradoras/page.tsx loading state**

In `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx`, find the loading state (currently showing text "Carregando..." or similar) and replace with:

```tsx
import { TableSkeleton } from "@/components/ui"

// Replace:
<div>Carregando...</div>
// OR whatever loading indicator is there

// With:
<TableSkeleton rows={5} />
```

- [ ] **Step 3: Verify TableSkeleton API**

Read `apps/dscar-web/src/components/ui/table-skeleton.tsx` to confirm the `rows` prop signature and adjust if needed.

- [ ] **Step 4: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src
git commit -m "fix(dscar): S17-A6 — TableSkeleton for all table loading states

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: S17-M9 — Panel consistency between PartsTab and ServicesTab

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`

- [ ] **Step 1: Find the add-service panel in ServicesTab.tsx**

Read `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx` and locate the form wrapper div for adding a service. It currently uses `rounded-md border border-neutral-200 bg-neutral-50 p-4`.

- [ ] **Step 2: Apply PartsTab panel style**

```tsx
// Before:
<div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 space-y-3">

// After:
<div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm space-y-3">
```

- [ ] **Step 3: Verify both tabs visually match**

Open OS detail in browser, switch between Peças and Serviços tabs, confirm both form panels look identical.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/tabs/ServicesTab.tsx
git commit -m "fix(dscar): S17-M9 — unify add-item panel style between PartsTab and ServicesTab

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: S17-M12 — formatCurrency compact option in @paddock/utils

**Files:**
- Modify: `packages/utils/src/formatters.ts`
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/BillingByTypeChart.tsx`
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`

- [ ] **Step 1: Update formatCurrency in formatters.ts**

In `packages/utils/src/formatters.ts`, update the existing `formatCurrency` signature:

```typescript
// Before:
export function formatCurrency(value: number | string | null | undefined): string {
  const n = value == null ? 0 : typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

// After:
export function formatCurrency(
  value: number | string | null | undefined,
  options?: { compact?: boolean }
): string {
  const n = value == null ? 0 : typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "R$ 0,00";
  if (options?.compact && Math.abs(n) >= 1000) {
    return `R$\u00a0${(n / 1000).toFixed(1)}k`
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}
```

- [ ] **Step 2: Remove local formatCurrency from BillingByTypeChart.tsx**

In `apps/dscar-web/src/app/(app)/dashboard/_components/BillingByTypeChart.tsx`:

```tsx
// Add import:
import { formatCurrency } from "@paddock/utils"

// Remove local function (lines 13-16):
// function formatCurrency(value: number): string {
//   if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`
//   return `R$${value.toFixed(0)}`
// }

// In YAxis formatter (was using local, now uses imported with compact):
<YAxis tickFormatter={(v: number) => formatCurrency(v, { compact: true })} tick={{ fontSize: 11 }} />

// In Tooltip formatter:
<Tooltip
  formatter={(value: number) => formatCurrency(value)}
/>
```

- [ ] **Step 3: Remove local formatCurrency from ManagerDashboard.tsx**

In `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx`:

```tsx
// Add import:
import { formatCurrency } from "@paddock/utils"

// Remove local function (lines 14-18):
// function formatCurrency(value: string | number): string { ... }

// All existing uses of formatCurrency(data.billing_month), formatCurrency(data.avg_ticket)
// will now use the imported version. Pass { compact: true } to maintain abbreviated display:
value={formatCurrency(data.billing_month, { compact: true })}
value={formatCurrency(data.avg_ticket, { compact: true })}
```

- [ ] **Step 4: Remove local formatCurrency from PartsTab.tsx**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`:

```tsx
// Add import:
import { formatCurrency } from "@paddock/utils"

// Remove local function (lines 31-33):
// function formatCurrency(value: string | number): string {
//   return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
// }
```

All existing `formatCurrency(part.unit_price)` calls continue to work unchanged (no `compact` option needed here).

- [ ] **Step 5: Find other local currency formatters**

```bash
cd apps/dscar-web && grep -rn "toLocaleString.*BRL\|Intl.NumberFormat.*BRL\|\.toFixed.*R\$" src --include="*.tsx"
```

If any other local formatters are found, migrate them to the shared function.

- [ ] **Step 6: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
cd packages/utils && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add packages/utils/src/formatters.ts apps/dscar-web/src
git commit -m "feat(utils): S17-M12 — add compact option to formatCurrency, remove local duplicates

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: S17-B6 — Shared form-styles.ts constants (depends on Task 2)

**Files:**
- Create: `apps/dscar-web/src/lib/form-styles.ts`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/EntrySection.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx`

**Prerequisite:** Task 2 (S17-C2) must be completed first.

- [ ] **Step 1: Create src/lib/form-styles.ts**

```typescript
/**
 * Shared form typography constants
 * Used in OS form sections and tabs to ensure visual consistency.
 * Sizes conform to WCAG 2.1 minimum (text-xs = 12px).
 */

/** Section group header: "DADOS DO VEÍCULO", "PRAZOS", etc. */
export const SECTION_TITLE =
  "text-xs font-semibold uppercase tracking-widest text-neutral-500"

/** Field label above an input: "Placa", "Nome do cliente", etc. */
export const LABEL =
  "block text-xs font-bold uppercase tracking-wide text-neutral-600 mb-1"
```

- [ ] **Step 2: Update EntrySection.tsx**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/EntrySection.tsx`:

```tsx
// Add import:
import { LABEL, SECTION_TITLE } from "@/lib/form-styles"

// Remove local definitions:
// const LABEL = "block text-xs font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
// const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-neutral-500"
```

- [ ] **Step 3: Update PrazosSection.tsx**

Same change in `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx`.

- [ ] **Step 4: Update ServicesTab.tsx**

Same change — remove local `LABEL`/`SECTION_TITLE` definitions and import from `@/lib/form-styles`.

- [ ] **Step 5: Update PartsTab.tsx**

Same change if `PartsTab` has local constants (check first by reading the file).

- [ ] **Step 6: Update NewOSDrawer.tsx**

Same change in `apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx`.

- [ ] **Step 7: Verify no local definitions remain**

```bash
cd apps/dscar-web && grep -rn "const LABEL\|const SECTION_TITLE" src --include="*.tsx"
```

Expected: 0 results.

- [ ] **Step 8: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add apps/dscar-web/src/lib/form-styles.ts apps/dscar-web/src
git commit -m "refactor(dscar): S17-B6 — extract shared LABEL/SECTION_TITLE to form-styles.ts

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Sprint 17 Completion Checklist

- [ ] `grep -r "#ea0e03\|#e31b1b\|hover:bg-red-700" apps/dscar-web/src` → 0 results in TSX
- [ ] `grep -r "text-\[9px\]\|text-\[10px\]" apps/dscar-web/src` → 0 results in labels
- [ ] `grep -r "window\.confirm\|[^/]confirm(" apps/dscar-web/src --include="*.tsx"` → 0 results
- [ ] `ConfirmDialog` exported from `src/components/ui/index.ts`
- [ ] `formatCurrency` accepts `options?: { compact?: boolean }` in `packages/utils/src/formatters.ts`
- [ ] `src/lib/form-styles.ts` exists with `LABEL` and `SECTION_TITLE`
- [ ] `npx tsc --noEmit` in `apps/dscar-web` → 0 errors
- [ ] `npm run build` in `apps/dscar-web` → no warnings
