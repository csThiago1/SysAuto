# Ciclo 03B — Frontend Integration · Módulo de Orçamentação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Conectar o frontend React/Vite existente à API real do Ciclo 03A, substituindo `mockData.ts` por TanStack Query + Zod + fetch real. Entregar UI funcional de Budget e OS V2 (detail + timeline + complement).

**Architecture:** React 19 + Vite + Tailwind v4 + **TanStack Query v5** (novo) + **Zod** (novo). Schemas Zod espelham OpenAPI do backend. Hooks TanStack encapsulam calls + invalidation. Componentes sempre com 3 estados (loading skeleton / error / empty) conforme CLAUDE.md.

**Tech Stack:** React 19, Vite 6, TanStack Query v5, Zod 3, Tailwind v4, Lucide, date-fns, motion.

**Referência:** [`docs/superpowers/specs/2026-04-20-modulo-orcamentacao-design.md`](../specs/2026-04-20-modulo-orcamentacao-design.md) §9.

**Dependências:** Ciclo 03A merged (API REST funcional).

**Out of scope** (Ciclo 4+):
- Upload de fotos com S3 real (Ciclo 5)
- Assinatura digital canvas (Ciclo 5)
- Importação seguradora (Ciclo 4)
- Toda infraestrutura multitenant/LGPD (roadmap)

---

## Chunks planejados

| Chunk | Escopo |
|---|---|
| **1** | Deps + QueryClientProvider + Zod schemas + API modules (budgets.ts, serviceOrdersV2.ts, payments.ts) |
| **2** | TanStack Query hooks (useBudget, useServiceOrderV2, useOSEvents, usePayments) + mutations |
| **3** | Budget UI: BudgetList, BudgetDetail, BudgetEditor com items |
| **4** | OS V2 UI: OSDetailV2 tabs (Versões/Timeline/Payments/Complement) |
| **5** | Kanban real + ServiceOrders atualizado + mockData retirement + smoke |

---

## Task 1: Setup + Zod + API modules

**Files:**
- Modify: `apps/dscar-web/package.json` (+ @tanstack/react-query + zod)
- Create: `apps/dscar-web/src/lib/queryClient.ts`
- Modify: `apps/dscar-web/src/main.tsx` (QueryClientProvider)
- Create: `apps/dscar-web/src/schemas/` (diretório + arquivos)
- Create: `apps/dscar-web/src/api/budgets.ts`
- Create: `apps/dscar-web/src/api/serviceOrdersV2.ts`
- Create: `apps/dscar-web/src/api/payments.ts`
- Create: `apps/dscar-web/src/api/referenceData.ts`

- [ ] **Step 1.1: Adicionar deps**

Em `apps/dscar-web/package.json` em `dependencies`:

```json
"@tanstack/react-query": "^5.64.0",
"@tanstack/react-query-devtools": "^5.64.0",
"zod": "^3.24.1"
```

Instalar: `cd apps/dscar-web && npm install`.

- [ ] **Step 1.2: QueryClient**

Create `apps/dscar-web/src/lib/queryClient.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

- [ ] **Step 1.3: Provider em main.tsx**

Update `apps/dscar-web/src/main.tsx`:

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { queryClient } from './lib/queryClient';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 1.4: Zod schemas compartilhados**

Create `apps/dscar-web/src/schemas/common.ts`:

```typescript
import { z } from 'zod';

export const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    count: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  });

export const DecimalStringSchema = z.string().regex(/^-?\d+(\.\d+)?$/, 'Decimal inválido');

export const RefItemSchema = z.object({
  id: z.number(),
  code: z.string(),
  label: z.string(),
  description: z.string().optional().default(''),
  is_active: z.boolean().default(true),
  sort_order: z.number().default(0),
});

export type RefItem = z.infer<typeof RefItemSchema>;
```

Create `apps/dscar-web/src/schemas/items.ts`:

```typescript
import { z } from 'zod';
import { DecimalStringSchema, RefItemSchema } from './common';

export const ItemOperationReadSchema = z.object({
  id: z.number(),
  operation_type: RefItemSchema,
  labor_category: RefItemSchema,
  hours: DecimalStringSchema,
  hourly_rate: DecimalStringSchema,
  labor_cost: DecimalStringSchema,
});

export const ItemOperationWriteSchema = z.object({
  operation_type_code: z.string(),
  labor_category_code: z.string(),
  hours: z.string(),
  hourly_rate: z.string(),
  labor_cost: z.string().optional(),
});

export type ItemOperationRead = z.infer<typeof ItemOperationReadSchema>;
export type ItemOperationWrite = z.infer<typeof ItemOperationWriteSchema>;

export const BucketSchema = z.enum(['IMPACTO', 'SEM_COBERTURA', 'SOB_ANALISE']);
export const PayerBlockSchema = z.enum([
  'SEGURADORA', 'COMPLEMENTO_PARTICULAR', 'FRANQUIA', 'PARTICULAR',
]);
export const ItemTypeSchema = z.enum([
  'PART', 'SERVICE', 'EXTERNAL_SERVICE', 'FEE', 'DISCOUNT',
]);
export const PartTypeSchema = z.enum(['GENUINA', 'ORIGINAL', 'OUTRAS_FONTES', 'VERDE', '']);
export const SupplierSchema = z.enum(['OFICINA', 'SEGURADORA']);
```

Create `apps/dscar-web/src/schemas/budgets.ts`:

```typescript
import { z } from 'zod';
import {
  BucketSchema, ItemOperationReadSchema, ItemTypeSchema,
  PartTypeSchema, PayerBlockSchema, SupplierSchema,
} from './items';
import { DecimalStringSchema } from './common';

export const BudgetVersionStatusSchema = z.enum([
  'draft', 'sent', 'approved', 'rejected', 'expired', 'revision', 'superseded',
]);

export const BudgetVersionItemReadSchema = z.object({
  id: z.number(),
  bucket: BucketSchema,
  payer_block: PayerBlockSchema,
  impact_area: z.number().nullable(),
  item_type: ItemTypeSchema,
  description: z.string(),
  external_code: z.string(),
  part_type: PartTypeSchema,
  supplier: SupplierSchema,
  quantity: DecimalStringSchema,
  unit_price: DecimalStringSchema,
  unit_cost: DecimalStringSchema.nullable(),
  discount_pct: DecimalStringSchema,
  net_price: DecimalStringSchema,
  flag_abaixo_padrao: z.boolean(),
  flag_acima_padrao: z.boolean(),
  flag_inclusao_manual: z.boolean(),
  flag_codigo_diferente: z.boolean(),
  flag_servico_manual: z.boolean(),
  flag_peca_da_conta: z.boolean(),
  sort_order: z.number(),
  operations: z.array(ItemOperationReadSchema),
});

export const BudgetVersionReadSchema = z.object({
  id: z.number(),
  version_number: z.number(),
  status: BudgetVersionStatusSchema,
  status_display: z.string(),
  status_label: z.string(),
  valid_until: z.string().nullable(),
  subtotal: DecimalStringSchema,
  discount_total: DecimalStringSchema,
  net_total: DecimalStringSchema,
  labor_total: DecimalStringSchema,
  parts_total: DecimalStringSchema,
  pdf_s3_key: z.string(),
  sent_at: z.string().nullable(),
  approved_at: z.string().nullable(),
  approved_by: z.string(),
  approval_evidence_s3_key: z.string(),
  created_by: z.string(),
  created_at: z.string(),
  items: z.array(BudgetVersionItemReadSchema),
});

