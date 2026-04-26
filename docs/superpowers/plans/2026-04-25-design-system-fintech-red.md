# Design System Fintech-Liquidity Red — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a estética "fintech-liquidity" (terminal dark, mono labels, status dots, section dividers) ao ERP dscar-web, substituindo o acento lime por vermelho sutil (#cc4444).

**Architecture:** Duas camadas. Layer 1: componentes foundation (card, page-header, status-badge, novo SectionDivider, utilitários CSS). Layer 2: páginas Dashboard, OS List e Kanban consomem os novos componentes. Nenhuma lógica de negócio ou API é alterada.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind CSS, shadcn/ui, Montserrat font

---

## Arquivos Modificados / Criados

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Modify | `apps/dscar-web/tailwind.config.ts` | Adicionar keyframe/animation `pulse-slow` |
| Modify | `apps/dscar-web/src/app/globals.css` | Adicionar `.label-mono` e `.section-divider` |
| Modify | `apps/dscar-web/src/components/ui/card.tsx` | Fix dark theme (`bg-white` → `bg-card`) |
| Modify | `apps/dscar-web/src/components/ui/page-header.tsx` | Fix `text-neutral-900` → `text-foreground` |
| Create | `apps/dscar-web/src/components/ui/section-divider.tsx` | Componente `LABEL ──────` |
| Modify | `apps/dscar-web/src/components/ui/status-badge.tsx` | Variante `dot` (sem badge background) |
| Modify | `apps/dscar-web/src/app/(app)/dashboard/page.tsx` | Usar PageHeader + SectionDivider |
| Modify | `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx` | SectionDivider + metrics grid |
| Modify | `apps/dscar-web/src/app/(app)/dashboard/_components/ConsultantDashboard.tsx` | SectionDivider + table headers mono |
| Modify | `apps/dscar-web/src/app/(app)/service-orders/page.tsx` | Usar PageHeader |
| Modify | `apps/dscar-web/src/app/(app)/service-orders/_components/ServiceOrderTable.tsx` | Cabeçalhos `.label-mono` |
| Modify | `apps/dscar-web/src/app/(app)/service-orders/kanban/page.tsx` | Usar PageHeader, fix title, fix toggles |
| Modify | `apps/dscar-web/src/components/kanban/KanbanColumn.tsx` | Dark theme + label-mono header |
| Modify | `apps/dscar-web/src/components/kanban/KanbanCard.tsx` | Dark theme card + StatusBadge dot |

---

## Task 1: Tailwind + CSS — Utilitários e Animação

**Files:**
- Modify: `apps/dscar-web/tailwind.config.ts:235-253`
- Modify: `apps/dscar-web/src/app/globals.css:74-112`

- [x] **Step 1: Adicionar `pulse-slow` no tailwind.config.ts**

Em `keyframes` (linha 235), adicionar após `pulse-red`:
```typescript
"pulse-slow": {
  "0%, 100%": { opacity: "1" },
  "50%":      { opacity: "0.4" },
},
```

Em `animation` (linha 249), adicionar após `pulse-red`:
```typescript
"pulse-slow": "pulse-slow 4s ease-in-out infinite",
```

- [x] **Step 2: Adicionar `.label-mono` e `.section-divider` no globals.css**

Dentro do bloco `@layer utilities {` (após a linha 111, antes do `}`):
```css
/* Label mono — fintech terminal style */
.label-mono {
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #cc4444;
  line-height: 1;
}

/* Section divider — LABEL ────────── */
.section-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #cc4444;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  line-height: 1;
}
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
}
```

- [x] **Step 3: Commit**

```bash
git add apps/dscar-web/tailwind.config.ts apps/dscar-web/src/app/globals.css
git commit -m "feat(design): add pulse-slow animation + label-mono/section-divider utilities"
```

---

## Task 2: `card.tsx` — Fix Dark Theme

**Files:**
- Modify: `apps/dscar-web/src/components/ui/card.tsx`

- [x] **Step 1: Trocar classes do Card, CardTitle e CardDescription**

`Card` (linha 9): `"rounded-md border border-neutral-200 bg-white shadow-card"` → `"rounded-md border border-white/10 bg-card shadow-card"`

`CardTitle` (linha 33): `"font-semibold leading-none tracking-tight text-neutral-900"` → `"font-semibold leading-none tracking-tight text-card-foreground"`

`CardDescription` (linha 44): `"text-sm text-neutral-500"` → `"text-sm text-muted-foreground"`

