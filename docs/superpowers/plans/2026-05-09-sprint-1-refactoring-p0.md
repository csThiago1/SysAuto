# Sprint 1 — Refactoring P0: Duplicacoes e Shared Utils

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar todas as duplicacoes criticas (fetchList x16, formatDate x9, formatCurrency x3, STATUS_LABELS x8) sem alterar comportamento, e adicionar lazy imports para performance.

**Architecture:** Centralizar utilidades compartilhadas em `@/lib/api` (fetchList) e `@paddock/utils` (status labels). Substituir imports inline por imports canonicos. Adicionar `next/dynamic` para paginas pesadas.

**Tech Stack:** TypeScript, TanStack Query v5, Next.js 15 (App Router), @paddock/utils, @paddock/types

**User requirement:** Utilizar lazy imports, optimized imports e tudo que melhore velocidade do app.

---

## File Structure

**Modified files:**
- `apps/dscar-web/src/lib/api.ts` — adicionar export `fetchList<T>`
- 16 hook files — remover `fetchList` local, importar de `@/lib/api`
- 3 hook files (useQuotes, useBenchmark, useBudgets) — remover `apiFetch` local tambem
- 9 page/component files — remover `formatDate` inline
- 3 page files — remover `formatCurrency` inline
- 3 page files — remover `formatDateTime` inline

**Created files:**
- `packages/utils/src/status-labels.ts` — STATUS_LABELS centralizados
- `packages/types/src/customer.types.ts` — Customer type

**Modified for barrel exports:**
- `packages/utils/src/index.ts` — adicionar export de status-labels
- `packages/types/src/index.ts` — adicionar export de customer.types

**Deleted code (Asaas):**
- `backend/core/apps/accounts_payable/views.py` — remover AsaasWebhookView
- `backend/core/apps/accounts_payable/urls.py` — remover rota asaas

---

### Task 1: Extrair `fetchList<T>` para `@/lib/api`

**Files:**
- Modify: `apps/dscar-web/src/lib/api.ts`

- [ ] **Step 1: Adicionar `fetchList` e tipo `PaginatedResponse` ao api.ts**

No final do arquivo `apps/dscar-web/src/lib/api.ts`, adicionar:

```typescript
// ─── DRF Paginated List Helper ───────────────────────────────────────────────

type PaginatedDRF<T> = {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
};

/**
 * Busca lista paginada DRF e extrai .results automaticamente.
 * Aceita tanto resposta paginada quanto array direto.
 */
export async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<PaginatedDRF<T> | T[]>(url);
  if (data && !Array.isArray(data) && "results" in data) return data.results;
  return data as T[];
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/dscar-web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Sem erros novos (warnings existentes ok)

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/lib/api.ts
git commit -m "feat(api): export fetchList<T> from @/lib/api for DRF paginated lists"
```

---

### Task 2: Migrar 13 hooks que usam `apiFetch` importado + `fetchList` local

**Files (remover definicao local de fetchList, adicionar import):**
- `apps/dscar-web/src/hooks/useFiscal.ts` (linhas 26-32)
- `apps/dscar-web/src/hooks/useInventory.ts` (linhas 30-34)
- `apps/dscar-web/src/hooks/useInventoryMovement.ts` (linhas 20-24)
- `apps/dscar-web/src/hooks/useInventoryCounting.ts` (linhas 19-23)
- `apps/dscar-web/src/hooks/useInventoryLocation.ts` (linhas 21-25)
- `apps/dscar-web/src/hooks/useInventoryProduct.ts` (linhas 20-24)
- `apps/dscar-web/src/hooks/usePricingCatalog.ts` (linhas 25-29)
- `apps/dscar-web/src/hooks/usePricingProfile.ts` (linhas 21-25)
- `apps/dscar-web/src/hooks/usePricingEngine.ts` (linhas 27-31)
- `apps/dscar-web/src/hooks/useCapacidade.ts` (linhas 21-25)
- `apps/dscar-web/src/hooks/usePurchasing.ts` (linhas 22-26)
- `apps/dscar-web/src/hooks/useExperts.ts` (linhas 12-16)
- `apps/dscar-web/src/hooks/useFichaTecnica.ts` (linhas 21-25)

Para CADA arquivo, a mudanca e identica:

- [ ] **Step 1: Atualizar import de `@/lib/api` para incluir `fetchList`**

Mudar:
```typescript
import { apiFetch } from "@/lib/api"
```
Para:
```typescript
import { apiFetch, fetchList } from "@/lib/api"
```

- [ ] **Step 2: Remover definicao local de `fetchList`**

Deletar o bloco inteiro (varia entre 4-7 linhas conforme o arquivo):
```typescript
// ─── fetchList helper ─── (ou similar)

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<{ results: T[] } | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}
```

Tambem remover `type Paginated<T>` local se existir (usePricingCatalog, usePricingProfile, useCapacidade, useExperts, useFichaTecnica).

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/dscar-web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Sem erros

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/hooks/useFiscal.ts apps/dscar-web/src/hooks/useInventory.ts apps/dscar-web/src/hooks/useInventoryMovement.ts apps/dscar-web/src/hooks/useInventoryCounting.ts apps/dscar-web/src/hooks/useInventoryLocation.ts apps/dscar-web/src/hooks/useInventoryProduct.ts apps/dscar-web/src/hooks/usePricingCatalog.ts apps/dscar-web/src/hooks/usePricingProfile.ts apps/dscar-web/src/hooks/usePricingEngine.ts apps/dscar-web/src/hooks/useCapacidade.ts apps/dscar-web/src/hooks/usePurchasing.ts apps/dscar-web/src/hooks/useExperts.ts apps/dscar-web/src/hooks/useFichaTecnica.ts
git commit -m "refactor(hooks): replace 13 local fetchList with import from @/lib/api"
```

---

### Task 3: Migrar 3 hooks com `apiFetch` E `fetchList` locais

Esses hooks (useQuotes, useBenchmark, useBudgets) definem TANTO `apiFetch` quanto `fetchList` localmente usando `fetch` raw. Precisam migrar os dois.

**Files:**
- `apps/dscar-web/src/hooks/useQuotes.ts` (linhas 23-41)
- `apps/dscar-web/src/hooks/useBenchmark.ts` (linhas 16-29)
- `apps/dscar-web/src/hooks/useBudgets.ts` (linhas 22-38)

- [ ] **Step 1: Adicionar import de `@/lib/api`**

No topo de cada arquivo, adicionar:
```typescript
import { apiFetch, fetchList } from "@/lib/api"
```

- [ ] **Step 2: Remover `Paginated<T>` type, `fetchList`, e `apiFetch` locais**

Em `useQuotes.ts`, remover linhas 23-41:
```typescript
type Paginated<T> = { results: T[]; count: number; next: string | null; previous: string | null };

async function fetchList<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const data = (await res.json()) as Paginated<T> | T[];
  if (data && !Array.isArray(data) && "results" in data) return data.results;
  return data as T[];
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    // ... error handling
  }
  return res.json() as Promise<T>;
}
```

Mesmo padrao para `useBenchmark.ts` (linhas 16-29) e `useBudgets.ts` (linhas 22-38).

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/dscar-web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Sem erros

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/hooks/useQuotes.ts apps/dscar-web/src/hooks/useBenchmark.ts apps/dscar-web/src/hooks/useBudgets.ts
git commit -m "refactor(hooks): replace local apiFetch+fetchList in useQuotes/useBenchmark/useBudgets"
```

---

### Task 4: Substituir `formatDate` inline por `@paddock/utils`

**Files (9 arquivos com formatDate inline + 1 com formatDateTime):**

Para cada arquivo, a mudanca segue o padrao:
1. Adicionar import `import { formatDate } from "@paddock/utils"` (ou adicionar ao import existente)
2. Deletar a funcao `formatDate` local

- [ ] **Step 1: Financeiro — 4 arquivos identicos**

`apps/dscar-web/src/app/(app)/financeiro/contas-pagar/page.tsx` (linha 47-49):
Remover:
```typescript
function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
}
```
Adicionar no topo: `import { formatDate } from "@paddock/utils"`

Repetir para:
- `financeiro/contas-receber/page.tsx` (linha 46-48)
- `financeiro/contas-pagar/[id]/page.tsx` (linha 45-47)
- `financeiro/contas-receber/[id]/page.tsx` (linha 45-47)

