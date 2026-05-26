# MVP Production Ready — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DS Car ERP production-ready for client validation — native auth, configurable RBAC, full catalog CRUD, robust plate API, validated imports, optimized performance.

**Architecture:** 6 phases with clear dependencies. Phases 1-4 run on separate `feat/*` branches from `develop`. Phase 5 (RBAC) depends on Phase 4 (Auth). Phase 6 (E2E) depends on all phases merged to `develop`.

**Tech Stack:** Django 5 + DRF, Next.js 15, React Native/Expo, next-auth v5, Playwright, Sentry

**Spec:** `docs/superpowers/specs/2026-05-26-mvp-production-ready-design.md`

---

## Dependency Graph

```
Phase 0: Git Branching Setup (must be first)
    |
    +---> Phase 1: Cleanup Hub + Performance (feat/cleanup-hub)
    +---> Phase 2: CRUD Cadastros Catalogo   (feat/crud-cadastros)
    +---> Phase 3: API Placas + Import Fixes  (feat/fix-placas-import)
    +---> Phase 4: Auth Nativo                (feat/auth-nativo)
                |
                +---> Phase 5: RBAC Configuravel (feat/rbac-configuravel)
                            |
                            +---> Phase 6: Testes E2E + Monitoring (feat/e2e-monitoring)
```

Phases 1, 2, 3 can run **in parallel** after Phase 0.

---

## Phase 0: Git Branching Setup

### Task 0.1: Audit branches and merge to main

**Files:**
- No files created/modified — git operations only

- [ ] **Step 1: Check diff between current branch and main**

```bash
git diff main..codex/sprint-0-baseline --stat
```

Review the diff. This shows all work on the current branch that hasn't been merged.

- [ ] **Step 2: Check other branches for unmerged work**

```bash
for branch in ciclo-07-cadastros-unificados feat/fiscal-docs feat/port-worktree-shamir feature/sprint-16; do
  echo "=== $branch ==="
  git log main..$branch --oneline 2>/dev/null || echo "(no commits ahead)"
done
```

Note any branches with valuable unmerged work.

- [ ] **Step 3: Merge current branch to main**

```bash
git checkout main
git merge codex/sprint-0-baseline --no-ff -m "chore: merge sprint-0-baseline into main — MVP production ready base"
```

Resolve conflicts if any. This brings all current work into main.

- [ ] **Step 4: Create develop and staging branches**

```bash
git checkout main
git checkout -b develop
git push -u origin develop
git checkout main
git checkout -b staging
git push -u origin staging
git checkout develop
```

- [ ] **Step 5: Clean obsolete branches**

```bash
# Delete local branches that are fully merged
git branch -d codex/sprint-0-baseline 2>/dev/null
git branch -d ciclo-07-cadastros-unificados 2>/dev/null
git branch -d feat/fiscal-docs 2>/dev/null
git branch -d feat/port-worktree-shamir 2>/dev/null
git branch -d feature/sprint-16 2>/dev/null

# Delete remote branches (only the ones confirmed merged)
git push origin --delete codex/sprint-0-baseline 2>/dev/null
```

Only delete branches confirmed as fully merged. Keep any with unmerged work.

- [ ] **Step 6: Push main**

```bash
git push origin main
```

---

## Phase 1: Cleanup Hub + Performance

> Branch: `feat/cleanup-hub` from `develop`

### Task 1.1: Delete apps/hub and clean references

**Files:**
- Delete: `apps/hub/` (entire directory)
- Modify: `package-lock.json` (auto-updated by npm install)

- [ ] **Step 1: Create feature branch**

```bash
git checkout develop
git checkout -b feat/cleanup-hub
```

- [ ] **Step 2: Delete hub directory**

```bash
rm -rf apps/hub/
```

- [ ] **Step 3: Clean npm lockfile**

```bash
npm install
```

This regenerates `package-lock.json` without hub workspace entries.

- [ ] **Step 4: Verify turbo still works**

```bash
npx turbo run build --filter=dscar-web --dry-run
```

Expected: turbo plans build for dscar-web without errors. No hub references.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete apps/hub — dead weight, no functionality

Hub was a placeholder SSO portal with only <h1>Paddock Hub</h1>.
Removing to reduce bundle build time and simplify monorepo."
```

### Task 1.2: Install bundle analyzer and measure baseline

**Files:**
- Modify: `apps/dscar-web/package.json`
- Modify: `apps/dscar-web/next.config.ts`

- [ ] **Step 1: Install @next/bundle-analyzer**

```bash
cd apps/dscar-web && npm install --save-dev @next/bundle-analyzer
```

- [ ] **Step 2: Configure next.config.ts**

Add bundle analyzer wrapper to `apps/dscar-web/next.config.ts`:

```typescript
import path from "path";
import type { NextConfig } from "next";

const withBundleAnalyzer = process.env.ANALYZE === "true"
    ? (await import("@next/bundle-analyzer")).default({ enabled: true })
    : (config: NextConfig) => config;

const r2Hostname = process.env.R2_PUBLIC_URL?.replace(/^https?:\/\//, "") ?? "";

const nextConfig: NextConfig = {
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname, "../../"),
    transpilePackages: ["@paddock/types", "@paddock/auth", "@paddock/utils"],
    experimental: {
        typedRoutes: true,
    },
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "**.amazonaws.com" },
            { protocol: "https", hostname: "**.r2.dev" },
            ...(r2Hostname ? [{ protocol: "https" as const, hostname: r2Hostname }] : []),
        ],
    },
    async rewrites() {
        return [
            { source: "/media/:path*", destination: "http://localhost:8000/media/:path*" },
        ];
    },
};

export default withBundleAnalyzer(nextConfig);
```

- [ ] **Step 3: Run baseline analysis**

```bash
cd apps/dscar-web && ANALYZE=true npx next build
```

This opens a browser report. Screenshot or note the top 10 largest chunks for comparison later.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/package.json apps/dscar-web/next.config.ts
git commit -m "chore(dscar-web): add @next/bundle-analyzer for performance tracking"
```

### Task 1.3: Optimize bundle — dynamic imports for heavy pages

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/page.tsx`
- Modify: `apps/dscar-web/src/app/(app)/compras/page.tsx`
- Modify: `apps/dscar-web/src/app/(app)/estoque/entrada/page.tsx`

- [ ] **Step 1: Identify heavy components from analyzer report**

From the bundle analysis in Task 1.2, identify which page-level components are largest. Common candidates:
- OS detail page (tabs, modals, billing)
- Compras page (tables, forms)
- Estoque page (tables, movements)
- Recharts (dashboard)

- [ ] **Step 2: Apply dynamic imports to heavy modal components**

For each page identified, convert heavy modal/tab imports from static to dynamic. Example pattern:

```typescript
// BEFORE
import { BillingModal } from "./_components/BillingModal";

// AFTER
import dynamic from "next/dynamic";
const BillingModal = dynamic(() => import("./_components/BillingModal").then(m => ({ default: m.BillingModal })), {
    loading: () => null,
});
```

Apply to the largest modal components in OS detail, compras, and estoque pages.

- [ ] **Step 3: Check for duplicate dependencies**

```bash
cd apps/dscar-web && npx next build 2>&1 | grep -i "duplicate"
```

Also check barrel exports:

```bash
grep -r "export \* from" packages/types/src/ packages/ui/src/ packages/auth/src/
```

If barrel exports pull in heavy unused modules, convert to named exports.

- [ ] **Step 4: Run depcheck for unused dependencies**

```bash
cd apps/dscar-web && npx depcheck --ignores="@types/*,eslint*,autoprefixer,postcss,tailwindcss*,typescript,@vitejs/*,jsdom"
```

Remove any truly unused dependencies.

- [ ] **Step 5: Re-run bundle analysis and compare**

```bash
cd apps/dscar-web && ANALYZE=true npx next build
```

Compare against baseline from Task 1.2. Document improvements.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "perf(dscar-web): dynamic imports for heavy modals, remove unused deps"
```

---

## Phase 2: CRUD Cadastros Catalogo

> Branch: `feat/crud-cadastros` from `develop`

### Task 2.1: Add missing mutation hooks

**Files:**
- Modify: `apps/dscar-web/src/hooks/usePricingCatalog.ts`

- [ ] **Step 1: Create feature branch**

```bash
git checkout develop
git checkout -b feat/crud-cadastros
```

- [ ] **Step 2: Add missing update/toggle hooks to usePricingCatalog.ts**

