# Design System Fintech-Red Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar dark theme fintech (terminal seletivo) em todas as ~40 páginas do ERP dscar-web via 6 componentes foundation + migração módulo-a-módulo.

**Architecture:** Layer 1 cria/refina componentes compartilhados (DataTable, StatusPill, StatCard, FormField tokens, Sidebar, shadcn Table base). Layer 2 migra cada página para consumir esses componentes. Nenhuma lógica de negócio é alterada — apenas classes CSS e imports.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-26-design-system-fintech-red-phase2.md`

---

## Arquivos Modificados / Criados

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Modify | `apps/dscar-web/src/components/ui/table.tsx` | Fix shadcn Table base dark theme |
| Create | `apps/dscar-web/src/components/ui/data-table.tsx` | DataTable wrapper dark |
| Create | `apps/dscar-web/src/components/ui/status-pill.tsx` | StatusPill badge dark genérico |
| Modify | `apps/dscar-web/src/app/(app)/dashboard/_components/StatCard.tsx` | Refatorar para fintech style |
| Modify | `packages/utils/src/form-styles.ts` | FormField tokens dark |
| Modify | `apps/dscar-web/src/components/Sidebar.tsx` | Section dividers + label-mono badges |
| Modify | `apps/dscar-web/src/app/(app)/dashboard/_components/OverdueOSList.tsx` | Dark error theme |
| Modify | `apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx` | Fix neutral borders |
| Modify | `apps/dscar-web/src/app/(app)/dashboard/_components/RecentOSTable.tsx` | Fix neutral borders + pills |
| Modify | `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx` | PageHeader + label-mono |
| Modify | Cadastros pages (~8 files) | DataTable + PageHeader |
| Modify | Financeiro pages (~6 files) | StatusPill + dark borders |
| Modify | RH pages (~8 files) | StatCard + DataTable + FormField |
| Modify | Motor/Capacidade/Auditoria pages (~6 files) | DataTable + PageHeader |
| Modify | Estoque/Orçamentos/Fiscal/Benchmark/Agenda pages (~10 files) | DataTable + PageHeader |

---

## Task 1: shadcn `table.tsx` — Fix Dark Theme Base

**Files:**
- Modify: `apps/dscar-web/src/components/ui/table.tsx`

Todo `<Table>` do app herda deste componente. Corrigir as classes light aqui propaga dark theme para todas as tabelas automaticamente.

- [ ] **Step 1: Corrigir TableFooter, TableRow, TableHead, TableCaption**

Em `table.tsx`, fazer estas substituições:

`TableFooter` (classe `border-t bg-neutral-50 font-medium`):
```
old: "border-t bg-neutral-50 font-medium"
new: "border-t border-white/10 bg-white/[0.03] font-medium"
```

`TableRow` (classe `border-b border-neutral-100 transition-colors hover:bg-neutral-50`):
```
old: "border-b border-neutral-100 transition-colors hover:bg-neutral-50"
new: "border-b border-white/5 transition-colors hover:bg-white/[0.03]"
```

`TableHead` (classe `h-10 px-4 text-left align-middle text-xs font-semibold text-neutral-500 uppercase tracking-wide`):
```
old: "h-10 px-4 text-left align-middle text-xs font-semibold text-neutral-500 uppercase tracking-wide"
new: "h-10 px-4 text-left align-middle label-mono text-white/40"
```

`TableCaption` (classe `mt-4 text-sm text-neutral-500`):
```
old: "mt-4 text-sm text-neutral-500"
new: "mt-4 text-sm text-white/40"
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/ui/table.tsx
git commit -m "fix(design): shadcn Table base — dark theme (neutral→white/opacity)"
```

---

## Task 2: Novo componente `DataTable`

**Files:**
- Create: `apps/dscar-web/src/components/ui/data-table.tsx`
- Modify: `apps/dscar-web/src/components/ui/index.ts`

- [ ] **Step 1: Criar `data-table.tsx`**

```tsx
import { cn } from "@/lib/utils"

interface DataTableProps {
  children: React.ReactNode
  emptyMessage?: string
  isEmpty?: boolean
  className?: string
}

