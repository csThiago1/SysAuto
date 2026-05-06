# UX/UI Audit — Remaining Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining UX/UI items from the audit across web (dscar-web) and mobile (apps/mobile), covering accessibility, design token compliance, and usability improvements.

**Architecture:** Three independent workstreams — (A) Web modal migrations to Dialog component, (B) Web misc UX fixes, (C) Mobile design token + accessibility hardening. Each workstream can run as a parallel sub-agent since they touch non-overlapping files.

**Tech Stack:** Next.js 15, shadcn/ui Dialog primitive, React Native + Expo, Tailwind CSS, Zustand, lucide-react, Ionicons

---

## Conventions

- **Commits:** `feat(a11y):`, `fix(ux):`, `refactor(ui):` per Conventional Commits
- **Design tokens web:** NEVER use raw colors (`text-white`, `bg-red-500`). Use `text-foreground`, `text-error-600`, `bg-muted`, etc.
- **Design tokens mobile:** NEVER use hex literals in components. Import from `@/constants/theme` (`Colors`, `SemanticColors`, `Typography`).
- **Dialog migration pattern:** Replace `<div className="fixed inset-0 z-50 ...">` with `<Dialog open onOpenChange={...}><DialogContent>...</DialogContent></Dialog>`.
- **a11y:** Icon-only buttons get `aria-label`, not `title`. Images with meaning get `alt={descriptiveName}`. Decorative images get `alt=""`.

---

## File Map

### Workstream A — Web Modal Migrations (8 files)

| Action | File |
|--------|------|
| Modify | `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ImportBudgetModal.tsx` |
| Modify | `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/FiscalEmissionModal.tsx` |
| Modify | `apps/dscar-web/src/app/(app)/compras/ordens/page.tsx` |
| Modify | `apps/dscar-web/src/app/(app)/estoque/unidades/page.tsx` |
| Modify | `apps/dscar-web/src/app/(app)/estoque/lotes/page.tsx` |
| Modify | `apps/dscar-web/src/components/purchasing/SeguradoraFormModal.tsx` |
| Modify | `apps/dscar-web/src/components/purchasing/CompraFormModal.tsx` |
| Modify | `apps/dscar-web/src/components/purchasing/EstoqueBuscaModal.tsx` |

### Workstream B — Web Misc UX Fixes (10+ files)

| Action | File |
|--------|------|
| Modify | `apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx:125` |
| Modify | `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx:94,278` |
| Modify | `apps/dscar-web/src/lib/withRoleGuard.ts:29` |
| Modify | `apps/dscar-web/src/components/PermissionGate.tsx:16` |
| Modify | `apps/dscar-web/src/components/Sidebar.tsx:499` |
| Modify | `apps/dscar-web/src/app/(app)/service-orders/_components/ServiceOrderTable.tsx:175,180` |
| Modify | `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/FilesTab.tsx:172` |
| Modify | `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/BillingModal.tsx:136` |
| Modify | `apps/dscar-web/src/app/(app)/orcamentos-particulares/page.tsx:181` |
| Modify | `apps/dscar-web/src/app/(app)/service-orders/kanban/_components/KanbanCard.tsx:115` |

### Workstream C — Mobile Design Tokens + Accessibility (8 files)

| Action | File |
|--------|------|
| Modify | `apps/mobile/app/(auth)/login.tsx` |
| Modify | `apps/mobile/app/+not-found.tsx` |
| Modify | `apps/mobile/src/components/ui/Badge.tsx` |
| Modify | `apps/mobile/src/components/ui/Button.tsx` |
| Modify | `apps/mobile/src/components/ui/MonoLabel.tsx` |
| Modify | `apps/mobile/app/(app)/photo-editor/index.tsx` |
| Modify | `apps/mobile/app/(app)/os/index.tsx` |
| Modify | `apps/mobile/app/_layout.tsx` |

---

## Workstream A — Web Modal Migrations

All 8 modals follow the same pattern. The Dialog component at `apps/dscar-web/src/components/ui/dialog.tsx` already has focus trap, Escape key handling, aria-modal, aria-labelledby, and body scroll lock. Each migration replaces the raw `<div className="fixed inset-0 ...">` wrapper with `<Dialog>` + `<DialogContent>`.

**Import block to add in each file:**
```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
```

---

