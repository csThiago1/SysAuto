# Parts Catalog — Frontend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the shared parts catalog (19k+ references) into the ERP frontend with autocomplete in CompraFormModal and a compatibility-aware fallback in EstoqueBuscaModal.

**Architecture:** Backend adds `vehicle_make_name` query param to PartReferenceViewSet, annotating results with `is_compatible` and including nested applications/suppliers. Frontend adds a `usePartsCatalog` hook, a `CatalogSearchCombobox` component, a `CatalogContextCard`, and a `CatalogFallbackSection`. CompraFormModal gets autocomplete + context card. EstoqueBuscaModal shows catalog results when inventory search returns empty, split into "Compatible" and "Others" sections.

**Tech Stack:** Django REST Framework (backend), React 18, TanStack Query v5, Tailwind CSS, shadcn/ui (frontend)

---

## File Structure

```
# Backend (modify)
backend/core/apps/parts_catalog/views.py           # Add vehicle_make_name filter + is_compatible annotation
backend/core/apps/parts_catalog/serializers.py      # Add PartReferenceSearchSerializer with is_compatible

# Frontend (create)
packages/types/src/parts-catalog.types.ts                          # TypeScript types
apps/dscar-web/src/hooks/usePartsCatalog.ts                        # TanStack Query hook
apps/dscar-web/src/components/purchasing/CatalogSearchCombobox.tsx  # Search dropdown
apps/dscar-web/src/components/purchasing/CatalogContextCard.tsx     # Context card after selection
apps/dscar-web/src/components/purchasing/CatalogFallbackSection.tsx # Fallback in EstoqueBuscaModal

# Frontend (modify)
apps/dscar-web/src/components/purchasing/CompraFormModal.tsx        # Add combobox + context card
apps/dscar-web/src/components/purchasing/EstoqueBuscaModal.tsx      # Add fallback section
apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/PartsTab.tsx  # Pass vehicle info, handle catalog→compra flow
```

---

### Task 1: Backend — vehicle compatibility filter

**Files:**
- Modify: `backend/core/apps/parts_catalog/views.py`
- Modify: `backend/core/apps/parts_catalog/serializers.py`

- [ ] **Step 1: Add PartReferenceSearchSerializer**

In `backend/core/apps/parts_catalog/serializers.py`, add a new serializer after `PartReferenceListSerializer`:

```python
class PartReferenceSearchSerializer(serializers.ModelSerializer):
    """
    Serializer para busca com compatibilidade veicular.

    Inclui is_compatible (annotation), applications e suppliers inline.
    Usado quando vehicle_make_name está nos query params.
    """

    category_name = serializers.CharField(source="category.name", read_only=True)
    is_compatible = serializers.BooleanField(read_only=True, default=False)
    applications = PartApplicationSerializer(many=True, read_only=True)
    suppliers = PartSupplierRefSerializer(many=True, read_only=True)

    class Meta:
        model = PartReference
        fields = [
            "id",
            "manufacturer_code",
            "description",
            "category",
            "category_name",
            "unit",
            "ncm",
            "ean",
            "is_compatible",
            "applications",
            "suppliers",
        ]
```

- [ ] **Step 2: Update PartReferenceViewSet.get_queryset for vehicle filter**

In `backend/core/apps/parts_catalog/views.py`, update `get_queryset` in `PartReferenceViewSet`:

```python
def get_queryset(self):  # type: ignore[override]
    if self.action == "retrieve":
        return (
            PartReference.objects.select_related("category")
            .prefetch_related("applications__make", "applications__model", "suppliers")
        )

    qs = PartReference.objects.select_related("category").filter(is_active=True)

    # Vehicle compatibility annotation
    vehicle_make_name = self.request.query_params.get("vehicle_make_name")
    if vehicle_make_name:
        from django.db.models import Exists, OuterRef
        from apps.vehicle_catalog.models import VehicleMake

        # Resolve make by name (icontains for "Chevrolet" → "GM - Chevrolet")
        make = VehicleMake.objects.filter(
            nome__icontains=vehicle_make_name
        ).first()
        if make:
            app_filter = PartApplication.objects.filter(
                part_ref=OuterRef("pk"),
                make=make,
            )
            vehicle_model_name = self.request.query_params.get("vehicle_model_name")
            if vehicle_model_name:
                from apps.vehicle_catalog.models import VehicleModel
                model_obj = VehicleModel.objects.filter(
                    marca=make,
                    nome__icontains=vehicle_model_name,
                ).first()
                if model_obj:
                    app_filter = app_filter.filter(model=model_obj)

            qs = qs.annotate(is_compatible=Exists(app_filter))
            qs = qs.order_by("-is_compatible", "description")
        else:
            qs = qs.annotate(
                is_compatible=Exists(PartApplication.objects.none())
            )

        # Prefetch applications and suppliers for search results
        qs = qs.prefetch_related(
            "applications__make", "applications__model", "suppliers"
        )

    return qs
```