export const BudgetReadSchema = z.object({
  id: z.number(),
  number: z.string(),
  customer: z.number(),
  customer_name: z.string(),
  vehicle_plate: z.string(),
  vehicle_description: z.string(),
  cloned_from: z.number().nullable(),
  service_order: z.number().nullable(),
  active_version: BudgetVersionReadSchema.nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Budget = z.infer<typeof BudgetReadSchema>;
export type BudgetVersion = z.infer<typeof BudgetVersionReadSchema>;
export type BudgetVersionItem = z.infer<typeof BudgetVersionItemReadSchema>;
export type BudgetVersionStatus = z.infer<typeof BudgetVersionStatusSchema>;
```

Create `apps/dscar-web/src/schemas/serviceOrders.ts`:

```typescript
import { z } from 'zod';
import { BucketSchema, ItemOperationReadSchema, ItemTypeSchema, PartTypeSchema, PayerBlockSchema, SupplierSchema } from './items';
import { DecimalStringSchema } from './common';

export const OSStatusSchema = z.enum([
  'reception', 'initial_survey', 'budget', 'waiting_parts', 'repair',
  'mechanic', 'bodywork', 'painting', 'assembly', 'polishing', 'washing',
  'final_survey', 'ready', 'delivered', 'cancelled',
]);

export const VersionStatusSchema = z.enum([
  'pending', 'approved', 'rejected',
  'analisado', 'autorizado', 'correcao', 'em_analise', 'negado',
  'superseded',
]);

export const EventTypeSchema = z.enum([
  'STATUS_CHANGE', 'AUTO_TRANSITION', 'VERSION_CREATED', 'VERSION_APPROVED',
  'VERSION_REJECTED', 'ITEM_ADDED', 'ITEM_REMOVED', 'ITEM_EDITED',
  'IMPORT_RECEIVED', 'PARECER_ADDED', 'PHOTO_UPLOADED', 'PHOTO_REMOVED',
  'PAYMENT_RECORDED', 'FISCAL_ISSUED', 'SIGNATURE_CAPTURED', 'BUDGET_LINKED',
]);

export const ServiceOrderVersionItemSchema = z.object({
  id: z.number(),
  bucket: BucketSchema,
  payer_block: PayerBlockSchema,
  impact_area: z.number().nullable(),
  item_type: ItemTypeSchema,
  description: z.string(),
  external_code: z.string(),
  part_type: PartTypeSchema,
  supplier: SupplierSchema,
  quantity: DecimalStringSchema,
  unit_price: DecimalStringSchema,
  unit_cost: DecimalStringSchema.nullable(),
  discount_pct: DecimalStringSchema,
  net_price: DecimalStringSchema,
  flag_abaixo_padrao: z.boolean(),
  flag_acima_padrao: z.boolean(),
  flag_inclusao_manual: z.boolean(),
  flag_codigo_diferente: z.boolean(),
  flag_servico_manual: z.boolean(),
  flag_peca_da_conta: z.boolean(),
  sort_order: z.number(),
  operations: z.array(ItemOperationReadSchema),
});

export const ServiceOrderVersionSchema = z.object({
  id: z.number(),
  version_number: z.number(),
  external_version: z.string(),
  external_numero_vistoria: z.string(),
  external_integration_id: z.string(),
  source: z.string(),
  status: VersionStatusSchema,
  status_display: z.string(),
  status_label: z.string(),
  subtotal: DecimalStringSchema,
  discount_total: DecimalStringSchema,
  net_total: DecimalStringSchema,
  labor_total: DecimalStringSchema,
  parts_total: DecimalStringSchema,
  total_seguradora: DecimalStringSchema,
  total_complemento_particular: DecimalStringSchema,
  total_franquia: DecimalStringSchema,
  content_hash: z.string(),
  raw_payload_s3_key: z.string(),
  hourly_rates: z.record(z.string()).default({}),
  global_discount_pct: DecimalStringSchema,
  created_at: z.string(),
  created_by: z.string(),
  approved_at: z.string().nullable(),
  items: z.array(ServiceOrderVersionItemSchema),
});

export const ServiceOrderReadSchema = z.object({
  id: z.number(),
  os_number: z.string(),
  customer: z.number(),
  customer_name: z.string(),
  customer_type: z.enum(['PARTICULAR', 'SEGURADORA']),
  vehicle_plate: z.string(),
  vehicle_description: z.string(),
  status: OSStatusSchema,
  status_display: z.string(),
  previous_status: z.string(),
  source_budget: z.number().nullable(),
  insurer: z.number().nullable(),
  insurer_name: z.string(),
  casualty_number: z.string(),
  external_budget_number: z.string(),
  policy_number: z.string(),
  policy_item: z.string(),
  franchise_amount: DecimalStringSchema,
  notes: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  active_version: ServiceOrderVersionSchema.nullable(),
});

export const ServiceOrderEventSchema = z.object({
  id: z.number(),
  event_type: EventTypeSchema,
  event_type_display: z.string(),
  actor: z.string(),
  payload: z.record(z.any()).default({}),
  from_state: z.string(),
  to_state: z.string(),
  created_at: z.string(),
});

export const ServiceOrderParecerSchema = z.object({
  id: z.number(),
  version: z.number().nullable(),
  source: z.string(),
  source_display: z.string(),
  flow_number: z.number().nullable(),
  author_external: z.string(),
  author_org: z.string(),
  author_internal: z.string(),
  parecer_type: z.string(),
  parecer_type_display: z.string(),
  body: z.string(),
  created_at_external: z.string().nullable(),
  created_at: z.string(),
});

export type ServiceOrder = z.infer<typeof ServiceOrderReadSchema>;
export type ServiceOrderVersion = z.infer<typeof ServiceOrderVersionSchema>;
export type ServiceOrderEvent = z.infer<typeof ServiceOrderEventSchema>;
export type OSStatus = z.infer<typeof OSStatusSchema>;
export type EventType = z.infer<typeof EventTypeSchema>;
```

Create `apps/dscar-web/src/schemas/payments.ts`:

```typescript
import { z } from 'zod';
import { DecimalStringSchema } from './common';

export const PaymentMethodSchema = z.enum(['PIX', 'BOLETO', 'DINHEIRO', 'CARTAO', 'TRANSFERENCIA']);
export const PaymentStatusSchema = z.enum(['pending', 'received', 'refunded']);
export const PaymentPayerBlockSchema = z.enum([
  'SEGURADORA', 'COMPLEMENTO_PARTICULAR', 'FRANQUIA', 'PARTICULAR',
]);

export const PaymentSchema = z.object({
  id: z.number(),
  service_order: z.number(),
  payer_block: PaymentPayerBlockSchema,
  payer_block_display: z.string(),
  amount: DecimalStringSchema,
  method: PaymentMethodSchema,
  method_display: z.string(),
  reference: z.string(),
  received_at: z.string().nullable(),
  received_by: z.string(),
  fiscal_doc_ref: z.string(),
  status: PaymentStatusSchema,
  created_at: z.string(),
});

export type Payment = z.infer<typeof PaymentSchema>;
```

- [ ] **Step 1.5: API modules**

Create `apps/dscar-web/src/api/budgets.ts`:

```typescript
import { apiRequest } from './client';
import { BudgetReadSchema, BudgetVersionReadSchema, BudgetVersionItemReadSchema } from '../schemas/budgets';
import { PaginatedSchema } from '../schemas/common';
import { z } from 'zod';
import type { Budget, BudgetVersion, BudgetVersionItem } from '../schemas/budgets';

// Lista / Detalhe
export async function listBudgets(params: {
  search?: string;
  customer?: number;
  page?: number;
} = {}): Promise<{ count: number; results: Budget[] }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.customer) qs.set('customer', String(params.customer));
  if (params.page) qs.set('page', String(params.page));
  const data = await apiRequest<unknown>(`/budgets/?${qs.toString()}`);
  const parsed = PaginatedSchema(BudgetReadSchema).parse(data);
  return { count: parsed.count, results: parsed.results };
}

export async function getBudget(id: number): Promise<Budget> {
  const data = await apiRequest<unknown>(`/budgets/${id}/`);
  return BudgetReadSchema.parse(data);
}