export function DataTable({
  children,
  emptyMessage = "Nenhum registro encontrado",
  isEmpty = false,
  className,
}: DataTableProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-white/10 bg-white/5 overflow-hidden",
        className
      )}
    >
      {isEmpty ? (
        <div className="flex items-center justify-center py-12 text-sm text-white/30">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  )
}
```

- [ ] **Step 2: Adicionar export no barrel**

Em `apps/dscar-web/src/components/ui/index.ts`, adicionar:
```typescript
export { DataTable } from "./data-table"
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/components/ui/data-table.tsx apps/dscar-web/src/components/ui/index.ts
git commit -m "feat(design): DataTable wrapper — dark container for shadcn Table"
```

---

## Task 3: Novo componente `StatusPill`

**Files:**
- Create: `apps/dscar-web/src/components/ui/status-pill.tsx`
- Modify: `apps/dscar-web/src/components/ui/index.ts`

- [ ] **Step 1: Criar `status-pill.tsx`**

```tsx
import { cn } from "@/lib/utils"

const COLOR_MAP = {
  success: {
    bg: "bg-success-500/10",
    border: "border-success-500/20",
    text: "text-success-400",
    dot: "bg-success-400",
  },
  error: {
    bg: "bg-error-500/10",
    border: "border-error-500/20",
    text: "text-error-400",
    dot: "bg-error-400",
  },
  warning: {
    bg: "bg-warning-500/10",
    border: "border-warning-500/20",
    text: "text-warning-400",
    dot: "bg-warning-400",
  },
  info: {
    bg: "bg-info-500/10",
    border: "border-info-500/20",
    text: "text-info-400",
    dot: "bg-info-400",
  },
  neutral: {
    bg: "bg-white/5",
    border: "border-white/10",
    text: "text-white/50",
    dot: "bg-white/50",
  },
} as const

type StatusPillColor = keyof typeof COLOR_MAP

interface StatusPillProps {
  label: string
  color: StatusPillColor
  size?: "sm" | "md"
  dot?: boolean
  className?: string
}

export function StatusPill({
  label,
  color,
  size = "sm",
  dot = false,
  className,
}: StatusPillProps) {
  const c = COLOR_MAP[color]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        c.bg,
        c.border,
        c.text,
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0 animate-pulse-slow",
            c.dot
          )}
        />
      )}
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Adicionar export no barrel**

Em `apps/dscar-web/src/components/ui/index.ts`, adicionar:
```typescript
export { StatusPill } from "./status-pill"
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/components/ui/status-pill.tsx apps/dscar-web/src/components/ui/index.ts
git commit -m "feat(design): StatusPill — dark badge genérico (success/error/warning/info/neutral)"
```

---

## Task 4: `StatCard` — Refatorar para fintech style

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/StatCard.tsx`

- [ ] **Step 1: Refatorar icon container e tipografia**

Substituir o `iconBg` prop para usar `bg-white/[0.06]` em vez de cores sólidas light. O ícone mantém a cor semântica.

No icon container, substituir:
```
old: className={cn("flex h-10 w-10 items-center justify-center rounded-md", iconBg)}
new: className="flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.06]"
```

No label (text acima do valor), substituir:
```
old: "text-xs font-medium uppercase tracking-wide text-white/50"
new: "label-mono text-white/40"
```

No valor numérico, adicionar `font-mono`:
```
old: "text-3xl font-bold text-white font-plate"
new: "text-3xl font-bold text-white font-mono"
```

Se houver trend/variação, usar:
```
old: qualquer classe de trend
new: "label-mono text-success-400" (positivo) ou "label-mono text-error-400" (negativo)
```

- [ ] **Step 2: Atualizar chamadas nos dashboards**

Em `ManagerDashboard.tsx`, `ConsultantDashboard.tsx`, e `rh/page.tsx`, remover a prop `iconBg` das chamadas ao `StatCard` (já que o background agora é fixo `bg-white/[0.06]`). Manter a prop `iconColor` para a cor do ícone.

Se o StatCard usa `iconBg` como prop, remover a prop do componente e hardcodar `bg-white/[0.06]`.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/dashboard/_components/StatCard.tsx
git add apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx
git add apps/dscar-web/src/app/(app)/dashboard/_components/ConsultantDashboard.tsx
git commit -m "feat(design): StatCard fintech — bg-white/[0.06] icon, label-mono, font-mono value"
```

---

## Task 5: `FormField` tokens — Dark fintech