- [x] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/ui/card.tsx
git commit -m "fix(design): card.tsx dark theme — bg-card + border-white/10 + card-foreground"
```

---

## Task 3: `page-header.tsx` — Fix Dark Theme

**Files:**
- Modify: `apps/dscar-web/src/components/ui/page-header.tsx`

- [x] **Step 1: Trocar classes de cor**

Linha 32: `"text-2xl font-semibold text-neutral-900"` → `"text-2xl font-semibold text-foreground"`

Linha 34: `"text-sm text-neutral-500 mt-0.5"` → `"text-sm text-muted-foreground mt-0.5"`

- [x] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/ui/page-header.tsx
git commit -m "fix(design): page-header.tsx — text-foreground/muted-foreground dark theme"
```

---

## Task 4: Novo componente `SectionDivider`

**Files:**
- Create: `apps/dscar-web/src/components/ui/section-divider.tsx`

- [x] **Step 1: Criar o arquivo**

```tsx
import { cn } from "@/lib/utils"

interface SectionDividerProps {
  label: string
  className?: string
}

export function SectionDivider({ label, className }: SectionDividerProps) {
  return (
    <div className={cn("section-divider", className)}>
      {label}
    </div>
  )
}
```

- [x] **Step 2: Exportar pelo barrel `src/components/ui/index.ts`**

Verificar se existe barrel. Adicionar:
```typescript
export { SectionDivider } from "./section-divider"
```

- [x] **Step 3: Commit**

```bash
git add apps/dscar-web/src/components/ui/section-divider.tsx
git commit -m "feat(design): add SectionDivider component (LABEL ────── pattern)"
```

---

## Task 5: `status-badge.tsx` — Variante `dot`

**Files:**
- Modify: `apps/dscar-web/src/components/ui/status-badge.tsx`

A variante `dot` renderiza apenas `● LABEL` em mono uppercase — sem o pill background arredondado do badge padrão. O `showDot` existente apenas adiciona um dot dentro do pill; a nova `variant='dot'` é um modo de renderização completamente diferente.

- [x] **Step 1: Adicionar prop `variant` e nova renderização**

```tsx
/**
 * StatusBadge — Badge de status de OS
 * Usa SERVICE_ORDER_STATUS_CONFIG de @paddock/utils.
 * Fonte de verdade única para cores de status no projeto.
 *
 * variant='default' — pill arredondado (padrão)
 * variant='dot'     — ponto pulsante + label mono, sem background pill
 */

import type { ServiceOrderStatus } from "@paddock/types";
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ServiceOrderStatus;
  /** Override de label (usa o do config por padrão) */
  label?: string;
  size?: "sm" | "md";
  /** Mostrar ponto colorido antes do label */
  showDot?: boolean;
  /** 'dot' = ponto pulsante + mono text, sem pill background */
  variant?: "default" | "dot";
  className?: string;
}

export function StatusBadge({
  status,
  label,
  size = "md",
  showDot = false,
  variant = "default",
  className,
}: StatusBadgeProps) {
  const cfg = SERVICE_ORDER_STATUS_CONFIG[status];
  const displayLabel = label ?? cfg.label;

  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0 animate-pulse-slow",
            cfg.dot
          )}
        />
        <span className="label-mono">{displayLabel}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        cfg.badge,
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
      )}
      {displayLabel}
    </span>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/ui/status-badge.tsx
git commit -m "feat(design): StatusBadge variant='dot' — pulsing dot + mono label"
```

---

## Task 6: Dashboard — PageHeader + SectionDividers

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/dashboard/page.tsx`
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx`
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/ConsultantDashboard.tsx`

### 6a: `dashboard/page.tsx` — PageHeader em todos os branches

O arquivo atual tem 4 branches (loading, consultant, manager, legacy) cada um com `<h1>` inline. Todos devem usar `<PageHeader>` + seus respectivos `<SectionDivider>`.

- [x] **Step 1: Adicionar imports no topo de `dashboard/page.tsx`**

```typescript
import { PageHeader } from "@/components/ui/page-header"
import { SectionDivider } from "@/components/ui/section-divider"
```

- [x] **Step 2: Branch loading — trocar `<h1>` inline por PageHeader**

Substituir (linhas 53-58):
```tsx
<div>
  <h1 className="text-2xl font-bold text-white">Dashboard</h1>
  <p className="mt-0.5 text-sm text-white/50">Carregando...</p>