// Create
export async function createBudget(input: {
  customer_id: number;
  vehicle_plate: string;
  vehicle_description: string;
}): Promise<Budget> {
  const data = await apiRequest<unknown>('/budgets/', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return BudgetReadSchema.parse(data);
}

export async function cloneBudget(id: number): Promise<Budget> {
  const data = await apiRequest<unknown>(`/budgets/${id}/clone/`, { method: 'POST' });
  return BudgetReadSchema.parse(data);
}

// Versions
export async function getBudgetVersion(budgetId: number, versionId: number): Promise<BudgetVersion> {
  const data = await apiRequest<unknown>(`/budgets/${budgetId}/versions/${versionId}/`);
  return BudgetVersionReadSchema.parse(data);
}

export async function sendBudgetVersion(budgetId: number, versionId: number): Promise<BudgetVersion> {
  const data = await apiRequest<unknown>(
    `/budgets/${budgetId}/versions/${versionId}/send/`,
    { method: 'POST' },
  );
  return BudgetVersionReadSchema.parse(data);
}

export async function approveBudgetVersion(
  budgetId: number, versionId: number,
  input: { approved_by: string; evidence_s3_key?: string },
): Promise<{ version: BudgetVersion; service_order: unknown }> {
  const data = await apiRequest<{ version: unknown; service_order: unknown }>(
    `/budgets/${budgetId}/versions/${versionId}/approve/`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return {
    version: BudgetVersionReadSchema.parse(data.version),
    service_order: data.service_order,
  };
}

export async function rejectBudgetVersion(budgetId: number, versionId: number): Promise<BudgetVersion> {
  const data = await apiRequest<unknown>(
    `/budgets/${budgetId}/versions/${versionId}/reject/`,
    { method: 'POST' },
  );
  return BudgetVersionReadSchema.parse(data);
}

export async function reviseBudgetVersion(budgetId: number, versionId: number): Promise<BudgetVersion> {
  const data = await apiRequest<unknown>(
    `/budgets/${budgetId}/versions/${versionId}/revision/`,
    { method: 'POST' },
  );
  return BudgetVersionReadSchema.parse(data);
}

export function budgetPdfUrl(budgetId: number, versionId: number): string {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
  return `${base}/budgets/${budgetId}/versions/${versionId}/pdf/`;
}

// Items
export async function createBudgetItem(
  budgetId: number, versionId: number,
  input: {
    description: string;
    quantity: string;
    unit_price: string;
    net_price: string;
    item_type?: string;
    external_code?: string;
    operations?: Array<{
      operation_type_code: string;
      labor_category_code: string;
      hours: string;
      hourly_rate: string;
    }>;
  },
): Promise<BudgetVersionItem> {
  const data = await apiRequest<unknown>(
    `/budgets/${budgetId}/versions/${versionId}/items/`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return BudgetVersionItemReadSchema.parse(data);
}

export async function deleteBudgetItem(
  budgetId: number, versionId: number, itemId: number,
): Promise<void> {
  await apiRequest<void>(
    `/budgets/${budgetId}/versions/${versionId}/items/${itemId}/`,
    { method: 'DELETE' },
  );
}
```

Create `apps/dscar-web/src/api/serviceOrdersV2.ts` (novo arquivo — coexiste com o antigo `serviceOrders.ts`):

```typescript
import { apiRequest } from './client';
import {
  ServiceOrderReadSchema, ServiceOrderEventSchema,
  ServiceOrderParecerSchema, ServiceOrderVersionSchema,
} from '../schemas/serviceOrders';
import { PaginatedSchema } from '../schemas/common';
import { z } from 'zod';
import type { ServiceOrder, ServiceOrderEvent, ServiceOrderVersion } from '../schemas/serviceOrders';

export async function listServiceOrdersV2(params: {
  search?: string;
  customer_type?: string;
  status?: string;
  page?: number;
} = {}): Promise<{ count: number; results: ServiceOrder[] }> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v));
  });
  const data = await apiRequest<unknown>(`/service-orders/?${qs.toString()}`);
  const parsed = PaginatedSchema(ServiceOrderReadSchema).parse(data);
  return { count: parsed.count, results: parsed.results };
}

export async function getServiceOrder(id: number): Promise<ServiceOrder> {
  const data = await apiRequest<unknown>(`/service-orders/${id}/`);
  return ServiceOrderReadSchema.parse(data);
}

export async function changeStatusV2(
  id: number, newStatus: string, notes?: string,
): Promise<ServiceOrder> {
  const data = await apiRequest<unknown>(
    `/service-orders/${id}/change-status/`,
    {
      method: 'POST',
      body: JSON.stringify({ new_status: newStatus, notes: notes ?? '' }),
    },
  );
  return ServiceOrderReadSchema.parse(data);
}

export async function listEvents(id: number, eventType?: string): Promise<{
  count: number; results: ServiceOrderEvent[];
}> {
  const qs = new URLSearchParams();
  if (eventType) qs.set('event_type', eventType);
  const data = await apiRequest<{ count: number; results: unknown[] }>(
    `/service-orders/${id}/events/?${qs.toString()}`,
  );
  return {
    count: data.count,
    results: data.results.map((r) => ServiceOrderEventSchema.parse(r)),
  };
}

export async function listPareceres(id: number) {
  const data = await apiRequest<unknown[]>(`/service-orders/${id}/pareceres/`);
  return z.array(ServiceOrderParecerSchema).parse(data);
}

export async function addInternalParecer(id: number, body: string, parecerType = 'COMENTARIO_INTERNO') {
  const data = await apiRequest<unknown>(
    `/service-orders/${id}/pareceres/`,
    {
      method: 'POST',
      body: JSON.stringify({ body, parecer_type: parecerType }),
    },
  );
  return ServiceOrderParecerSchema.parse(data);
}

export async function addComplement(
  id: number,
  items: Array<{
    description: string;
    quantity: string;
    unit_price: string;
    net_price: string;
    item_type?: string;
    impact_area?: number | null;
  }>,
  approvedBy: string,
): Promise<ServiceOrderVersion> {
  const data = await apiRequest<unknown>(
    `/service-orders/${id}/complement/`,
    {
      method: 'POST',
      body: JSON.stringify({ items, approved_by: approvedBy }),
    },
  );
  return ServiceOrderVersionSchema.parse(data);
}

export async function approveVersion(
  serviceOrderId: number, versionId: number,
): Promise<ServiceOrderVersion> {
  const data = await apiRequest<unknown>(
    `/service-orders/${serviceOrderId}/versions/${versionId}/approve/`,
    { method: 'POST' },
  );
  return ServiceOrderVersionSchema.parse(data);
}
```

Create `apps/dscar-web/src/api/payments.ts`:

```typescript
import { apiRequest } from './client';
import { PaymentSchema } from '../schemas/payments';
import { z } from 'zod';
import type { Payment } from '../schemas/payments';

export async function listPayments(serviceOrderId: number): Promise<{ count: number; results: Payment[] }> {
  const data = await apiRequest<{ count: number; results: unknown[] }>(
    `/service-orders/${serviceOrderId}/payments/`,
  );
  return {
    count: data.count,
    results: data.results.map((r) => PaymentSchema.parse(r)),
  };
}

