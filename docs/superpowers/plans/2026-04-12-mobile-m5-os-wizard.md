# Sprint M5 — Abertura de OS no Mobile (Wizard 4 Steps)

> **For agentic workers:** Use superpowers:subagent-driven-development to execute task-by-task.
> Tasks are **sequential** (each depends on the previous).

**Goal:** Replace the placeholder `nova-os/index.tsx` screen with a full 4-step OS creation wizard:
Step 1 Veículo → Step 2 Cliente → Step 3 Tipo OS → Step 4 Revisão → Criação (online/offline).

**Codebase:** `apps/mobile/` (React Native + Expo SDK 55, WatermelonDB, Zustand, MMKV)
**Branch:** main

---

## Context (for all tasks)

### Stack
- React Native 0.83.4 · Expo SDK 55 · Expo Router v4
- WatermelonDB 0.28 (offline DB, LokiJS adapter in Expo Go / SQLite in native)
- Zustand 5 + MMKV 3.2 (stores + cache)
- TypeScript strict (no `any`, explicit return types)
- StyleSheet.create (no NativeWind/Tailwind)

### Existing patterns to follow

**MMKV init (always use try/catch — fails silently in Expo Go):**
```typescript
let _mmkv: MMKV | null = null;
try { _mmkv = new MMKV({ id: 'store-id' }); } catch { _mmkv = null; }
function getCache<T>(key: string): T | null {
  try { const v = _mmkv?.getString(key); return v ? (JSON.parse(v) as T) : null; }
  catch { return null; }
}
function setCache<T>(key: string, value: T): void {
  try { _mmkv?.set(key, JSON.stringify(value)); } catch {}
}
```

**WatermelonDB write:**
```typescript
await database.write(async () => {
  await database.get<ServiceOrder>('service_orders').create((record) => {
    record.remoteId = uuid;  // temp UUID until backend synced
    record.number = 0;       // backend assigns real number
    record.status = 'reception';
    // ...
  });
});
```

**API client (always trailing slash, Django APPEND_SLASH=True):**
```typescript
import { api } from '@/lib/api';
const result = await api.post<ServiceOrderAPI>('/service-orders/', payload);
```

**Connectivity:**
```typescript
import { useConnectivity } from '@/hooks/useConnectivity';
const isOnline = useConnectivity();
```

**Zustand store pattern:**
```typescript
import { create } from 'zustand';
interface MyState { ... }
export const useMyStore = create<MyState>()((set) => ({ ... }));
```

### File paths (key existing files)
- `apps/mobile/src/db/schema.ts` — WatermelonDB schema (currently v2)
- `apps/mobile/src/db/migrations.ts` — migration list
- `apps/mobile/src/db/models/ServiceOrder.ts` — model class
- `apps/mobile/src/db/index.ts` — database init (LokiJS vs SQLite)
- `apps/mobile/src/db/sync.ts` — syncServiceOrders() + pushChanges (currently no-op)
- `apps/mobile/src/lib/api.ts` — API client
- `apps/mobile/src/stores/auth.store.ts` — user, token, activeCompany
- `apps/mobile/src/hooks/useConnectivity.ts` — returns boolean
- `apps/mobile/app/(app)/nova-os/index.tsx` — PLACEHOLDER (replace in Task 3)
- `apps/mobile/app/(app)/_layout.tsx` — tab navigator

### ServiceOrder schema fields (current v2)
```
remote_id (string, indexed), number (number), status (string, indexed),
customer_name (string), vehicle_plate (string, indexed),
vehicle_model (string), vehicle_brand (string), vehicle_year (number, optional),
vehicle_color (string, optional), customer_type (string),
os_type (string), consultant_name (string, optional),
total_parts (number), total_services (number),
created_at_remote (number), updated_at_remote (number), synced_at (number)
```

### Status values (11 total)
`reception | initial_survey | budget | waiting_approval | approved | in_progress | waiting_parts | final_survey | ready | delivered | cancelled`

### OS types & customer types
```typescript
type CustomerType = 'insurer' | 'private';
type OSType = 'bodywork' | 'warranty' | 'rework' | 'mechanical' | 'aesthetic';
```