Nos arquivos `[id]/page.tsx`, tambem remover `formatDateTime` local (linhas 49-51) e importar:
```typescript
import { formatDate, formatDateTime } from "@paddock/utils"
```

- [ ] **Step 2: Estoque — 2 arquivos**

`apps/dscar-web/src/app/(app)/estoque/contagens/page.tsx` (linha 89-97):
Remover funcao `formatDate` local. Esta versao inclui hora — verificar se o uso no template precisa de `formatDateTime` em vez de `formatDate`. Se mostra hora, trocar chamada para `formatDateTime`.

`apps/dscar-web/src/app/(app)/estoque/contagens/[id]/page.tsx` (linha 52-61):
Mesma analise — se mostra hora, usar `formatDateTime`.

Adicionar import `from "@paddock/utils"`.

- [ ] **Step 3: Compras**

`apps/dscar-web/src/app/(app)/compras/ordens/page.tsx` (linha 146-148):
Remover `formatDate` local. Adicionar import de `@paddock/utils`.
Tambem remover `formatCurrency` local (linha 140-144). Adicionar import:
```typescript
import { formatDate, formatCurrency } from "@paddock/utils"
```

- [ ] **Step 4: Componente de Inventario**

`apps/dscar-web/src/components/inventory/MovimentacaoTimeline.tsx` (linha 17-29):
Esta versao usa `Intl.DateTimeFormat` com hora. Substituir chamadas por `formatDateTime` de `@paddock/utils`.

- [ ] **Step 5: Fichas Tecnicas**

`apps/dscar-web/src/app/(app)/cadastros/fichas-tecnicas/page.tsx` (linha 21-24):
Remover `formatDate` local. Adicionar import de `@paddock/utils`.

`apps/dscar-web/src/app/(app)/cadastros/fichas-tecnicas/[servico_id]/page.tsx` (linhas 83-99):
Remover `formatDate` (83-89) e `formatDateTime` (91-99). Adicionar:
```typescript
import { formatDate, formatDateTime } from "@paddock/utils"
```

- [ ] **Step 6: Substituir `formatCurrency` restantes**

`apps/dscar-web/src/app/(app)/configuracao-motor/simulador/page.tsx` (linha 22):
Remover `formatCurrency` local. Adicionar import de `@paddock/utils`.

`apps/dscar-web/src/app/(app)/configuracao-motor/snapshots/page.tsx` (linha 34):
Remover `formatCurrency` local. Adicionar import de `@paddock/utils`.

- [ ] **Step 7: Verificar que compila**

Run: `cd apps/dscar-web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Sem erros

- [ ] **Step 8: Commit**

```bash
git add -A apps/dscar-web/src/app apps/dscar-web/src/components/inventory/MovimentacaoTimeline.tsx
git commit -m "refactor(frontend): replace 15 inline formatDate/formatCurrency/formatDateTime with @paddock/utils"
```

---

### Task 5: Centralizar STATUS_LABELS em `@paddock/utils`

**Files:**
- Create: `packages/utils/src/status-labels.ts`
- Modify: `packages/utils/src/index.ts`

- [ ] **Step 1: Criar `packages/utils/src/status-labels.ts`**

```typescript
/**
 * @paddock/utils — Status Labels
 * Labels, badges e cores para status de documentos financeiros e fiscais.
 * Centralizado aqui para evitar duplicacao entre paginas.
 */

// ─── Fiscal ──────────────────────────────────────────────────────────────────

export const FISCAL_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  authorized: "Autorizada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};

export const FISCAL_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border border-amber-200",
  authorized: "bg-success-100 text-success-700 border border-success-200",
  rejected: "bg-error-100 text-error-700 border border-error-200",
  cancelled: "bg-neutral-100 text-neutral-500 border border-neutral-200",
};

// ─── NF-e Entrada ────────────────────────────────────────────────────────────

export const NFE_ENTRADA_STATUS_LABEL: Record<string, string> = {
  importada: "Importada",
  validada: "Validada",
  estoque_gerado: "Estoque Gerado",
};

export const NFE_ENTRADA_STATUS_BADGE: Record<string, string> = {
  importada: "bg-blue-100 text-blue-700 border border-blue-200",
  validada: "bg-amber-100 text-amber-700 border border-amber-200",
  estoque_gerado: "bg-success-100 text-success-700 border border-success-200",
};