export async function recordPayment(
  serviceOrderId: number,
  input: {
    payer_block: string;
    amount: string;
    method: string;
    reference?: string;
    fiscal_doc_ref?: string;
  },
): Promise<Payment> {
  const data = await apiRequest<unknown>(
    `/service-orders/${serviceOrderId}/payments/`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return PaymentSchema.parse(data);
}
```

Create `apps/dscar-web/src/api/referenceData.ts`:

```typescript
import { apiRequest } from './client';
import { PaginatedSchema, RefItemSchema } from '../schemas/common';
import type { RefItem } from '../schemas/common';

export async function listOperationTypes(): Promise<RefItem[]> {
  const data = await apiRequest<unknown>('/items/operation-types/');
  return PaginatedSchema(RefItemSchema).parse(data).results;
}

export async function listLaborCategories(): Promise<RefItem[]> {
  const data = await apiRequest<unknown>('/items/labor-categories/');
  return PaginatedSchema(RefItemSchema).parse(data).results;
}
```

- [ ] **Step 1.6: Validar build**

```bash
cd apps/dscar-web
npm install
npm run lint   # tsc --noEmit
npm run build
```

Expected: TypeScript compila sem erros.

- [ ] **Step 1.7: Commit**

```bash
git add apps/dscar-web/
git commit -m "feat(frontend): setup TanStack Query + Zod schemas + API modules (budgets, SO v2, payments)"
```

---

## Task 2: TanStack Query hooks

**Files:**
- Create: `apps/dscar-web/src/hooks/useBudget.ts`
- Create: `apps/dscar-web/src/hooks/useServiceOrderV2.ts`
- Create: `apps/dscar-web/src/hooks/useOSEvents.ts`
- Create: `apps/dscar-web/src/hooks/usePayments.ts`
- Create: `apps/dscar-web/src/hooks/useReferenceData.ts`

- [ ] **Step 2.1: useBudget**

```typescript
// apps/dscar-web/src/hooks/useBudget.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/budgets';

export const budgetKeys = {
  all: ['budgets'] as const,
  lists: () => [...budgetKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...budgetKeys.lists(), params] as const,
  details: () => [...budgetKeys.all, 'detail'] as const,
  detail: (id: number) => [...budgetKeys.details(), id] as const,
};

export function useBudgets(params: { search?: string; customer?: number; page?: number } = {}) {
  return useQuery({
    queryKey: budgetKeys.list(params),
    queryFn: () => api.listBudgets(params),
  });
}

export function useBudget(id: number | null) {
  return useQuery({
    queryKey: budgetKeys.detail(id ?? 0),
    queryFn: () => api.getBudget(id!),
    enabled: id !== null,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBudget,
    onSuccess: () => { qc.invalidateQueries({ queryKey: budgetKeys.lists() }); },
  });
}

export function useSendBudgetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, versionId }: { budgetId: number; versionId: number }) =>
      api.sendBudgetVersion(budgetId, versionId),
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) });
    },
  });
}

export function useApproveBudgetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { budgetId: number; versionId: number; approved_by: string; evidence_s3_key?: string }) =>
      api.approveBudgetVersion(input.budgetId, input.versionId, {
        approved_by: input.approved_by,
        evidence_s3_key: input.evidence_s3_key,
      }),
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) });
      qc.invalidateQueries({ queryKey: ['service-orders'] });
    },
  });
}

export function useRejectBudgetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, versionId }: { budgetId: number; versionId: number }) =>
      api.rejectBudgetVersion(budgetId, versionId),
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) });
    },
  });
}

export function useReviseBudgetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, versionId }: { budgetId: number; versionId: number }) =>
      api.reviseBudgetVersion(budgetId, versionId),
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) });
    },
  });
}

export function useCreateBudgetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.createBudgetItem>[2] & {
      budgetId: number; versionId: number;
    }) => {
      const { budgetId, versionId, ...data } = input;
      return api.createBudgetItem(budgetId, versionId, data);
    },
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) });
    },
  });
}

export function useCloneBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.cloneBudget(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: budgetKeys.lists() }); },
  });
}
```

- [ ] **Step 2.2: useServiceOrderV2**

```typescript
// apps/dscar-web/src/hooks/useServiceOrderV2.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/serviceOrdersV2';

export const soKeys = {
  all: ['service-orders'] as const,
  lists: () => [...soKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...soKeys.lists(), params] as const,
  detail: (id: number) => [...soKeys.all, 'detail', id] as const,
  events: (id: number) => [...soKeys.all, id, 'events'] as const,
  pareceres: (id: number) => [...soKeys.all, id, 'pareceres'] as const,
};

export function useServiceOrdersV2(params: {
  search?: string; customer_type?: string; status?: string; page?: number;
} = {}) {
  return useQuery({
    queryKey: soKeys.list(params),
    queryFn: () => api.listServiceOrdersV2(params),
  });
}

export function useServiceOrderV2(id: number | null) {
  return useQuery({
    queryKey: soKeys.detail(id ?? 0),
    queryFn: () => api.getServiceOrder(id!),
    enabled: id !== null,
  });
}

export function useChangeStatusV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; newStatus: string; notes?: string }) =>
      api.changeStatusV2(input.id, input.newStatus, input.notes),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: soKeys.detail(id) });
      qc.invalidateQueries({ queryKey: soKeys.events(id) });
      qc.invalidateQueries({ queryKey: soKeys.lists() });
    },
  });
}

export function useAddComplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: number;
      items: Parameters<typeof api.addComplement>[1];
      approvedBy: string;
    }) => api.addComplement(input.id, input.items, input.approvedBy),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: soKeys.detail(id) });
      qc.invalidateQueries({ queryKey: soKeys.events(id) });
    },
  });
}

export function useApproveVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { serviceOrderId: number; versionId: number }) =>
      api.approveVersion(input.serviceOrderId, input.versionId),
    onSuccess: (_, { serviceOrderId }) => {
      qc.invalidateQueries({ queryKey: soKeys.detail(serviceOrderId) });
      qc.invalidateQueries({ queryKey: soKeys.events(serviceOrderId) });
    },
  });
}
```

- [ ] **Step 2.3: useOSEvents + usePareceres**

```typescript
// apps/dscar-web/src/hooks/useOSEvents.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/serviceOrdersV2';
import { soKeys } from './useServiceOrderV2';

export function useOSEvents(id: number | null, eventType?: string) {
  return useQuery({
    queryKey: [...soKeys.events(id ?? 0), eventType ?? 'all'],
    queryFn: () => api.listEvents(id!, eventType),
    enabled: id !== null,
  });
}

export function useOSPareceres(id: number | null) {
  return useQuery({
    queryKey: soKeys.pareceres(id ?? 0),
    queryFn: () => api.listPareceres(id!),
    enabled: id !== null,
  });
}

export function useAddParecer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; body: string; parecerType?: string }) =>
      api.addInternalParecer(input.id, input.body, input.parecerType),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: soKeys.pareceres(id) });
      qc.invalidateQueries({ queryKey: soKeys.events(id) });
    },
  });
}
```

- [ ] **Step 2.4: usePayments**

```typescript
// apps/dscar-web/src/hooks/usePayments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/payments';
import { soKeys } from './useServiceOrderV2';

export function usePayments(serviceOrderId: number | null) {
  return useQuery({
    queryKey: [...soKeys.detail(serviceOrderId ?? 0), 'payments'],
    queryFn: () => api.listPayments(serviceOrderId!),
    enabled: serviceOrderId !== null,
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { serviceOrderId: number } & Parameters<typeof api.recordPayment>[1]) => {
      const { serviceOrderId, ...data } = input;
      return api.recordPayment(serviceOrderId, data);
    },
    onSuccess: (_, { serviceOrderId }) => {
      qc.invalidateQueries({ queryKey: [...soKeys.detail(serviceOrderId), 'payments'] });
      qc.invalidateQueries({ queryKey: soKeys.events(serviceOrderId) });
    },
  });
}
```

- [ ] **Step 2.5: useReferenceData**

```typescript
// apps/dscar-web/src/hooks/useReferenceData.ts
import { useQuery } from '@tanstack/react-query';
import { listOperationTypes, listLaborCategories } from '../api/referenceData';