### placa-fipe API (free, no key required)
```
POST https://placa-fipe.apibrasil.com.br/placa/consulta
Content-Type: application/json
Body: { "placa": "ABC1234" }

Response (success):
{
  "placa": "ABC1234",
  "marca": "HONDA",
  "modelo": "CIVIC",
  "submodelo": "EXL",
  "ano": "2019",
  "cor": "PRATA",
  "chassi": "9BGRK...",
  "municipio": "MANAUS",
  "uf": "AM"
}
// On failure or unknown plate: { "placa": "ABC1234", "error": "..." } or similar
```

### Backend customer search API
```
GET /api/v1/customers/search/?q=<query>
Response: Array<{ id: string; name: string; cpf_masked: string; phone_masked: string; }>
```
Use `api.get<CustomerSearchResult[]>('/customers/search/', { params: { q: query } })` — or append query string manually since `api.get` may not support params.

### Text component (custom, not RN default)
```typescript
import { Text } from '@/components/ui/Text';
// variants: heading2 | heading3 | label | body | bodySmall | caption
<Text variant="heading3">...</Text>
```

### Existing UI components
```
@/components/ui/Button — variants: primary | secondary | ghost | danger
@/components/ui/Text — typography
@/components/ui/Card — container
```

---

## Task 1: Data Layer — Schema v3 + Hooks

**Status:** - [ ]
**Files to create/modify:**
- MODIFY `apps/mobile/src/db/schema.ts`
- MODIFY `apps/mobile/src/db/migrations.ts`
- MODIFY `apps/mobile/src/db/models/ServiceOrder.ts`
- MODIFY `apps/mobile/src/db/sync.ts`
- CREATE `apps/mobile/src/hooks/useVehicleByPlate.ts`
- CREATE `apps/mobile/src/hooks/useCustomerSearch.ts`
- CREATE `apps/mobile/src/hooks/useCreateServiceOrder.ts`

### 1A. Schema v3 migration — add `push_status` column

In `schema.ts`, increment `version` from 2 → 3 and add to `service_orders` table:
```typescript
{ name: 'push_status', type: 'string', isOptional: true },
// values: 'pending' | 'synced' | 'error' | null
// 'pending' = created offline, not yet POSTed to API
// 'synced' = exists in backend (has real remote_id from API)
// null = pulled from API (never a locally-created record)
```

In `migrations.ts`, add migration from v2 → v3:
```typescript
addMigration({
  toVersion: 3,
  steps: [
    addColumns({
      table: 'service_orders',
      columns: [{ name: 'push_status', type: 'string', isOptional: true }],
    }),
  ],
}),
```

In `models/ServiceOrder.ts`, add field:
```typescript
@field('push_status') pushStatus!: string | null;
```

### 1B. Push sync in sync.ts

Replace the no-op `pushChanges` with an implementation that:
1. Reads `changes.service_orders.created` from WatermelonDB (these are locally-created records)
2. For each record, checks its `push_status` field
3. Only processes records where `pushStatus === 'pending'`
4. POSTs each to `POST /api/v1/service-orders/` via fetch (not `api.ts`) to avoid circular deps
5. On success: updates the local record — sets `remoteId` to backend-returned `id`, sets `pushStatus` to `'synced'`, sets `number` to backend-returned `number`
6. On failure: sets `pushStatus` to `'error'`, logs warning — does NOT throw (partial failure ok)

**Implementation:**
```typescript
pushChanges: async ({ changes }) => {
  const created = changes.service_orders?.created ?? [];
  for (const raw of created) {
    if (raw.push_status !== 'pending') continue;
    try {
      const token = authStore.getState().token;
      const company = authStore.getState().activeCompany;
      const res = await fetch(`${API_BASE_URL}/api/v1/service-orders/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Domain': `${company}.localhost`,
        },
        body: JSON.stringify({
          customer_name: raw.customer_name,
          vehicle_plate: raw.vehicle_plate,
          vehicle_model: raw.vehicle_model,
          vehicle_brand: raw.vehicle_brand,
          vehicle_year: raw.vehicle_year ?? null,
          vehicle_color: raw.vehicle_color ?? null,
          customer_type: raw.customer_type,
          os_type: raw.os_type,
          status: 'reception',
        }),
      });
      if (res.ok) {
        const data = await res.json() as { id: string; number: number };
        const collection = database.get<ServiceOrder>('service_orders');
        const record = await collection.query(Q.where('remote_id', raw.remote_id)).fetch();
        if (record[0]) {
          await database.write(async () => {
            await record[0].update((r) => {
              r.remoteId = data.id;
              r.number = data.number;
              r.pushStatus = 'synced';
            });
          });
        }
      } else {
        // Mark as error so user can retry
        const collection = database.get<ServiceOrder>('service_orders');
        const record = await collection.query(Q.where('remote_id', raw.remote_id)).fetch();
        if (record[0]) {
          await database.write(async () => {
            await record[0].update((r) => { r.pushStatus = 'error'; });
          });
        }
      }
    } catch (err) {
      console.warn('Push sync error for OS:', raw.remote_id, err);
    }
  }
},
```

Import needed: `import { useAuthStore } from '@/stores/auth.store';` — but since sync runs outside hooks, use the store directly: `const token = useAuthStore.getState().token;`

### 1C. useVehicleByPlate hook

Create `apps/mobile/src/hooks/useVehicleByPlate.ts`:

```typescript
export interface VehicleInfo {
  plate: string;
  brand: string;    // marca
  model: string;    // modelo
  submodel: string; // submodelo
  year: number;     // ano (parse to int)
  color: string;    // cor
  chassi?: string;
}