- [ ] **Step 3: Update get_serializer_class**

In `PartReferenceViewSet.get_serializer_class`, switch to `PartReferenceSearchSerializer` when vehicle params are present:

```python
def get_serializer_class(self):  # type: ignore[override]
    if self.action == "retrieve":
        return PartReferenceDetailSerializer
    if self.action == "list" and self.request.query_params.get("vehicle_make_name"):
        return PartReferenceSearchSerializer
    return PartReferenceListSerializer
```

Add the import at the top of views.py:

```python
from apps.parts_catalog.serializers import (
    PartApplicationSerializer,
    PartCategorySerializer,
    PartReferenceDetailSerializer,
    PartReferenceListSerializer,
    PartReferenceSearchSerializer,
)
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/parts_catalog/views.py backend/core/apps/parts_catalog/serializers.py
git commit -m "feat(parts_catalog): vehicle compatibility filter in list endpoint

When vehicle_make_name query param is present, annotates results
with is_compatible and includes nested applications/suppliers.
Compatible results sorted first."
```

---

### Task 2: Frontend — Types + Hook

**Files:**
- Create: `packages/types/src/parts-catalog.types.ts`
- Modify: `packages/types/src/index.ts`
- Create: `apps/dscar-web/src/hooks/usePartsCatalog.ts`

- [ ] **Step 1: Create TypeScript types**

Write `packages/types/src/parts-catalog.types.ts`:

```typescript
export interface PartCatalogApplication {
  id: string
  make: number
  make_nome: string
  model: number | null
  model_nome: string | null
  year_start: number | null
  year_end: number | null
  source: "seed" | "os_auto" | "api_external" | "manual"
  confidence_score: number
}

export interface PartCatalogSupplier {
  id: string
  supplier_name: string
  supplier_code: string
}

export interface PartCatalogReference {
  id: string
  manufacturer_code: string
  description: string
  category: number
  category_name: string
  ncm: string
  unit: string
  ean: string
  is_compatible?: boolean
  applications?: PartCatalogApplication[]
  suppliers?: PartCatalogSupplier[]
}
```

- [ ] **Step 2: Export from index**

In `packages/types/src/index.ts`, add:

```typescript
export type {
  PartCatalogApplication,
  PartCatalogSupplier,
  PartCatalogReference,
} from "./parts-catalog.types"
```

- [ ] **Step 3: Create usePartsCatalog hook**

Write `apps/dscar-web/src/hooks/usePartsCatalog.ts`:

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchList } from "@/lib/api"
import type { PartCatalogReference } from "@paddock/types"

interface PartsCatalogParams {
  search?: string
  vehicle_make_name?: string
  vehicle_model_name?: string
  category?: number
}