**Files:**
- Modify: `packages/utils/src/form-styles.ts`

- [ ] **Step 1: Atualizar todas as constantes**

```typescript
// old
export const FORM_SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-neutral-500"
export const FORM_SUBSECTION = "text-xs font-semibold uppercase tracking-wider text-neutral-400 mt-3 mb-1"
export const FORM_LABEL = "block text-xs font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
export const FORM_HINT = "mt-0.5 text-xs text-neutral-400"
export const FORM_ERROR = "mt-0.5 text-xs text-red-500"

// new
export const FORM_SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-white/50"
export const FORM_SUBSECTION = "label-mono text-white/40 mt-3 mb-1"
export const FORM_LABEL = "label-mono text-white/50 mb-0.5"
export const FORM_HINT = "mt-0.5 text-xs text-white/30 font-mono"
export const FORM_ERROR = "mt-0.5 text-xs text-error-400 font-mono"
```

- [ ] **Step 2: Commit**

```bash
git add packages/utils/src/form-styles.ts
git commit -m "feat(design): FormField tokens — dark fintech (neutral→white/opacity, label-mono)"
```

---

## Task 6: Sidebar — Section dividers + mono badges

**Files:**
- Modify: `apps/dscar-web/src/components/Sidebar.tsx`

- [ ] **Step 1: Trocar section headers para `section-divider`**

Encontrar os elementos de section header (texto como "CADASTROS", "FINANCEIRO", etc.) que usam:
```
old: "text-xs font-semibold text-white/25 tracking-[1.5px] uppercase px-5 pt-4 pb-1.5"
new: "section-divider px-5 pt-4 pb-1.5"
```

- [ ] **Step 2: Adicionar `font-mono` nos badges de contagem**

Nos badges que mostram contagem (ex: OS abertas), adicionar `font-mono`:
```
old: "ml-auto bg-primary-600 text-white text-xs font-bold px-[7px] py-[2px] rounded-[10px] leading-4"
new: "ml-auto bg-primary-600 text-white text-xs font-bold font-mono px-[7px] py-[2px] rounded-[10px] leading-4"
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/components/Sidebar.tsx
git commit -m "feat(design): sidebar — section-divider headers + font-mono badges"
```

---

## Task 7: Dashboard — Migração completa

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/OverdueOSList.tsx`
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx`
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/RecentOSTable.tsx`

- [ ] **Step 1: OverdueOSList — Dark error theme**

Substituições:
```
"border border-red-100"     → "border border-error-500/20"
"border-b border-red-100"   → "border-b border-error-500/20"
"text-red-700"              → "text-error-400"
"bg-red-50"                 → "bg-error-500/5"
"text-red-400"              → "text-error-400"
"divide-y divide-red-50"    → "divide-y divide-error-500/10"
"hover:bg-red-50/50"        → "hover:bg-error-500/5"
"text-red-600"              → "text-error-400"
```

- [ ] **Step 2: TeamProductivityTable — Fix borders**

Substituições:
```
"border-b border-neutral-100"   → "border-b border-white/10"
"divide-y divide-neutral-100"   → "divide-y divide-white/5"
"text-success-700"              → "text-success-400"
```

- [ ] **Step 3: RecentOSTable — Fix borders + pills**

Substituições:
```
"border-b border-neutral-100"   → "border-b border-white/10"
"divide-y divide-neutral-50"    → "divide-y divide-white/5"
"bg-info-100 text-info-700"     → "bg-info-500/10 text-info-400"
```

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/(app)/dashboard/_components/
git commit -m "feat(design): dashboard tables — dark error/border/pill theme"
```

---

## Task 8: Cadastros — Sweep completo

**Files:**
- Modify: All pages in `apps/dscar-web/src/app/(app)/cadastros/`

Este task requer ler cada arquivo, identificar classes proibidas, e substituir. Padrão:

- [ ] **Step 1: Buscar todos os arquivos com classes proibidas**

```bash
cd apps/dscar-web && grep -rn "neutral-\|bg-white[^/]\|emerald-\|indigo-\|divide-neutral\|bg-red-[15]0\|bg-blue-[15]0\|bg-success-[15]0\|bg-warning-[15]0\|bg-info-[15]0" src/app/\(app\)/cadastros/ --include="*.tsx" | head -60
```