</div>
```
Por:
```tsx
<PageHeader title="Dashboard" description="Carregando..." />
```

- [x] **Step 3: Branch consultant — trocar `<h1>` inline por PageHeader**

Substituir (linhas 70-74):
```tsx
<div>
  <h1 className="text-2xl font-bold text-white">Dashboard</h1>
  <p className="mt-0.5 text-sm text-white/50">Meu painel de atendimento</p>
</div>
```
Por:
```tsx
<PageHeader title="Dashboard" description="Meu painel de atendimento" />
```

- [x] **Step 4: Branch manager — trocar `<h1>` inline por PageHeader**

Substituir (linhas 93-96):
```tsx
<div>
  <h1 className="text-2xl font-bold text-white">Dashboard</h1>
  <p className="mt-0.5 text-sm text-white/50">Visão gerencial</p>
</div>
```
Por:
```tsx
<PageHeader title="Dashboard" description="Visão gerencial" />
```

- [x] **Step 5: Branch legacy — trocar `<h1>` inline + adicionar SectionDivider**

Substituir (linhas 117-121):
```tsx
<div>
  <h1 className="text-2xl font-bold text-white">Dashboard</h1>
  <p className="mt-0.5 text-sm text-white/50">Visão geral das Ordens de Serviço</p>
</div>
```
Por:
```tsx
<PageHeader title="Dashboard" description="Visão geral das Ordens de Serviço" />
```

Antes do grid de StatCards (linha 131), adicionar:
```tsx
<SectionDivider label="VISÃO GERAL" />
```

Antes do bloco `<div className="rounded-md bg-white/5...">` (linha 166), adicionar:
```tsx
<SectionDivider label="OS RECENTES" />
```

### 6b: `ManagerDashboard.tsx` — SectionDividers

- [x] **Step 6: Adicionar imports e SectionDividers**

Adicionar import:
```typescript
import { SectionDivider } from "@/components/ui/section-divider"
```

Antes do `{/* KPI Cards */}` (linha 18), adicionar:
```tsx
<SectionDivider label="VISÃO GERAL" />
```

Antes de `{/* Billing Chart */}` (linha 50), adicionar:
```tsx
<SectionDivider label="FATURAMENTO" />
```

Antes de `{/* Productivity + Overdue */}` (linha 55), adicionar:
```tsx
<SectionDivider label="EQUIPE" />
```

### 6c: `ConsultantDashboard.tsx` — SectionDividers + table headers mono

- [x] **Step 7: Adicionar imports e SectionDividers**

Adicionar import:
```typescript
import { SectionDivider } from "@/components/ui/section-divider"
```

Antes de `{/* Cards KPI */}` (linha 15), adicionar:
```tsx
<SectionDivider label="MEUS INDICADORES" />
```

Antes de `{/* OS recentes */}` (linha 44), adicionar:
```tsx
<SectionDivider label="EM ANDAMENTO" />
```

Nos cabeçalhos da tabela interna (linhas 54-58), trocar a classe `text-xs font-semibold uppercase text-white/40` por `label-mono text-white/40` em cada `<th>`:
```tsx
<th className="px-4 py-2.5 text-left label-mono text-white/40">PLACA</th>
<th className="px-4 py-2.5 text-left label-mono text-white/40">CLIENTE</th>
<th className="px-4 py-2.5 text-left label-mono text-white/40">STATUS</th>
<th className="px-4 py-2.5 text-right label-mono text-white/40">DIAS NA OFICINA</th>
```

- [x] **Step 8: Commit**

```bash
git add apps/dscar-web/src/app/(app)/dashboard/
git commit -m "feat(design): dashboard — PageHeader + SectionDividers (VISÃO GERAL / EM ANDAMENTO / EQUIPE)"
```

---

## Task 7: OS List — PageHeader + Mono Table Headers

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/page.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/_components/ServiceOrderTable.tsx`

### 7a: `service-orders/page.tsx` — PageHeader

- [x] **Step 1: Adicionar import e usar PageHeader**

Adicionar import:
```typescript
import { PageHeader } from "@/components/ui/page-header"
```