### Task A1: Migrate ImportBudgetModal to Dialog

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ImportBudgetModal.tsx`

This modal has TWO overlay layers: a main modal (line 105) and a diff-result overlay (line 91). Both need migration.

- [ ] **Step 1: Read the full file**

Read `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ImportBudgetModal.tsx` entirely to understand both modal layers.

- [ ] **Step 2: Add Dialog imports**

At the top of the file, add the Dialog imports:
```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
```

- [ ] **Step 3: Migrate main modal (line ~105)**

Replace the raw outer modal:
```tsx
// BEFORE:
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
  <div className="w-full max-w-lg rounded-xl border border-border bg-surface-900 p-6 shadow-2xl">
    ...buttons and form content...
  </div>
</div>

// AFTER:
<Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
  <DialogContent className="max-w-lg p-0 overflow-hidden">
    <DialogHeader className="px-6 pt-6">
      <DialogTitle>...existing title...</DialogTitle>
    </DialogHeader>
    <div className="px-6 pb-6 space-y-4">
      ...form content...
    </div>
    <DialogFooter className="px-6 pb-6">
      ...buttons...
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Remove the `if (!open) return null` guard — `Dialog open={open}` handles visibility.

- [ ] **Step 4: Migrate diff-result overlay (line ~91)**

The diff result uses a secondary overlay. Wrap it in its own `<Dialog>`:
```tsx
<Dialog open={!!diffResult} onOpenChange={(v) => { if (!v) setDiffResult(null) }}>
  <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-6">
    <DialogTitle>Resultado da Importação</DialogTitle>
    ...diff content...
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: Verify no raw overlays remain**

Search the file for `fixed inset-0` — should find zero matches.

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ImportBudgetModal.tsx
git commit -m "refactor(a11y): migrate ImportBudgetModal to Dialog primitive

Adds focus trap, Escape key, aria-modal to both main and diff-result overlays."
```

---

### Task A2: Migrate FiscalEmissionModal to Dialog

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/FiscalEmissionModal.tsx`

- [ ] **Step 1: Read the full file**

Read `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/FiscalEmissionModal.tsx` entirely.

- [ ] **Step 2: Add Dialog imports**

Same import block as Task A1.

- [ ] **Step 3: Migrate the modal**

The modal starts at line ~106. Replace:
```tsx
// BEFORE:
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
    {/* header with close X button */}
    {/* body */}
    {/* footer buttons */}
  </div>
</div>

// AFTER:
<Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
  <DialogContent className="max-w-md p-0 overflow-hidden">
    <DialogHeader className="...existing header classes...">
      <DialogTitle>...existing title...</DialogTitle>
    </DialogHeader>
    {/* body stays the same */}
    <DialogFooter className="px-5 pb-5">
      {/* buttons stay the same */}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Remove the manual close `<button>` with `X` icon — `DialogContent` already renders one.

- [ ] **Step 4: Verify no raw overlays remain**

Search the file for `fixed inset-0` — should find zero matches.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/[id]/_components/FiscalEmissionModal.tsx
git commit -m "refactor(a11y): migrate FiscalEmissionModal to Dialog primitive"
```

---

### Task A3: Migrate NovaOCDialog in compras/ordens

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/compras/ordens/page.tsx`

- [ ] **Step 1: Read the full file**

Read `apps/dscar-web/src/app/(app)/compras/ordens/page.tsx` entirely.

- [ ] **Step 2: Add Dialog imports**

Same import block as Task A1.

- [ ] **Step 3: Migrate NovaOCDialog component**

The inline `NovaOCDialog` component starts around line 70. It has:
- Outer fixed overlay with backdrop click (line ~96-104)
- Inner form with OS ID input + buttons (line ~105-133)

Replace the entire JSX return:
```tsx
// BEFORE:
if (!open) return null
return (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={...} role="button" ... />
    <div className="relative bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-4">
      ...
    </div>
  </div>
)

// AFTER:
return (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Nova Ordem de Compra</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        ...form content (OS ID input)...
      </div>
      <DialogFooter>
        ...buttons...
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

- [ ] **Step 4: Verify no raw overlays remain**

Search the file for `fixed inset-0` — should find zero matches.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/(app)/compras/ordens/page.tsx
git commit -m "refactor(a11y): migrate NovaOCDialog to Dialog primitive"
```

---