- [ ] **Step 2: Para cada arquivo encontrado, aplicar as substituições do contrato**

Regras (aplicar em todos os matches):
```
bg-white (sólido, não bg-white/)    → bg-card ou bg-white/[0.04]
bg-neutral-50                       → bg-white/[0.03]
bg-neutral-100                      → bg-white/[0.03]
border-neutral-100                  → border-white/10
border-neutral-200                  → border-white/10
divide-neutral-100                  → divide-white/5
divide-neutral-50                   → divide-white/5
text-neutral-900                    → text-white/90
text-neutral-700                    → text-white/70
text-neutral-500                    → text-white/50
text-neutral-600                    → text-white/40
text-neutral-400                    → text-white/30
bg-emerald-100                      → bg-success-500/10
text-emerald-700                    → text-success-400
bg-red-50, bg-red-100               → bg-error-500/10
text-red-700                        → text-error-400
border-red-200                      → border-error-500/20
bg-indigo-50                        → bg-white/5
text-indigo-700                     → text-white/50
bg-blue-100                         → bg-info-500/10
text-blue-700                       → text-info-400
border-blue-200                     → border-info-500/20
bg-purple-100                       → bg-purple-500/10
text-purple-700                     → text-purple-400
border-purple-200                   → border-purple-500/20
bg-success-100                      → bg-success-500/10
text-success-700                    → text-success-400
border-success-200                  → border-success-500/20
bg-warning-100                      → bg-warning-500/10
text-warning-700                    → text-warning-400
border-warning-200                  → border-warning-500/20
bg-info-100                         → bg-info-500/10
text-info-700                       → text-info-400
```

- [ ] **Step 3: Adicionar `PageHeader` + `SectionDivider` onde ausentes**

Para cada página que ainda usa `<h1>` ou `<div>` inline para títulos, substituir por:
```tsx
import { PageHeader } from "@/components/ui/page-header"
import { SectionDivider } from "@/components/ui/section-divider"

<PageHeader title="..." description="..." actions={...} />
<SectionDivider label="SEÇÃO" />
```

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/(app)/cadastros/
git commit -m "feat(design): cadastros — full dark sweep (neutral→white/opacity, StatusPill, PageHeader)"
```

---

## Task 9: Financeiro — Sweep completo

**Files:**
- Modify: All pages in `apps/dscar-web/src/app/(app)/financeiro/`

- [ ] **Step 1: Buscar classes proibidas**

```bash
cd apps/dscar-web && grep -rn "neutral-\|bg-white[^/]\|emerald-\|indigo-\|bg-red-[15]0\|bg-blue-[15]0\|bg-success-[15]0\|bg-warning-[15]0\|bg-info-[15]0\|text-red-[67]00\|text-success-[67]00\|text-warning-[67]00\|hover:bg-primary-50\|hover:border-primary-200" src/app/\(app\)/financeiro/ --include="*.tsx" | head -60
```

- [ ] **Step 2: Aplicar substituições do contrato (mesma tabela Task 8)**

Atenção especial ao `JournalEntryTable.tsx`:
- Status badges `bg-red-100 text-red-700 border border-red-200` → importar `StatusPill` e usar `<StatusPill label="Rejeitado" color="error" />`
- `bg-success-100 text-success-700 border border-success-200` → `<StatusPill label="Aprovado" color="success" />`
- `bg-warning-100 text-warning-700 border border-warning-200` → `<StatusPill label="Rascunho" color="warning" />`
- `border-neutral-100` → `border-white/10`
- `divide-neutral-50` → `divide-white/5`

Dashboard financeiro:
- `bg-blue-100` → `bg-white/[0.06]`
- `bg-orange-100` → `bg-white/[0.06]`
- `bg-success-100` → `bg-white/[0.06]`
- `border-neutral-100` → `border-white/10`
- `hover:border-primary-200 hover:bg-primary-50` → `hover:border-primary-500/30 hover:bg-primary-500/5`

- [ ] **Step 3: Adicionar `PageHeader` + `SectionDivider` onde ausentes**

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/(app)/financeiro/
git commit -m "feat(design): financeiro — dark sweep (StatusPill, neutral→white/opacity)"
```

---

## Task 10: RH — Sweep completo

**Files:**
- Modify: All pages in `apps/dscar-web/src/app/(app)/rh/`