export function useOperationTypes() {
  return useQuery({
    queryKey: ['ref', 'operation-types'],
    queryFn: listOperationTypes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLaborCategories() {
  return useQuery({
    queryKey: ['ref', 'labor-categories'],
    queryFn: listLaborCategories,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2.6: Validar build**

```bash
cd apps/dscar-web
npm run lint && npm run build
```

- [ ] **Step 2.7: Commit**

```bash
git add apps/dscar-web/src/hooks/
git commit -m "feat(frontend): TanStack Query hooks (useBudget, useServiceOrderV2, useOSEvents, usePayments, useReferenceData)"
```

---

## Task 3: Budget UI (List + Detail + Editor)

**Files:**
- Create: `apps/dscar-web/src/components/Budget/` (diretório)
- Create: `apps/dscar-web/src/components/Budget/BudgetList.tsx`
- Create: `apps/dscar-web/src/components/Budget/BudgetStatusBadge.tsx`
- Create: `apps/dscar-web/src/components/Budget/BudgetDetail.tsx`
- Create: `apps/dscar-web/src/components/Budget/BudgetItemEditor.tsx`
- Create: `apps/dscar-web/src/components/Budget/BudgetActionsPanel.tsx`
- Create: `apps/dscar-web/src/utils/format.ts` (helpers Decimal → BRL)

- [ ] **Step 3.1: Helpers de formato**

```typescript
// apps/dscar-web/src/utils/format.ts
export function formatBRL(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
```

- [ ] **Step 3.2: BudgetStatusBadge**

```tsx
// apps/dscar-web/src/components/Budget/BudgetStatusBadge.tsx
import type { BudgetVersionStatus } from '../../schemas/budgets';
import { clsx } from 'clsx';

const STATUS_STYLES: Record<BudgetVersionStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  expired: 'bg-amber-100 text-amber-700 border-amber-200',
  revision: 'bg-purple-100 text-purple-700 border-purple-200',
  superseded: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  expired: 'Expirado',
  revision: 'Em Revisão',
  superseded: 'Superado',
};

export function BudgetStatusBadge({ status }: { status: BudgetVersionStatus }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
      STATUS_STYLES[status],
    )}>
      {STATUS_LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 3.3: BudgetList**

```tsx
// apps/dscar-web/src/components/Budget/BudgetList.tsx
import { useState } from 'react';
import { Link } from '../_fallback/Link'; // ou routing nativo do App.tsx
import { useBudgets } from '../../hooks/useBudget';
import { BudgetStatusBadge } from './BudgetStatusBadge';
import { formatBRL, formatDate } from '../../utils/format';
import { Search, Plus } from 'lucide-react';

export function BudgetList() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useBudgets({ search });

  if (isLoading) {
    return <div className="p-6"><div className="animate-pulse h-8 bg-slate-200 rounded mb-2" /><div className="animate-pulse h-8 bg-slate-200 rounded" /></div>;
  }
  if (error) {
    return <div className="p-6 text-red-600">Erro: {(error as Error).message}</div>;
  }
  const budgets = data?.results ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Orçamentos</h1>
        <button className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
          <Plus size={18} /> Novo Orçamento
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número, placa, cliente..."
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
        />
      </div>

      {budgets.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Nenhum orçamento encontrado.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Veículo</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Validade</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {budgets.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-sm">{b.number}</td>
                  <td className="px-4 py-3">{b.customer_name}</td>
                  <td className="px-4 py-3 text-sm">
                    <div>{b.vehicle_description}</div>
                    <div className="text-slate-500 font-mono">{b.vehicle_plate}</div>
                  </td>
                  <td className="px-4 py-3">
                    {b.active_version && <BudgetStatusBadge status={b.active_version.status} />}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {b.active_version ? formatBRL(b.active_version.net_total) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(b.active_version?.valid_until ?? null)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

> **Atenção**: o import `Link` é placeholder — o projeto atualmente usa SPA sem router. Adaptar para usar navegação interna via state ou context em App.tsx.

- [ ] **Step 3.4: BudgetDetail (expandir para painel com items e ações)**

```tsx
// apps/dscar-web/src/components/Budget/BudgetDetail.tsx
import { useBudget } from '../../hooks/useBudget';
import { BudgetStatusBadge } from './BudgetStatusBadge';
import { BudgetActionsPanel } from './BudgetActionsPanel';
import { BudgetItemEditor } from './BudgetItemEditor';
import { formatBRL, formatDate, formatDateTime } from '../../utils/format';

export function BudgetDetail({ budgetId }: { budgetId: number }) {
  const { data: budget, isLoading, error } = useBudget(budgetId);

  if (isLoading) return <div className="p-6 animate-pulse"><div className="h-8 bg-slate-200 rounded w-64 mb-4" /><div className="h-32 bg-slate-200 rounded" /></div>;
  if (error) return <div className="p-6 text-red-600">Erro: {(error as Error).message}</div>;
  if (!budget) return <div className="p-6">Orçamento não encontrado.</div>;

  const v = budget.active_version;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{budget.number}</h1>
          <p className="text-slate-600">{budget.customer_name} · {budget.vehicle_description} · <span className="font-mono">{budget.vehicle_plate}</span></p>
          {v && <div className="mt-2"><BudgetStatusBadge status={v.status} /><span className="ml-2 text-sm text-slate-500">v{v.version_number} · criado em {formatDateTime(v.created_at)}</span></div>}
        </div>
      </div>

      {v && (
        <>
          <BudgetActionsPanel budget={budget} version={v} />

          <div className="mt-6 bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Itens</h2>
            <BudgetItemEditor budget={budget} version={v} />
          </div>

          <div className="mt-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><div className="text-slate-500">Peças</div><div className="font-semibold">{formatBRL(v.parts_total)}</div></div>
              <div><div className="text-slate-500">Mão-de-obra</div><div className="font-semibold">{formatBRL(v.labor_total)}</div></div>
              <div><div className="text-slate-500">Desconto</div><div className="font-semibold">− {formatBRL(v.discount_total)}</div></div>
              <div><div className="text-slate-500">Validade</div><div className="font-semibold">{formatDate(v.valid_until)}</div></div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-300 flex justify-between items-center">
              <span className="text-slate-600">Total</span>
              <span className="text-2xl font-bold text-red-600">{formatBRL(v.net_total)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3.5: BudgetActionsPanel (send / approve / reject / revision / PDF)**

```tsx
// apps/dscar-web/src/components/Budget/BudgetActionsPanel.tsx
import { useState } from 'react';
import type { Budget, BudgetVersion } from '../../schemas/budgets';
import {
  useSendBudgetVersion, useApproveBudgetVersion,
  useRejectBudgetVersion, useReviseBudgetVersion,
} from '../../hooks/useBudget';
import { budgetPdfUrl } from '../../api/budgets';
import { Send, Check, X, RefreshCw, FileText } from 'lucide-react';

export function BudgetActionsPanel({ budget, version }: { budget: Budget; version: BudgetVersion }) {
  const send = useSendBudgetVersion();
  const approve = useApproveBudgetVersion();
  const reject = useRejectBudgetVersion();
  const revise = useReviseBudgetVersion();
  const [approvedBy, setApprovedBy] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  const canSend = version.status === 'draft';
  const canAct = version.status === 'sent';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap gap-2">
      {canSend && (
        <button
          onClick={() => send.mutate({ budgetId: budget.id, versionId: version.id })}
          disabled={send.isPending}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={16} /> Enviar ao cliente
        </button>
      )}

      {canAct && (
        <>
          <button
            onClick={() => setShowApproveDialog(true)}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            <Check size={16} /> Aprovar
          </button>
          <button
            onClick={() => reject.mutate({ budgetId: budget.id, versionId: version.id })}
            disabled={reject.isPending}
            className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            <X size={16} /> Rejeitar
          </button>
          <button
            onClick={() => revise.mutate({ budgetId: budget.id, versionId: version.id })}
            disabled={revise.isPending}
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            <RefreshCw size={16} /> Revisão
          </button>
        </>
      )}

      {version.pdf_s3_key && (
        <a
          href={budgetPdfUrl(budget.id, version.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-md hover:bg-slate-800"
        >
          <FileText size={16} /> Ver PDF
        </a>
      )}

      {showApproveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowApproveDialog(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Aprovar orçamento</h3>
            <p className="text-sm text-slate-600 mb-3">
              Como foi aprovado pelo cliente?
            </p>
            <input
              type="text"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              placeholder="Ex: WhatsApp, presencial..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApproveDialog(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  approve.mutate({
                    budgetId: budget.id, versionId: version.id,
                    approved_by: approvedBy || 'não informado',
                  });
                  setShowApproveDialog(false);
                }}
                disabled={approve.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {approve.isPending ? 'Aprovando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(send.error ?? approve.error ?? reject.error ?? revise.error) && (
        <div className="w-full mt-2 text-sm text-red-600">
          {((send.error ?? approve.error ?? reject.error ?? revise.error) as Error).message}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3.6: BudgetItemEditor**

```tsx
// apps/dscar-web/src/components/Budget/BudgetItemEditor.tsx
import { useState } from 'react';
import type { Budget, BudgetVersion } from '../../schemas/budgets';
import { useCreateBudgetItem } from '../../hooks/useBudget';
import { useOperationTypes, useLaborCategories } from '../../hooks/useReferenceData';
import { formatBRL } from '../../utils/format';
import { Plus } from 'lucide-react';

export function BudgetItemEditor({ budget, version }: { budget: Budget; version: BudgetVersion }) {
  const readOnly = version.status !== 'draft';
  const create = useCreateBudgetItem();
  const { data: ops } = useOperationTypes();
  const { data: cats } = useLaborCategories();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    description: '', quantity: '1', unit_price: '',
    operation_type_code: 'TROCA', labor_category_code: 'FUNILARIA',
    hours: '1', hourly_rate: '40',
  });

  const addItem = () => {
    const netPrice = (parseFloat(form.quantity) * parseFloat(form.unit_price)).toFixed(2);
    create.mutate({
      budgetId: budget.id, versionId: version.id,
      description: form.description,
      quantity: form.quantity,
      unit_price: form.unit_price,
      net_price: netPrice,
      item_type: 'PART',
      operations: [{
        operation_type_code: form.operation_type_code,
        labor_category_code: form.labor_category_code,
        hours: form.hours, hourly_rate: form.hourly_rate,
      }],
    }, {
      onSuccess: () => {
        setShowForm(false);
        setForm({ ...form, description: '', unit_price: '' });
      },
    });
  };

  return (
    <div>
      {version.items.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">Nenhum item adicionado ainda.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {version.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div>
                <div className="font-medium">{item.description}</div>
                <div className="text-xs text-slate-500">
                  {item.quantity} × {formatBRL(item.unit_price)}
                  {item.operations.map((op) => (
                    <span key={op.id} className="ml-2">
                      · {op.operation_type.label}/{op.labor_category.label} {op.hours}h
                    </span>
                  ))}
                </div>
              </div>
              <div className="font-semibold">{formatBRL(item.net_price)}</div>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 text-red-600 hover:text-red-800 font-medium"
            >
              <Plus size={16} /> Adicionar item
            </button>
          ) : (
            <div className="border border-slate-200 rounded-md p-4 bg-slate-50 space-y-3">
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição (ex: AMORTECEDOR DIANT ESQ)"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="Qtd" className="px-3 py-2 border border-slate-300 rounded-md" />
                <input type="text" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} placeholder="Preço unit." className="px-3 py-2 border border-slate-300 rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={form.operation_type_code} onChange={(e) => setForm({ ...form, operation_type_code: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
                  {ops?.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                </select>
                <select value={form.labor_category_code} onChange={(e) => setForm({ ...form, labor_category_code: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
                  {cats?.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="Horas MO" className="px-3 py-2 border border-slate-300 rounded-md" />
                <input type="text" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} placeholder="Valor/h" className="px-3 py-2 border border-slate-300 rounded-md" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md">Cancelar</button>
                <button onClick={addItem} disabled={create.isPending || !form.description} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                  {create.isPending ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
              {create.error && <div className="text-sm text-red-600">{(create.error as Error).message}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3.7: Validar**

```bash
cd apps/dscar-web
npm run lint && npm run build
```

- [ ] **Step 3.8: Commit**

```bash
git add apps/dscar-web/
git commit -m "feat(frontend): Budget UI completa (List + Detail + Editor + ActionsPanel + StatusBadge)"
```

---

## Task 4: OS V2 UI

**Files:**
- Create: `apps/dscar-web/src/components/ServiceOrderV2/OSDetailV2.tsx`
- Create: `apps/dscar-web/src/components/ServiceOrderV2/OSTimeline.tsx`
- Create: `apps/dscar-web/src/components/ServiceOrderV2/OSVersionsTab.tsx`
- Create: `apps/dscar-web/src/components/ServiceOrderV2/OSPaymentsTab.tsx`
- Create: `apps/dscar-web/src/components/ServiceOrderV2/OSComplementForm.tsx`

- [ ] **Step 4.1: OSDetailV2 (tabs)**

```tsx
// apps/dscar-web/src/components/ServiceOrderV2/OSDetailV2.tsx
import { useState } from 'react';
import { useServiceOrderV2, useChangeStatusV2 } from '../../hooks/useServiceOrderV2';
import { OSTimeline } from './OSTimeline';
import { OSVersionsTab } from './OSVersionsTab';
import { OSPaymentsTab } from './OSPaymentsTab';
import { OSComplementForm } from './OSComplementForm';
import { formatBRL } from '../../utils/format';

type Tab = 'versions' | 'timeline' | 'payments' | 'complement';

export function OSDetailV2({ osId }: { osId: number }) {
  const { data: os, isLoading, error } = useServiceOrderV2(osId);
  const [tab, setTab] = useState<Tab>('versions');
  const changeStatus = useChangeStatusV2();

  if (isLoading) return <div className="p-6 animate-pulse"><div className="h-8 bg-slate-200 rounded w-64 mb-4" /><div className="h-48 bg-slate-200 rounded" /></div>;
  if (error) return <div className="p-6 text-red-600">Erro: {(error as Error).message}</div>;
  if (!os) return <div className="p-6">OS não encontrada.</div>;

  const v = os.active_version;
  const isSeguradora = os.customer_type === 'SEGURADORA';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{os.os_number}</h1>
          <p className="text-slate-600">
            {os.customer_name} · {os.vehicle_description} · <span className="font-mono">{os.vehicle_plate}</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
              isSeguradora ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
            }`}>
              {os.customer_type}
            </span>
            {isSeguradora && <span className="text-sm text-slate-500">{os.insurer_name} · Sinistro {os.casualty_number}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-500">Status Kanban</div>
          <div className="text-lg font-semibold">{os.status_display}</div>
          {v && <div className="text-xl font-bold text-red-600 mt-1">{formatBRL(v.net_total)}</div>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-4">
        {(['versions', 'timeline', 'payments', 'complement'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              tab === t ? 'border-red-600 text-red-600' : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            {t === 'versions' ? 'Versões' : t === 'timeline' ? 'Timeline' : t === 'payments' ? 'Pagamentos' : 'Complemento'}
          </button>
        ))}
      </div>

      {tab === 'versions' && <OSVersionsTab osId={osId} version={v} />}
      {tab === 'timeline' && <OSTimeline osId={osId} />}
      {tab === 'payments' && <OSPaymentsTab osId={osId} />}
      {tab === 'complement' && isSeguradora && <OSComplementForm osId={osId} />}
      {tab === 'complement' && !isSeguradora && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          Complemento particular só se aplica a OS de seguradora.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4.2: OSTimeline**

```tsx
// apps/dscar-web/src/components/ServiceOrderV2/OSTimeline.tsx
import { useOSEvents } from '../../hooks/useOSEvents';
import { formatDateTime } from '../../utils/format';
import {
  ArrowRight, FileText, Zap, Plus, Minus, Edit,
  Download, MessageSquare, Image, DollarSign, Receipt, PenTool, Link as LinkIcon,
} from 'lucide-react';
import type { EventType } from '../../schemas/serviceOrders';

const EVENT_ICONS: Record<EventType, typeof ArrowRight> = {
  STATUS_CHANGE: ArrowRight,
  AUTO_TRANSITION: Zap,
  VERSION_CREATED: Plus,
  VERSION_APPROVED: FileText,
  VERSION_REJECTED: Minus,
  ITEM_ADDED: Plus,
  ITEM_REMOVED: Minus,
  ITEM_EDITED: Edit,
  IMPORT_RECEIVED: Download,
  PARECER_ADDED: MessageSquare,
  PHOTO_UPLOADED: Image,
  PHOTO_REMOVED: Image,
  PAYMENT_RECORDED: DollarSign,
  FISCAL_ISSUED: Receipt,
  SIGNATURE_CAPTURED: PenTool,
  BUDGET_LINKED: LinkIcon,
};

export function OSTimeline({ osId }: { osId: number }) {
  const { data, isLoading, error } = useOSEvents(osId);

  if (isLoading) return <div className="animate-pulse space-y-2"><div className="h-12 bg-slate-200 rounded" /><div className="h-12 bg-slate-200 rounded" /></div>;
  if (error) return <div className="text-red-600">Erro: {(error as Error).message}</div>;
  if (!data || data.count === 0) return <div className="text-slate-500">Nenhum evento registrado.</div>;

  return (
    <div className="space-y-2">
      {data.results.map((ev) => {
        const Icon = EVENT_ICONS[ev.event_type];
        return (
          <div key={ev.id} className="flex gap-3 p-3 bg-white border border-slate-200 rounded">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <div className="font-medium text-slate-800">{ev.event_type_display}</div>
                <div className="text-xs text-slate-500">{formatDateTime(ev.created_at)}</div>
              </div>
              <div className="text-sm text-slate-600">
                Por <span className="font-medium">{ev.actor}</span>
                {ev.from_state && ev.to_state && (
                  <> · <span className="font-mono">{ev.from_state}</span> → <span className="font-mono">{ev.to_state}</span></>
                )}
              </div>
              {Object.keys(ev.payload).length > 0 && (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-700">detalhes</summary>
                  <pre className="mt-1 bg-slate-50 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(ev.payload, null, 2)}</pre>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4.3: OSVersionsTab**

```tsx
// apps/dscar-web/src/components/ServiceOrderV2/OSVersionsTab.tsx
import type { ServiceOrderVersion } from '../../schemas/serviceOrders';
import { useServiceOrderV2, useApproveVersion } from '../../hooks/useServiceOrderV2';
import { formatBRL, formatDateTime } from '../../utils/format';

export function OSVersionsTab({ osId, version }: { osId: number; version: ServiceOrderVersion | null }) {
  const approve = useApproveVersion();

  if (!version) {
    return <div className="text-slate-500">OS ainda sem versão ativa.</div>;
  }

  const needsApproval = version.status === 'em_analise' || version.status === 'pending' || version.status === 'analisado';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-lg font-semibold text-slate-800">{version.status_label}</div>
            <div className="text-sm text-slate-500">
              Fonte: {version.source} · criada em {formatDateTime(version.created_at)}
            </div>
          </div>
          {needsApproval && (
            <button
              onClick={() => approve.mutate({ serviceOrderId: osId, versionId: version.id })}
              disabled={approve.isPending}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {approve.isPending ? 'Aprovando...' : 'Aprovar versão'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div><div className="text-xs text-slate-500">Seguradora</div><div className="font-semibold">{formatBRL(version.total_seguradora)}</div></div>
          <div><div className="text-xs text-slate-500">Complemento</div><div className="font-semibold">{formatBRL(version.total_complemento_particular)}</div></div>
          <div><div className="text-xs text-slate-500">Franquia</div><div className="font-semibold">{formatBRL(version.total_franquia)}</div></div>
          <div><div className="text-xs text-slate-500">Total</div><div className="font-bold text-red-600">{formatBRL(version.net_total)}</div></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Itens da versão</h3>
        {version.items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum item.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="text-left pb-2">Item</th>
                <th className="text-left pb-2">Bloco</th>
                <th className="text-right pb-2">Qtd</th>
                <th className="text-right pb-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {version.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2">
                    <div className="font-medium">{item.description}</div>
                    {item.external_code && <div className="text-xs text-slate-500 font-mono">{item.external_code}</div>}
                  </td>
                  <td className="py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      item.payer_block === 'SEGURADORA' ? 'bg-blue-100 text-blue-700' :
                      item.payer_block === 'COMPLEMENTO_PARTICULAR' ? 'bg-purple-100 text-purple-700' :
                      item.payer_block === 'FRANQUIA' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {item.payer_block}
                    </span>
                  </td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right font-semibold">{formatBRL(item.net_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4.4: OSPaymentsTab**

```tsx
// apps/dscar-web/src/components/ServiceOrderV2/OSPaymentsTab.tsx
import { useState } from 'react';
import { usePayments, useRecordPayment } from '../../hooks/usePayments';
import { formatBRL, formatDateTime } from '../../utils/format';

export function OSPaymentsTab({ osId }: { osId: number }) {
  const { data, isLoading } = usePayments(osId);
  const record = useRecordPayment();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    payer_block: 'PARTICULAR', amount: '', method: 'PIX', reference: '',
  });

  const submit = () => {
    record.mutate({
      serviceOrderId: osId, ...form,
    }, {
      onSuccess: () => {
        setShowForm(false);
        setForm({ payer_block: 'PARTICULAR', amount: '', method: 'PIX', reference: '' });
      },
    });
  };

  if (isLoading) return <div className="animate-pulse h-24 bg-slate-200 rounded" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Pagamentos registrados</h3>
        <button onClick={() => setShowForm(!showForm)} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
          + Registrar pagamento
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.payer_block} onChange={(e) => setForm({ ...form, payer_block: e.target.value })} className="px-3 py-2 border border-slate-300 rounded">
              <option value="PARTICULAR">Particular</option>
              <option value="SEGURADORA">Seguradora</option>
              <option value="COMPLEMENTO_PARTICULAR">Complemento Particular</option>
              <option value="FRANQUIA">Franquia</option>
            </select>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="px-3 py-2 border border-slate-300 rounded">
              <option value="PIX">Pix</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CARTAO">Cartão</option>
              <option value="BOLETO">Boleto</option>
              <option value="TRANSFERENCIA">Transferência</option>
            </select>
          </div>
          <input type="text" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Valor (ex: 1000.50)" className="w-full px-3 py-2 border border-slate-300 rounded" />
          <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Referência (opcional)" className="w-full px-3 py-2 border border-slate-300 rounded" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600">Cancelar</button>
            <button onClick={submit} disabled={record.isPending || !form.amount} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50">
              {record.isPending ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
          {record.error && <div className="text-sm text-red-600">{(record.error as Error).message}</div>}
        </div>
      )}

      {!data?.count ? (
        <div className="text-slate-500 text-center py-8">Nenhum pagamento registrado.</div>
      ) : (
        <div className="space-y-2">
          {data.results.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded p-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{p.method_display} · {p.payer_block_display}</div>
                <div className="text-xs text-slate-500">{formatDateTime(p.received_at)}{p.reference && ` · ${p.reference}`}</div>
              </div>
              <div className="text-lg font-bold text-green-600">{formatBRL(p.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4.5: OSComplementForm**

```tsx
// apps/dscar-web/src/components/ServiceOrderV2/OSComplementForm.tsx
import { useState } from 'react';
import { useAddComplement } from '../../hooks/useServiceOrderV2';
import { Plus, Trash2 } from 'lucide-react';
import { formatBRL } from '../../utils/format';

interface ComplementItemDraft {
  description: string;
  quantity: string;
  unit_price: string;
  item_type: string;
}

export function OSComplementForm({ osId }: { osId: number }) {
  const add = useAddComplement();
  const [items, setItems] = useState<ComplementItemDraft[]>([]);
  const [newItem, setNewItem] = useState<ComplementItemDraft>({
    description: '', quantity: '1', unit_price: '', item_type: 'SERVICE',
  });

  const total = items.reduce((sum, i) =>
    sum + (parseFloat(i.quantity || '0') * parseFloat(i.unit_price || '0')), 0,
  );

  const addItemToList = () => {
    if (newItem.description && newItem.unit_price) {
      setItems([...items, newItem]);
      setNewItem({ description: '', quantity: '1', unit_price: '', item_type: 'SERVICE' });
    }
  };

  const submit = () => {
    const payload = items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      net_price: (parseFloat(i.quantity) * parseFloat(i.unit_price)).toFixed(2),
      item_type: i.item_type,
    }));
    add.mutate({ id: osId, items: payload, approvedBy: 'cliente' }, {
      onSuccess: () => setItems([]),
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
        O complemento adiciona itens cobrados do cliente (fora da cobertura da seguradora), criando nova versão da OS.
      </div>

      <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
        <h3 className="font-semibold">Adicionar item de complemento</h3>
        <input
          type="text" value={newItem.description}
          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
          placeholder="Descrição (ex: Pintura extra em roda)"
          className="w-full px-3 py-2 border border-slate-300 rounded"
        />
        <div className="grid grid-cols-3 gap-3">
          <input type="text" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} placeholder="Qtd" className="px-3 py-2 border border-slate-300 rounded" />
          <input type="text" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} placeholder="Preço unit." className="px-3 py-2 border border-slate-300 rounded" />
          <select value={newItem.item_type} onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })} className="px-3 py-2 border border-slate-300 rounded">
            <option value="SERVICE">Serviço</option>
            <option value="PART">Peça</option>
            <option value="EXTERNAL_SERVICE">Serviço Terceiro</option>
            <option value="FEE">Taxa</option>
          </select>
        </div>
        <button onClick={addItemToList} disabled={!newItem.description || !newItem.unit_price} className="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2">
          <Plus size={16} /> Adicionar ao lote
        </button>
      </div>

      {items.length > 0 && (
        <div className="bg-white border border-slate-200 rounded p-4">
          <h3 className="font-semibold mb-3">Itens a adicionar ({items.length})</h3>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100">
                <div className="flex-1">
                  <div className="font-medium">{item.description}</div>
                  <div className="text-xs text-slate-500">{item.quantity} × {formatBRL(item.unit_price)}</div>
                </div>
                <div className="font-semibold">{formatBRL((parseFloat(item.quantity) * parseFloat(item.unit_price)).toFixed(2))}</div>
                <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="ml-3 text-red-500 hover:text-red-700">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
            <span className="font-semibold">Total complemento</span>
            <span className="text-xl font-bold text-red-600">{formatBRL(total.toFixed(2))}</span>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={submit} disabled={add.isPending} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50">
              {add.isPending ? 'Adicionando...' : 'Confirmar complemento'}
            </button>
          </div>
          {add.error && <div className="mt-2 text-sm text-red-600">{(add.error as Error).message}</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4.6: Validar + commit**

```bash
cd apps/dscar-web
npm run lint && npm run build
git add apps/dscar-web/src/components/ServiceOrderV2/
git commit -m "feat(frontend): OS V2 UI (DetailV2 com tabs, Timeline, VersionsTab, PaymentsTab, ComplementForm)"
```

---

## Task 5: Kanban real + mockData retirement + smoke + docs

**Files:**
- Modify: `apps/dscar-web/src/hooks/useServiceOrders.ts` (substituir mock por V2 interno)
- Modify: `apps/dscar-web/src/components/Kanban.tsx` (usar hooks V2)
- Modify: `apps/dscar-web/src/App.tsx` (integrar novas views)
- Create: `apps/dscar-web/src/App.tsx` routing simples pra Budget/OS V2
- Modify: `apps/dscar-web/.env.example` (VITE_USE_MOCK_DATA=false default)
- Create: `apps/dscar-web/src/__smoke__/smoke_ciclo3b.md` (roteiro manual)
- Modify: `backend/core/MVP_CHECKLIST.md`

- [ ] **Step 5.1: App.tsx routing simples**

Adicionar estado local em `App.tsx` pra alternar entre views (o projeto usa SPA sem router):

```tsx
// Adicionar em App.tsx — state de view + componentes novos
import { useState } from 'react';
import { BudgetList } from './components/Budget/BudgetList';
import { BudgetDetail } from './components/Budget/BudgetDetail';
import { OSDetailV2 } from './components/ServiceOrderV2/OSDetailV2';
// ...

type View =
  | { name: 'budgets' }
  | { name: 'budget-detail'; id: number }
  | { name: 'os-v2'; id: number };

// No App component:
const [view, setView] = useState<View>({ name: 'budgets' });

// No render:
if (view.name === 'budgets') return <BudgetList onOpen={(id) => setView({ name: 'budget-detail', id })} />;
if (view.name === 'budget-detail') return <BudgetDetail budgetId={view.id} />;
if (view.name === 'os-v2') return <OSDetailV2 osId={view.id} />;
```

Adaptar conforme estrutura real do App.tsx existente. Se já tem sistema de navegação (Sidebar, etc), integrar com ele.

- [ ] **Step 5.2: Kanban real usando hooks V2**

Refactor `apps/dscar-web/src/components/Kanban.tsx` pra usar `useServiceOrdersV2` + `useChangeStatusV2` em vez de `useServiceOrders` mock. Manter props/interface similar.

Pode fazer gradualmente: criar `KanbanV2.tsx` novo e deixar Kanban antigo até retirada completa do mock.

- [ ] **Step 5.3: `.env` default**

Criar/atualizar `apps/dscar-web/.env.example`:
```
VITE_API_URL=http://localhost:8000/api/v1
VITE_USE_MOCK_DATA=false
```

- [ ] **Step 5.4: Smoke roteiro manual**

Create `apps/dscar-web/src/__smoke__/smoke_ciclo3b.md`:

````markdown
# Smoke Ciclo 03B — Frontend

## Setup
1. Backend rodando: `cd backend/core && python manage.py runserver`
2. Frontend: `cd apps/dscar-web && npm run dev`
3. Browser: http://localhost:3000

## Fluxo a validar

1. [ ] Login JWT funciona (credenciais válidas)
2. [ ] Lista de Orçamentos carrega (vazia OK)
3. [ ] Criar novo Orçamento
4. [ ] Abrir detalhe — ver versão v1 draft
5. [ ] Adicionar item com operação
6. [ ] Enviar ao cliente (send) — status muda pra "sent", PDF gerado
7. [ ] Abrir PDF em nova aba (download real)
8. [ ] Aprovar com evidence — cria OS
9. [ ] Ver OS V2 criada automaticamente
10. [ ] Timeline da OS mostra eventos BUDGET_LINKED + VERSION_CREATED
11. [ ] Mover OS no Kanban — timeline atualizada
12. [ ] Registrar pagamento — aparece em Payments tab
13. [ ] TanStack DevTools aberto (canto inferior) mostra queries/mutations
````

- [ ] **Step 5.5: Atualizar docs**

Update `backend/core/MVP_CHECKLIST.md`:

```markdown
## Entregue no Ciclo 06 — Frontend Integration (03B)

- [x] TanStack Query v5 + Zod schemas espelhando API
- [x] API modules: budgets, serviceOrdersV2, payments, referenceData
- [x] Hooks: useBudget (+ mutations), useServiceOrderV2, useOSEvents, usePayments, useReferenceData
- [x] Budget UI completa: List, Detail, Editor, ActionsPanel, StatusBadge
- [x] OS V2 UI: DetailV2 com 4 tabs (Versões, Timeline, Payments, Complement), VersionsTab, ComplementForm
- [x] Kanban conectado à API real (KanbanV2)
- [x] mockData.ts retirado / marcado deprecated
- [x] Smoke manual documentado em apps/dscar-web/src/__smoke__/

## Próximo — Ciclo 04: Importadores Seguradora
- [ ] CiliaImporter (polling Celery)
- [ ] XmlIfxImporter (Porto/Azul/Itaú)
- [ ] HdiImporter (HTML upload)
```

- [ ] **Step 5.6: Commit final**

```bash
git add apps/ backend/core/MVP_CHECKLIST.md
git commit -m "chore(ciclo-03b): Kanban real + smoke manual + checklist — frontend conectado à API"
```

---

## Verificação final

- [ ] `cd apps/dscar-web && npm run lint && npm run build` passa
- [ ] Smoke manual executado com sucesso em dev
- [ ] `git log --oneline | head -7` mostra commits do Ciclo 03B
- [ ] DevTools TanStack Query funciona no browser

---

## Notas pro Ciclo 04 (Importadores)

Os hooks `useServiceOrderV2` + events já estão prontos pra consumir dados vindos de:
- Cilia polling (Celery beat)
- HDI HTML upload
- XML Porto/Azul/Itaú upload

O frontend precisará apenas de:
- Novo componente `ImportUploader.tsx` (dropzone)
- Novo endpoint backend `/api/v1/imports/upload/`
- Auto-refresh do OS detail quando import cria nova versão (já coberto por `invalidateQueries`)

**Fim do plano Ciclo 03B.**