Substituir o bloco inline (linhas 64-85):
```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-white">Ordens de Serviço</h1>
    <p className="text-sm text-white/50 mt-1">Gerencie a listagem tabular e aplique filtros para encontrar OS.</p>
  </div>
  <div className="flex items-center gap-3">
    <Link ...>Ver Kanban</Link>
    <button ...>Nova OS</button>
  </div>
</div>
```
Por (mantendo os botões de ação via prop `actions`):
```tsx
<PageHeader
  title="Ordens de Serviço"
  description={data ? `${data.count} resultado${data.count !== 1 ? "s" : ""} encontrado${data.count !== 1 ? "s" : ""}` : "Gerencie as Ordens de Serviço"}
  actions={
    <div className="flex items-center gap-3">
      <Link
        href="/service-orders/kanban"
        className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.03]"
      >
        Ver Kanban
      </Link>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 shadow-sm"
      >
        <Plus className="h-4 w-4" />
        Nova OS
      </button>
    </div>
  }
/>
```

### 7b: `ServiceOrderTable.tsx` — Cabeçalhos mono

- [x] **Step 2: Aplicar `.label-mono` nos `<TableHead>`**

Cada `<TableHead>` passa de `font-semibold text-white/60` para `label-mono text-white/40`. Substituir todas as linhas 34-39:

```tsx
<TableHead className="w-[100px] label-mono text-white/40">OS</TableHead>
<TableHead className="min-w-[200px] label-mono text-white/40">CLIENTE / SEGURADORA</TableHead>
<TableHead className="min-w-[180px] label-mono text-white/40">VEÍCULO</TableHead>
<TableHead className="w-[140px] label-mono text-white/40">DATAS</TableHead>
<TableHead className="w-[180px] label-mono text-white/40">STATUS</TableHead>
<TableHead className="w-[60px] text-right label-mono text-white/40"></TableHead>
```

- [x] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/page.tsx apps/dscar-web/src/app/(app)/service-orders/_components/ServiceOrderTable.tsx
git commit -m "feat(design): OS list — PageHeader + mono table headers"
```

---

## Task 8: Kanban — Dark Theme + PageHeader + Mono Headers

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/kanban/page.tsx`
- Modify: `apps/dscar-web/src/components/kanban/KanbanColumn.tsx`
- Modify: `apps/dscar-web/src/components/kanban/KanbanCard.tsx`

### 8a: `kanban/page.tsx` — PageHeader + Fix title + Fix toggles

- [x] **Step 1: Adicionar import e usar PageHeader**

Adicionar import:
```typescript
import { PageHeader } from "@/components/ui/page-header"
```

Substituir o bloco `{/* Header */}` (linhas 34-85) — manter os toggles mas mudar o título:

```tsx
{/* Header */}
<div className="flex items-center justify-between shrink-0">
  <PageHeader
    title="Kanban"
    description={`${orders.length} ordem${orders.length !== 1 ? "s" : ""} ativa${orders.length !== 1 ? "s" : ""}`}
  />
  <div className="flex items-center gap-2">
    {/* Toggle: mostrar entregues */}
    <button
      type="button"
      onClick={() => setShowDelivered((v) => !v)}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
        showDelivered
          ? "bg-success-500/10 border-success-500/30 text-success-400"
          : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/5"
      )}
    >
      <CheckCircle className="h-3.5 w-3.5" />
      {showDelivered ? "Ocultar Entregues" : "Mostrar Entregues"}
    </button>
    {/* Toggle: mostrar canceladas */}
    <button
      type="button"
      onClick={() => setShowCancelled((v) => !v)}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
        showCancelled
          ? "bg-error-500/10 border-error-500/30 text-error-400"
          : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/5"
      )}
    >
      <XCircle className="h-3.5 w-3.5" />
      {showCancelled ? "Ocultar Canceladas" : "Mostrar Canceladas"}
    </button>

    <Button variant="outline" asChild>
      <Link href="/service-orders">
        <LayoutList className="h-4 w-4" />
        Ver Lista
      </Link>
    </Button>
    <Button onClick={() => setDrawerOpen(true)}>
      <Plus className="h-4 w-4" />
      Nova OS
    </Button>
  </div>
</div>
```

### 8b: `KanbanColumn.tsx` — Dark theme + label-mono header

- [x] **Step 2: Aplicar dark theme na coluna**

`KanbanColumn` — substituir o drop zone (linha 48-50):
```tsx
"overflow-y-auto rounded-b-md p-2 space-y-2 min-h-[100px] max-h-[calc(100vh-220px)]",
"bg-white/[0.02] border border-t-0 border-white/5",
"transition-colors",
isOver && "bg-primary-500/5 border-primary-500/20"
```