### Task A4: Migrate ReservarModal + TransferirModal in estoque/unidades

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/estoque/unidades/page.tsx`

This file has TWO inline modal components.

- [ ] **Step 1: Read the full file**

Read `apps/dscar-web/src/app/(app)/estoque/unidades/page.tsx` entirely.

- [ ] **Step 2: Add Dialog imports**

Same import block as Task A1.

- [ ] **Step 3: Migrate ReservarModal (line ~65)**

```tsx
// BEFORE:
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
  <div className="w-full max-w-md rounded-lg border border-border bg-[#1a1a1c] p-6 space-y-4">
    ...
  </div>
</div>

// AFTER:
<Dialog open={!!reservarUnidade} onOpenChange={(v) => { if (!v) setReservarUnidade(null) }}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Reservar Unidade</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      ...form content (OS ID input)...
    </div>
    <DialogFooter>
      ...buttons...
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Note: Replace `bg-[#1a1a1c]` with nothing — `DialogContent` already uses `bg-card`.

- [ ] **Step 4: Migrate TransferirModal (line ~138)**

Same pattern. Replace `bg-[#1a1a1c]` → rely on `DialogContent` default `bg-card`. Use `max-w-2xl` for the wider modal.

```tsx
<Dialog open={!!transferirUnidade} onOpenChange={(v) => { if (!v) setTransferirUnidade(null) }}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Transferir Unidade</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      ...PosicaoSelector and content...
    </div>
    <DialogFooter>
      ...buttons...
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: Update conditional renders in page**

The page likely has `{reservarUnidade && <ReservarModal ... />}` blocks. With Dialog's `open` prop handling visibility, you can remove the conditional wrapper OR keep it — both work since Dialog with `open={false}` renders nothing.

- [ ] **Step 6: Verify no raw overlays remain**

Search the file for `fixed inset-0` — should find zero matches.

- [ ] **Step 7: Commit**

```bash
git add apps/dscar-web/src/app/(app)/estoque/unidades/page.tsx
git commit -m "refactor(a11y): migrate ReservarModal + TransferirModal to Dialog primitive"
```

---

### Task A5: Migrate BaixarModal + TransferirLoteModal in estoque/lotes

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/estoque/lotes/page.tsx`

Exact same pattern as Task A4 but with BaixarModal (line ~94) and TransferirLoteModal (line ~183).

- [ ] **Step 1: Read the full file**

Read `apps/dscar-web/src/app/(app)/estoque/lotes/page.tsx` entirely.

- [ ] **Step 2: Add Dialog imports**

Same import block as Task A1.

- [ ] **Step 3: Migrate BaixarModal (line ~94)**