// ─── Contagem de Estoque ─────────────────────────────────────────────────────

export const CONTAGEM_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em Andamento",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export const CONTAGEM_STATUS_BADGE: Record<string, string> = {
  rascunho: "bg-neutral-100 text-neutral-600 border border-neutral-200",
  em_andamento: "bg-blue-100 text-blue-700 border border-blue-200",
  finalizada: "bg-success-100 text-success-700 border border-success-200",
  cancelada: "bg-error-100 text-error-700 border border-error-200",
};

export const CONTAGEM_TIPO_LABEL: Record<string, string> = {
  completa: "Completa",
  parcial: "Parcial",
  ciclica: "Ciclica",
};

export const CONTAGEM_TIPO_BADGE: Record<string, string> = {
  completa: "bg-info-100 text-info-700 border border-info-200",
  parcial: "bg-amber-100 text-amber-700 border border-amber-200",
  ciclica: "bg-purple-100 text-purple-700 border border-purple-200",
};

// ─── Orcamentos ──────────────────────────────────────────────────────────────

export const ORCAMENTO_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  pending_review: "Aguardando Revisao",
  approved: "Aprovado",
  rejected: "Rejeitado",
  expired: "Expirado",
};

export const ORCAMENTO_STATUS_BADGE: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600 border border-neutral-200",
  pending_review: "bg-amber-100 text-amber-700 border border-amber-200",
  approved: "bg-success-100 text-success-700 border border-success-200",
  rejected: "bg-error-100 text-error-700 border border-error-200",
  expired: "bg-neutral-100 text-neutral-400 border border-neutral-200",
};

// ─── Budget Versions ─────────────────────────────────────────────────────────

export const BUDGET_VERSION_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

export const BUDGET_VERSION_STATUS_BADGE: Record<string, string> = {
  rascunho: "bg-neutral-100 text-neutral-600 border border-neutral-200",
  pendente: "bg-amber-100 text-amber-700 border border-amber-200",
  aprovada: "bg-success-100 text-success-700 border border-success-200",
  rejeitada: "bg-error-100 text-error-700 border border-error-200",
};

// ─── Unidade Fisica ──────────────────────────────────────────────────────────

export const UNIDADE_FISICA_STATUS_LABEL: Record<string, string> = {
  available: "Disponivel",
  reserved: "Reservada",
  consumed: "Consumida",
  returned: "Devolvida",
};

export const UNIDADE_FISICA_STATUS_BADGE: Record<string, string> = {
  available: "bg-success-100 text-success-700 border border-success-200",
  reserved: "bg-amber-100 text-amber-700 border border-amber-200",
  consumed: "bg-neutral-100 text-neutral-500 border border-neutral-200",
  returned: "bg-blue-100 text-blue-700 border border-blue-200",
};

// ─── Benchmark Ingestao ──────────────────────────────────────────────────────

export const BENCHMARK_INGESTAO_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  processando: "Processando",
  concluida: "Concluida",
  erro: "Erro",
};

export const BENCHMARK_INGESTAO_STATUS_BADGE: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700 border border-amber-200",
  processando: "bg-blue-100 text-blue-700 border border-blue-200",
  concluida: "bg-success-100 text-success-700 border border-success-200",
  erro: "bg-error-100 text-error-700 border border-error-200",
};
```

- [ ] **Step 2: Exportar no barrel**

Adicionar a `packages/utils/src/index.ts`:
```typescript
export * from "./status-labels";
```

- [ ] **Step 3: Verificar que compila**

Run: `cd packages/utils && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Sem erros

- [ ] **Step 4: Commit**

```bash
git add packages/utils/src/status-labels.ts packages/utils/src/index.ts
git commit -m "feat(utils): add centralized STATUS_LABELS for fiscal, inventory, budgets, benchmarks"
```

---

### Task 6: Substituir STATUS_LABELS inline nas paginas

**Files:**
- `apps/dscar-web/src/app/(app)/estoque/contagens/page.tsx` (linhas 17-34)
- `apps/dscar-web/src/app/(app)/orcamentos/page.tsx` (linhas 10-28)
- `apps/dscar-web/src/app/(app)/benchmark/ingestoes/page.tsx` (linhas 33-45)

