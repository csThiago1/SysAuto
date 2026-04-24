# Orçamentos Particulares — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o frontend completo do módulo de Orçamentos Particulares (`apps.budgets`) — lista, criação, detalhe com editor de itens + operações de MO + fluxo de versões.

**Architecture:** 3 páginas Next.js 15 App Router (`/orcamentos-particulares`, `/novo`, `/[id]`). Types em `@paddock/types`, hooks em `useBudgets.ts` (TanStack Query v5). Detalhe usa componentes em `_components/` com `ItemSheet` (Sheet lateral shadcn) para edição de itens + operações aninhadas.

**Tech Stack:** Next.js 15, TypeScript strict, shadcn/ui, TanStack Query v5, Zod, React Hook Form, Lucide icons, Tailwind CSS (tokens success-*/info-*/error-*/warning-*)

---

## File Map

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Create | `packages/types/src/budget.types.ts` | Tipos Budget, BudgetVersion, BudgetVersionItem, ItemOperation |
| Modify | `packages/types/src/index.ts` | Exportar novos tipos |
| Create | `apps/dscar-web/src/hooks/useBudgets.ts` | 12 hooks TanStack Query v5 |
| Create | `apps/dscar-web/src/app/(app)/orcamentos-particulares/page.tsx` | Lista + 4 KPI cards |
| Create | `apps/dscar-web/src/app/(app)/orcamentos-particulares/novo/page.tsx` | Formulário criação |
| Create | `apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/BudgetHeader.tsx` | Header com botões contextuais |
| Create | `apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/VersionHistory.tsx` | Lista de versões |
| Create | `apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/ItemsTable.tsx` | Tabela de itens da versão |
| Create | `apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/ItemSheet.tsx` | Sheet lateral: form item + operações MO |
| Create | `apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/page.tsx` | Detalhe do orçamento |
| Modify | `apps/dscar-web/src/components/Sidebar.tsx` | Adicionar item "Orç. Particulares" |

---

## Task 1: Types `budget.types.ts`

**Files:**
- Create: `packages/types/src/budget.types.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Criar `budget.types.ts`**

```typescript
// packages/types/src/budget.types.ts
/**
 * @paddock/types — Budget (Orçamentos Particulares)
 * Espelha apps.budgets do backend. Distinto de apps.quotes (Cilia/seguradora).
 */

export type BudgetVersionStatus =
  | "draft"
  | "sent"
  | "approved"
  | "rejected"
  | "expired"
  | "revision"
  | "superseded"

export type BudgetItemType =
  | "PART"
  | "SERVICE"
  | "EXTERNAL_SERVICE"
  | "FEE"
  | "DISCOUNT"

export interface BudgetItemOperation {
  id: number
  operation_type: { id: number; code: string; label: string }
  labor_category: { id: number; code: string; label: string }
  hours: string
  hourly_rate: string
  labor_cost: string
}

export interface BudgetVersionItem {
  id: number
  bucket: "IMPACTO" | "SEM_COBERTURA" | "SOB_ANALISE"
  payer_block: "SEGURADORA" | "COMPLEMENTO_PARTICULAR" | "FRANQUIA" | "PARTICULAR"
  impact_area: number | null
  item_type: BudgetItemType
  description: string
  external_code: string
  part_type: "GENUINA" | "ORIGINAL" | "OUTRAS_FONTES" | "VERDE" | ""
  supplier: "OFICINA" | "SEGURADORA"
  quantity: string
  unit_price: string
  unit_cost: string | null
  discount_pct: string
  net_price: string
  sort_order: number
  flag_abaixo_padrao: boolean
  flag_acima_padrao: boolean
  flag_inclusao_manual: boolean
  flag_codigo_diferente: boolean
  flag_servico_manual: boolean
  flag_peca_da_conta: boolean
  operations: BudgetItemOperation[]
}

export interface BudgetVersion {
  id: number
  version_number: number
  status: BudgetVersionStatus
  status_display: string
  valid_until: string | null
  subtotal: string
  discount_total: string
  net_total: string
  labor_total: string
  parts_total: string
  pdf_s3_key: string
  sent_at: string | null
  approved_at: string | null
  approved_by: string
  created_by: string
  created_at: string
  items: BudgetVersionItem[]
}