```tsx
<Dialog open={!!baixarLote} onOpenChange={(v) => { if (!v) setBaixarLote(null) }}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Baixar Lote</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      ...OS ID input + Quantidade input...
    </div>
    <DialogFooter>
      ...buttons...
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Replace `bg-[#1a1a1c]` → rely on `DialogContent` default.

- [ ] **Step 4: Migrate TransferirLoteModal (line ~183)**

```tsx
<Dialog open={!!transferirLote} onOpenChange={(v) => { if (!v) setTransferirLote(null) }}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Transferir Lote</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      ...PosicaoSelector and content...
    </div>
    <DialogFooter>
      ...buttons...
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: Verify no raw overlays remain**

Search the file for `fixed inset-0` — should find zero matches.

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/(app)/estoque/lotes/page.tsx
git commit -m "refactor(a11y): migrate BaixarModal + TransferirLoteModal to Dialog primitive"
```

---

### Task A6: Migrate SeguradoraFormModal to Dialog

**Files:**
- Modify: `apps/dscar-web/src/components/purchasing/SeguradoraFormModal.tsx`

- [ ] **Step 1: Read the full file**

Read `apps/dscar-web/src/components/purchasing/SeguradoraFormModal.tsx` entirely.

- [ ] **Step 2: Add Dialog imports**

Same import block as Task A1.

- [ ] **Step 3: Migrate the modal**

The modal starts at line ~57 with `if (!open) return null` guard. Replace:
```tsx
// BEFORE:
if (!open) return null
return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div onClick={handleClose} className="absolute inset-0" />
    <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      ...header, form fields, buttons...
    </div>
  </div>
)

// AFTER:
return (
  <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>...existing title (Peça Fornecida pela Seguradora)...</DialogTitle>
        <p className="text-xs text-muted-foreground">...subtitle...</p>
      </DialogHeader>
      <div className="space-y-4">
        ...form fields (description, tipo_qualidade, unit_price, quantity)...
      </div>
      <DialogFooter>
        ...buttons...
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

Remove `onClick={handleClose}` backdrop div and `onClick={(e) => e.stopPropagation()}` — Dialog handles both.

- [ ] **Step 4: Verify no raw overlays remain**

Search the file for `fixed inset-0` — should find zero matches.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/purchasing/SeguradoraFormModal.tsx
git commit -m "refactor(a11y): migrate SeguradoraFormModal to Dialog primitive"
```

---

### Task A7: Migrate CompraFormModal to Dialog

**Files:**
- Modify: `apps/dscar-web/src/components/purchasing/CompraFormModal.tsx`

Exact same pattern as Task A6. Modal starts at line ~65.

- [ ] **Step 1: Read the full file**

Read `apps/dscar-web/src/components/purchasing/CompraFormModal.tsx` entirely.

- [ ] **Step 2: Add Dialog imports**

Same import block as Task A1.

- [ ] **Step 3: Migrate the modal**

Same transformation as A6. Title is "Solicitar Compra de Peça". Form fields: description, part_number, tipo_qualidade, unit_price, quantity, observacoes.

```tsx
return (
  <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Solicitar Compra de Peça</DialogTitle>
        <p className="text-xs text-muted-foreground">...subtitle...</p>
      </DialogHeader>
      <div className="space-y-4">
        ...all 6 form fields...
      </div>
      <DialogFooter>
        ...Cancelar + Solicitar Compra buttons...
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

- [ ] **Step 4: Verify no raw overlays remain**

Search the file for `fixed inset-0` — should find zero matches.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/purchasing/CompraFormModal.tsx
git commit -m "refactor(a11y): migrate CompraFormModal to Dialog primitive"
```

---

### Task A8: Migrate EstoqueBuscaModal to Dialog

**Files:**
- Modify: `apps/dscar-web/src/components/purchasing/EstoqueBuscaModal.tsx`

This is the most complex modal — it has search/filter, results list, and selection panel.

- [ ] **Step 1: Read the full file**

Read `apps/dscar-web/src/components/purchasing/EstoqueBuscaModal.tsx` entirely.

- [ ] **Step 2: Add Dialog imports**

Same import block as Task A1.

- [ ] **Step 3: Migrate the modal**

The modal at line ~80 has max-height scrolling. Preserve that:
```tsx
return (
  <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
      <DialogHeader className="px-6 pt-6">
        <DialogTitle>Buscar no Estoque</DialogTitle>
      </DialogHeader>
      <div className="px-6 pb-6 space-y-4">
        ...search input, filters, results list, selection panel...
      </div>
      <DialogFooter className="px-6 pb-6">
        ...conditional buttons (Fechar or Bloquear e Adicionar)...
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

- [ ] **Step 4: Verify no raw overlays remain**

Search the file for `fixed inset-0` — should find zero matches.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/purchasing/EstoqueBuscaModal.tsx
git commit -m "refactor(a11y): migrate EstoqueBuscaModal to Dialog primitive"
```

---

## Workstream B — Web Misc UX Fixes

---

### Task B1: NewOSDrawer responsive width

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx:125`

- [ ] **Step 1: Read line 125 area**

Read `apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx` lines 120-130.

- [ ] **Step 2: Fix the width**

Change:
```tsx
// BEFORE:
className="w-[420px] sm:max-w-[420px] overflow-y-auto"

// AFTER:
className="w-full max-w-[420px] overflow-y-auto"
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx
git commit -m "fix(ux): make NewOSDrawer responsive on small screens"
```

---

### Task B2: ServicesTab — skeleton loading + confirm dialog

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`

- [ ] **Step 1: Read the full file**

Read `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx` entirely.

- [ ] **Step 2: Replace loading text with skeleton (line ~278)**

Find the loading text:
```tsx
// BEFORE:
{isLoading ? (
  <p className="text-sm text-muted-foreground">Carregando serviços...</p>
```

Replace with a skeleton:
```tsx
// AFTER:
{isLoading ? (
  <div className="space-y-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
    ))}
  </div>
```

- [ ] **Step 3: Replace confirm() with ConfirmDialog (line ~94)**

Find:
```tsx
async function handleDelete(laborId: string, desc: string) {
  if (!confirm(`Remover "${desc}"?`)) return
```

Add state for the confirm dialog:
```tsx
const [deleteTarget, setDeleteTarget] = useState<{ id: string; desc: string } | null>(null)
```

Replace `handleDelete`:
```tsx
function handleDelete(laborId: string, desc: string) {
  setDeleteTarget({ id: laborId, desc })
}

async function confirmDelete() {
  if (!deleteTarget) return
  // ...existing delete logic using deleteTarget.id...
  setDeleteTarget(null)
}
```

Add the ConfirmDialog at the bottom of the JSX:
```tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

<ConfirmDialog
  open={!!deleteTarget}
  onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
  title="Remover Serviço"
  description={`Tem certeza que deseja remover "${deleteTarget?.desc}"?`}
  confirmLabel="Remover"
  variant="destructive"
  onConfirm={confirmDelete}
/>
```

- [ ] **Step 4: Verify no confirm() remains**

Search the file for `confirm(` — should find zero matches.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx
git commit -m "fix(ux): skeleton loading + ConfirmDialog in ServicesTab

Replaces plain text loading with animated skeletons and
window.confirm with accessible ConfirmDialog."
```

---

### Task B3: withRoleGuard + PermissionGate — loading skeleton

**Files:**
- Modify: `apps/dscar-web/src/lib/withRoleGuard.ts:29`
- Modify: `apps/dscar-web/src/components/PermissionGate.tsx:16`

- [ ] **Step 1: Read both files**

Read `apps/dscar-web/src/lib/withRoleGuard.ts` and `apps/dscar-web/src/components/PermissionGate.tsx`.

- [ ] **Step 2: Fix withRoleGuard (line ~29)**

Find the early return during loading:
```tsx
// BEFORE:
if (status !== "authenticated" || !allowed) return null;

// AFTER — split loading from forbidden:
if (status === "loading") {
  return <div className="flex-1 animate-pulse bg-muted/30 rounded-lg m-6 min-h-[200px]" />;
}
if (status !== "authenticated" || !allowed) return null;
```

- [ ] **Step 3: Fix PermissionGate (line ~16)**

```tsx
// BEFORE:
if (status === "loading") return <></>;

// AFTER:
if (status === "loading") {
  return <div className="animate-pulse bg-muted/30 rounded-lg h-8 w-full" />;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/lib/withRoleGuard.ts apps/dscar-web/src/components/PermissionGate.tsx
git commit -m "fix(ux): show loading skeleton in withRoleGuard and PermissionGate

Prevents blank flash while auth status is resolving."
```

---

### Task B4: Icon-only buttons — title → aria-label

**Files:**
- Modify: `apps/dscar-web/src/components/Sidebar.tsx:499`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/_components/ServiceOrderTable.tsx:175,180`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/FilesTab.tsx:172`

- [ ] **Step 1: Fix Sidebar.tsx**

Find line ~499:
```tsx
// BEFORE:
title="Recolher sidebar"
// AFTER:
aria-label="Recolher sidebar"
```

- [ ] **Step 2: Fix ServiceOrderTable.tsx**

Find line ~175:
```tsx
// BEFORE:
title="Faturar OS"
// AFTER:
aria-label="Faturar OS"
```

Find line ~180 (CheckCircle icon — this is not a button, it's a status icon. Add sr-only text):
```tsx
// BEFORE:
<CheckCircle className="h-4 w-4 text-success-400 mx-auto" title="OS faturada" />
// AFTER:
<span className="flex items-center justify-center" aria-label="OS faturada">
  <CheckCircle className="h-4 w-4 text-success-400" aria-hidden="true" />
</span>
```

- [ ] **Step 3: Fix FilesTab.tsx**

Find line ~172:
```tsx
// BEFORE:
title="Remover foto"
// AFTER:
aria-label="Remover foto"
```

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/components/Sidebar.tsx \
       apps/dscar-web/src/app/(app)/service-orders/_components/ServiceOrderTable.tsx \
       apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/FilesTab.tsx
git commit -m "fix(a11y): replace title with aria-label on icon-only buttons"
```

---

### Task B5: Logo/make images — meaningful alt text

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/_components/ServiceOrderTable.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/kanban/_components/KanbanCard.tsx`
- Modify: `apps/dscar-web/src/app/(app)/orcamentos-particulares/page.tsx`

- [ ] **Step 1: Read each file and find alt="" on insurer/make logos**

- [ ] **Step 2: Fix ServiceOrderTable.tsx**

Find the insurer logo `alt=""`:
```tsx
// BEFORE:
<img src={order.insurer_detail.logo} alt="" className="..." />
// AFTER:
<img src={order.insurer_detail.logo} alt={order.insurer_detail?.display_name ?? ""} className="..." />
```

Find the make logo:
```tsx
// BEFORE:
<img src={order.make_logo} alt={order.make} className="..." />
```
This one likely already has `alt={order.make}`. Verify — if it does, skip.

- [ ] **Step 3: Fix KanbanCard.tsx**

```tsx
// BEFORE:
<img src={order.insurer_detail.logo} alt="" .../>
// AFTER:
<img src={order.insurer_detail.logo} alt={order.insurer_detail?.display_name ?? ""} .../>
```

- [ ] **Step 4: Fix orcamentos-particulares/page.tsx**

```tsx
// BEFORE:
<img src={b.vehicle_make_logo} alt="" .../>
// AFTER:
<img src={b.vehicle_make_logo} alt={b.vehicle_make ?? ""} .../>
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/_components/ServiceOrderTable.tsx \
       apps/dscar-web/src/app/(app)/service-orders/kanban/_components/KanbanCard.tsx \
       apps/dscar-web/src/app/(app)/orcamentos-particulares/page.tsx
git commit -m "fix(a11y): add meaningful alt text to insurer and vehicle make logos"
```

---

## Workstream C — Mobile Design Tokens + Accessibility

---

### Task C1: Fix +not-found.tsx — broken dark theme

**Files:**
- Modify: `apps/mobile/app/+not-found.tsx`

This is **CRITICAL** — the 404 page uses a light background that breaks the dark theme.

- [ ] **Step 1: Read the full file**

Read `apps/mobile/app/+not-found.tsx`.

- [ ] **Step 2: Replace all hardcoded colors with theme tokens**

```tsx
import { Colors } from '@/constants/theme'

// Line 44 — background:
// BEFORE: backgroundColor: '#f9fafb'
// AFTER:  backgroundColor: Colors.bg

// Line 20 — description color:
// BEFORE: color: '#6b7280'
// AFTER:  color: Colors.textTertiary

// Line 32 — link color:
// BEFORE: color: '#e31b1b'
// AFTER:  color: Colors.brand

// Line 54 — code text color:
// BEFORE: color: '#e31b1b'
// AFTER:  color: Colors.brand
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/+not-found.tsx
git commit -m "fix(mobile): replace hardcoded light colors with dark theme tokens in 404 page"
```

---

### Task C2: Fix login.tsx — hardcoded colors

**Files:**
- Modify: `apps/mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Read the full file**

Read `apps/mobile/app/(auth)/login.tsx`.

- [ ] **Step 2: Add Colors import if missing**

```tsx
import { Colors } from '@/constants/theme'
```

- [ ] **Step 3: Replace all hardcoded hex values**

| Line | Before | After |
|------|--------|-------|
| 72, 134 | `'#ea0e03'` | `Colors.brand` |
| 135 | `'#c50b02'` | `Colors.brandShade` |
| 184 | `'#ffffff'` | `Colors.textPrimary` |
| 198 | `'rgba(255,255,255,0.85)'` | `Colors.textPrimary` (or keep rgba if intentional opacity) |
| 203 | `'rgba(255,255,255,0.25)'` | `Colors.textTertiary` |
| 219 | `'rgba(255,255,255,0.04)'` | `Colors.inputBg` |
| 221 | `'#222'` | `Colors.border` |
| 225 | `'#ffffff'` | `Colors.textPrimary` |
| 228 | `'#ea0e03'` | `Colors.brand` |
| 229 | `'rgba(234,14,3,0.04)'` | `Colors.brandTint` |
| 230, 256 | `'#ea0e03'` | `Colors.brand` |
| 271 | `'#ffffff'` | `Colors.textPrimary` |

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(auth)/login.tsx
git commit -m "fix(mobile): migrate login screen to design tokens

Replaces 16 hardcoded hex values with Colors.* constants."
```

---

### Task C3: Fix Badge.tsx — hardcoded status colors

**Files:**
- Modify: `apps/mobile/src/components/ui/Badge.tsx`

- [ ] **Step 1: Read the full file**

Read `apps/mobile/src/components/ui/Badge.tsx`.

- [ ] **Step 2: Replace STATUS_CONFIG with theme tokens**

The `STATUS_CONFIG` object (lines 20-32) has 16 hardcoded light-mode colors that look broken on dark backgrounds. Replace with `SemanticColors` and `OS_STATUS_MAP` from theme:

```tsx
import { Colors, SemanticColors, OS_STATUS_MAP } from '@/constants/theme'

// Replace the entire STATUS_CONFIG with a function that reads from OS_STATUS_MAP:
function getStatusStyle(status: string): { backgroundColor: string; color: string } {
  const mapped = OS_STATUS_MAP[status]
  if (mapped) {
    return { backgroundColor: mapped.bg, color: mapped.color }
  }
  // Fallback for non-OS statuses
  return { backgroundColor: SemanticColors.neutral.bg, color: SemanticColors.neutral.color }
}
```

Update the Badge component to call `getStatusStyle(status)` instead of reading from the old object.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ui/Badge.tsx
git commit -m "fix(mobile): migrate Badge to OS_STATUS_MAP theme tokens

Replaces 16 hardcoded light-mode colors with dark-theme-compatible
values from the centralized design system."
```

---

### Task C4: Fix Button.tsx + MonoLabel.tsx + photo-editor — minor hardcoded colors

**Files:**
- Modify: `apps/mobile/src/components/ui/Button.tsx:108,117`
- Modify: `apps/mobile/src/components/ui/MonoLabel.tsx:43`
- Modify: `apps/mobile/app/(app)/photo-editor/index.tsx:83`

- [ ] **Step 1: Read each file at the relevant lines**

- [ ] **Step 2: Fix Button.tsx**

```tsx
// Line 108 — labelPrimary:
// BEFORE: color: '#ffffff'
// AFTER:  color: Colors.textPrimary

// Line 117 — labelDanger:
// BEFORE: color: '#ffffff'
// AFTER:  color: Colors.textPrimary
```

- [ ] **Step 3: Fix MonoLabel.tsx**

```tsx
// Line 43 — accent variant:
// BEFORE: color: '#cc4444'
// AFTER:  color: Typography.labelMono.color
```

(Import `Typography` from `@/constants/theme` if not already imported.)

- [ ] **Step 4: Fix photo-editor/index.tsx**

```tsx
// Line 83 — activeColor initial value:
// BEFORE: const [activeColor, setActiveColor] = useState('#e31b1b')
// AFTER:  const [activeColor, setActiveColor] = useState(Colors.brand)
```

(Import `Colors` from `@/constants/theme` if not already imported.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/ui/Button.tsx \
       apps/mobile/src/components/ui/MonoLabel.tsx \
       apps/mobile/app/(app)/photo-editor/index.tsx
git commit -m "fix(mobile): replace remaining hardcoded hex colors with theme tokens"
```

---

### Task C5: OS list — add accessibilityLabel to all interactive elements

**Files:**
- Modify: `apps/mobile/app/(app)/os/index.tsx`

This is the most used screen. Needs accessibility labels on all interactive elements.

- [ ] **Step 1: Read the full file**

Read `apps/mobile/app/(app)/os/index.tsx` entirely.

- [ ] **Step 2: Add accessibility to header buttons**

Find the notifications icon button (~line 208):
```tsx
// BEFORE:
<TouchableOpacity onPress={...}>
  <Ionicons name="notifications-outline" ... />
</TouchableOpacity>

// AFTER:
<TouchableOpacity
  onPress={...}
  accessibilityRole="button"
  accessibilityLabel="Notificações"
>
  <Ionicons name="notifications-outline" ... />
</TouchableOpacity>
```

- [ ] **Step 3: Add accessibility to filter button**

Find the filter button (~line 322):
```tsx
// AFTER:
<TouchableOpacity
  onPress={...}
  accessibilityRole="button"
  accessibilityLabel={selectedStatus ? `Filtro: ${selectedStatus}` : "Filtrar por status"}
>
```

Find the clear filter button (~line 338):
```tsx
// AFTER:
<TouchableOpacity
  onPress={...}
  accessibilityRole="button"
  accessibilityLabel="Limpar filtro"
>
```

- [ ] **Step 4: Add accessibility to status modal items**

Find the status filter modal items (~lines 128-170):
```tsx
// Each status row TouchableOpacity:
<TouchableOpacity
  onPress={...}
  accessibilityRole="radio"
  accessibilityState={{ checked: isSelected }}
  accessibilityLabel={`Status: ${statusLabel}`}
>
```

- [ ] **Step 5: Add accessibility to OS list items**

Find the list item TouchableOpacity (~line 360+):
```tsx
// Each OS card:
<TouchableOpacity
  onPress={...}
  accessibilityRole="button"
  accessibilityLabel={`OS número ${item.number}, ${item.customer_name}, status ${item.status_display}`}
>
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/(app)/os/index.tsx
git commit -m "feat(a11y): add accessibilityLabel to all interactive elements in OS list

Covers header buttons, filter controls, status modal items,
and OS list cards for VoiceOver/TalkBack support."
```

---

### Task C6: Error boundary in root layout

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Read the full file**

Read `apps/mobile/app/_layout.tsx`.

- [ ] **Step 2: Install expo-error-boundary if not already present**

Check if `expo-error-boundary` or equivalent is in `package.json`. If not:
```bash
cd apps/mobile && npx expo install expo-error-boundary
```

If `expo-error-boundary` is not available, create a simple class-based ErrorBoundary:

```tsx
import React from 'react'
import { View, Text as RNText, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Typography } from '@/constants/theme'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <RNText style={styles.title}>Algo deu errado</RNText>
          <RNText style={styles.message}>
            O aplicativo encontrou um erro inesperado.
          </RNText>
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
          >
            <RNText style={styles.buttonText}>Tentar novamente</RNText>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  message: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: Colors.brand,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
})
```

- [ ] **Step 3: Wrap providers in ErrorBoundary**

In `_layout.tsx`, wrap the `<Slot />` or provider tree:
```tsx
<ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    ...existing providers...
    <Slot />
  </QueryClientProvider>
</ErrorBoundary>
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx apps/mobile/src/components/ErrorBoundary.tsx
git commit -m "feat(mobile): add ErrorBoundary to root layout

Catches unhandled render errors and shows a retry screen
instead of crashing the app."
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] 8 raw modals → Dialog (Tasks A1-A8)
   - [x] NewOSDrawer responsive (B1)
   - [x] ServicesTab skeleton + confirm (B2)
   - [x] withRoleGuard/PermissionGate loading (B3)
   - [x] Icon-only buttons aria-label (B4)
   - [x] Logo alt text (B5)
   - [x] Mobile 404 dark theme (C1)
   - [x] Mobile login hardcoded colors (C2)
   - [x] Mobile Badge colors (C3)
   - [x] Mobile minor hardcoded colors (C4)
   - [x] Mobile OS list accessibility (C5)
   - [x] Mobile error boundary (C6)