export function useVehicleByPlate(): {
  lookup: (plate: string) => Promise<VehicleInfo | null>;
  isLoading: boolean;
  error: string | null;
}
```

Implementation:
- Normalizes plate: uppercase, remove hyphens/spaces, trim
- **Cache first:** check MMKV key `vehicle_plate_<normalized>` — if found and < 7 days old, return cached
- **If online:** POST to `https://placa-fipe.apibrasil.com.br/placa/consulta` with `{ placa: normalized }`
  - On success: parse response, store in MMKV with timestamp, return VehicleInfo
  - On failure (network or API error): return null, set error message
- **If offline:** return cached data if available, else return null
- Cache max 50 entries (MMKV key `vehicle_plate_keys` holds array of recent plates, trim if > 50)
- `isLoading` is true while fetch is in progress
- `error` is null on success, human-readable string on failure

### 1D. useCustomerSearch hook

Create `apps/mobile/src/hooks/useCustomerSearch.ts`:

```typescript
export interface CustomerSearchResult {
  id: string;
  name: string;
  cpf_masked: string;
  phone_masked: string;
}

export function useCustomerSearch(): {
  results: CustomerSearchResult[];
  isLoading: boolean;
  search: (query: string) => void;
  clear: () => void;
}
```

Implementation:
- Debounces query 400ms before firing (use `useEffect` + `setTimeout`)
- Only fires if query.trim().length >= 2
- **Online:** `GET /api/v1/customers/search/?q=<query>` via `api.get` (build URL manually: `/customers/search/?q=${encodeURIComponent(query)}`)
- **Offline or query < 2 chars:** empty results
- On error: empty results + console.warn
- `clear()` resets results and query
- TypeScript strict, no `any`

### 1E. useCreateServiceOrder hook

Create `apps/mobile/src/hooks/useCreateServiceOrder.ts`:

```typescript
export interface CreateOSPayload {
  customerName: string;
  customerId?: string;      // UUID from customer search (optional — may not exist yet)
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear?: number;
  vehicleColor?: string;
  customerType: 'insurer' | 'private';
  osType: 'bodywork' | 'warranty' | 'rework' | 'mechanical' | 'aesthetic';
  insurerName?: string;     // if customerType === 'insurer'
  claimNumber?: string;     // número do sinistro
  deductible?: number;      // franquia
}

export interface CreateOSResult {
  localId: string;    // WatermelonDB record ID (for immediate navigation)
  remoteId: string;   // same as localId if offline (temp UUID); real ID if online
  number: number;     // 0 if offline, real number if online
  isOffline: boolean;
}

export function useCreateServiceOrder(): {
  create: (payload: CreateOSPayload) => Promise<CreateOSResult>;
  isCreating: boolean;
  error: string | null;
}
```

Implementation:
- `isCreating` starts false, set true during operation
- **If online:**
  1. POST to `/api/v1/service-orders/` with payload
  2. On success: write to WatermelonDB with `pushStatus = 'synced'`, real `remoteId` and `number`
  3. Return `{ localId: record.id, remoteId: data.id, number: data.number, isOffline: false }`
  4. On API failure: fall through to offline path