- [ ] **Step 1: Contagens — substituir STATUS_BADGE e TIPO_BADGE**

Em `estoque/contagens/page.tsx`, remover as definicoes locais de `STATUS_BADGE` e `TIPO_BADGE` (linhas 17-34).

Adicionar import:
```typescript
import {
  CONTAGEM_STATUS_LABEL,
  CONTAGEM_STATUS_BADGE,
  CONTAGEM_TIPO_LABEL,
  CONTAGEM_TIPO_BADGE,
} from "@paddock/utils"
```

Atualizar as referencias no template de `STATUS_BADGE[status]` para `CONTAGEM_STATUS_BADGE[status]` e `TIPO_BADGE[tipo]` para `CONTAGEM_TIPO_BADGE[tipo]`. Se os nomes das labels mudaram, verificar os valores exatos lendo o arquivo primeiro.

- [ ] **Step 2: Orcamentos — substituir STATUS_LABELS e STATUS_COLORS**

Em `orcamentos/page.tsx`, remover definicoes locais (linhas 10-28).

Adicionar import:
```typescript
import { ORCAMENTO_STATUS_LABEL, ORCAMENTO_STATUS_BADGE } from "@paddock/utils"
```

Atualizar referencias no template.

- [ ] **Step 3: Benchmark — substituir STATUS_LABELS e STATUS_BADGE_CLS**

Em `benchmark/ingestoes/page.tsx`, remover definicoes locais (linhas 33-45).

Adicionar import:
```typescript
import { BENCHMARK_INGESTAO_STATUS_LABEL, BENCHMARK_INGESTAO_STATUS_BADGE } from "@paddock/utils"
```

Atualizar referencias no template.

- [ ] **Step 4: Verificar que compila**

Run: `cd apps/dscar-web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Sem erros

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/(app)/estoque/contagens/page.tsx apps/dscar-web/src/app/(app)/orcamentos/page.tsx apps/dscar-web/src/app/(app)/benchmark/ingestoes/page.tsx
git commit -m "refactor(frontend): use centralized STATUS_LABELS from @paddock/utils in 3 pages"
```

---

### Task 7: Mover types inline para `@paddock/types`

**Files:**
- Modify: `packages/types/src/fiscal.types.ts` — adicionar NfeRecebida, FiscalDocumentParams
- Create: `packages/types/src/customer.types.ts` — Customer type
- Modify: `packages/types/src/index.ts` — adicionar export
- Modify: `apps/dscar-web/src/hooks/useFiscal.ts` — remover types inline, importar
- Modify: `apps/dscar-web/src/hooks/useServiceOrders.ts` — remover VehicleHistory, PlateApiResult inline
- Modify: `apps/dscar-web/src/hooks/useCustomers.ts` — remover Customer inline

- [ ] **Step 1: Adicionar NfeRecebida e FiscalDocumentParams a `fiscal.types.ts`**

No final de `packages/types/src/fiscal.types.ts`, adicionar:

```typescript
// ─── NF-e Recebida ───────────────────────────────────────────────────────────

export interface NfeRecebida {
  chave_nfe: string;
  nome_emitente: string;
  documento_emitente: string;
  data_emissao: string;
  valor_total: string;
  situacao: string;
  situacao_manifesto:
    | "ciencia"
    | "confirmada"
    | "desconhecida"
    | "nao_realizada"
    | null;
}

// ─── Fiscal Document Filters ─────────────────────────────────────────────────

export interface FiscalDocumentParams {
  document_type?: string;
  status?: string;
  service_order?: string;
}
```

- [ ] **Step 2: Criar `packages/types/src/customer.types.ts`**

```typescript
/**
 * @paddock/types — Customer
 * Tipo leve para seletores e listas de clientes no frontend.
 */
export interface Customer {
  id: string;
  name: string;
  cpf_cnpj?: string;
  person_id?: string;
}
```

- [ ] **Step 3: Adicionar VehicleHistory e PlateApiResult a `packages/types/src/vehicle.types.ts`**

Ler o arquivo atual primeiro, depois adicionar no final:

```typescript
// ─── Vehicle History (Consulta por Placa) ────────────────────────────────────

export interface VehicleHistory {
  found: boolean;
  plate?: string;
  make?: string;
  model?: string;
  year?: number | null;
  vehicle_version?: string;
  color?: string;
  fuel_type?: string;
  fipe_value?: string | null;
  last_customer_name?: string;
  last_customer_uuid?: string | null;
  visits?: number;
  last_visit?: string | null;
}

export interface PlateApiResult {
  plate: string;
  make: string;
  model: string;
  year: number | null;
  chassis: string;
  renavam: string;
  city: string;
}
```

- [ ] **Step 4: Exportar no barrel**

Adicionar a `packages/types/src/index.ts`:
```typescript
export * from "./customer.types";
```
(fiscal.types e vehicle.types ja sao exportados)

- [ ] **Step 5: Atualizar hooks — remover types inline e importar**

Em `useFiscal.ts`: remover interface `NfeRecebida` e interface `FiscalDocumentParams` (se inline). Adicionar ao import de `@paddock/types`:
```typescript
import type { ..., NfeRecebida, FiscalDocumentParams } from "@paddock/types"
```

Em `useServiceOrders.ts`: remover interfaces `VehicleHistory` e `PlateApiResult`. Adicionar ao import de `@paddock/types`:
```typescript
import type { ..., VehicleHistory, PlateApiResult } from "@paddock/types"
```

Em `useCustomers.ts`: remover interface `Customer`. Adicionar:
```typescript
import type { Customer } from "@paddock/types"
```

- [ ] **Step 6: Verificar que compila**

Run: `cd apps/dscar-web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Sem erros

- [ ] **Step 7: Commit**

```bash
git add packages/types/src/ apps/dscar-web/src/hooks/useFiscal.ts apps/dscar-web/src/hooks/useServiceOrders.ts apps/dscar-web/src/hooks/useCustomers.ts
git commit -m "refactor(types): move inline NfeRecebida, Customer, VehicleHistory, PlateApiResult to @paddock/types"
```

---

### Task 8: Corrigir typos em types

**Files:**
- `apps/dscar-web/src/hooks/usePricingCatalog.ts`

- [ ] **Step 1: Renomear typos**

Em `usePricingCatalog.ts`:
- Renomear `ServicoCanonicoPaylod` para `ServicoCanonicoPayload` (todas as ocorrencias)
- Renomear `MaterialCanonicoPaylod` para `MaterialCanonicoPayload` (todas as ocorrencias)

Usar search-and-replace no arquivo.

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/dscar-web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Sem erros

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/hooks/usePricingCatalog.ts
git commit -m "fix(types): rename ServicoCanonicoPaylod/MaterialCanonicoPaylod typos to Payload"
```

---

### Task 9: Remover Asaas

**Files:**
- `backend/core/apps/accounts_payable/views.py` — remover AsaasWebhookView
- `backend/core/apps/accounts_payable/urls.py` — remover rota asaas

- [ ] **Step 1: Ler views.py e identificar AsaasWebhookView**

Ler `backend/core/apps/accounts_payable/views.py` e identificar o bloco inteiro da classe `AsaasWebhookView`. Remover a classe e seus imports.

- [ ] **Step 2: Remover rota do urls.py**

Em `backend/core/apps/accounts_payable/urls.py`, remover:
```python
path("asaas/webhook/", AsaasWebhookView.as_view(), name="asaas-webhook"),
```

E remover o import de `AsaasWebhookView`.

- [ ] **Step 3: Verificar que compila**

Run: `cd backend/core && python -c "from apps.accounts_payable.urls import urlpatterns; print('OK', len(urlpatterns))"`
Expected: OK (com numero de urlpatterns reduzido em 1)

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/accounts_payable/views.py backend/core/apps/accounts_payable/urls.py
git commit -m "chore(accounts_payable): remove Asaas webhook stub — integration cancelled"
```

---

### Task 10: Adicionar `next/dynamic` para paginas pesadas

Paginas de fiscal e financeiro sao grandes e carregam muitos componentes. Usar `next/dynamic` para lazy-load de dialogos e componentes pesados.

**Files:**
- `apps/dscar-web/src/app/(app)/fiscal/emitir-nfe/page.tsx`
- `apps/dscar-web/src/app/(app)/fiscal/emitir-nfse/page.tsx`
- `apps/dscar-web/src/app/(app)/financeiro/contas-pagar/page.tsx`
- `apps/dscar-web/src/app/(app)/financeiro/contas-receber/page.tsx`
- `apps/dscar-web/src/app/(app)/financeiro/dre/page.tsx`
- `apps/dscar-web/src/app/(app)/financeiro/plano-contas/page.tsx`

- [ ] **Step 1: Identificar componentes pesados para lazy-load**

Para cada pagina, ler e identificar:
- Dialogos (Dialog, AlertDialog) que so abrem sob interacao
- Componentes de formulario complexos que ficam em abas escondidas
- Graficos ou tabelas pesadas

O padrao a aplicar e:

```typescript
import dynamic from "next/dynamic"