Cabeçalho da coluna (linhas 36-41) — aplicar `.label-mono`:
```tsx
<div
  className={cn(
    "flex items-center justify-between px-3 py-2 rounded-t-md bg-white/[0.04] border border-b-0 border-white/10",
  )}
>
  <span className="label-mono text-white/70">
    {cfg.label}
  </span>
  <span className="ml-2 shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 label-mono text-white/50 leading-none">
    {orders.length}
  </span>
</div>
```

`KanbanColumnSkeleton` (linha 71-82) — fix background:
```tsx
<div className="flex flex-col min-w-[280px] w-[280px]">
  <Skeleton className="h-10 rounded-b-none" />
  <div className="rounded-b-md border border-t-0 border-white/5 bg-white/[0.02] p-2 space-y-2 min-h-[200px]">
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-24 rounded-md" />
    ))}
  </div>
</div>
```

Remover o `cfg.column` do header (o config de status já tem essa classe, mas agora usamos um header unificado dark).

### 8c: `KanbanCard.tsx` — Dark theme + StatusBadge dot

O card atualmente usa `bg-white border-neutral-200`. Precisamos de dark glass.

- [x] **Step 3: Aplicar dark theme no card body e adicionar StatusBadge dot**

Adicionar import:
```typescript
import { StatusBadge } from "@/components/ui/status-badge"
```

`CardContent` — trocar `bg-white rounded-md border border-neutral-200` (linha 71):
```tsx
"bg-white/[0.04] rounded-md border border-white/10 backdrop-blur-sm"
```

Row 1 (linha 78-90): trocar `text-neutral-700` → `text-white/80`, remover o dot simples e usar `StatusBadge variant='dot'`:
```tsx
{/* Row 1: OS number + status dot */}
<div className="flex items-center justify-between gap-1">
  <span className="text-xs font-bold text-white/80 leading-none font-mono">
    #{order.number}
  </span>
  <div className="flex items-center gap-1.5">
    <DaysInShopBadge days={order.days_in_shop} />
    <StatusBadge status={order.status} variant="dot" />
  </div>
</div>
```

Row 2 (linha 94): trocar `text-neutral-900` → `text-white/90`:
```tsx
<div className="text-sm font-mono font-semibold tracking-widest text-white/90 leading-none">
  {order.plate}
</div>
```

Row 3 (linha 99): trocar `text-neutral-500` → `text-white/40`:
```tsx
<p className="text-xs text-white/40 leading-snug truncate">
  {[order.make, order.model, order.year ? String(order.year) : ""]
    .filter(Boolean)
    .join(" · ")}
</p>
```

Row 4 (linha 106): trocar `text-neutral-600` → `text-white/60`:
```tsx
<p className="text-xs text-white/60 truncate font-medium">
  {order.customer_name}
</p>
```

Row 5 — insurer badge (linha 115-133): trocar `bg-indigo-50 border-indigo-200` → `bg-white/5 border-white/10`, `text-indigo-700` → `text-white/50`:
```tsx
{!isOverdue && order.insurer_detail && (
  <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-sm px-1 py-0.5 max-w-full">
    {order.insurer_detail.logo ? (
      <img
        src={order.insurer_detail.logo}
        alt=""
        className="h-3.5 w-3.5 object-contain shrink-0"
      />
    ) : (
      <span
        className="h-3.5 w-3.5 rounded-full flex items-center justify-center text-white text-[7px] font-bold shrink-0"
        style={{ backgroundColor: order.insurer_detail.brand_color ?? "#6366f1" }}
      >
        {order.insurer_detail.abbreviation?.charAt(0)}
      </span>
    )}
    <span className="text-xs text-white/50 font-medium truncate max-w-[90px]">
      {order.insurer_detail.display_name ?? order.insurer_detail.name}
    </span>
  </div>
)}
```

- [x] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/kanban/page.tsx apps/dscar-web/src/components/kanban/
git commit -m "feat(design): kanban — dark theme cards/columns + PageHeader + label-mono headers"
```

---

## Task 9: Verificar exports e typecheck

**Files:**
- Modify: `apps/dscar-web/src/components/ui/index.ts` (se existir barrel)

- [x] **Step 1: Verificar se existe barrel e garantir export do SectionDivider**

```bash
cat apps/dscar-web/src/components/ui/index.ts | grep -n "SectionDivider"
```

Se não aparecer, adicionar a linha de export.

- [x] **Step 2: Rodar typecheck**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | head -50
```

Expected: 0 erros novos (podem existir erros pré-existentes).

- [x] **Step 3: Commit final se houver correções**

```bash
git add -A
git commit -m "fix(design): typecheck fixes pós design system fintech-red"
```