export function usePartsCatalog(params?: PartsCatalogParams) {
  const searchParams = new URLSearchParams()
  if (params?.search) searchParams.set("search", params.search)
  if (params?.vehicle_make_name) searchParams.set("vehicle_make_name", params.vehicle_make_name)
  if (params?.vehicle_model_name) searchParams.set("vehicle_model_name", params.vehicle_model_name)
  if (params?.category) searchParams.set("category", String(params.category))

  const qs = searchParams.toString()
  const enabled = !!params?.search && params.search.length >= 2

  return useQuery<PartCatalogReference[]>({
    queryKey: ["parts-catalog", "references", params],
    queryFn: () => fetchList<PartCatalogReference>(`/api/proxy/parts-catalog/references/?${qs}`),
    enabled,
    staleTime: 60_000,
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/parts-catalog.types.ts packages/types/src/index.ts apps/dscar-web/src/hooks/usePartsCatalog.ts
git commit -m "feat(frontend): parts catalog types and usePartsCatalog hook

PartCatalogReference type with optional is_compatible, applications,
and suppliers. Hook queries /api/proxy/parts-catalog/references/
with vehicle_make_name/vehicle_model_name for compatibility."
```

---

### Task 3: CatalogSearchCombobox

**Files:**
- Create: `apps/dscar-web/src/components/purchasing/CatalogSearchCombobox.tsx`

- [ ] **Step 1: Create the combobox component**

Write `apps/dscar-web/src/components/purchasing/CatalogSearchCombobox.tsx`:

```tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { usePartsCatalog } from "@/hooks/usePartsCatalog"
import type { PartCatalogReference } from "@paddock/types"

interface CatalogSearchComboboxProps {
  vehicleMakeName?: string
  vehicleModelName?: string
  onSelect: (ref: PartCatalogReference) => void
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function CatalogSearchCombobox({
  vehicleMakeName,
  vehicleModelName,
  onSelect,
  value,
  onChange,
  placeholder = "Buscar no catalogo (descricao ou codigo)...",
}: CatalogSearchComboboxProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const [debouncedSearch, setDebouncedSearch] = useState("")

  const { data: results, isLoading } = usePartsCatalog({
    search: debouncedSearch,
    vehicle_make_name: vehicleMakeName,
    vehicle_model_name: vehicleModelName,
  })

  // Debounce input
  function handleChange(text: string) {
    onChange(text)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(text)
      if (text.length >= 2) setOpen(true)
    }, 300)
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(ref: PartCatalogReference) {
    onSelect(ref)
    setOpen(false)
  }

  const hasResults = results && results.length > 0

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (debouncedSearch.length >= 2 && hasResults) setOpen(true)
        }}
        placeholder={placeholder}
        className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border"
      />

      {open && debouncedSearch.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {isLoading && (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              Buscando no catalogo...
            </p>
          )}

          {!isLoading && (!results || results.length === 0) && (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              Nenhum resultado no catalogo.
            </p>
          )}

          {!isLoading &&
            results?.map((ref) => (
              <button
                key={ref.id}
                type="button"
                onClick={() => handleSelect(ref)}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">
                      {ref.description}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {ref.manufacturer_code}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {ref.category_name}
                    </span>
                    {ref.is_compatible && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-success-500/10 text-success-500 border border-success-500/20">
                        Compativel
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/purchasing/CatalogSearchCombobox.tsx
git commit -m "feat(frontend): CatalogSearchCombobox component

Debounced search input with dropdown showing catalog results.
Shows compatibility badge when vehicle_make_name is provided."
```

---

### Task 4: CatalogContextCard

**Files:**
- Create: `apps/dscar-web/src/components/purchasing/CatalogContextCard.tsx`

- [ ] **Step 1: Create the context card component**

Write `apps/dscar-web/src/components/purchasing/CatalogContextCard.tsx`:

```tsx
"use client"

import { X } from "lucide-react"
import type { PartCatalogReference } from "@paddock/types"

interface CatalogContextCardProps {
  reference: PartCatalogReference
  onClear: () => void
}

export function CatalogContextCard({ reference, onClear }: CatalogContextCardProps) {
  const suppliers = reference.suppliers ?? []
  const applications = reference.applications ?? []
  const compatible = applications.filter((a) => a.confidence_score >= 50)

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
      <div className="flex items-start justify-between">
        <p className="font-medium text-foreground">
          Catalogo: {reference.manufacturer_code}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground p-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-foreground/70">
        <div>
          <span className="text-muted-foreground">Categoria:</span>{" "}
          {reference.category_name}
        </div>
        <div>
          <span className="text-muted-foreground">NCM:</span>{" "}
          {reference.ncm || "—"}
        </div>
      </div>

      {suppliers.length > 0 && (
        <div className="mt-2 text-xs text-foreground/70">
          <span className="text-muted-foreground">Fornecedores:</span>{" "}
          {suppliers.map((s) => s.supplier_name).join(" · ")}
        </div>
      )}

      {compatible.length > 0 ? (
        <div className="mt-2 text-xs">
          <span className="inline-flex items-center gap-1 text-success-500">
            <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
            Compativel:
          </span>{" "}
          <span className="text-foreground/70">
            {compatible.map((a) => {
              let text = a.make_nome
              if (a.model_nome) text += ` ${a.model_nome}`
              if (a.year_start) {
                text += ` (${a.year_start}`
                if (a.year_end && a.year_end !== a.year_start) text += `–${a.year_end}`
                text += ")"
              }
              return text
            }).join(", ")}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Sem dados de compatibilidade.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/purchasing/CatalogContextCard.tsx
git commit -m "feat(frontend): CatalogContextCard component

Shows category, NCM, suppliers, and vehicle compatibility
after selecting a part from the catalog."
```

---

### Task 5: CatalogFallbackSection

**Files:**
- Create: `apps/dscar-web/src/components/purchasing/CatalogFallbackSection.tsx`

- [ ] **Step 1: Create the fallback section component**

Write `apps/dscar-web/src/components/purchasing/CatalogFallbackSection.tsx`:

```tsx
"use client"

import { BookOpen } from "lucide-react"
import { usePartsCatalog } from "@/hooks/usePartsCatalog"
import type { PartCatalogReference } from "@paddock/types"

interface CatalogFallbackSectionProps {
  searchTerm: string
  vehicleMakeName?: string
  vehicleModelName?: string
  vehicleLabel: string
  onSelect: (ref: PartCatalogReference) => void
}

export function CatalogFallbackSection({
  searchTerm,
  vehicleMakeName,
  vehicleModelName,
  vehicleLabel,
  onSelect,
}: CatalogFallbackSectionProps) {
  const { data: results, isLoading } = usePartsCatalog({
    search: searchTerm,
    vehicle_make_name: vehicleMakeName,
    vehicle_model_name: vehicleModelName,
  })

  if (isLoading) {
    return (
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">Buscando no catalogo...</p>
      </div>
    )
  }

  if (!results || results.length === 0) return null

  const compatible = results.filter((r) => r.is_compatible)
  const others = results.filter((r) => !r.is_compatible)

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium text-foreground">
          Resultados do catalogo
        </h4>
      </div>

      {compatible.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-success-500 font-medium mb-2">
            Compativeis com {vehicleLabel}
          </p>
          <div className="space-y-1">
            {compatible.map((ref) => (
              <CatalogResultRow key={ref.id} ref_={ref} onSelect={onSelect} compatible />
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          {compatible.length > 0 && (
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Outros resultados
            </p>
          )}
          <div className="space-y-1">
            {others.map((ref) => (
              <CatalogResultRow key={ref.id} ref_={ref} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CatalogResultRow({
  ref_,
  onSelect,
  compatible = false,
}: {
  ref_: PartCatalogReference
  onSelect: (ref: PartCatalogReference) => void
  compatible?: boolean
}) {
  const suppliers = ref_.suppliers ?? []

  return (
    <button
      type="button"
      onClick={() => onSelect(ref_)}
      className="w-full text-left rounded-md border border-border bg-muted/30 hover:bg-muted/50 px-3 py-2.5 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">
            {ref_.description}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {ref_.manufacturer_code}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">{ref_.category_name}</span>
          {compatible && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-success-500/10 text-success-500 border border-success-500/20">
              Compativel
            </span>
          )}
        </div>
      </div>
      {suppliers.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground truncate">
          Fornecedores: {suppliers.map((s) => s.supplier_name).join(" · ")}
        </p>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/purchasing/CatalogFallbackSection.tsx
git commit -m "feat(frontend): CatalogFallbackSection component

Shows catalog results when inventory search returns empty.
Splits into 'Compatible with [vehicle]' and 'Others' sections."
```

---

### Task 6: Integrate CompraFormModal

**Files:**
- Modify: `apps/dscar-web/src/components/purchasing/CompraFormModal.tsx`

- [ ] **Step 1: Update CompraFormModal**

Replace the entire content of `apps/dscar-web/src/components/purchasing/CompraFormModal.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import type { TipoQualidade, PartCatalogReference } from "@paddock/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { CatalogSearchCombobox } from "./CatalogSearchCombobox"
import { CatalogContextCard } from "./CatalogContextCard"

interface CompraFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    description: string
    part_number: string
    tipo_qualidade: string
    unit_price: string
    quantity: string
    observacoes: string
  }) => void
  vehicleMakeName?: string
  vehicleModelName?: string
  prefill?: {
    description?: string
    partNumber?: string
    catalogRef?: PartCatalogReference
  }
}

const TIPO_QUALIDADE_OPTIONS: { value: TipoQualidade; label: string }[] = [
  { value: "genuina", label: "Genuina" },
  { value: "reposicao", label: "Reposicao" },
  { value: "similar", label: "Similar" },
  { value: "usada", label: "Usada" },
]

export function CompraFormModal({
  open,
  onClose,
  onSubmit,
  vehicleMakeName,
  vehicleModelName,
  prefill,
}: CompraFormModalProps) {
  const [description, setDescription] = useState("")
  const [partNumber, setPartNumber] = useState("")
  const [tipoQualidade, setTipoQualidade] = useState<TipoQualidade>("genuina")
  const [unitPrice, setUnitPrice] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [observacoes, setObservacoes] = useState("")
  const [catalogRef, setCatalogRef] = useState<PartCatalogReference | null>(null)

  // Apply prefill when modal opens with prefill data
  useEffect(() => {
    if (open && prefill) {
      if (prefill.description) setDescription(prefill.description)
      if (prefill.partNumber) setPartNumber(prefill.partNumber)
      if (prefill.catalogRef) setCatalogRef(prefill.catalogRef)
    }
  }, [open, prefill])

  function handleReset() {
    setDescription("")
    setPartNumber("")
    setTipoQualidade("genuina")
    setUnitPrice("")
    setQuantity("1")
    setObservacoes("")
    setCatalogRef(null)
  }

  function handleClose() {
    handleReset()
    onClose()
  }

  function handleCatalogSelect(ref: PartCatalogReference) {
    setDescription(ref.description)
    setPartNumber(ref.manufacturer_code)
    setCatalogRef(ref)
  }

  function handleClearCatalog() {
    setCatalogRef(null)
  }

  function handleSubmit() {
    if (!description || !unitPrice) return
    onSubmit({
      description,
      part_number: partNumber,
      tipo_qualidade: tipoQualidade,
      unit_price: unitPrice,
      quantity,
      observacoes,
    })
    handleReset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar Compra de Peca</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground/60">
          Um pedido de compra sera criado automaticamente para o setor de compras.
        </p>

        <div className="space-y-4">
          {/* Descricao — with catalog search */}
          <div>
            <label className="label-mono text-muted-foreground mb-0.5 block">
              Descricao *
            </label>
            <CatalogSearchCombobox
              value={description}
              onChange={setDescription}
              onSelect={handleCatalogSelect}
              vehicleMakeName={vehicleMakeName}
              vehicleModelName={vehicleModelName}
              placeholder="Buscar no catalogo ou digitar descricao..."
            />
          </div>

          {/* Catalog context card */}
          {catalogRef && (
            <CatalogContextCard
              reference={catalogRef}
              onClear={handleClearCatalog}
            />
          )}

          {/* Codigo / Referencia */}
          <div>
            <label className="label-mono text-muted-foreground mb-0.5 block">
              Codigo / Referencia
            </label>
            <input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="Ex: 5C6807221GRU, TYC-20-9646"
              className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border"
            />
          </div>

          {/* Tipo de peca + Valor cobrado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                Tipo de peca *
              </label>
              <select
                value={tipoQualidade}
                onChange={(e) =>
                  setTipoQualidade(e.target.value as TipoQualidade)
                }
                className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none"
              >
                {TIPO_QUALIDADE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                Valor cobrado ao cliente *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <input
                  type="text"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-muted/50 border border-border text-foreground rounded-md pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border"
                />
              </div>
            </div>
          </div>

          {/* Quantidade */}
          <div className="w-24">
            <label className="label-mono text-muted-foreground mb-0.5 block">
              Quantidade
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:border-border"
            />
          </div>

          {/* Observacoes */}
          <div>
            <label className="label-mono text-muted-foreground mb-0.5 block">
              Observacoes para compras
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Informacoes adicionais para o setor de compras..."
              className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!description || !unitPrice}
            className="rounded-md bg-info-500 hover:bg-info-600 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Solicitar Compra
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/purchasing/CompraFormModal.tsx
git commit -m "feat(CompraFormModal): catalog search autocomplete + context card

Description field now searches the shared catalog with debounce.
Selecting a result fills description + part_number and shows a
context card with category, suppliers, and vehicle compatibility.
Accepts prefill prop for EstoqueBuscaModal → CompraFormModal flow."
```

---

### Task 7: Integrate EstoqueBuscaModal + PartsTab

**Files:**
- Modify: `apps/dscar-web/src/components/purchasing/EstoqueBuscaModal.tsx`
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/PartsTab.tsx`

- [ ] **Step 1: Update EstoqueBuscaModal**

In `apps/dscar-web/src/components/purchasing/EstoqueBuscaModal.tsx`, add the catalog fallback. Add new props and import:

Add to the props interface:

```typescript
interface EstoqueBuscaModalProps {
  open: boolean
  onClose: () => void
  osId: string
  onSelect: (data: {
    unidade_fisica_id: string
    tipo_qualidade: string
    unit_price: string
    description: string
  }) => void
  vehicleMakeName?: string
  vehicleModelName?: string
  vehicleLabel?: string
  onCatalogSelect?: (ref: PartCatalogReference) => void
}
```

Add import at the top:

```typescript
import type { PecaEstoqueResult, TipoQualidade, PartCatalogReference } from "@paddock/types"
import { CatalogFallbackSection } from "./CatalogFallbackSection"
```

Update the function signature to destructure new props:

```typescript
export function EstoqueBuscaModal({
  open, onClose, onSelect,
  vehicleMakeName, vehicleModelName, vehicleLabel,
  onCatalogSelect,
}: EstoqueBuscaModalProps) {
```

Then, in the JSX, replace the "Nenhuma peca encontrada" empty state (the block at line 143-147) with:

```tsx
{!isLoading && busca.length >= 2 && resultados?.length === 0 && (
  <>
    <p className="text-sm text-muted-foreground py-4 text-center">
      Nenhuma peca encontrada no estoque.
    </p>
    {onCatalogSelect && (
      <CatalogFallbackSection
        searchTerm={busca}
        vehicleMakeName={vehicleMakeName}
        vehicleModelName={vehicleModelName}
        vehicleLabel={vehicleLabel ?? "este veiculo"}
        onSelect={(ref) => {
          onCatalogSelect(ref)
          handleClose()
        }}
      />
    )}
  </>
)}
```

- [ ] **Step 2: Update PartsTab**

In `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/PartsTab.tsx`, add vehicle data and the catalog→compra flow.

Add import:

```typescript
import type { PartCatalogReference } from "@paddock/types"
import { useServiceOrder } from "../../_hooks/useServiceOrder"
```

Inside the component, add state and handler after existing state:

```typescript
const { data: osData } = useServiceOrder(orderId)
const [compraModalPrefill, setCompraModalPrefill] = useState<{
  description?: string
  partNumber?: string
  catalogRef?: PartCatalogReference
} | undefined>()

function handleCatalogSelect(ref: PartCatalogReference) {
  setEstoqueOpen(false)
  setCompraModalPrefill({
    description: ref.description,
    partNumber: ref.manufacturer_code,
    catalogRef: ref,
  })
  setCompraOpen(true)
}
```

Update the `EstoqueBuscaModal` JSX to pass new props:

```tsx
<EstoqueBuscaModal
  open={estoqueOpen}
  onClose={() => setEstoqueOpen(false)}
  osId={orderId}
  onSelect={handleEstoqueSelect}
  vehicleMakeName={osData?.make}
  vehicleModelName={osData?.model}
  vehicleLabel={osData ? `${osData.make} ${osData.model} ${osData.year ?? ""}`.trim() : undefined}
  onCatalogSelect={handleCatalogSelect}
/>
```

Update the `CompraFormModal` JSX to pass vehicle info and prefill:

```tsx
<CompraFormModal
  open={compraOpen}
  onClose={() => {
    setCompraOpen(false)
    setCompraModalPrefill(undefined)
  }}
  onSubmit={handleCompraSubmit}
  vehicleMakeName={osData?.make}
  vehicleModelName={osData?.model}
  prefill={compraModalPrefill}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/components/purchasing/EstoqueBuscaModal.tsx apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/PartsTab.tsx
git commit -m "feat(PartsTab): catalog fallback in EstoqueBuscaModal + CompraFormModal flow

When inventory search returns empty, shows catalog results split
into 'Compatible with [vehicle]' and 'Others'. Selecting a catalog
result closes EstoqueBuscaModal and opens CompraFormModal pre-filled.
Both modals now receive vehicle info for compatibility display."
```