- **If offline (or online POST failed):**
  1. Generate `tempId = crypto.randomUUID()` (or `Math.random().toString(36).substr(2, 9)` if unavailable)
  2. Write to WatermelonDB: `remoteId = tempId`, `number = 0`, `pushStatus = 'pending'`, `status = 'reception'`
  3. Return `{ localId: record.id, remoteId: tempId, number: 0, isOffline: true }`
- Sets `error` on unrecoverable failure
- Import `useConnectivity` to check online status
- Import `database` from `@/db/index`

---

## Task 2: Wizard State Store + Step Components

**Status:** - [ ]
**Depends on:** Task 1 (imports hooks from Task 1)
**Files to create:**
- CREATE `apps/mobile/src/stores/new-os.store.ts`
- CREATE `apps/mobile/src/components/nova-os/Step1Vehicle.tsx`
- CREATE `apps/mobile/src/components/nova-os/Step2Customer.tsx`
- CREATE `apps/mobile/src/components/nova-os/Step3OSType.tsx`
- CREATE `apps/mobile/src/components/nova-os/Step4Review.tsx`

### 2A. New OS Wizard Store

Create `apps/mobile/src/stores/new-os.store.ts`:

```typescript
import { create } from 'zustand';
import type { VehicleInfo } from '@/hooks/useVehicleByPlate';
import type { CustomerSearchResult } from '@/hooks/useCustomerSearch';

type CustomerType = 'insurer' | 'private';
type OSType = 'bodywork' | 'warranty' | 'rework' | 'mechanical' | 'aesthetic';

export interface NewOSState {
  // Step 1 — Vehicle
  vehiclePlate: string;
  vehicleInfo: VehicleInfo | null;
  vehicleManualBrand: string;
  vehicleManualModel: string;
  vehicleManualYear: string;
  vehicleManualColor: string;
  plateSource: 'api' | 'manual' | null; // null = not set yet

  // Step 2 — Customer
  customer: CustomerSearchResult | null;
  customerManualName: string;
  customerSource: 'search' | 'manual' | null;

  // Step 3 — OS Type
  customerType: CustomerType;
  osType: OSType;
  insurerName: string;
  claimNumber: string;
  deductible: string; // string for input, parse to number on submit

  // Actions
  setVehiclePlate: (plate: string) => void;
  setVehicleInfo: (info: VehicleInfo | null, source: 'api' | 'manual') => void;
  setVehicleManualField: (field: 'brand' | 'model' | 'year' | 'color', value: string) => void;
  setCustomer: (customer: CustomerSearchResult | null, source: 'search' | 'manual') => void;
  setCustomerManualName: (name: string) => void;
  setCustomerType: (type: CustomerType) => void;
  setOSType: (type: OSType) => void;
  setInsurer: (name: string) => void;
  setClaimNumber: (n: string) => void;
  setDeductible: (d: string) => void;
  reset: () => void;
}
```

### 2B. Step 1 — Vehicle

**File:** `apps/mobile/src/components/nova-os/Step1Vehicle.tsx`

**Props:**
```typescript
interface Step1VehicleProps {
  onNext: () => void;
}
```

**UI:**
- Title: "Veículo" (Text variant="heading3")
- TextInput for plate (all caps, max 8 chars, keyboard: `default`, `autoCapitalize="characters"`)
- "Buscar Placa" Button (primary) — calls `lookup(plate)` from `useVehicleByPlate`
- Loading indicator while searching
- **If vehicle found (plateSource === 'api'):** show vehicle info card (brand, model, year, color) with green "Dados encontrados automaticamente" label
- **If not found or offline:** show 4 manual text inputs (Marca, Modelo, Ano, Cor)
- "Preenchimento manual" link/button to force manual mode even when online
- Validation: plate required (at least 7 chars) + if manual: brand and model required
- `onNext` called only when validation passes
- Updates store via `useNewOSStore`