- [ ] **Step 1: Buscar classes proibidas**

```bash
cd apps/dscar-web && grep -rn "neutral-\|bg-white[^/]\|emerald-\|indigo-\|bg-red-[15]0\|bg-blue-[15]0\|bg-success-[15]0\|bg-warning-[15]0\|bg-info-[15]0\|bg-primary-[15]0\|text-warning-[678]00" src/app/\(app\)/rh/ --include="*.tsx" | head -60
```

- [ ] **Step 2: Aplicar substituições do contrato**

RH Dashboard (`rh/page.tsx`):
- `bg-primary-100` → `bg-white/[0.06]`
- `bg-success-100` → `bg-white/[0.06]`
- `bg-warning-100` → `bg-white/[0.06]`
- Warning alert box: `border-warning-200 bg-warning-50` → `border-warning-500/20 bg-warning-500/10`
- `text-warning-600` → `text-warning-400`
- `text-warning-800` → `text-warning-400`
- `text-warning-700` → `text-warning-400`

EmployeeTable:
- Adicionar `label-mono text-white/40` nos headers se ausente

Formulários (admissão, detalhe tabs):
- Inputs e labels já consomem `FORM_LABEL` etc. de `form-styles.ts` — atualização automática via Task 5

- [ ] **Step 3: Adicionar `PageHeader` + `SectionDivider` onde ausentes**

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/(app)/rh/
git commit -m "feat(design): RH — dark sweep (StatCard icon, warning dark, label-mono headers)"
```

---

## Task 11: Motor + Capacidade + Auditoria — Sweep

**Files:**
- Modify: Pages in `apps/dscar-web/src/app/(app)/configuracao-motor/`, `capacidade/`, `auditoria/`

- [ ] **Step 1: Buscar classes proibidas**

```bash
cd apps/dscar-web && grep -rn "neutral-\|bg-white[^/]\|emerald-\|bg-red-[15]0\|bg-success-[15]0\|bg-warning-[15]0" src/app/\(app\)/configuracao-motor/ src/app/\(app\)/capacidade/ src/app/\(app\)/auditoria/ --include="*.tsx" | head -40
```

- [ ] **Step 2: Aplicar substituições do contrato + PageHeader + SectionDivider**

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/configuracao-motor/ apps/dscar-web/src/app/(app)/capacidade/ apps/dscar-web/src/app/(app)/auditoria/
git commit -m "feat(design): motor+capacidade+auditoria — dark sweep"
```

---

## Task 12: Estoque + Orçamentos + Fiscal + Benchmark + Agenda — Sweep

**Files:**
- Modify: Pages in `apps/dscar-web/src/app/(app)/estoque/`, `orcamentos/`, `fiscal/`, `benchmark/`, `agenda/`

- [ ] **Step 1: Buscar classes proibidas em todos os módulos restantes**

```bash
cd apps/dscar-web && grep -rn "neutral-\|bg-white[^/]\|emerald-\|indigo-\|bg-red-[15]0\|bg-success-[15]0\|bg-warning-[15]0\|bg-info-[15]0\|text-red-[67]00\|text-success-[67]00\|text-warning-[67]00" src/app/\(app\)/estoque/ src/app/\(app\)/orcamentos/ src/app/\(app\)/fiscal/ src/app/\(app\)/benchmark/ src/app/\(app\)/agenda/ --include="*.tsx" | head -60
```

- [ ] **Step 2: Aplicar substituições do contrato + PageHeader + SectionDivider**

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/estoque/ apps/dscar-web/src/app/(app)/orcamentos/ apps/dscar-web/src/app/(app)/fiscal/ apps/dscar-web/src/app/(app)/benchmark/ apps/dscar-web/src/app/(app)/agenda/
git commit -m "feat(design): estoque+orcamentos+fiscal+benchmark+agenda — dark sweep"
```

---

## Task 13: OS Detail + Form — Sweep

**Files:**
- Modify: Pages in `apps/dscar-web/src/app/(app)/service-orders/[id]/`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx`

- [ ] **Step 1: Buscar classes proibidas no OS detail**