2. **Placeholder scan:** No TBD/TODO/"implement later" found. All steps have code.

3. **Type consistency:** Dialog import block is identical across all A tasks. `Colors.*` references in C tasks match `apps/mobile/src/constants/theme.ts` exports.

---

## Execution Notes

**Parallelism:** Workstreams A, B, and C touch completely separate files and can run as **3 parallel sub-agents**.

Within Workstream A, tasks A1-A8 also touch separate files and could theoretically run in parallel (8 agents), but the pattern is identical — running them sequentially in one agent is more practical.

**Recommended agent split:**
- **Agent 1:** Tasks A1-A8 (web modal migrations)
- **Agent 2:** Tasks B1-B5 (web misc UX)
- **Agent 3:** Tasks C1-C6 (mobile tokens + a11y)

**Verification after all agents complete:**
```bash
# Web — TypeScript check
npx tsc --noEmit --project apps/dscar-web/tsconfig.json 2>&1 | grep "error TS" | wc -l
# Should not increase from baseline (27 pre-existing errors)

# Web — search for remaining raw modals
grep -r "fixed inset-0" apps/dscar-web/src/ --include="*.tsx" -l
# Should return only dialog.tsx and CommandPalette.tsx (which use it correctly)

# Mobile — search for hardcoded hex
grep -rn "'#" apps/mobile/src/components/ui/ --include="*.tsx"
# Should return 0 matches (all migrated to theme)
```