export interface Budget {
  id: number
  number: string
  customer: number
  customer_name: string
  vehicle_plate: string
  vehicle_description: string
  cloned_from: number | null
  service_order: number | null
  active_version: BudgetVersion | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Versão simplificada para listagem (active_version sem items) */
export interface BudgetListItem extends Omit<Budget, "active_version"> {
  active_version: Pick<
    BudgetVersion,
    "id" | "version_number" | "status" | "status_display" | "net_total"
  > | null
}

/** Payload para criar orçamento */
export interface BudgetCreatePayload {
  customer_id: number
  vehicle_plate: string
  vehicle_description: string
}

/** Payload para aprovar versão */
export interface BudgetApprovePayload {
  approved_by: string
  evidence_s3_key?: string
}

/** Payload para criar item */
export interface BudgetItemCreatePayload {
  description: string
  item_type: BudgetItemType
  quantity: string
  unit_price: string
  net_price: string
  discount_pct?: string
  unit_cost?: string | null
  bucket?: string
  payer_block?: string
  part_type?: string
  supplier?: string
  sort_order?: number
  operations?: {
    operation_type_code: string
    labor_category_code: string
    hours: string
    hourly_rate: string
    labor_cost?: string
  }[]
}
```

- [ ] **Step 2: Exportar de `packages/types/src/index.ts`**

Abrir `packages/types/src/index.ts` e adicionar no final:

```typescript
export * from "./budget.types"
```

- [ ] **Step 3: Verificar TypeScript compila**

```bash
cd packages/types && npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/budget.types.ts packages/types/src/index.ts
git commit -m "feat(types): add budget.types — Budget, BudgetVersion, BudgetVersionItem"
```

---

## Task 2: Hooks `useBudgets.ts`

**Files:**
- Create: `apps/dscar-web/src/hooks/useBudgets.ts`

- [ ] **Step 1: Criar `useBudgets.ts`**

```typescript
// apps/dscar-web/src/hooks/useBudgets.ts
"use client"

/**
 * Paddock Solutions — useBudgets
 * Orçamentos Particulares (apps.budgets): CRUD, versões, itens, fluxo de estado.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  Budget,
  BudgetApprovePayload,
  BudgetCreatePayload,
  BudgetItemCreatePayload,
  BudgetListItem,
  BudgetVersion,
  BudgetVersionItem,
} from "@paddock/types"

const BASE = "/api/proxy/budgets"

type Paginated<T> = { results: T[]; count: number; next: string | null; previous: string | null }

async function fetchList<T>(url: string): Promise<T[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  const data = (await res.json()) as Paginated<T> | T[]
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText })) as Record<string, unknown>
    const message =
      (err.detail as string | undefined) ??
      (err.erro as string | undefined) ??
      (err.non_field_errors as string[] | undefined)?.[0] ??
      `${init?.method ?? "GET"} ${url} → ${res.status}`
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

// ── Query Keys ────────────────────────────────────────────────────────────────

export const budgetKeys = {
  all:      ["budgets"] as const,
  lists:    () => [...budgetKeys.all, "list"] as const,
  list:     (f?: Record<string, string>) => [...budgetKeys.lists(), f] as const,
  detail:   (id: string | number) => [...budgetKeys.all, String(id)] as const,
  versions: (id: string | number) => [...budgetKeys.detail(id), "versions"] as const,
  items:    (id: string | number, vId: string | number) =>
    [...budgetKeys.versions(id), String(vId), "items"] as const,
}

// ── Hooks de leitura ──────────────────────────────────────────────────────────

export function useBudgets(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters ?? {}).toString()
  return useQuery({
    queryKey: budgetKeys.list(filters),
    queryFn:  () => fetchList<BudgetListItem>(`${BASE}/${params ? "?" + params : ""}`),
  })
}

export function useBudget(id: string | number) {
  return useQuery({
    queryKey: budgetKeys.detail(id),
    queryFn:  () => apiFetch<Budget>(`${BASE}/${id}/`),
    enabled:  !!id,
  })
}

export function useBudgetVersions(budgetId: string | number) {
  return useQuery({
    queryKey: budgetKeys.versions(budgetId),
    queryFn:  () => fetchList<BudgetVersion>(`${BASE}/${budgetId}/versions/`),
    enabled:  !!budgetId,
  })
}

export function useBudgetItems(budgetId: string | number, versionId: string | number) {
  return useQuery({
    queryKey: budgetKeys.items(budgetId, versionId),
    queryFn:  () => fetchList<BudgetVersionItem>(
      `${BASE}/${budgetId}/versions/${versionId}/items/`
    ),
    enabled: !!budgetId && !!versionId,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BudgetCreatePayload) =>
      apiFetch<Budget>(`${BASE}/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetKeys.lists() }),
  })
}

export function useCloneBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (budgetId: number) =>
      apiFetch<Budget>(`${BASE}/${budgetId}/clone/`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetKeys.lists() }),
  })
}

export function useSendBudget(budgetId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: number) =>
      apiFetch<BudgetVersion>(`${BASE}/${budgetId}/versions/${versionId}/send/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
      qc.invalidateQueries({ queryKey: budgetKeys.versions(budgetId) })
    },
  })
}

export function useApproveBudget(budgetId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ versionId, payload }: { versionId: number; payload: BudgetApprovePayload }) =>
      apiFetch<{ version: BudgetVersion; service_order: { id: number; number: number } }>(
        `${BASE}/${budgetId}/versions/${versionId}/approve/`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
      qc.invalidateQueries({ queryKey: budgetKeys.versions(budgetId) })
      qc.invalidateQueries({ queryKey: budgetKeys.lists() })
    },
  })
}

export function useRejectBudget(budgetId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: number) =>
      apiFetch<BudgetVersion>(`${BASE}/${budgetId}/versions/${versionId}/reject/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
      qc.invalidateQueries({ queryKey: budgetKeys.versions(budgetId) })
    },
  })
}

export function useRequestRevision(budgetId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: number) =>
      apiFetch<BudgetVersion>(`${BASE}/${budgetId}/versions/${versionId}/revision/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
      qc.invalidateQueries({ queryKey: budgetKeys.versions(budgetId) })
    },
  })
}

export function useCreateBudgetItem(budgetId: string | number, versionId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BudgetItemCreatePayload) =>
      apiFetch<BudgetVersionItem>(
        `${BASE}/${budgetId}/versions/${versionId}/items/`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.items(budgetId, versionId) })
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
    },
  })
}

export function useDeleteBudgetItem(
  budgetId: string | number,
  versionId: string | number
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) =>
      apiFetch<void>(
        `${BASE}/${budgetId}/versions/${versionId}/items/${itemId}/`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.items(budgetId, versionId) })
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
    },
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep useBudgets
```

Expected: sem erros relacionados ao arquivo.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/hooks/useBudgets.ts
git commit -m "feat(budgets): hooks useBudgets — 12 hooks TanStack Query v5"
```

---

## Task 3: Página Lista `/orcamentos-particulares`

**Files:**
- Create: `apps/dscar-web/src/app/(app)/orcamentos-particulares/page.tsx`

- [ ] **Step 1: Criar diretório e `page.tsx`**

```bash
mkdir -p apps/dscar-web/src/app/\(app\)/orcamentos-particulares
```

```tsx
// apps/dscar-web/src/app/(app)/orcamentos-particulares/page.tsx
"use client"

import { useState } from "react"
import { ReceiptText, Plus, Search } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBudgets } from "@/hooks/useBudgets"
import type { BudgetVersionStatus } from "@paddock/types"

const STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  draft:      "Rascunho",
  sent:       "Enviado",
  approved:   "Aprovado",
  rejected:   "Rejeitado",
  expired:    "Expirado",
  revision:   "Em Revisão",
  superseded: "Superado",
}

const STATUS_COLORS: Record<BudgetVersionStatus, string> = {
  draft:      "text-white/50 bg-white/10",
  sent:       "text-info-400 bg-info-400/10",
  approved:   "text-success-400 bg-success-400/10",
  rejected:   "text-error-400 bg-error-400/10",
  expired:    "text-warning-400 bg-warning-400/10",
  revision:   "text-warning-400 bg-warning-400/10",
  superseded: "text-white/30 bg-white/5",
}

const formatBRL = (v: string | number) =>
  parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR")

export default function OrcamentosParticularesPage() {
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch]             = useState("")

  const filters: Record<string, string> = {}
  if (statusFilter) filters.status = statusFilter

  const { data: budgets = [], isLoading } = useBudgets(
    Object.keys(filters).length ? filters : undefined
  )

  const filtered = search.trim()
    ? budgets.filter((b) =>
        b.number.toLowerCase().includes(search.toLowerCase()) ||
        b.vehicle_plate.toLowerCase().includes(search.toLowerCase()) ||
        b.customer_name.toLowerCase().includes(search.toLowerCase())
      )
    : budgets

  const total     = budgets.length
  const rascunhos = budgets.filter((b) => b.active_version?.status === "draft").length
  const enviados  = budgets.filter((b) => b.active_version?.status === "sent").length
  const aprovados = budgets.filter((b) => b.active_version?.status === "approved").length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ReceiptText className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Orçamentos Particulares</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {total} orçamento{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link href={"/orcamentos-particulares/novo" as Route}>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Orçamento
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total",     value: total,     color: "text-white" },
          { label: "Rascunhos", value: rascunhos, color: "text-white/60" },
          { label: "Enviados",  value: enviados,  color: "text-info-400" },
          { label: "Aprovados", value: aprovados, color: "text-success-400" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-white/5 border border-white/10 p-4"
          >
            <p className="text-xs text-white/40">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            placeholder="Número, placa, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <TableSkeleton columns={6} />
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/50">Número</TableHead>
                <TableHead className="text-white/50">Cliente</TableHead>
                <TableHead className="text-white/50">Placa</TableHead>
                <TableHead className="text-white/50">Versão</TableHead>
                <TableHead className="text-white/50">Valor Líquido</TableHead>
                <TableHead className="text-white/50">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-white/30 py-12">
                    Nenhum orçamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow
                    key={b.id}
                    className="border-white/5 hover:bg-white/5 cursor-pointer"
                    onClick={() =>
                      (window.location.href = `/orcamentos-particulares/${b.id}`)
                    }
                  >
                    <TableCell className="font-mono text-white text-sm">{b.number}</TableCell>
                    <TableCell className="text-white/80">{b.customer_name}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-white/10 text-white px-2 py-0.5 rounded">
                        {b.vehicle_plate}
                      </span>
                    </TableCell>
                    <TableCell>
                      {b.active_version ? (
                        <Badge
                          className={`text-xs border-0 ${STATUS_COLORS[b.active_version.status]}`}
                        >
                          v{b.active_version.version_number} ·{" "}
                          {STATUS_LABELS[b.active_version.status]}
                        </Badge>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-white/80 font-medium">
                      {b.active_version
                        ? formatBRL(b.active_version.net_total)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-white/40 text-sm">
                      {formatDate(b.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep orcamentos-particulares
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/orcamentos-particulares/page.tsx
git commit -m "feat(budgets): lista /orcamentos-particulares + 4 KPI cards"
```

---

## Task 4: Página Criação `/orcamentos-particulares/novo`

**Files:**
- Create: `apps/dscar-web/src/app/(app)/orcamentos-particulares/novo/page.tsx`

- [ ] **Step 1: Criar diretório e `page.tsx`**

```bash
mkdir -p "apps/dscar-web/src/app/(app)/orcamentos-particulares/novo"
```

```tsx
// apps/dscar-web/src/app/(app)/orcamentos-particulares/novo/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ReceiptText, ChevronLeft, Search, X } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateBudget } from "@/hooks/useBudgets"
import { useCustomers } from "@/hooks/useCustomers"

export default function NovoBudgetPage() {
  const router = useRouter()
  const { mutateAsync: criar, isPending } = useCreateBudget()

  // Cliente
  const [clienteSearch, setClienteSearch]   = useState("")
  const [clienteSelecionado, setClienteSel] = useState<{ id: number; name: string } | null>(null)
  const { data: clientesData }              = useCustomers(clienteSearch)
  const clientes                            = (clientesData as { results?: { id: number; full_name?: string; name?: string }[] })?.results ?? []

  // Veículo
  const [placa, setPlaca]               = useState("")
  const [descricao, setDescricao]       = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteSelecionado) {
      toast.error("Selecione um cliente.")
      return
    }
    if (!placa.trim()) {
      toast.error("Informe a placa do veículo.")
      return
    }
    if (!descricao.trim()) {
      toast.error("Informe a descrição do veículo.")
      return
    }
    try {
      const budget = await criar({
        customer_id:         clienteSelecionado.id,
        vehicle_plate:       placa.toUpperCase().trim(),
        vehicle_description: descricao.trim(),
      })
      toast.success(`Orçamento ${budget.number} criado!`)
      router.push(`/orcamentos-particulares/${budget.id}` as Route)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar orçamento.")
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={"/orcamentos-particulares" as Route}>
          <Button variant="ghost" size="icon" className="text-white/50 hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <ReceiptText className="h-5 w-5 text-primary-500" />
        <h1 className="text-lg font-semibold text-white">Novo Orçamento Particular</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cliente */}
        <div className="space-y-2">
          <Label className="text-white/70">Cliente</Label>
          {clienteSelecionado ? (
            <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2">
              <span className="text-white text-sm">{clienteSelecionado.name}</span>
              <button
                type="button"
                onClick={() => { setClienteSel(null); setClienteSearch("") }}
                className="text-white/30 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="Buscar por nome..."
                  value={clienteSearch}
                  onChange={(e) => setClienteSearch(e.target.value)}
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              {clientes.length > 0 && (
                <ul className="rounded-lg border border-white/10 bg-[#1c1c1e] divide-y divide-white/5 max-h-48 overflow-y-auto">
                  {clientes.slice(0, 8).map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                        onClick={() => {
                          setClienteSel({ id: c.id, name: c.full_name ?? c.name ?? "" })
                          setClienteSearch("")
                        }}
                      >
                        {c.full_name ?? c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Placa */}
        <div className="space-y-2">
          <Label className="text-white/70">Placa do veículo</Label>
          <Input
            placeholder="ABC1D23"
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            maxLength={8}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono uppercase"
          />
        </div>

        {/* Descrição */}
        <div className="space-y-2">
          <Label className="text-white/70">Descrição do veículo</Label>
          <Input
            placeholder="Ex: Toyota Corolla 2020 XEI"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Criando..." : "Criar Orçamento"}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep "novo"
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/orcamentos-particulares/novo/page.tsx"
git commit -m "feat(budgets): página /orcamentos-particulares/novo"
```

---

## Task 5: Componentes do Detalhe — BudgetHeader + VersionHistory

**Files:**
- Create: `apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/BudgetHeader.tsx`
- Create: `apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/VersionHistory.tsx`

- [ ] **Step 1: Criar diretórios**

```bash
mkdir -p "apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components"
```

- [ ] **Step 2: Criar `BudgetHeader.tsx`**

```tsx
// apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/BudgetHeader.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Send, CheckCircle, XCircle, RotateCcw, Copy, Download, ExternalLink } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { usePermission } from "@/hooks/usePermission"
import {
  useApproveBudget,
  useCloneBudget,
  useRejectBudget,
  useRequestRevision,
  useSendBudget,
} from "@/hooks/useBudgets"
import type { Budget, BudgetVersionStatus } from "@paddock/types"

const STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  draft:      "Rascunho",
  sent:       "Enviado",
  approved:   "Aprovado",
  rejected:   "Rejeitado",
  expired:    "Expirado",
  revision:   "Em Revisão",
  superseded: "Superado",
}

const STATUS_COLORS: Record<BudgetVersionStatus, string> = {
  draft:      "text-white/50 bg-white/10 border-white/10",
  sent:       "text-info-400 bg-info-400/10 border-info-400/20",
  approved:   "text-success-400 bg-success-400/10 border-success-400/20",
  rejected:   "text-error-400 bg-error-400/10 border-error-400/20",
  expired:    "text-warning-400 bg-warning-400/10 border-warning-400/20",
  revision:   "text-warning-400 bg-warning-400/10 border-warning-400/20",
  superseded: "text-white/20 bg-white/5 border-white/5",
}

interface Props { budget: Budget }

export function BudgetHeader({ budget }: Props) {
  const router     = useRouter()
  const canManage  = usePermission("MANAGER")
  const version    = budget.active_version
  const status     = version?.status ?? "draft"

  const [confirmSend,    setConfirmSend]    = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [confirmReject,  setConfirmReject]  = useState(false)

  const { mutateAsync: send,     isPending: sending }   = useSendBudget(budget.id)
  const { mutateAsync: approve,  isPending: approving } = useApproveBudget(budget.id)
  const { mutateAsync: reject,   isPending: rejecting } = useRejectBudget(budget.id)
  const { mutateAsync: revision, isPending: revising }  = useRequestRevision(budget.id)
  const { mutateAsync: clone,    isPending: cloning }   = useCloneBudget()

  async function handleSend() {
    if (!version) return
    try {
      await send(version.id)
      toast.success("Orçamento enviado ao cliente.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar.")
    }
    setConfirmSend(false)
  }

  async function handleApprove() {
    if (!version) return
    try {
      const res = await approve({ versionId: version.id, payload: { approved_by: "gerente" } })
      toast.success(`OS #${res.service_order.number} criada com sucesso!`)
      router.push(`/os/${res.service_order.id}` as Route)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar.")
    }
    setConfirmApprove(false)
  }

  async function handleReject() {
    if (!version) return
    try {
      await reject(version.id)
      toast.success("Orçamento rejeitado.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao rejeitar.")
    }
    setConfirmReject(false)
  }

  async function handleRevision() {
    if (!version) return
    try {
      await revision(version.id)
      toast.success("Nova versão de revisão criada.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao solicitar revisão.")
    }
  }

  async function handleClone() {
    try {
      const nb = await clone(budget.id)
      toast.success(`Orçamento ${nb.number} criado.`)
      router.push(`/orcamentos-particulares/${nb.id}` as Route)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao clonar.")
    }
  }

  const pdfUrl = version?.pdf_s3_key
    ? `/api/proxy/budgets/${budget.id}/versions/${version.id}/pdf/`
    : null

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        {/* Esquerda: voltar + info */}
        <div className="flex items-center gap-3">
          <Link href={"/orcamentos-particulares" as Route}>
            <Button variant="ghost" size="icon" className="text-white/50 hover:text-white">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-white">{budget.number}</span>
              {version && (
                <span className="text-white/40 text-sm">v{version.version_number}</span>
              )}
              {version && (
                <Badge className={`text-xs border ${STATUS_COLORS[status]}`}>
                  {STATUS_LABELS[status]}
                </Badge>
              )}
            </div>
            <p className="text-sm text-white/40 mt-0.5">
              {budget.customer_name} · {budget.vehicle_plate} · {budget.vehicle_description}
            </p>
          </div>
        </div>

        {/* Direita: ações */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-white/50 hover:text-white">
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </a>
          )}

          {/* OS vinculada */}
          {status === "approved" && budget.service_order && (
            <Link href={`/os/${budget.service_order}` as Route}>
              <Button variant="outline" size="sm" className="gap-1.5 border-success-400/30 text-success-400 hover:bg-success-400/10">
                <ExternalLink className="h-4 w-4" />
                Ver OS
              </Button>
            </Link>
          )}

          {/* Clonar (rejected/expired) */}
          {(status === "rejected" || status === "expired") && (
            <Button
              variant="ghost"
              size="sm"
              disabled={cloning}
              onClick={handleClone}
              className="gap-1.5 text-white/60 hover:text-white"
            >
              <Copy className="h-4 w-4" />
              Clonar
            </Button>
          )}

          {/* Solicitar revisão (sent) */}
          {status === "sent" && canManage && (
            <Button
              variant="ghost"
              size="sm"
              disabled={revising}
              onClick={handleRevision}
              className="gap-1.5 text-warning-400 hover:text-warning-300"
            >
              <RotateCcw className="h-4 w-4" />
              Revisão
            </Button>
          )}

          {/* Rejeitar (sent) */}
          {status === "sent" && canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmReject(true)}
              className="gap-1.5 text-error-400 hover:text-error-300"
            >
              <XCircle className="h-4 w-4" />
              Rejeitar
            </Button>
          )}

          {/* Aprovar (sent) */}
          {status === "sent" && canManage && (
            <Button
              size="sm"
              disabled={approving}
              onClick={() => setConfirmApprove(true)}
              className="gap-1.5 bg-success-600 hover:bg-success-700 text-white"
            >
              <CheckCircle className="h-4 w-4" />
              Aprovar → OS
            </Button>
          )}

          {/* Enviar (draft) */}
          {status === "draft" && version && version.items.length > 0 && (
            <Button
              size="sm"
              disabled={sending}
              onClick={() => setConfirmSend(true)}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              Enviar ao Cliente
            </Button>
          )}
        </div>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Enviar orçamento?"
        description="O orçamento será enviado ao cliente e ficará imutável. Confirma?"
        onConfirm={handleSend}
        confirmLabel="Enviar"
      />
      <ConfirmDialog
        open={confirmApprove}
        onOpenChange={setConfirmApprove}
        title="Aprovar e criar OS?"
        description="Uma Ordem de Serviço particular será criada automaticamente. Essa ação não pode ser desfeita."
        onConfirm={handleApprove}
        confirmLabel="Aprovar"
        variant="success"
      />
      <ConfirmDialog
        open={confirmReject}
        onOpenChange={setConfirmReject}
        title="Rejeitar orçamento?"
        description="O orçamento será marcado como rejeitado. Você poderá clonar para criar uma nova versão."
        onConfirm={handleReject}
        confirmLabel="Rejeitar"
        variant="destructive"
      />
    </>
  )
}
```

- [ ] **Step 3: Criar `VersionHistory.tsx`**

```tsx
// apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/VersionHistory.tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { useBudgetVersions } from "@/hooks/useBudgets"
import type { BudgetVersionStatus } from "@paddock/types"

const STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  draft:      "Rascunho",
  sent:       "Enviado",
  approved:   "Aprovado",
  rejected:   "Rejeitado",
  expired:    "Expirado",
  revision:   "Em Revisão",
  superseded: "Superado",
}

const STATUS_COLORS: Record<BudgetVersionStatus, string> = {
  draft:      "text-white/50 bg-white/10 border-white/10",
  sent:       "text-info-400 bg-info-400/10 border-info-400/20",
  approved:   "text-success-400 bg-success-400/10 border-success-400/20",
  rejected:   "text-error-400 bg-error-400/10 border-error-400/20",
  expired:    "text-warning-400 bg-warning-400/10 border-warning-400/20",
  revision:   "text-warning-400 bg-warning-400/10 border-warning-400/20",
  superseded: "text-white/20 bg-white/5 border-white/5",
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"

interface Props { budgetId: number }

export function VersionHistory({ budgetId }: Props) {
  const { data: versions = [], isLoading } = useBudgetVersions(budgetId)

  if (isLoading) {
    return <div className="text-white/30 text-sm py-4">Carregando versões...</div>
  }

  if (versions.length === 0) {
    return <div className="text-white/30 text-sm py-4">Nenhuma versão encontrada.</div>
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <div
          key={v.id}
          className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">Versão {v.version_number}</span>
              <Badge className={`text-xs border ${STATUS_COLORS[v.status]}`}>
                {STATUS_LABELS[v.status]}
              </Badge>
            </div>
            <span className="text-white/40 text-xs font-mono">
              {parseFloat(v.net_total).toLocaleString("pt-BR", {
                style: "currency", currency: "BRL",
              })}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-white/40">
            <span>Criado: {fmt(v.created_at)}</span>
            <span>Enviado: {fmt(v.sent_at)}</span>
            <span>Aprovado: {fmt(v.approved_at)}</span>
          </div>
          {v.pdf_s3_key && (
            <a
              href={`/api/proxy/budgets/${budgetId}/versions/${v.id}/pdf/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-info-400 hover:text-info-300 underline"
            >
              Download PDF v{v.version_number}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep "_components"
```

Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/BudgetHeader.tsx" \
        "apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/VersionHistory.tsx"
git commit -m "feat(budgets): BudgetHeader + VersionHistory components"
```

---

## Task 6: ItemsTable + ItemSheet (editor completo com operações MO)

**Files:**
- Create: `apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/ItemsTable.tsx`
- Create: `apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/ItemSheet.tsx`

- [ ] **Step 1: Criar `ItemsTable.tsx`**

```tsx
// apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/ItemsTable.tsx
"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useBudgetItems, useDeleteBudgetItem } from "@/hooks/useBudgets"
import { ItemSheet } from "./ItemSheet"
import type { BudgetVersion, BudgetVersionItem } from "@paddock/types"

const ITEM_TYPE_LABELS: Record<string, string> = {
  PART:             "Peça",
  SERVICE:          "Serviço",
  EXTERNAL_SERVICE: "Serv. Externo",
  FEE:              "Taxa",
  DISCOUNT:         "Desconto",
}

const fmt = (v: string | number) =>
  parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

interface Props {
  budgetId: number
  version: BudgetVersion
}

export function ItemsTable({ budgetId, version }: Props) {
  const isDraft = version.status === "draft"

  const { data: items = [], isLoading } = useBudgetItems(budgetId, version.id)
  const { mutateAsync: deleteItem }     = useDeleteBudgetItem(budgetId, version.id)

  const [sheetOpen,    setSheetOpen]    = useState(false)
  const [editingItem,  setEditingItem]  = useState<BudgetVersionItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  function openNew() {
    setEditingItem(null)
    setSheetOpen(true)
  }

  function openEdit(item: BudgetVersionItem) {
    if (!isDraft) return
    setEditingItem(item)
    setSheetOpen(true)
  }

  async function handleDelete() {
    if (deleteTarget === null) return
    try {
      await deleteItem(deleteTarget)
      toast.success("Item removido.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover item.")
    }
    setDeleteTarget(null)
  }

  const laborTotal = items.reduce(
    (acc, item) =>
      acc + item.operations.reduce((s, op) => s + parseFloat(op.labor_cost), 0),
    0
  )

  if (isLoading) return <TableSkeleton columns={6} rows={3} />

  return (
    <div className="space-y-3">
      {/* Tabela */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-white/50">Descrição</TableHead>
              <TableHead className="text-white/50">Tipo</TableHead>
              <TableHead className="text-white/50 text-right">Qtd</TableHead>
              <TableHead className="text-white/50 text-right">Preço Unit.</TableHead>
              <TableHead className="text-white/50 text-right">Desconto</TableHead>
              <TableHead className="text-white/50 text-right">Total Líq.</TableHead>
              {isDraft && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isDraft ? 7 : 6}
                  className="text-center text-white/30 py-10 text-sm"
                >
                  {isDraft
                    ? "Nenhum item adicionado. Clique em "Adicionar Item" para começar."
                    : "Versão sem itens."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className={`border-white/5 ${isDraft ? "hover:bg-white/5 cursor-pointer" : ""}`}
                  onClick={() => openEdit(item)}
                >
                  <TableCell className="text-white/90 text-sm max-w-xs truncate">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-white/50 text-xs">
                    {ITEM_TYPE_LABELS[item.item_type] ?? item.item_type}
                  </TableCell>
                  <TableCell className="text-right text-white/70 text-sm">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right text-white/70 text-sm">
                    {fmt(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right text-white/50 text-sm">
                    {parseFloat(item.discount_pct) > 0 ? `${item.discount_pct}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-white font-medium text-sm">
                    {fmt(item.net_price)}
                  </TableCell>
                  {isDraft && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button
                        className="text-white/20 hover:text-error-400 transition-colors"
                        onClick={() => setDeleteTarget(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totais */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 w-72 space-y-1.5 text-sm">
            <div className="flex justify-between text-white/50">
              <span>Peças</span>
              <span>{fmt(version.parts_total)}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Mão de Obra</span>
              <span>{fmt(version.labor_total !== "0.00" ? version.labor_total : laborTotal)}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Descontos</span>
              <span className="text-error-400">- {fmt(version.discount_total)}</span>
            </div>
            <div className="border-t border-white/10 pt-1.5 flex justify-between text-white font-semibold">
              <span>Total Líquido</span>
              <span>{fmt(version.net_total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Ações */}
      {isDraft && (
        <div>
          <Button size="sm" variant="outline" onClick={openNew} className="gap-2 border-white/20 text-white/70 hover:text-white hover:border-white/40">
            <Plus className="h-4 w-4" />
            Adicionar Item
          </Button>
        </div>
      )}

      {!isDraft && (
        <p className="text-xs text-white/30 italic">
          Versão {version.status === "sent" ? "enviada" : version.status} — somente leitura.
        </p>
      )}

      {/* Sheet */}
      <ItemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        budgetId={budgetId}
        versionId={version.id}
        item={editingItem}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="Remover item?"
        description="O item será removido permanentemente desta versão."
        onConfirm={handleDelete}
        confirmLabel="Remover"
        variant="destructive"
      />
    </div>
  )
}
```

- [ ] **Step 2: Criar `ItemSheet.tsx`**

```tsx
// apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/ItemSheet.tsx
"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useCreateBudgetItem } from "@/hooks/useBudgets"
import type { BudgetItemCreatePayload, BudgetVersionItem } from "@paddock/types"

interface OperationRow {
  operation_type_code: string
  labor_category_code: string
  hours: string
  hourly_rate: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  budgetId: number
  versionId: number
  item: BudgetVersionItem | null
}

const OPERATION_TYPE_OPTIONS = [
  { code: "FUNILARIA",      label: "Funilaria" },
  { code: "PINTURA",        label: "Pintura" },
  { code: "MECANICA",       label: "Mecânica" },
  { code: "ELETRICA",       label: "Elétrica" },
  { code: "INST_PECA",      label: "Instalação de Peça" },
  { code: "REMOCAO_INSTAL", label: "Remoção/Instalação" },
]

const LABOR_CATEGORY_OPTIONS = [
  { code: "FUNILEIRO",  label: "Funileiro" },
  { code: "PINTOR",     label: "Pintor" },
  { code: "MECANICO",   label: "Mecânico" },
  { code: "ELETRICISTA",label: "Eletricista" },
  { code: "POLIDOR",    label: "Polidor" },
]

export function ItemSheet({ open, onOpenChange, budgetId, versionId, item }: Props) {
  const { mutateAsync: createItem, isPending } = useCreateBudgetItem(budgetId, versionId)

  // Campos do item
  const [description, setDescription] = useState("")
  const [itemType,    setItemType]     = useState<string>("PART")
  const [quantity,    setQuantity]     = useState("1.000")
  const [unitPrice,   setUnitPrice]    = useState("0.00")
  const [discountPct, setDiscountPct]  = useState("0.00")

  // Operações MO
  const [operations, setOperations] = useState<OperationRow[]>([])

  // Preencher ao editar (read-only — versão não draft bloqueada antes de chegar aqui)
  useEffect(() => {
    if (item) {
      setDescription(item.description)
      setItemType(item.item_type)
      setQuantity(item.quantity)
      setUnitPrice(item.unit_price)
      setDiscountPct(item.discount_pct)
      setOperations(
        item.operations.map((op) => ({
          operation_type_code: op.operation_type.code,
          labor_category_code: op.labor_category.code,
          hours:               op.hours,
          hourly_rate:         op.hourly_rate,
        }))
      )
    } else {
      setDescription("")
      setItemType("PART")
      setQuantity("1.000")
      setUnitPrice("0.00")
      setDiscountPct("0.00")
      setOperations([])
    }
  }, [item, open])

  const netPrice = (() => {
    const gross    = parseFloat(unitPrice || "0") * parseFloat(quantity || "0")
    const discount = gross * (parseFloat(discountPct || "0") / 100)
    return Math.max(0, gross - discount).toFixed(2)
  })()

  function addOperation() {
    setOperations((prev) => [
      ...prev,
      { operation_type_code: "FUNILARIA", labor_category_code: "FUNILEIRO", hours: "1.00", hourly_rate: "80.00" },
    ])
  }

  function updateOp(idx: number, field: keyof OperationRow, value: string) {
    setOperations((prev) => prev.map((op, i) => (i === idx ? { ...op, [field]: value } : op)))
  }

  function removeOp(idx: number) {
    setOperations((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!description.trim()) {
      toast.error("Informe a descrição do item.")
      return
    }
    const payload: BudgetItemCreatePayload = {
      description:  description.trim(),
      item_type:    itemType as BudgetItemCreatePayload["item_type"],
      quantity,
      unit_price:   unitPrice,
      net_price:    netPrice,
      discount_pct: discountPct,
      operations:   operations.map((op) => ({
        operation_type_code: op.operation_type_code,
        labor_category_code: op.labor_category_code,
        hours:               op.hours,
        hourly_rate:         op.hourly_rate,
        labor_cost:          (parseFloat(op.hours) * parseFloat(op.hourly_rate)).toFixed(2),
      })),
    }
    try {
      await createItem(payload)
      toast.success("Item salvo.")
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar item.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] bg-[#1c1c1e] border-white/10 text-white overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-white">
            {item ? "Editar Item" : "Novo Item"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Parabrisa dianteiro"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Tipo</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PART">Peça</SelectItem>
                <SelectItem value="SERVICE">Serviço</SelectItem>
                <SelectItem value="EXTERNAL_SERVICE">Serviço Externo</SelectItem>
                <SelectItem value="FEE">Taxa</SelectItem>
                <SelectItem value="DISCOUNT">Desconto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade + Preço + Desconto */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Qtd</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Preço Unit. (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Desconto (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>

          {/* Total calculado */}
          <div className="rounded-lg bg-white/5 px-3 py-2 flex justify-between text-sm">
            <span className="text-white/50">Total Líquido</span>
            <span className="text-white font-medium">
              {parseFloat(netPrice).toLocaleString("pt-BR", {
                style: "currency", currency: "BRL",
              })}
            </span>
          </div>

          {/* Operações MO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-white/70 text-xs">Operações de Mão de Obra</Label>
              <button
                type="button"
                onClick={addOperation}
                className="text-xs text-info-400 hover:text-info-300 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Adicionar
              </button>
            </div>

            {operations.length === 0 && (
              <p className="text-xs text-white/30 py-2">Nenhuma operação de MO.</p>
            )}

            {operations.map((op, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">Tipo de Operação</Label>
                    <Select
                      value={op.operation_type_code}
                      onValueChange={(v) => updateOp(idx, "operation_type_code", v)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATION_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">Categoria</Label>
                    <Select
                      value={op.labor_category_code}
                      onValueChange={(v) => updateOp(idx, "labor_category_code", v)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LABOR_CATEGORY_OPTIONS.map((o) => (
                          <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">Horas</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.25"
                      value={op.hours}
                      onChange={(e) => updateOp(idx, "hours", e.target.value)}
                      className="bg-white/5 border-white/10 text-white h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">R$/hora</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={op.hourly_rate}
                      onChange={(e) => updateOp(idx, "hourly_rate", e.target.value)}
                      className="bg-white/5 border-white/10 text-white h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60 font-medium">
                      = {(parseFloat(op.hours || "0") * parseFloat(op.hourly_rate || "0"))
                          .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOp(idx)}
                      className="text-white/20 hover:text-error-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              className="flex-1 text-white/50 hover:text-white border border-white/10"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={isPending}
              onClick={handleSave}
            >
              {isPending ? "Salvando..." : "Salvar Item"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep "ItemSheet\|ItemsTable"
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/ItemsTable.tsx" \
        "apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/_components/ItemSheet.tsx"
git commit -m "feat(budgets): ItemsTable + ItemSheet com editor de itens e operações MO"
```

---

## Task 7: Página Detalhe `/orcamentos-particulares/[id]`

**Files:**
- Create: `apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/page.tsx`

- [ ] **Step 1: Criar `page.tsx`**

```bash
mkdir -p "apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]"
```

```tsx
// apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/page.tsx
"use client"

import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useBudget } from "@/hooks/useBudgets"
import { BudgetHeader }    from "./_components/BudgetHeader"
import { ItemsTable }      from "./_components/ItemsTable"
import { VersionHistory }  from "./_components/VersionHistory"

export default function BudgetDetailPage() {
  const { id }                              = useParams<{ id: string }>()
  const { data: budget, isLoading, isError } = useBudget(id)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-14 w-full rounded-xl bg-white/5" />
        <Skeleton className="h-8 w-64 rounded-lg bg-white/5" />
        <Skeleton className="h-48 w-full rounded-xl bg-white/5" />
      </div>
    )
  }

  if (isError || !budget) {
    return (
      <div className="p-6 text-error-400 text-sm">
        Orçamento não encontrado.
      </div>
    )
  }

  const version = budget.active_version

  return (
    <div className="p-6 space-y-6">
      <BudgetHeader budget={budget} />

      <Tabs defaultValue="itens">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="itens" className="data-[state=active]:bg-white/10 text-white/60 data-[state=active]:text-white">
            Itens
          </TabsTrigger>
          <TabsTrigger value="versoes" className="data-[state=active]:bg-white/10 text-white/60 data-[state=active]:text-white">
            Versões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="mt-4">
          {version ? (
            <ItemsTable budgetId={budget.id} version={version} />
          ) : (
            <p className="text-white/30 text-sm">Nenhuma versão ativa.</p>
          )}
        </TabsContent>

        <TabsContent value="versoes" className="mt-4">
          <VersionHistory budgetId={budget.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep "orcamentos-particulares"
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/orcamentos-particulares/[id]/page.tsx"
git commit -m "feat(budgets): página detalhe /orcamentos-particulares/[id]"
```

---

## Task 8: Sidebar — adicionar item "Orç. Particulares"

**Files:**
- Modify: `apps/dscar-web/src/components/Sidebar.tsx`

- [ ] **Step 1: Adicionar import do ícone `ReceiptText`**

Em `apps/dscar-web/src/components/Sidebar.tsx`, localizar o bloco de imports de ícones do lucide-react e adicionar `ReceiptText`:

```typescript
// Localizar a linha com os imports de lucide-react (ex: FileText, CalendarDays...)
// Adicionar ReceiptText na lista de imports
import {
  // ... ícones existentes ...
  ReceiptText,  // ← adicionar aqui
} from "lucide-react"
```

- [ ] **Step 2: Adicionar item na navegação após "Orçamentos"**

Localizar o bloco do item `id: "orcamentos"` e adicionar o novo item logo após:

```typescript
      {
        id: "orcamentos",
        label: "Orçamentos",
        icon: FileText,
        href: "/orcamentos",
      },
      {
        id: "orcamentos-particulares",
        label: "Orç. Particulares",
        icon: ReceiptText,
        href: "/orcamentos-particulares",
      },
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep Sidebar
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/components/Sidebar.tsx
git commit -m "feat(budgets): sidebar item Orç. Particulares (ReceiptText)"
```

---

## Task 9: Verificação final

- [ ] **Step 1: TypeScript completo sem erros**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1
```

Expected: 0 erros.

- [ ] **Step 2: Subir frontend e verificar páginas**

```bash
cd apps/dscar-web && npm run dev
```

Verificar manualmente:
- `http://localhost:3000/orcamentos-particulares` — lista carrega, 4 cards visíveis
- `http://localhost:3000/orcamentos-particulares/novo` — formulário renderiza
- Criar um orçamento → redireciona para detalhe
- Na página de detalhe: tab Itens e tab Versões funcionam
- Adicionar item → Sheet abre, campos funcionam, salvar cria item na tabela
- Sidebar: item "Orç. Particulares" aparece com ícone correto

- [ ] **Step 3: Commit final se necessário**

```bash
git add -A
git status  # confirmar que não há arquivos indesejados
git commit -m "feat(budgets): frontend completo /orcamentos-particulares"
```

---

## Self-Review

**Spec coverage:**
- ✅ Rota `/orcamentos-particulares` — Task 3
- ✅ 4 KPI cards — Task 3
- ✅ Filtro por status + busca — Task 3
- ✅ `/orcamentos-particulares/novo` com busca de cliente + placa + descrição — Task 4
- ✅ `BudgetHeader` com botões contextuais por status — Task 5
- ✅ `VersionHistory` — Task 5
- ✅ `ItemsTable` com totais — Task 6
- ✅ `ItemSheet` completo com operações MO — Task 6
- ✅ Página detalhe com Tabs — Task 7
- ✅ Sidebar item — Task 8
- ✅ `ConfirmDialog` em aprovação e rejeição — Tasks 5, 6
- ✅ `TableSkeleton` durante loading — Tasks 3, 6
- ✅ Bloqueio read-only se versão não for draft — Task 6
- ✅ `usePermission("MANAGER")` para aprovar/rejeitar — Task 5
- ✅ Tokens de cor success-*/info-*/error-*/warning-* (sem cores brutas) — todos os tasks
- ✅ Hooks com try/catch + toast.error — Tasks 4, 5, 6
- ✅ `fetchList<T>` para endpoints paginados — Task 2

**Tipo consistency:**
- `BudgetListItem` tem `active_version` como `Pick<BudgetVersion, ...> | null` — usado em Task 3 ✅
- `Budget` tem `active_version: BudgetVersion | null` — usado em Tasks 5, 6, 7 ✅
- `useCreateBudgetItem(budgetId, versionId)` retorna mutation — usado em Task 6 `ItemSheet` ✅
- `useDeleteBudgetItem(budgetId, versionId)` retorna mutation com `mutateAsync: (itemId: number)` — usado em Task 6 `ItemsTable` ✅
- `useApproveBudget` retorna `{ version, service_order: { id, number } }` — usado em `BudgetHeader.handleApprove` ✅