**Style:** white background, 16px padding, gap 12, rounded inputs (borderRadius 12, border #e5e7eb)

### 2C. Step 2 — Customer

**File:** `apps/mobile/src/components/nova-os/Step2Customer.tsx`

**Props:**
```typescript
interface Step2CustomerProps {
  onNext: () => void;
  onBack: () => void;
}
```

**UI:**
- Title: "Cliente"
- Search TextInput ("Buscar por nome, CPF ou telefone...") — calls `search(query)` from `useCustomerSearch`
- Results list (FlatList, max height 200): each row shows `name` + `cpf_masked` + `phone_masked` — tap to select
- If customer selected: show selected card with name + cpf_masked, and "Trocar" link
- "Cadastro rápido" section (shown when query >= 2 chars and no results, or always via link):
  - TextInput "Nome completo" (sets `customerManualName`)
  - (CPF and phone are optional — skip for now to keep wizard fast)
- Validation: either a customer is selected OR `customerManualName.trim().length >= 3`
- Updates store via `useNewOSStore`

### 2D. Step 3 — OS Type

**File:** `apps/mobile/src/components/nova-os/Step3OSType.tsx`

**Props:**
```typescript
interface Step3OSTypeProps {
  onNext: () => void;
  onBack: () => void;
}
```

**UI:**
- Title: "Tipo de OS"
- **Customer type toggle** (two buttons side by side):
  - "Seguradora" → customerType = 'insurer'
  - "Particular" → customerType = 'private'
  - Active: bg `#e31b1b`, text white; Inactive: bg white, border #e5e7eb
- **OS type selector** (grid of pills, 2 columns):
  - "Lataria/Pintura" → 'bodywork'
  - "Garantia" → 'warranty'
  - "Retrabalho" → 'rework'
  - "Mecânica" → 'mechanical'
  - "Estética" → 'aesthetic'
  - Active: bg `#fee2e2`, border `#e31b1b`, text `#e31b1b`
- **If customerType === 'insurer':** show additional fields:
  - TextInput "Seguradora" (insurerName)
  - TextInput "Nº Sinistro" (claimNumber, optional)
  - TextInput "Franquia (R$)" (deductible, keyboardType="numeric", optional)
- Validation: customerType and osType are required (always have default values, so no explicit validation needed)
- Updates store via `useNewOSStore`

### 2E. Step 4 — Review

**File:** `apps/mobile/src/components/nova-os/Step4Review.tsx`

**Props:**
```typescript
interface Step4ReviewProps {
  onConfirm: (startChecklist: boolean) => void;
  onBack: () => void;
  isCreating: boolean;
  error: string | null;
}
```

**UI:**
- Title: "Revisão"
- Summary card sections:
  - **Veículo:** plate, brand+model+year, color; badge "API" or "Manual" (small, gray)
  - **Cliente:** name, cpf_masked (if from search); badge "Cadastro" or "Novo"
  - **Tipo:** customerType label + osType label + insurer info (if applicable)
- **Two action buttons** (stacked):
  1. "Criar OS e Iniciar Checklist" (primary, full width) → `onConfirm(true)`
  2. "Criar OS" (secondary, full width) → `onConfirm(false)`
- Error text in red if `error` is not null
- ActivityIndicator centered if `isCreating`
- Both buttons disabled when `isCreating`
- CustomerType labels: `'insurer'` → "Seguradora", `'private'` → "Particular"
- OSType labels: bodywork→"Lataria/Pintura", warranty→"Garantia", rework→"Retrabalho", mechanical→"Mecânica", aesthetic→"Estética"

---

## Task 3: Main Wizard Screen

**Status:** - [ ]
**Depends on:** Task 1 + Task 2
**Files to modify/create:**
- MODIFY `apps/mobile/app/(app)/nova-os/index.tsx` — replace placeholder with wizard
- (No layout changes needed — existing `nova-os` tab already registered)

### Full replacement of nova-os/index.tsx

The screen manages:
1. Current step (0–3)
2. Calls to `useCreateServiceOrder`
3. Navigation to checklist after creation

**Behavior:**
- Header: title "Nova OS" + progress bar (4 steps, red fill for completed)
- `activeStep` state (0 = Vehicle, 1 = Customer, 2 = OS Type, 3 = Review)
- Back button in header (or within step component) to go to previous step
- Step 0 is the initial step (no back button, or back navigates away from wizard)
- On Step 4 `onConfirm(startChecklist)`:
  1. Build `CreateOSPayload` from store
  2. Call `create(payload)` from `useCreateServiceOrder`
  3. Call `store.reset()` to clear wizard state
  4. If `startChecklist`: navigate to `/checklist/[localId]`
  5. If not: navigate to OS list (Expo Router `router.push('/')` or `router.replace('/(app)')`)
  6. Show toast or inline message if `isOffline`: "OS criada localmente — será sincronizada quando conectar"

**Progress bar component (inline in this file):**
```tsx
function ProgressBar({ step, total }: { step: number; total: number }): JSX.Element {
  // 4 segment dots or filled bar
  // step 0 = 1/4 filled, step 1 = 2/4, etc.
  return (
    <View style={progressStyles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[progressStyles.segment, i <= step && progressStyles.segmentActive]}
        />
      ))}
    </View>
  );
}
```

**Screen header (dark gradient, same style as OSHeader):**
```tsx
<LinearGradient colors={['#1c1c1e', '#141414']} ...>
  <View style={headerRow}>
    {activeStep > 0 ? (
      <TouchableOpacity onPress={handleBack}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>
    ) : <View style={spacer} />}
    <Text style={headerTitle}>Nova OS</Text>
    <View style={spacer} />
  </View>
  <ProgressBar step={activeStep} total={4} />
</LinearGradient>
```

**Step rendering:**
```tsx
{activeStep === 0 && <Step1Vehicle onNext={() => setActiveStep(1)} />}
{activeStep === 1 && <Step2Customer onNext={() => setActiveStep(2)} onBack={() => setActiveStep(0)} />}
{activeStep === 2 && <Step3OSType onNext={() => setActiveStep(3)} onBack={() => setActiveStep(1)} />}
{activeStep === 3 && (
  <Step4Review
    onConfirm={handleConfirm}
    onBack={() => setActiveStep(2)}
    isCreating={isCreating}
    error={error}
  />
)}
```

**Offline banner:** if `!isOnline`, show small banner below header: "Modo offline — OS será sincronizada ao reconectar" (yellow bg, small text).

**Full screen scroll:** Each step component should be wrapped in a `ScrollView` or manage its own scrollability if content might overflow.

**Complete handleConfirm:**
```typescript
const handleConfirm = useCallback(async (startChecklist: boolean): Promise<void> => {
  const store = useNewOSStore.getState();
  const payload: CreateOSPayload = {
    customerName: store.customer?.name ?? store.customerManualName,
    customerId: store.customer?.id,
    vehiclePlate: store.vehiclePlate,
    vehicleBrand: store.vehicleInfo?.brand ?? store.vehicleManualBrand,
    vehicleModel: store.vehicleInfo?.model ?? store.vehicleManualModel,
    vehicleYear: store.vehicleInfo
      ? store.vehicleInfo.year
      : (store.vehicleManualYear ? parseInt(store.vehicleManualYear, 10) : undefined),
    vehicleColor: store.vehicleInfo?.color ?? store.vehicleManualColor || undefined,
    customerType: store.customerType,
    osType: store.osType,
    insurerName: store.customerType === 'insurer' ? store.insurerName : undefined,
    claimNumber: store.customerType === 'insurer' ? store.claimNumber : undefined,
    deductible: store.customerType === 'insurer' && store.deductible
      ? parseFloat(store.deductible)
      : undefined,
  };
  const result = await create(payload);
  if (!error) {
    store.reset();
    if (startChecklist) {
      router.push(`/checklist/${result.localId}` as const);
    } else {
      router.replace('/(app)' as const);
    }
  }
}, [create, error, router]);
```

---

## Acceptance Criteria (all tasks)

- [ ] TypeScript strict — `npx tsc --noEmit` passes with 0 errors
- [ ] Schema v3 migration exists (push_status column in service_orders)
- [ ] `useVehicleByPlate` caches plates in MMKV, works offline (returns cached), handles errors gracefully
- [ ] `useCustomerSearch` debounces 400ms, fires only for >= 2 chars, works offline (empty results)
- [ ] `useCreateServiceOrder` creates in WatermelonDB on both online (after API) and offline paths
- [ ] Push sync in sync.ts sends pending OS to backend on next sync cycle
- [ ] Nova-OS screen shows 4-step wizard with progress bar
- [ ] Step 1: plate input + FIPE lookup + manual fallback
- [ ] Step 2: customer search + selection + manual name
- [ ] Step 3: customer type toggle + OS type grid + insurer fields conditional
- [ ] Step 4: review summary + two creation buttons
- [ ] Post-creation: redirect to checklist (if chosen) or OS list; clears wizard store
- [ ] Offline banner shown when no connectivity
- [ ] All files use StyleSheet.create, no inline styles objects

---

*Sprint M5 — Paddock Solutions · 2026-04-12*