```bash
cd apps/dscar-web && grep -rn "neutral-\|bg-white[^/]\|emerald-\|indigo-\|bg-red-[15]0\|bg-success-[15]0\|bg-warning-[15]0" src/app/\(app\)/service-orders/\[id\]/ src/app/\(app\)/service-orders/_components/ src/app/\(app\)/service-orders/new/ --include="*.tsx" | head -60
```

- [ ] **Step 2: Aplicar substituições + SectionDivider nas seções do form**

Os formulários de OS são compostos por tabs. Cada tab pode ganhar `SectionDivider` nos agrupamentos internos. Labels de form já consomem `form-styles.ts` (atualizado na Task 5).

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/
git commit -m "feat(design): OS detail+form — dark sweep + SectionDivider"
```

---

## Task 14: Verificação final + imports legado

**Files:**
- Verify: All modified files

- [ ] **Step 1: Buscar QUALQUER classe proibida remanescente no app inteiro**

```bash
cd apps/dscar-web && grep -rn "bg-neutral-50\|bg-neutral-100\|border-neutral-100\|border-neutral-200\|divide-neutral-\|text-neutral-[4-9]00\|bg-emerald-\|bg-indigo-\|bg-red-50\|bg-red-100\|bg-blue-50\|bg-blue-100" src/app/\(app\)/ src/components/ --include="*.tsx" | grep -v "node_modules" | head -30
```

Se houver matches, corrigir.

- [ ] **Step 2: Buscar imports legado de `@/lib/design-tokens`**

```bash
cd apps/dscar-web && grep -rn "from.*design-tokens" src/ --include="*.tsx" --include="*.ts" | head -20
```

Migrar qualquer import restante para `@paddock/utils`.

- [ ] **Step 3: Rodar typecheck**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep -v "next.config\|middleware\|NotificationBell.test\|usePermission.test" | head -30
```

Expected: 0 erros novos.

- [ ] **Step 4: Commit final se houver correções**

```bash
git add -A
git commit -m "fix(design): sweep final — classes proibidas remanescentes + imports legado"
```

---

## Task 15: Atualizar documentação

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-04-26-design-system-fintech-red-phase2.md`

- [ ] **Step 1: Marcar todas as checkboxes do plano como `[x]`**

- [ ] **Step 2: Adicionar sprint no CLAUDE.md em "Sprints Entregues"**

Adicionar após "Design System Fintech-Red":
```markdown
### Design System Fintech-Red Phase 2 — Abril 2026 ✅
**Full ERP sweep: 6 foundation components + ~40 páginas migradas para dark fintech theme**

Foundation (Layer 1):
- `table.tsx` (shadcn base): dark theme — neutral→white/opacity, label-mono headers
- `DataTable` wrapper: `bg-white/5 rounded-md border border-white/10 overflow-hidden`
- `StatusPill`: badge dark genérico (success/error/warning/info/neutral) com dot pulsante
- `StatCard` refatorado: icon `bg-white/[0.06]`, value `font-mono`, label `label-mono`
- `form-styles.ts`: tokens dark — `label-mono text-white/50` labels, `text-error-400` errors
- Sidebar: section headers `section-divider`, badges `font-mono`

Migração (Layer 2):
- Dashboard: OverdueOSList dark error, TeamProductivity/RecentOS borders, StatCard fintech
- OS List + Kanban: já migrados Phase 1
- OS Detail/Form: SectionDivider nas tabs, FormField tokens
- Cadastros: PersonTable full dark migration, PageHeader em todas as páginas
- Financeiro: JournalEntryTable StatusPill, dashboard icon containers dark
- RH: warning alerts dark, StatCard icon containers, label-mono headers
- Motor + Capacidade + Auditoria: DataTable + PageHeader
- Estoque + Orçamentos + Fiscal + Benchmark + Agenda: DataTable + PageHeader

**Regras estabelecidas:**
- Cores `neutral-*`, `bg-white` (sólido), `emerald-*`, `indigo-*` proibidas — usar `white/opacity` + tokens semânticos
- Badges: nunca fundo sólido light — sempre `bg-{color}-500/10 border-{color}-500/20 text-{color}-400`
- Imports: sempre `@paddock/utils`, nunca `@/lib/design-tokens` (legado)
- Table headers: sempre `label-mono text-white/40`
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-04-26-design-system-fintech-red-phase2.md
git commit -m "docs(design): mark phase 2 complete + add sprint to CLAUDE.md"
```