// Lazy-load de dialogos — so carregam quando usuario interage
const PaymentDialog = dynamic(() => import("./_components/PaymentDialog"), {
  ssr: false,
})
```

Para componentes que ja estao inline (como no emitir-nfe), esta task e preparatoria — a extracao de componentes sera feita na Sprint 2 (Task de shared components). Aqui, adicionar lazy loading onde componentes JA ESTAO em arquivos separados.

- [ ] **Step 2: Ler cada pagina e aplicar `dynamic()` onde possivel**

Para paginas que ja importam componentes de `_components/` ou `@/components/`, converter imports estaticos para dynamic:

```typescript
// ANTES
import { JournalEntryTable } from "./_components/JournalEntryTable"

// DEPOIS
import dynamic from "next/dynamic"
const JournalEntryTable = dynamic(
  () => import("./_components/JournalEntryTable").then(m => ({ default: m.JournalEntryTable })),
  { ssr: false, loading: () => <div className="animate-pulse h-64 bg-muted rounded" /> }
)
```

Para paginas onde TUDO e inline (emitir-nfe, contas-pagar), anotar com comentario `// TODO Sprint 2: extract to _components/ for lazy loading` e pular para proxima.

- [ ] **Step 3: Otimizar barrel imports dos hooks**

Verificar `apps/dscar-web/src/hooks/index.ts`. Se ele usa `export *` de TODOS os hooks, isso carrega tudo em qualquer pagina que importa um unico hook.

Se o barrel faz `export * from "./useHR"` etc., verificar se as paginas importam do barrel (`@/hooks`) ou diretamente (`@/hooks/useFiscal`).

**Se importam do barrel:** converter imports diretos nos arquivos de pagina:
```typescript
// ANTES (carrega TODOS os hooks)
import { useFiscalDocuments } from "@/hooks"

// DEPOIS (carrega so o hook necessario)
import { useFiscalDocuments } from "@/hooks/useFiscal"
```

Aplicar em TODAS as paginas de fiscal e financeiro.

- [ ] **Step 4: Verificar que compila**

Run: `cd apps/dscar-web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Sem erros

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/(app)/fiscal/ apps/dscar-web/src/app/(app)/financeiro/
git commit -m "perf(frontend): add next/dynamic lazy loading + direct hook imports for fiscal/financeiro pages"
```

---

### Task 11: Verificacao final e cleanup

- [ ] **Step 1: Rodar type check completo**

Run: `cd apps/dscar-web && npx tsc --noEmit --pretty`
Expected: Sem erros novos

- [ ] **Step 2: Rodar lint**

Run: `cd apps/dscar-web && npx next lint 2>&1 | tail -20`
Expected: Sem erros novos

- [ ] **Step 3: Verificar que build funciona**

Run: `cd apps/dscar-web && npx next build 2>&1 | tail -30`
Expected: Build completo sem erros

- [ ] **Step 4: Grep final por duplicacoes restantes**

```bash
# Verificar que nao restam fetchList locais
grep -r "async function fetchList" apps/dscar-web/src/hooks/ | wc -l
# Expected: 0

# Verificar que nao restam formatDate locais em paginas
grep -rn "function formatDate" apps/dscar-web/src/app/ apps/dscar-web/src/components/ | wc -l
# Expected: 0

# Verificar que nao restam formatCurrency locais
grep -rn "function formatCurrency" apps/dscar-web/src/app/ | wc -l
# Expected: 0
```

- [ ] **Step 5: Commit final se houver ajustes**

```bash
git add -A
git commit -m "chore(sprint-1): final cleanup — verify zero duplications remain"
```