The file already has `useCreateServicoCanonico`, `useUpdateServicoCanonico`, `useCreateMaterialCanonico`, `useCreateInsumoMaterial`. Missing: update hooks for material, insumo, categorias, and toggle (deactivate) hooks.

Add after the existing hooks in `apps/dscar-web/src/hooks/usePricingCatalog.ts`:

```typescript
/* ── Material Canonico: update ── */
export function useUpdateMaterialCanonico(id: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<MaterialCanonicoPayload>) =>
      apiFetch(`${CATALOG_API}/materiais/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: catalogKeys.materiais() }); },
  });
}

/* ── Insumo Material: update ── */
export function useUpdateInsumoMaterial(id: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<InsumoMaterialPayload>) =>
      apiFetch(`${CATALOG_API}/insumos/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: catalogKeys.insumos() }); },
  });
}

/* ── Categorias Mao de Obra: payload + hooks ── */
export interface CategoriaMaoObraPayload {
  codigo: string;
  nome: string;
  ordem?: number;
  is_active?: boolean;
}

export function useCreateCategoriaMaoObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoriaMaoObraPayload) =>
      apiFetch(`${CATALOG_API}/categorias-mao-obra/`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: catalogKeys.categoriasMaoObra }); },
  });
}

export function useUpdateCategoriaMaoObra(id: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CategoriaMaoObraPayload>) =>
      apiFetch(`${CATALOG_API}/categorias-mao-obra/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: catalogKeys.categoriasMaoObra }); },
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/hooks/usePricingCatalog.ts
git commit -m "feat(hooks): add update/create hooks for materiais, insumos, categorias MO"
```

### Task 2.2: CRUD for Servicos page (currently read-only)

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/cadastros/catalogo/servicos/page.tsx`

This is the highest priority — page is 100% read-only today. Backend is fully ready.

- [ ] **Step 1: Rewrite servicos page with full CRUD**

Replace the entire content of `apps/dscar-web/src/app/(app)/cadastros/catalogo/servicos/page.tsx` with:

```tsx
"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Power } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  useServicosCanonico,
  useCategoriasMaoObra,
  useCreateServicoCanonico,
  useUpdateServicoCanonico,
  catalogKeys,
  type ServicoCanonicoPayload,
} from "@/hooks/usePricingCatalog";

const schema = z.object({
  codigo: z.string().min(1, "Codigo obrigatorio"),
  nome: z.string().min(2, "Minimo 2 caracteres"),
  categoria: z.string().min(1, "Selecione uma categoria"),
  unidade: z.string().default("un"),
  descricao: z.string().optional(),
  aplica_multiplicador_tamanho: z.boolean().default(false),
  is_active: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

interface ServicoCanonico {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  categoria_nome: string;
  unidade: string;
  descricao: string;
  aplica_multiplicador_tamanho: boolean;
  is_active: boolean;
}

export default function ServicosPage() {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ServicoCanonico | null>(null);
  const [deactivating, setDeactivating] = useState<ServicoCanonico | null>(null);

  const queryClient = useQueryClient();
  const { data: servicos = [], isLoading } = useServicosCanonico(search);
  const { data: categorias = [] } = useCategoriasMaoObra();
  const createMutation = useCreateServicoCanonico();
  const updateMutation = useUpdateServicoCanonico(editing?.id ?? 0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { codigo: "", nome: "", categoria: "", unidade: "un", descricao: "", aplica_multiplicador_tamanho: false, is_active: true },
  });

  const filtered = servicos.filter((s: ServicoCanonico) =>
    showInactive ? true : s.is_active !== false
  );

  function openCreate() {
    setEditing(null);
    form.reset({ codigo: "", nome: "", categoria: "", unidade: "un", descricao: "", aplica_multiplicador_tamanho: false, is_active: true });
    setSheetOpen(true);
  }

  function openEdit(s: ServicoCanonico) {
    setEditing(s);
    form.reset({
      codigo: s.codigo,
      nome: s.nome,
      categoria: s.categoria,
      unidade: s.unidade || "un",
      descricao: s.descricao || "",
      aplica_multiplicador_tamanho: s.aplica_multiplicador_tamanho,
      is_active: s.is_active,
    });
    setSheetOpen(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editing) {
        const { codigo: _, ...payload } = values;
        await updateMutation.mutateAsync(payload as Partial<ServicoCanonicoPayload>);
        toast.success("Servico atualizado");
      } else {
        await createMutation.mutateAsync(values as ServicoCanonicoPayload);
        toast.success("Servico criado");
      }
      setSheetOpen(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  }

  async function handleDeactivate() {
    if (!deactivating) return;
    try {
      await apiFetch(`/api/proxy/pricing/catalog/servicos/${deactivating.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !deactivating.is_active }),
      });
      queryClient.invalidateQueries({ queryKey: catalogKeys.servicos() });
      toast.success(deactivating.is_active ? "Servico desativado" : "Servico reativado");
      setDeactivating(null);
    } catch {
      toast.error("Erro ao alterar status.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Servicos</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo Servico
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por nome ou codigo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Checkbox
            checked={showInactive}
            onCheckedChange={(v) => setShowInactive(v === true)}
          />
          Mostrar inativos
        </label>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Codigo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="w-[80px]">Unidade</TableHead>
              <TableHead className="w-[100px]">Multiplicador</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[100px] text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum servico encontrado</TableCell></TableRow>
            ) : (
              filtered.map((s: ServicoCanonico) => (
                <TableRow key={s.id} className={s.is_active === false ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">{s.codigo}</TableCell>
                  <TableCell>{s.nome}</TableCell>
                  <TableCell>{s.categoria_nome}</TableCell>
                  <TableCell>{s.unidade}</TableCell>
                  <TableCell>{s.aplica_multiplicador_tamanho ? "Sim" : "Nao"}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active !== false ? "default" : "secondary"}>
                      {s.is_active !== false ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeactivating(s)} title={s.is_active !== false ? "Desativar" : "Reativar"}>
                      <Power className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Sheet form */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[420px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar Servico" : "Novo Servico"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={(e) => { e.preventDefault(); void form.handleSubmit(onSubmit)(e); }} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Codigo</Label>
              <Input id="codigo" {...form.register("codigo")} disabled={!!editing} placeholder="Ex: FUN-001" />
              {form.formState.errors.codigo && <p className="text-xs text-error-600">{form.formState.errors.codigo.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" {...form.register("nome")} placeholder="Ex: Funilaria Porta Dianteira" />
              {form.formState.errors.nome && <p className="text-xs text-error-600">{form.formState.errors.nome.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={form.watch("categoria")} onValueChange={(v) => form.setValue("categoria", v, { shouldDirty: true })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c: { id: number; codigo: string; nome: string }) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.categoria && <p className="text-xs text-error-600">{form.formState.errors.categoria.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unidade">Unidade</Label>
              <Select value={form.watch("unidade")} onValueChange={(v) => form.setValue("unidade", v, { shouldDirty: true })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">Unidade (un)</SelectItem>
                  <SelectItem value="h">Hora (h)</SelectItem>
                  <SelectItem value="m2">Metro quadrado (m2)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descricao">Descricao</Label>
              <Input id="descricao" {...form.register("descricao")} placeholder="Descricao opcional" />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.watch("aplica_multiplicador_tamanho")}
                onCheckedChange={(v) => form.setValue("aplica_multiplicador_tamanho", v === true, { shouldDirty: true })}
              />
              Aplica multiplicador de tamanho do veiculo
            </label>

            <SheetFooter>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Salvar" : "Criar"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Deactivate confirmation */}
      <AlertDialog open={!!deactivating} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivating?.is_active !== false ? "Desativar servico?" : "Reativar servico?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.is_active !== false
                ? `"${deactivating?.nome}" nao aparecera em novos orcamentos.`
                : `"${deactivating?.nome}" voltara a aparecer em novos orcamentos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeactivate()}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

Fix any type errors (likely around missing component imports — check that AlertDialog, Select, Checkbox exist in components/ui/).

- [ ] **Step 3: Test manually**

```bash
cd apps/dscar-web && npm run dev
```

Navigate to `/cadastros/catalogo/servicos`. Verify:
- List displays existing servicos
- "Novo Servico" opens sheet form
- Create works (fills form, clicks Criar)
- Edit button opens sheet with data populated
- Codigo is disabled on edit
- Desativar shows confirmation dialog
- Inactive items shown with opacity when checkbox checked

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/cadastros/catalogo/servicos/page.tsx
git commit -m "feat(cadastros): full CRUD for servicos page — create, edit, deactivate

Previously read-only. Backend already supported full CRUD via
ServicoCanonicoViewSet. Now exposes Sheet form with category select,
unit select, size multiplier checkbox, and deactivate confirmation."
```

### Task 2.3: Add deactivate + active filter to Pecas page

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/cadastros/catalogo/pecas/page.tsx`

The pecas page already has create/edit. Missing: deactivate button and active/inactive filter.

- [ ] **Step 1: Add deactivate dialog and filter to pecas page**

Add the following to the existing pecas page:

1. Add state variables near the top:
```tsx
const [showInactive, setShowInactive] = useState(false);
const [deactivating, setDeactivating] = useState<PecaCanonica | null>(null);
```

2. Add filter checkbox next to search input:
```tsx
<label className="flex items-center gap-1.5 text-sm text-muted-foreground">
  <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} />
  Mostrar inativos
</label>
```

3. Filter the displayed data:
```tsx
const filtered = pecas.filter((p: PecaCanonica) => showInactive ? true : p.is_active !== false);
```

4. Add Power button in each row's actions cell:
```tsx
<Button variant="ghost" size="icon" onClick={() => setDeactivating(p)} title={p.is_active !== false ? "Desativar" : "Reativar"}>
  <Power className="h-4 w-4" />
</Button>
```

5. Add status badge column.

6. Add AlertDialog (same pattern as servicos — deactivate confirmation).

7. Add deactivate handler using `useUpdatePecaCanonica`:
```tsx
async function handleDeactivate() {
  if (!deactivating) return;
  try {
    await apiFetch(`/api/proxy/pricing/catalog/pecas/${deactivating.id}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !deactivating.is_active }),
    });
    queryClient.invalidateQueries({ queryKey: catalogKeys.pecas() });
    toast.success(deactivating.is_active ? "Peca desativada" : "Peca reativada");
    setDeactivating(null);
  } catch {
    toast.error("Erro ao alterar status.");
  }
}
```

- [ ] **Step 2: Test manually**

Navigate to `/cadastros/catalogo/pecas`. Verify deactivate button works and filter shows/hides inactive.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/cadastros/catalogo/pecas/page.tsx
git commit -m "feat(cadastros): add deactivate/reactivate + active filter to pecas page"
```

### Task 2.4: CRUD for Materiais page

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/cadastros/catalogo/materiais/page.tsx`

Same pattern as servicos. Backend fields: `codigo` (immutable), `nome`, `unidade_base` (immutable after create), `tipo` (consumivel|ferramenta), `is_active`.

- [ ] **Step 1: Rewrite materiais page with CRUD**

Follow the exact same pattern as the servicos page in Task 2.2, with these differences:

- Schema:
```typescript
const schema = z.object({
  codigo: z.string().min(1, "Codigo obrigatorio"),
  nome: z.string().min(2, "Minimo 2 caracteres"),
  unidade_base: z.string().min(1, "Selecione unidade"),
  tipo: z.string().default("consumivel"),
  is_active: z.boolean().default(true),
});
```

- Select for `tipo`: "consumivel" | "ferramenta"
- Select for `unidade_base`: "un" | "kg" | "l" | "m" | "m2" | "pç"
- On edit: both `codigo` AND `unidade_base` are disabled (immutable per backend serializer)
- Use `useCreateMaterialCanonico()` and `useUpdateMaterialCanonico(id)` hooks

- [ ] **Step 2: Test and commit**

```bash
git add apps/dscar-web/src/app/\(app\)/cadastros/catalogo/materiais/page.tsx
git commit -m "feat(cadastros): full CRUD for materiais page — create, edit, deactivate"
```

### Task 2.5: CRUD for Insumos page

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/cadastros/catalogo/insumos/page.tsx`

Backend fields: `material_canonico` (FK, immutable), `sku_interno` (immutable), `gtin`, `descricao`, `marca`, `unidade_compra`, `fator_conversao`, `is_active`.

- [ ] **Step 1: Rewrite insumos page with CRUD**

Same pattern. Key differences:
- Schema:
```typescript
const schema = z.object({
  material_canonico: z.string().min(1, "Selecione material"),
  sku_interno: z.string().min(1, "SKU obrigatorio"),
  descricao: z.string().min(2, "Minimo 2 caracteres"),
  marca: z.string().optional(),
  gtin: z.string().optional().refine((v) => !v || /^\d{13,14}$/.test(v), "GTIN deve ter 13 ou 14 digitos"),
  unidade_compra: z.string().default("un"),
  fator_conversao: z.string().default("1"),
  is_active: z.boolean().default(true),
});
```

- `material_canonico`: Select populated by `useMateriaisCanonico()`, disabled on edit
- `sku_interno`: disabled on edit
- GTIN validation: 13-14 digits

- [ ] **Step 2: Test and commit**

```bash
git add apps/dscar-web/src/app/\(app\)/cadastros/catalogo/insumos/page.tsx
git commit -m "feat(cadastros): full CRUD for insumos page — create, edit, GTIN validation"
```

### Task 2.6: CRUD for Categorias Mao-de-Obra page

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/cadastros/catalogo/categorias-mao-obra/page.tsx`

Backend fields: `codigo`, `nome`, `ordem`, `is_active`.

- [ ] **Step 1: Rewrite categorias page with CRUD**

Same pattern. Key differences:
- Schema:
```typescript
const schema = z.object({
  codigo: z.string().min(1, "Codigo obrigatorio"),
  nome: z.string().min(2, "Minimo 2 caracteres"),
  ordem: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});
```

- `codigo`: disabled on edit
- `ordem`: numeric input
- Use `useCreateCategoriaMaoObra()` and `useUpdateCategoriaMaoObra(id)` hooks

- [ ] **Step 2: Test and commit**

```bash
git add apps/dscar-web/src/app/\(app\)/cadastros/catalogo/categorias-mao-obra/page.tsx
git commit -m "feat(cadastros): full CRUD for categorias mao-de-obra page"
```

---

## Phase 3: API Placas + Import Fixes

> Branch: `feat/fix-placas-import` from `develop`

### Task 3.1: Fix VehicleService exception handling

**Files:**
- Modify: `backend/core/apps/vehicles/services.py`
- Modify: `backend/core/apps/vehicles/tests/test_services.py`

- [ ] **Step 1: Create feature branch**

```bash
git checkout develop
git checkout -b feat/fix-placas-import
```

- [ ] **Step 2: Write tests for specific exception handling**

Add to `backend/core/apps/vehicles/tests/test_services.py`:

```python
from unittest.mock import patch, MagicMock
import httpx

class TestVehicleServiceErrorHandling(TestCase):
    """Tests for specific exception handling in plate lookup."""

    @patch("apps.vehicles.services.httpx.get")
    def test_timeout_returns_none_and_logs(self, mock_get):
        mock_get.side_effect = httpx.TimeoutException("timed out")
        result = VehicleService.lookup_plate("ABC1234")
        self.assertIsNone(result)

    @patch("apps.vehicles.services.httpx.get")
    def test_429_returns_none_and_logs_rate_limit(self, mock_get):
        response = MagicMock()
        response.status_code = 429
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "rate limited", request=MagicMock(), response=response
        )
        mock_get.return_value = response
        result = VehicleService.lookup_plate("ABC1234")
        self.assertIsNone(result)

    @patch("apps.vehicles.services.httpx.get")
    def test_invalid_json_returns_none(self, mock_get):
        response = MagicMock()
        response.status_code = 200
        response.raise_for_status.return_value = None
        response.json.side_effect = ValueError("invalid json")
        mock_get.return_value = response
        result = VehicleService.lookup_plate("ABC1234")
        self.assertIsNone(result)
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend/core && python -m pytest apps/vehicles/tests/test_services.py -v -k "ErrorHandling"
```

Expected: tests may pass or fail depending on current broad except. Either way, proceed to refactor.

- [ ] **Step 4: Refactor exception handling in VehicleService**

In `backend/core/apps/vehicles/services.py`, replace the broad `except Exception` with specific catches:

```python
import httpx
import json

# Replace the existing try/except block around the API call:
try:
    timeout = getattr(settings, "APIPLACAS_TIMEOUT", 8)
    response = httpx.get(
        f"{url}/{plate}/{token}",
        timeout=timeout,
    )
    if response.status_code == 429:
        logger.warning("plate_lookup: rate limit atingido para placa %s***", plate[:3])
        return None
    response.raise_for_status()
    raw_data = response.json()
    if not isinstance(raw_data, dict):
        logger.warning("plate_lookup: API retornou tipo inesperado %s para %s***", type(raw_data).__name__, plate[:3])
        return None
except httpx.TimeoutException:
    logger.warning("plate_lookup: timeout para placa %s***", plate[:3])
    return None
except httpx.HTTPStatusError as exc:
    logger.warning("plate_lookup: HTTP %d para placa %s***", exc.response.status_code, plate[:3])
    return None
except httpx.ConnectError:
    logger.warning("plate_lookup: erro de conexao para placa %s***", plate[:3])
    return None
except (ValueError, json.JSONDecodeError) as exc:
    logger.warning("plate_lookup: JSON invalido para placa %s***: %s", plate[:3], exc)
    return None
```

- [ ] **Step 5: Run tests**

```bash
cd backend/core && python -m pytest apps/vehicles/tests/test_services.py -v
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/vehicles/services.py backend/core/apps/vehicles/tests/test_services.py
git commit -m "fix(vehicles): specific exception handling in plate lookup

Replace broad except Exception with httpx.TimeoutException,
HTTPStatusError, ConnectError, ValueError. Log HTTP status codes.
Handle 429 rate limit explicitly."
```

### Task 3.2: Fix Vehicle Catalog views — year parsing + chassis validation

**Files:**
- Modify: `backend/core/apps/vehicle_catalog/views.py`
- Modify: `backend/core/apps/vehicle_catalog/tests/test_plate_lookup.py`

- [ ] **Step 1: Write tests for year parsing and chassis validation**

Add to `backend/core/apps/vehicle_catalog/tests/test_plate_lookup.py`:

```python
from apps.vehicle_catalog.views import _parse_year, _validate_chassis

class TestYearParsing(TestCase):
    def test_standard_year(self):
        self.assertEqual(_parse_year("2022"), 2022)

    def test_slash_format(self):
        self.assertEqual(_parse_year("2022/2023"), 2022)

    def test_hyphen_format(self):
        self.assertEqual(_parse_year("2022-2023"), 2022)

    def test_none_returns_none(self):
        self.assertIsNone(_parse_year(None))

    def test_garbage_returns_none(self):
        self.assertIsNone(_parse_year("N/A"))

class TestChassisValidation(TestCase):
    def test_valid_chassis(self):
        self.assertEqual(_validate_chassis("9BWZZZ377VT004251"), "9BWZZZ377VT004251")

    def test_masked_chassis_returns_empty(self):
        self.assertEqual(_validate_chassis("9BW***377VT00***"), "")

    def test_short_chassis_returns_empty(self):
        self.assertEqual(_validate_chassis("ABC123"), "")

    def test_none_returns_empty(self):
        self.assertEqual(_validate_chassis(None), "")
```

- [ ] **Step 2: Extract helper functions in views.py**

Add to `backend/core/apps/vehicle_catalog/views.py`:

```python
import re

def _parse_year(value) -> int | None:
    """Parse year from API response. Handles '2022', '2022/2023', '2022-2023'."""
    if not value:
        return None
    match = re.search(r"\d{4}", str(value))
    if match:
        year = int(match.group())
        if 1900 <= year <= 2100:
            return year
    return None

def _validate_chassis(value) -> str:
    """Validate chassis is 17 alphanumeric chars, no masking."""
    if not value:
        return ""
    raw = str(value).strip().upper()
    if re.fullmatch(r"[A-Z0-9]{17}", raw):
        return raw
    return ""
```

Replace existing year parsing and chassis logic in `_normalize_plate_response` to use these helpers.

- [ ] **Step 3: Run tests**

```bash
cd backend/core && python -m pytest apps/vehicle_catalog/tests/test_plate_lookup.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/vehicle_catalog/views.py backend/core/apps/vehicle_catalog/tests/test_plate_lookup.py
git commit -m "fix(vehicle_catalog): robust year parsing + chassis validation

Year: regex-based extraction handles slash/hyphen formats.
Chassis: strict 17 alphanumeric, rejects masked values."
```

### Task 3.3: Move insurer mapping from hardcoded to database

**Files:**
- Modify: `backend/core/apps/cilia/sources/cilia_parser.py`
- Modify: `backend/core/apps/insurers/models.py` (or equivalent Insurer model)
- Create: `backend/core/apps/cilia/tests/test_insurer_mapping.py`

- [ ] **Step 1: Add trade_names field to Insurer model**

Find the Insurer model and add:

```python
from django.contrib.postgres.fields import ArrayField

class Insurer(models.Model):
    # ... existing fields ...
    trade_names = ArrayField(
        models.CharField(max_length=100),
        default=list,
        blank=True,
        help_text="Nomes comerciais usados por fontes externas (Cilia, XML IFX)",
    )
```

- [ ] **Step 2: Create and run migration**

```bash
cd backend/core && python manage.py makemigrations insurers
cd backend/core && python manage.py migrate
```

- [ ] **Step 3: Seed trade_names from existing hardcoded mapping**

Create a data migration or management command that populates `trade_names` for existing insurers from the current `INSURER_TRADE_TO_CODE` mapping.

- [ ] **Step 4: Update CiliaParser to use database lookup with hardcoded fallback**

In `backend/core/apps/cilia/sources/cilia_parser.py`:

```python
@staticmethod
def _resolve_insurer_code(trade_name: str) -> str | None:
    """Resolve insurer trade name to internal code. DB first, hardcoded fallback."""
    from apps.insurers.models import Insurer

    # DB lookup
    insurer = Insurer.objects.filter(trade_names__contains=[trade_name]).first()
    if insurer:
        return insurer.code

    # Hardcoded fallback (legacy)
    return INSURER_TRADE_TO_CODE.get(trade_name)
```

Replace direct `INSURER_TRADE_TO_CODE.get()` calls with `_resolve_insurer_code()`.

- [ ] **Step 5: Write test**

```python
class TestInsurerMapping(TestCase):
    def test_db_lookup_takes_priority(self):
        Insurer.objects.create(code="test", name="Test", trade_names=["Test Insurance Co"])
        code = CiliaParser._resolve_insurer_code("Test Insurance Co")
        self.assertEqual(code, "test")

    def test_hardcoded_fallback(self):
        code = CiliaParser._resolve_insurer_code("Tokio Marine")
        self.assertEqual(code, "tokio")

    def test_unknown_returns_none(self):
        code = CiliaParser._resolve_insurer_code("Unknown Insurer XYZ")
        self.assertIsNone(code)
```

- [ ] **Step 6: Run tests and commit**

```bash
cd backend/core && python -m pytest apps/cilia/tests/ -v
git add -A
git commit -m "feat(cilia): dynamic insurer mapping — DB lookup with hardcoded fallback

Adds trade_names ArrayField to Insurer model. CiliaParser resolves
insurer by DB first, falls back to hardcoded mapping for backwards
compatibility. Admin can manage aliases via seguradora cadastro."
```

### Task 3.4: Add validation logging to import decimal parsing

**Files:**
- Modify: `backend/core/apps/cilia/sources/cilia_parser.py`

- [ ] **Step 1: Add warning logging to _dec() helper**

```python
def _dec(value, field_name: str = "unknown") -> Decimal:
    """Convert value to Decimal. Logs warning instead of silent zero."""
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        logger.warning("import_parse: falha ao converter '%s' para Decimal no campo %s: %s", value, field_name, exc)
        return Decimal("0")
```

Update all `_dec()` call sites to pass the field name:
```python
# Before: _dec(item.get("unit_value"))
# After:  _dec(item.get("unit_value"), "unit_price")
```

- [ ] **Step 2: Add year and phone validation**

In the `parse()` method, after extracting vehicle_year and segurado_phone:

```python
# Year validation
year = _parse_year(vehicle.get("model_year"))
if year is not None and not (1900 <= year <= 2100):
    logger.warning("import_parse: vehicle_year %s fora do range", year)
    year = None

# Phone cleanup
raw_phone = client.get("phone", "")
phone_digits = re.sub(r"\D", "", raw_phone)
if phone_digits and not (10 <= len(phone_digits) <= 11):
    logger.warning("import_parse: telefone '%s' tem %d digitos (esperado 10-11)", raw_phone, len(phone_digits))
```

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/cilia/sources/cilia_parser.py
git commit -m "fix(cilia): add warning logs for decimal parse failures, validate year/phone

_dec() now logs field name on failure instead of silent zero.
Vehicle year validated against 1900-2100 range.
Phone digits validated for 10-11 digit length."
```

---

## Phase 4: Auth Nativo (Drop Keycloak)

> Branch: `feat/auth-nativo` from `develop`
> This is the largest phase. Key files listed below.

### Task 4.1: Create auth backend — models and JWT utils

**Files:**
- Create: `backend/core/apps/authentication/jwt_utils.py`
- Create: `backend/core/apps/authentication/models.py` (RefreshToken, EmailVerification, PasswordReset)
- Modify: `backend/core/apps/authentication/serializers.py`

- [ ] **Step 1: Create feature branch**

```bash
git checkout develop
git checkout -b feat/auth-nativo
```

- [ ] **Step 2: Create JWT utility module**

Create `backend/core/apps/authentication/jwt_utils.py`:

```python
"""JWT generation and validation using RS256."""
import datetime
import logging
import jwt
from django.conf import settings

logger = logging.getLogger(__name__)

def generate_access_token(user, permissions: list[str]) -> str:
    """Generate RS256 access token with 15-min TTL."""
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    payload = {
        "sub": str(user.pk),
        "email": user.email,
        "role": user.role,
        "companies": [user.tenant.slug] if hasattr(user, "tenant") and user.tenant else [],
        "active_company": user.tenant.slug if hasattr(user, "tenant") and user.tenant else "",
        "tenant_schema": user.tenant.schema_name if hasattr(user, "tenant") and user.tenant else "",
        "client_slug": getattr(settings, "CLIENT_SLUG", "grupo-dscar"),
        "permissions": permissions,
        "iat": now,
        "exp": now + datetime.timedelta(minutes=15),
        "token_type": "access",
    }
    return jwt.encode(payload, settings.JWT_PRIVATE_KEY, algorithm="RS256")

def generate_refresh_token(user) -> str:
    """Generate RS256 refresh token with 7-day TTL."""
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    payload = {
        "sub": str(user.pk),
        "iat": now,
        "exp": now + datetime.timedelta(days=7),
        "token_type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_PRIVATE_KEY, algorithm="RS256")

def decode_token(token: str) -> dict:
    """Decode and validate JWT. Raises jwt.InvalidTokenError on failure."""
    return jwt.decode(token, settings.JWT_PUBLIC_KEY, algorithms=["RS256"])
```

- [ ] **Step 3: Create auth models**

Add to `backend/core/apps/authentication/models.py`:

```python
import uuid
from django.db import models
from django.conf import settings

class RefreshToken(models.Model):
    """Stored refresh tokens for rotation."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="refresh_tokens")
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    is_revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [models.Index(fields=["user", "is_revoked"])]

class PasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, unique=True)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

class EmailVerificationToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, unique=True)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
```

- [ ] **Step 4: Create and run migration**

```bash
cd backend/core && python manage.py makemigrations authentication
cd backend/core && python manage.py migrate
```

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/authentication/
git commit -m "feat(auth): JWT RS256 utils + RefreshToken, PasswordReset, EmailVerification models"
```

### Task 4.2: Create auth views — login, refresh, me

**Files:**
- Create: `backend/core/apps/authentication/views_auth.py`
- Modify: `backend/core/apps/authentication/urls.py`

- [ ] **Step 1: Write login test**

```python
# backend/core/apps/authentication/tests/test_auth_views.py
from django.test import TestCase
from rest_framework.test import APIClient

class TestLoginView(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.test_pw = "test-password-123"
        self.user = User.objects.create_user(
            email="test@dscar.com.br",
            password=self.test_pw,
            role="CONSULTANT",
        )

    def test_login_success(self):
        response = self.client.post("/api/v1/auth/login/", {
            "email": "test@dscar.com.br",
            "password": self.test_pw,
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.data)
        self.assertIn("refresh_token", response.data)

    def test_login_wrong_password(self):
        response = self.client.post("/api/v1/auth/login/", {
            "email": "test@dscar.com.br",
            "password": "wrong",
        })
        self.assertEqual(response.status_code, 401)

    def test_login_rate_limited(self):
        for _ in range(6):
            self.client.post("/api/v1/auth/login/", {"email": "a@b.com", "password": "x"})
        response = self.client.post("/api/v1/auth/login/", {"email": "a@b.com", "password": "x"})
        self.assertEqual(response.status_code, 429)
```

- [ ] **Step 2: Create auth views**

Create `backend/core/apps/authentication/views_auth.py`:

```python
"""Native auth endpoints — login, refresh, me."""
import hashlib
import logging
from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from django.contrib.auth import authenticate

from .jwt_utils import generate_access_token, generate_refresh_token, decode_token
from .models import RefreshToken

logger = logging.getLogger(__name__)

class LoginThrottle(AnonRateThrottle):
    rate = "5/min"

def _get_user_permissions(user) -> list[str]:
    """Get permission codes for user based on role + tenant overrides."""
    # Phase 5 (RBAC) will expand this. For now, return defaults based on role.
    from .permissions import DEFAULT_PERMISSIONS
    return DEFAULT_PERMISSIONS.get(user.role, [])

@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")
    if not email or not password:
        return Response({"detail": "Email e senha obrigatorios."}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, email=email, password=password)
    if not user:
        return Response({"detail": "Email ou senha incorretos."}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.is_active:
        return Response({"detail": "Conta desativada."}, status=status.HTTP_403_FORBIDDEN)

    permissions = _get_user_permissions(user)
    access_token = generate_access_token(user, permissions)
    refresh_token = generate_refresh_token(user)

    # Store refresh token hash for rotation
    RefreshToken.objects.create(
        user=user,
        token_hash=hashlib.sha256(refresh_token.encode()).hexdigest(),
        expires_at=timezone.now() + timedelta(days=7),
    )

    return Response({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "expires_in": 900,  # 15 min
    })

@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_view(request):
    token = request.data.get("refresh_token", "")
    if not token:
        return Response({"detail": "refresh_token obrigatorio."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        payload = decode_token(token)
    except Exception:
        return Response({"detail": "Token invalido ou expirado."}, status=status.HTTP_401_UNAUTHORIZED)

    if payload.get("token_type") != "refresh":
        return Response({"detail": "Token invalido."}, status=status.HTTP_401_UNAUTHORIZED)

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    stored = RefreshToken.objects.filter(token_hash=token_hash, is_revoked=False).first()
    if not stored:
        return Response({"detail": "Token revogado ou inexistente."}, status=status.HTTP_401_UNAUTHORIZED)

    # Revoke old token (rotation)
    stored.is_revoked = True
    stored.save(update_fields=["is_revoked"])

    user = stored.user
    permissions = _get_user_permissions(user)
    new_access = generate_access_token(user, permissions)
    new_refresh = generate_refresh_token(user)

    RefreshToken.objects.create(
        user=user,
        token_hash=hashlib.sha256(new_refresh.encode()).hexdigest(),
        expires_at=timezone.now() + timedelta(days=7),
    )

    return Response({
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "Bearer",
        "expires_in": 900,
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = request.user
    return Response({
        "id": str(user.pk),
        "email": user.email,
        "name": getattr(user, "name", user.email),
        "role": user.role,
        "permissions": _get_user_permissions(user),
    })
```

- [ ] **Step 3: Register URLs**

Add to `backend/core/apps/authentication/urls.py`:

```python
from django.urls import path
from .views_auth import login_view, refresh_view, me_view

auth_urlpatterns = [
    path("auth/login/", login_view, name="auth-login"),
    path("auth/refresh/", refresh_view, name="auth-refresh"),
    path("auth/me/", me_view, name="auth-me"),
]
```

Include in main `config/urls.py`:
```python
from apps.authentication.urls import auth_urlpatterns
urlpatterns += [path("api/v1/", include(auth_urlpatterns))]
```

- [ ] **Step 4: Run tests**

```bash
cd backend/core && python -m pytest apps/authentication/tests/test_auth_views.py -v
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): login, refresh, me endpoints with RS256 JWT + rate limiting"
```

### Task 4.3: Create forgot-password and reset-password views

**Files:**
- Modify: `backend/core/apps/authentication/views_auth.py`
- Create: `backend/core/apps/authentication/email_service.py`

- [ ] **Step 1: Create email service**

```python
# backend/core/apps/authentication/email_service.py
"""Email sending via Resend API."""
import logging
import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

RESEND_API = "https://api.resend.com/emails"

def send_reset_password_email(to_email: str, reset_url: str) -> bool:
    """Send password reset email via Resend."""
    try:
        resp = httpx.post(RESEND_API, json={
            "from": settings.EMAIL_FROM,
            "to": [to_email],
            "subject": "Redefinir sua senha — DS Car ERP",
            "html": f"""
                <h2>Redefinir senha</h2>
                <p>Voce solicitou a redefinicao de senha.</p>
                <p><a href="{reset_url}">Clique aqui para redefinir</a></p>
                <p>Este link expira em 1 hora.</p>
                <p>Se voce nao solicitou, ignore este email.</p>
            """,
        }, headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"}, timeout=10)
        return resp.is_success
    except Exception as exc:
        logger.error("Erro ao enviar email de reset: %s", exc)
        return False

def send_verification_email(to_email: str, verify_url: str) -> bool:
    """Send email verification via Resend."""
    try:
        resp = httpx.post(RESEND_API, json={
            "from": settings.EMAIL_FROM,
            "to": [to_email],
            "subject": "Confirme seu cadastro — DS Car ERP",
            "html": f"""
                <h2>Bem-vindo ao DS Car ERP</h2>
                <p>Sua conta foi criada. Confirme seu email para acessar.</p>
                <p><a href="{verify_url}">Confirmar email</a></p>
                <p>Este link expira em 24 horas.</p>
            """,
        }, headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"}, timeout=10)
        return resp.is_success
    except Exception as exc:
        logger.error("Erro ao enviar email de verificacao: %s", exc)
        return False
```

- [ ] **Step 2: Add forgot-password and reset-password views**

Add to `views_auth.py`:

```python
import secrets

@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password_view(request):
    email = request.data.get("email", "").strip().lower()
    if not email:
        return Response({"detail": "Email obrigatorio."}, status=status.HTTP_400_BAD_REQUEST)

    # Always return 200 to prevent email enumeration
    user = User.objects.filter(email=email, is_active=True).first()
    if user:
        token = secrets.token_urlsafe(48)
        PasswordResetToken.objects.create(
            user=user,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            expires_at=timezone.now() + timedelta(hours=1),
        )
        reset_url = f"{settings.FRONTEND_URL}/redefinir-senha/{token}"
        from .email_service import send_reset_password_email
        send_reset_password_email(user.email, reset_url)

    return Response({"detail": "Se o email existir, um link foi enviado."})

@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password_view(request):
    token = request.data.get("token", "")
    new_password = request.data.get("password", "")
    if not token or not new_password:
        return Response({"detail": "Token e senha obrigatorios."}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 8:
        return Response({"detail": "Senha deve ter no minimo 8 caracteres."}, status=status.HTTP_400_BAD_REQUEST)

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    stored = PasswordResetToken.objects.filter(
        token_hash=token_hash, is_used=False, expires_at__gt=timezone.now()
    ).first()
    if not stored:
        return Response({"detail": "Token invalido ou expirado."}, status=status.HTTP_400_BAD_REQUEST)

    user = stored.user
    user.set_password(new_password)
    user.save(update_fields=["password"])
    stored.is_used = True
    stored.save(update_fields=["is_used"])

    # Revoke all refresh tokens
    RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)

    return Response({"detail": "Senha redefinida com sucesso."})
```

- [ ] **Step 3: Add verify-email and register (invite) views**

```python
@api_view(["POST"])
@permission_classes([AllowAny])
def verify_email_view(request):
    token = request.data.get("token", "")
    if not token:
        return Response({"detail": "Token obrigatorio."}, status=status.HTTP_400_BAD_REQUEST)

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    stored = EmailVerificationToken.objects.filter(
        token_hash=token_hash, is_used=False, expires_at__gt=timezone.now()
    ).first()
    if not stored:
        return Response({"detail": "Token invalido ou expirado."}, status=status.HTTP_400_BAD_REQUEST)

    user = stored.user
    user.email_verified = True
    user.save(update_fields=["email_verified"])
    stored.is_used = True
    stored.save(update_fields=["is_used"])

    return Response({"detail": "Email verificado com sucesso."})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_view(request):
    """Admin invites a new user. Not self-service."""
    from .permissions import IsAdminOrAbove
    if not IsAdminOrAbove().has_permission(request, None):
        return Response({"detail": "Apenas ADMIN pode convidar usuarios."}, status=status.HTTP_403_FORBIDDEN)

    email = request.data.get("email", "").strip().lower()
    name = request.data.get("name", "")
    role = request.data.get("role", "CONSULTANT")

    if User.objects.filter(email=email).exists():
        return Response({"detail": "Email ja cadastrado."}, status=status.HTTP_409_CONFLICT)

    temp_password = secrets.token_urlsafe(12)
    user = User.objects.create_user(email=email, password=temp_password, name=name, role=role)

    token = secrets.token_urlsafe(48)
    EmailVerificationToken.objects.create(
        user=user,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        expires_at=timezone.now() + timedelta(hours=24),
    )
    verify_url = f"{settings.FRONTEND_URL}/confirmar-email/{token}"
    from .email_service import send_verification_email
    send_verification_email(email, verify_url)

    return Response({"detail": "Convite enviado.", "user_id": str(user.pk)}, status=status.HTTP_201_CREATED)
```

- [ ] **Step 4: Register all URLs**

```python
auth_urlpatterns = [
    path("auth/login/", login_view),
    path("auth/refresh/", refresh_view),
    path("auth/me/", me_view),
    path("auth/forgot-password/", forgot_password_view),
    path("auth/reset-password/", reset_password_view),
    path("auth/verify-email/", verify_email_view),
    path("auth/register/", register_view),
]
```

- [ ] **Step 5: Run tests and commit**

```bash
cd backend/core && python -m pytest apps/authentication/tests/ -v
git add -A
git commit -m "feat(auth): forgot-password, reset-password, verify-email, register (invite)

Forgot password sends Resend email with 1h token. Reset revokes all
refresh tokens. Register is admin-only invite flow. Verify-email
activates account after invite."
```

### Task 4.4: Update frontend — next-auth config + new pages

**Files:**
- Modify: `apps/dscar-web/src/lib/auth.ts`
- Create: `apps/dscar-web/src/app/(auth)/esqueci-senha/page.tsx`
- Create: `apps/dscar-web/src/app/(auth)/redefinir-senha/[token]/page.tsx`
- Create: `apps/dscar-web/src/app/(auth)/confirmar-email/[token]/page.tsx`
- Modify: `apps/dscar-web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Update next-auth config — remove Keycloak, point to Django**

In `apps/dscar-web/src/lib/auth.ts`:
- Remove KeycloakProvider import and config
- Update CredentialsProvider to call Django `/api/v1/auth/login/` directly
- JWT callback: store access_token + refresh_token from Django response
- Session callback: decode permissions from token

- [ ] **Step 2: Update login page — remove Keycloak button**

Remove the `{process.env.NODE_ENV !== "production" && ...}` block with the Keycloak SSO button from `login/page.tsx`.

- [ ] **Step 3: Create esqueci-senha page**

Simple form: email input → POST to `/api/proxy/auth/forgot-password/` → success message.

- [ ] **Step 4: Create redefinir-senha/[token] page**

Form: new password + confirm → POST to `/api/proxy/auth/reset-password/` with token → redirect to login.

- [ ] **Step 5: Create confirmar-email/[token] page**

On mount: POST to `/api/proxy/auth/verify-email/` with token → success/error message → link to login.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(dscar-web): native auth pages — remove Keycloak, add forgot/reset/verify"
```

### Task 4.5: Delete Keycloak and hub references

**Files:**
- Delete: `infra/docker/keycloak/` (entire directory)
- Modify: `infra/docker/docker-compose.dev.yml` (remove keycloak service)
- Delete: Keycloak env vars from all `.env` files
- Remove: `mozilla-django-oidc` from requirements
- Remove: `KeycloakJWTAuthentication` class

- [ ] **Step 1: Remove Keycloak from docker-compose**

In `infra/docker/docker-compose.dev.yml`, remove the entire `keycloak:` service block (lines 39-68 approximately).

- [ ] **Step 2: Delete Keycloak directory**

```bash
rm -rf infra/docker/keycloak/
```

- [ ] **Step 3: Remove mozilla-django-oidc from backend**

```bash
# Remove from requirements
grep -v "mozilla-django-oidc" backend/core/requirements.txt > /tmp/req.txt && mv /tmp/req.txt backend/core/requirements.txt
```

Remove from `INSTALLED_APPS` and `AUTHENTICATION_BACKENDS` in Django settings.
Remove `KeycloakJWTAuthentication` class and its references.

- [ ] **Step 4: Add RS256 key settings**

In Django settings:
```python
JWT_PRIVATE_KEY = os.environ.get("JWT_PRIVATE_KEY", "")
JWT_PUBLIC_KEY = os.environ.get("JWT_PUBLIC_KEY", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3001")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "noreply@paddock.solutions")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
```

- [ ] **Step 5: Generate RS256 keypair for dev**

```bash
openssl genrsa -out /tmp/jwt_private.pem 2048
openssl rsa -in /tmp/jwt_private.pem -pubout -out /tmp/jwt_public.pem
```

Add to `.env` files.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove Keycloak — docker, oidc lib, auth class, env vars

Auth is now fully native Django. RS256 keypair configured via env vars.
Keycloak themes, realm export, and seed scripts removed."
```

### Task 4.6: Update mobile auth

**Files:**
- Modify: `apps/mobile/src/hooks/useAuth.ts`
- Modify: `apps/mobile/package.json` (remove expo-auth-session if present)

- [ ] **Step 1: Update mobile useAuth hook**

Replace OIDC flow with direct API call:

```typescript
async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/v1/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error("Login falhou");
  const data = await response.json();
  await SecureStore.setItemAsync("access_token", data.access_token);
  await SecureStore.setItemAsync("refresh_token", data.refresh_token);
  // ... update state
}
```

- [ ] **Step 2: Add refresh interceptor**

Add auto-refresh logic that catches 401 responses, uses refresh token, retries.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useAuth.ts
git commit -m "feat(mobile): native auth — direct login API, SecureStore tokens, auto-refresh"
```

---

## Phase 5: RBAC Configuravel

> Branch: `feat/rbac-configuravel` from `develop` (after Phase 4 merged)

### Task 5.1: Create permission model and defaults

**Files:**
- Create: `backend/core/apps/authentication/permissions_config.py`
- Modify: `backend/core/apps/authentication/models.py`

- [ ] **Step 1: Define permission codes and defaults**

Create `backend/core/apps/authentication/permissions_config.py`:

```python
"""Permission codes and default matrix per role."""

PERMISSION_CODES = {
    # OS
    "os.view": "Ver lista e detalhe de OS",
    "os.create": "Criar nova OS",
    "os.edit": "Editar OS existente",
    "os.transition": "Avancar/retroceder status",
    "os.billing": "Faturar OS (emitir NF)",
    "os.delete": "Cancelar OS",
    # Cadastros
    "cadastros.view": "Ver pessoas, seguradoras, etc",
    "cadastros.edit": "Criar/editar cadastros",
    "cadastros.catalog": "Gerenciar catalogo (servicos, pecas)",
    # Compras/Estoque
    "compras.view": "Ver pedidos e cotacoes",
    "compras.create": "Criar pedidos de compra",
    "compras.approve": "Aprovar OC",
    "estoque.view": "Ver estoque",
    "estoque.move": "Dar entrada/saida",
    # Financeiro/Fiscal
    "financeiro.view": "Ver contas a pagar/receber",
    "financeiro.edit": "Registrar pagamentos/recebimentos",
    "fiscal.view": "Ver notas fiscais",
    "fiscal.emit": "Emitir NF-e/NFS-e/NFC-e",
    # Admin
    "admin.users": "Gerenciar usuarios do tenant",
    "admin.permissions": "Configurar matriz de permissoes",
    "admin.settings": "Configuracoes do tenant",
}

# Default permissions per role (before tenant overrides)
DEFAULT_PERMISSIONS: dict[str, list[str]] = {
    "OWNER": list(PERMISSION_CODES.keys()),  # All permissions
    "ADMIN": list(PERMISSION_CODES.keys()),  # All permissions
    "MANAGER": [
        "os.view", "os.create", "os.edit", "os.transition", "os.billing",
        "cadastros.view", "cadastros.edit", "cadastros.catalog",
        "compras.view", "compras.create", "compras.approve",
        "estoque.view", "estoque.move",
        "financeiro.view", "fiscal.view", "fiscal.emit",
    ],
    "CONSULTANT": [
        "os.view", "os.create", "os.edit", "os.transition",
        "cadastros.view",
        "compras.view",
        "estoque.view",
    ],
    "STOREKEEPER": [
        "os.view",
        "cadastros.view",
        "compras.view", "compras.create",
        "estoque.view", "estoque.move",
    ],
}
```

- [ ] **Step 2: Add TenantPermissionOverride model**

Add to `backend/core/apps/authentication/models.py`:

```python
class TenantPermissionOverride(models.Model):
    """Override de permissao padrao por role para este tenant."""
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="permission_overrides")
    role = models.CharField(max_length=20)
    permission_code = models.CharField(max_length=50)
    allowed = models.BooleanField()

    class Meta:
        unique_together = ("tenant", "role", "permission_code")
        indexes = [models.Index(fields=["tenant", "role"])]
```

- [ ] **Step 3: Create migration and commit**

```bash
cd backend/core && python manage.py makemigrations authentication
cd backend/core && python manage.py migrate
git add -A
git commit -m "feat(rbac): TenantPermissionOverride model + default permission matrix"
```

### Task 5.2: Create permission check utilities

**Files:**
- Create: `backend/core/apps/authentication/permission_service.py`

- [ ] **Step 1: Create permission resolution service**

```python
"""Resolve effective permissions for a user in their tenant."""
import logging
from django.core.cache import cache
from .permissions_config import DEFAULT_PERMISSIONS
from .models import TenantPermissionOverride

logger = logging.getLogger(__name__)
CACHE_TTL = 300  # 5 min

def get_effective_permissions(user) -> list[str]:
    """Get all permission codes this user has, considering tenant overrides."""
    role = user.role
    tenant = getattr(user, "tenant", None)

    # OWNER always has everything
    if role == "OWNER":
        return list(DEFAULT_PERMISSIONS["OWNER"])

    defaults = set(DEFAULT_PERMISSIONS.get(role, []))

    if not tenant:
        return list(defaults)

    cache_key = f"perms:{tenant.pk}:{role}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    overrides = TenantPermissionOverride.objects.filter(
        tenant=tenant, role=role
    ).values_list("permission_code", "allowed")

    for code, allowed in overrides:
        if allowed:
            defaults.add(code)
        else:
            defaults.discard(code)

    result = list(defaults)
    cache.set(cache_key, result, CACHE_TTL)
    return result

def has_permission(user, permission_code: str) -> bool:
    """Check if user has a specific permission."""
    return permission_code in get_effective_permissions(user)

def invalidate_permission_cache(tenant, role: str | None = None):
    """Invalidate cached permissions after matrix update."""
    if role:
        cache.delete(f"perms:{tenant.pk}:{role}")
    else:
        for r in DEFAULT_PERMISSIONS:
            cache.delete(f"perms:{tenant.pk}:{r}")
```

- [ ] **Step 2: Create DRF permission class**

```python
# Add to authentication/permissions.py
from .permission_service import has_permission as _check

class HasTenantPermission:
    """DRF permission check using tenant permission matrix."""
    def __init__(self, permission_code: str):
        self.permission_code = permission_code

    def __call__(self):
        return self

    def has_permission(self, request, view):
        return _check(request.user, self.permission_code)
```

- [ ] **Step 3: Write tests**

```python
class TestPermissionService(TestCase):
    def test_defaults_for_consultant(self):
        perms = get_effective_permissions(consultant_user)
        self.assertIn("os.view", perms)
        self.assertNotIn("os.billing", perms)

    def test_override_grants_permission(self):
        TenantPermissionOverride.objects.create(
            tenant=tenant, role="CONSULTANT", permission_code="os.billing", allowed=True
        )
        perms = get_effective_permissions(consultant_user)
        self.assertIn("os.billing", perms)

    def test_override_denies_permission(self):
        TenantPermissionOverride.objects.create(
            tenant=tenant, role="MANAGER", permission_code="fiscal.emit", allowed=False
        )
        perms = get_effective_permissions(manager_user)
        self.assertNotIn("fiscal.emit", perms)

    def test_owner_always_has_all(self):
        TenantPermissionOverride.objects.create(
            tenant=tenant, role="OWNER", permission_code="os.view", allowed=False
        )
        perms = get_effective_permissions(owner_user)
        self.assertIn("os.view", perms)  # override ignored
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(rbac): permission service with cache + DRF permission class

Resolves effective permissions from defaults + tenant overrides.
5-min Redis cache per tenant+role. OWNER always has all permissions."
```

### Task 5.3: Create permission matrix API

**Files:**
- Create: `backend/core/apps/authentication/views_permissions.py`

- [ ] **Step 1: Create matrix endpoints**

```python
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def permission_matrix_view(request):
    """GET: full matrix for admin UI. PUT: save overrides."""
    if not _check(request.user, "admin.permissions"):
        return Response({"detail": "Sem permissao."}, status=403)

    tenant = request.user.tenant
    overrides = TenantPermissionOverride.objects.filter(tenant=tenant)
    override_map = {(o.role, o.permission_code): o.allowed for o in overrides}

    matrix = {}
    for role, defaults in DEFAULT_PERMISSIONS.items():
        matrix[role] = {}
        for code in PERMISSION_CODES:
            key = (role, code)
            if key in override_map:
                matrix[role][code] = override_map[key]
            else:
                matrix[role][code] = code in defaults

    return Response({
        "permissions": PERMISSION_CODES,
        "matrix": matrix,
    })

@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def permission_matrix_update_view(request):
    if not _check(request.user, "admin.permissions"):
        return Response({"detail": "Sem permissao."}, status=403)

    tenant = request.user.tenant
    overrides_data = request.data.get("overrides", [])

    # Validate
    for item in overrides_data:
        if item["role"] == "OWNER":
            continue  # Skip OWNER overrides
        if item["permission_code"] not in PERMISSION_CODES:
            return Response({"detail": f"Permissao invalida: {item['permission_code']}"}, status=400)

    # Replace all overrides
    TenantPermissionOverride.objects.filter(tenant=tenant).delete()
    for item in overrides_data:
        if item["role"] == "OWNER":
            continue
        TenantPermissionOverride.objects.create(
            tenant=tenant,
            role=item["role"],
            permission_code=item["permission_code"],
            allowed=item["allowed"],
        )

    invalidate_permission_cache(tenant)
    return Response({"detail": "Permissoes atualizadas."})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_permissions_view(request):
    perms = get_effective_permissions(request.user)
    return Response({"permissions": perms})
```

- [ ] **Step 2: Register URLs and commit**

```bash
git add -A
git commit -m "feat(rbac): permission matrix GET/PUT API + my-permissions endpoint"
```

### Task 5.4: Create frontend permissions config page

**Files:**
- Create: `apps/dscar-web/src/app/(app)/configuracoes/permissoes/page.tsx`
- Create: `apps/dscar-web/src/hooks/usePermissions.ts`

- [ ] **Step 1: Create usePermissions hook**

```typescript
// apps/dscar-web/src/hooks/usePermissions.ts
import { useSession } from "next-auth/react";

export function usePermission(code: string): boolean {
  const { data: session } = useSession();
  const permissions = (session as any)?.permissions ?? [];
  return permissions.includes(code);
}

export function usePermissions(): string[] {
  const { data: session } = useSession();
  return (session as any)?.permissions ?? [];
}
```

- [ ] **Step 2: Create permissions config page**

Build a table with roles as columns and permissions grouped by module as rows. Each cell is a toggle switch. Fetches matrix from GET `/api/proxy/permissions/matrix/`, saves via PUT.

- [ ] **Step 3: Update middleware.ts to use permissions**

Add permission checks for protected routes (e.g., `/financeiro` requires `financeiro.view`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(dscar-web): RBAC permissions config page + usePermission hook + middleware"
```

### Task 5.5: Apply permission checks to existing ViewSets

**Files:**
- Modify: Multiple ViewSets across apps (service_orders, purchasing, fiscal, etc.)

- [ ] **Step 1: Replace hardcoded permission classes with HasTenantPermission**

Example for ServiceOrderViewSet:
```python
def get_permissions(self):
    if self.action in ("create",):
        return [IsAuthenticated(), HasTenantPermission("os.create")()]
    if self.action in ("update", "partial_update"):
        return [IsAuthenticated(), HasTenantPermission("os.edit")()]
    if self.action == "billing":
        return [IsAuthenticated(), HasTenantPermission("os.billing")()]
    return [IsAuthenticated(), HasTenantPermission("os.view")()]
```

Apply similar pattern to all ViewSets per the permission matrix.

- [ ] **Step 2: Test and commit**

```bash
git add -A
git commit -m "feat(rbac): apply HasTenantPermission to all ViewSets

Service orders, purchasing, fiscal, inventory, persons ViewSets now
use granular permission codes instead of hardcoded role checks."
```

---

## Phase 6: Testes E2E + Monitoring

> Branch: `feat/e2e-monitoring` from `develop` (after all phases merged)

### Task 6.1: Playwright E2E — login flow

**Files:**
- Create: `apps/dscar-web/e2e/auth.spec.ts`

- [ ] **Step 1: Write login E2E test**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Auth flows", () => {
  test("login with email/password redirects to /os", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@dscar.com.br");
    await page.fill('input[type="password"]', process.env.E2E_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/os");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@dscar.com.br");
    await page.fill('input[type="password"]', "wrong");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=incorretos")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run and commit**

```bash
cd apps/dscar-web && npx playwright test e2e/auth.spec.ts
git add apps/dscar-web/e2e/auth.spec.ts
git commit -m "test(e2e): login flow — success + error scenarios"
```

### Task 6.2: Playwright E2E — CRUD cadastro servicos

**Files:**
- Create: `apps/dscar-web/e2e/cadastro-servicos.spec.ts`

- [ ] **Step 1: Write CRUD E2E test**

```typescript
test.describe("Cadastro Servicos CRUD", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@dscar.com.br");
    await page.fill('input[type="password"]', process.env.E2E_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/os");
  });

  test("create, edit, and deactivate a servico", async ({ page }) => {
    await page.goto("/cadastros/catalogo/servicos");
    await page.click("text=Novo Servico");
    await page.fill('input[id="codigo"]', "TEST-001");
    await page.fill('input[id="nome"]', "Servico de Teste E2E");
    // Select categoria
    await page.click('[role="combobox"]');
    await page.click('[role="option"]:first-child');
    await page.click('button:has-text("Criar")');
    await expect(page.locator("text=Servico criado")).toBeVisible();
    await expect(page.locator("text=Servico de Teste E2E")).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/e2e/cadastro-servicos.spec.ts
git commit -m "test(e2e): cadastro servicos CRUD flow"
```

### Task 6.3: Health check endpoint

**Files:**
- Create: `backend/core/apps/authentication/views_health.py`

- [ ] **Step 1: Create health check**

```python
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    checks = {}

    # DB
    try:
        from django.db import connection
        connection.ensure_connection()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {type(e).__name__}"

    # Redis
    try:
        from django.core.cache import cache
        cache.set("health_check", "ok", 10)
        checks["redis"] = "ok" if cache.get("health_check") == "ok" else "error"
    except Exception:
        checks["redis"] = "error"

    # API Placas token
    from django.conf import settings
    checks["api_placas"] = "configured" if getattr(settings, "APIPLACAS_TOKEN", "") else "not_configured"

    # Resend
    checks["email"] = "configured" if getattr(settings, "RESEND_API_KEY", "") else "not_configured"

    all_ok = all(v in ("ok", "configured") for v in checks.values())
    return Response(
        {"status": "healthy" if all_ok else "degraded", "checks": checks},
        status=200 if all_ok else 503,
    )
```

- [ ] **Step 2: Register URL and commit**

```python
path("api/v1/health/", health_check),
```

```bash
git add -A
git commit -m "feat: health check endpoint — DB, Redis, API placas, email status"
```

### Task 6.4: Sentry alert configuration

**Files:**
- No code changes — Sentry dashboard configuration

- [ ] **Step 1: Configure Sentry alerts via dashboard**

In Sentry project settings:
1. Alert: "Error rate spike" — trigger when error count > 10 in 1 minute
2. Alert: "Slow transaction" — trigger when p95 > 3s for any transaction
3. Enable Performance monitoring for both dscar-web and Django projects

- [ ] **Step 2: Verify Sentry is capturing events**

```bash
# Trigger a test error
cd backend/core && python -c "
import sentry_sdk
sentry_sdk.capture_message('Health check test', level='info')
"
```

Check Sentry dashboard for the test event.

---

## Execution Order Summary

```
Week 1:
  Phase 0: Git setup (1 task, ~30 min)
  Phase 1: Hub cleanup + perf (3 tasks, ~2h)       ← parallel
  Phase 2: CRUD cadastros (6 tasks, ~4h)            ← parallel
  Phase 3: Placas + import (4 tasks, ~3h)            ← parallel

Week 2:
  Phase 4: Auth nativo (6 tasks, ~6h)

Week 3:
  Phase 5: RBAC configuravel (5 tasks, ~5h)
  Phase 6: E2E + monitoring (4 tasks, ~3h)
```

Total: ~30 tasks, ~24h estimated execution time.
