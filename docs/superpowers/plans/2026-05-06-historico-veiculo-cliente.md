# Histórico de Veículo e Cliente — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir visualizar o histórico completo de um cliente (total gasto, OS, veículos) no cadastro, e o histórico de um veículo (por placa) via Sheet lateral na OS.

**Architecture:** Novo endpoint `vehicle-history` no ServiceOrderViewSet + enriquecimento do `useClientOrders` com summary. Frontend: Tabs no cadastro de pessoa, Sheet na VehicleSection da OS. Sem modelo novo — tudo via queries no ServiceOrder.

**Tech Stack:** Django REST Framework (backend), React + TanStack Query + shadcn/ui Tabs/Sheet (frontend)

**Spec:** `docs/superpowers/specs/2026-05-06-historico-veiculo-cliente-design.md`

---

## File Map

### Backend
- **Modify:** `backend/core/apps/service_orders/views.py` — adicionar action `vehicle_history`
- **Modify:** `backend/core/apps/service_orders/serializers.py` — adicionar `VehicleHistorySerializer`
- **Create:** `backend/core/apps/service_orders/tests/test_vehicle_history.py` — testes do endpoint

### Frontend — Histórico do Veículo (OS)
- **Create:** `apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useVehicleHistory.ts` — hook React Query
- **Create:** `apps/dscar-web/src/app/(app)/os/[numero]/_components/shared/VehicleHistorySheet.tsx` — Sheet lateral
- **Modify:** `apps/dscar-web/src/app/(app)/os/[numero]/_components/sections/VehicleSection.tsx` — botão "Histórico"

### Frontend — Histórico do Cliente (Cadastro)
- **Create:** `apps/dscar-web/src/app/(app)/cadastros/[id]/_components/ClientHistoryTab.tsx` — aba completa
- **Modify:** `apps/dscar-web/src/app/(app)/cadastros/[id]/page.tsx` — reestruturar com Tabs
- **Modify:** `apps/dscar-web/src/hooks/useClientOrders.ts` — aumentar page_size, adicionar campos

---

## Task 1: Backend — Endpoint `vehicle-history`

**Files:**
- Modify: `backend/core/apps/service_orders/serializers.py`
- Modify: `backend/core/apps/service_orders/views.py`
- Create: `backend/core/apps/service_orders/tests/test_vehicle_history.py`

- [ ] **Step 1: Criar o serializer `VehicleHistoryItemSerializer`**

Adicionar no final de `backend/core/apps/service_orders/serializers.py`:

```python
class VehicleHistoryItemSerializer(serializers.ModelSerializer):
    """Serializer compacto para itens do histórico de veículo."""

    total = serializers.FloatField(read_only=True)

    class Meta:
        model = ServiceOrder
        fields = [
            "id",
            "number",
            "status",
            "customer_name",
            "entry_date",
            "delivered_at",
            "parts_total",
            "services_total",
            "discount_total",
            "total",
        ]
        read_only_fields = fields
```

- [ ] **Step 2: Criar a action `vehicle_history` no ViewSet**

Adicionar no `ServiceOrderViewSet` em `backend/core/apps/service_orders/views.py`, após as actions existentes:

```python
@extend_schema(
    summary="Histórico de OS por placa do veículo",
    parameters=[
        OpenApiParameter("plate", description="Placa do veículo", required=True),
        OpenApiParameter("exclude_id", description="ID da OS a excluir", required=False),
    ],
)
@action(detail=False, methods=["get"], url_path="vehicle-history")
def vehicle_history(self, request: Request) -> Response:
    """Retorna todas as OS de uma placa com resumo agregado."""
    plate = request.query_params.get("plate", "").strip().upper()
    if not plate:
        return Response(
            {"detail": "Parâmetro 'plate' é obrigatório."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    qs = ServiceOrder.objects.filter(
        plate__iexact=plate, is_active=True
    ).order_by("-opened_at")

    exclude_id = request.query_params.get("exclude_id")
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)

    # Agregações
    delivered_qs = qs.filter(status=ServiceOrderStatus.DELIVERED)
    agg = delivered_qs.aggregate(
        total_spent=Sum(
            F("parts_total") + F("services_total") - F("discount_total"),
            output_field=DecimalField(),
        ),
    )
    first_visit = qs.aggregate(first_visit=Min("entry_date"))

    summary = {
        "os_count": qs.count(),
        "total_spent": str(agg["total_spent"] or 0),
        "first_visit": first_visit["first_visit"],
    }

    serializer = VehicleHistoryItemSerializer(qs, many=True)
    return Response({"summary": summary, "results": serializer.data})
```

Imports necessários (verificar quais já existam no topo do arquivo):
```python
from django.db.models import Sum, Min, F, DecimalField
```

- [ ] **Step 3: Escrever testes para o endpoint**

Criar `backend/core/apps/service_orders/tests/test_vehicle_history.py`:

```python
"""Testes para o endpoint vehicle-history."""

import pytest
from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APIClient

from apps.service_orders.models import ServiceOrder, ServiceOrderStatus


@pytest.fixture
def api_client(authenticated_client):
    """Client autenticado do fixture padrão."""
    return authenticated_client


@pytest.fixture
def vehicle_orders(db):
    """Cria 3 OS para a mesma placa, 1 entregue, 1 em andamento, 1 de outra placa."""
    base = {
        "customer_name": "João Silva",
        "make": "Honda",
        "model": "Civic",
        "year": 2024,
    }
    os1 = ServiceOrder.objects.create(
        plate="ABC1D23",
        status=ServiceOrderStatus.DELIVERED,
        parts_total=Decimal("3000"),
        services_total=Decimal("2000"),
        discount_total=Decimal("500"),
        entry_date=timezone.now() - timezone.timedelta(days=90),
        delivered_at=timezone.now() - timezone.timedelta(days=80),
        **base,
    )
    os2 = ServiceOrder.objects.create(
        plate="ABC1D23",
        status=ServiceOrderStatus.REPAIR,
        parts_total=Decimal("1000"),
        services_total=Decimal("500"),
        discount_total=Decimal("0"),
        entry_date=timezone.now() - timezone.timedelta(days=10),
        **base,
    )
    os3 = ServiceOrder.objects.create(
        plate="XYZ9F99",
        status=ServiceOrderStatus.DELIVERED,
        parts_total=Decimal("5000"),
        services_total=Decimal("3000"),
        discount_total=Decimal("0"),
        entry_date=timezone.now() - timezone.timedelta(days=60),
        customer_name="Maria Santos",
        make="Toyota",
        model="Corolla",
        year=2023,
    )
    return os1, os2, os3


@pytest.mark.django_db
class TestVehicleHistory:
    URL = "/api/v1/service-orders/vehicle-history/"

    def test_requires_plate_param(self, api_client):
        resp = api_client.get(self.URL)
        assert resp.status_code == 400

    def test_returns_os_for_plate(self, api_client, vehicle_orders):
        os1, os2, os3 = vehicle_orders
        resp = api_client.get(self.URL, {"plate": "ABC1D23"})
        assert resp.status_code == 200
        data = resp.json()

        assert data["summary"]["os_count"] == 2
        assert len(data["results"]) == 2

        numbers = [r["number"] for r in data["results"]]
        assert os3.number not in numbers

    def test_total_spent_only_delivered(self, api_client, vehicle_orders):
        resp = api_client.get(self.URL, {"plate": "ABC1D23"})
        data = resp.json()
        # Só os1 é DELIVERED: 3000 + 2000 - 500 = 4500
        assert Decimal(data["summary"]["total_spent"]) == Decimal("4500")

    def test_exclude_id(self, api_client, vehicle_orders):
        os1, os2, _ = vehicle_orders
        resp = api_client.get(self.URL, {"plate": "ABC1D23", "exclude_id": str(os2.pk)})
        data = resp.json()
        assert data["summary"]["os_count"] == 1
        assert data["results"][0]["number"] == os1.number

    def test_case_insensitive_plate(self, api_client, vehicle_orders):
        resp = api_client.get(self.URL, {"plate": "abc1d23"})
        assert resp.status_code == 200
        assert resp.json()["summary"]["os_count"] == 2

    def test_empty_results_for_unknown_plate(self, api_client, vehicle_orders):
        resp = api_client.get(self.URL, {"plate": "ZZZ0Z00"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["os_count"] == 0
        assert data["results"] == []
```

- [ ] **Step 4: Rodar os testes**

Run: `cd backend/core && python -m pytest apps/service_orders/tests/test_vehicle_history.py -v`
Expected: todos passam

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/service_orders/serializers.py backend/core/apps/service_orders/views.py backend/core/apps/service_orders/tests/test_vehicle_history.py
git commit -m "feat(service-orders): add vehicle-history endpoint with plate lookup"
```

---

## Task 2: Frontend — Hook `useVehicleHistory`

**Files:**
- Create: `apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useVehicleHistory.ts`

- [ ] **Step 1: Criar o hook**

Criar `apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useVehicleHistory.ts`:

```typescript
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

interface VehicleHistoryOS {
  id: string
  number: number
  status: string
  customer_name: string
  entry_date: string | null
  delivered_at: string | null
  parts_total: string
  services_total: string
  discount_total: string
  total: number
}

interface VehicleHistorySummary {
  os_count: number
  total_spent: string
  first_visit: string | null
}

export interface VehicleHistoryResponse {
  summary: VehicleHistorySummary
  results: VehicleHistoryOS[]
}

export function useVehicleHistory(plate: string, excludeId?: string) {
  const params = new URLSearchParams({ plate })
  if (excludeId) params.set("exclude_id", excludeId)

  return useQuery<VehicleHistoryResponse>({
    queryKey: ["vehicle-history", plate, excludeId],
    queryFn: () =>
      apiFetch<VehicleHistoryResponse>(
        `/api/proxy/service-orders/vehicle-history/?${params.toString()}`
      ),
    enabled: plate.length >= 7,
  })
}
```

- [ ] **Step 2: Exportar no barrel (se existir)**

Verificar se existe `apps/dscar-web/src/app/(app)/os/[numero]/_hooks/index.ts`. Se sim, adicionar:

```typescript
export { useVehicleHistory } from "./useVehicleHistory"
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useVehicleHistory.ts
git commit -m "feat(dscar-web): add useVehicleHistory hook"
```

---

## Task 3: Frontend — `VehicleHistorySheet`

**Files:**
- Create: `apps/dscar-web/src/app/(app)/os/[numero]/_components/shared/VehicleHistorySheet.tsx`

- [ ] **Step 1: Criar o componente**

Criar `apps/dscar-web/src/app/(app)/os/[numero]/_components/shared/VehicleHistorySheet.tsx`:

```tsx
"use client"

import Link from "next/link"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  StatusBadge,
} from "@/components/ui"
import { useVehicleHistory } from "../../_hooks/useVehicleHistory"
import { formatCurrency, formatDate, formatOSNumber } from "@paddock/utils"
import type { ServiceOrderStatus } from "@paddock/types"

interface VehicleHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plate: string
  make?: string
  model?: string
  year?: number
  makeLogo?: string
  excludeId?: string
}

export function VehicleHistorySheet({
  open,
  onOpenChange,
  plate,
  make,
  model,
  year,
  makeLogo,
  excludeId,
}: VehicleHistorySheetProps) {
  const { data, isLoading } = useVehicleHistory(plate, excludeId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            {makeLogo ? (
              <img
                src={makeLogo}
                alt={make ?? ""}
                className="h-10 w-10 rounded-lg border border-border bg-muted/30 object-contain p-1"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center">
                <span className="text-lg">🚗</span>
              </div>
            )}
            <div>
              <SheetTitle className="text-lg font-bold font-mono tracking-wider">
                {plate}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {[make, model, year].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : data ? (
          <div className="space-y-6 mt-6">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard label="OS" value={String(data.summary.os_count)} />
              <SummaryCard
                label="Total Gasto"
                value={formatCurrency(Number(data.summary.total_spent))}
              />
              <SummaryCard
                label="Primeira Visita"
                value={data.summary.first_visit ? formatDate(data.summary.first_visit) : "—"}
              />
            </div>

            {/* OS list */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Ordens de Serviço
              </h3>
              {data.results.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma OS anterior para este veículo.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.results.map((os) => (
                    <Link
                      key={os.id}
                      href={`/os/${os.number}`}
                      target="_blank"
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-foreground">
                          OS #{formatOSNumber(os.number)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {os.entry_date ? formatDate(os.entry_date) : "—"}
                          {os.delivered_at ? ` → ${formatDate(os.delivered_at)}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrency(os.total)}
                        </span>
                        <StatusBadge status={os.status as ServiceOrderStatus} size="sm" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que `formatCurrency` existe em `@paddock/utils`**

Run: `grep -r "export.*formatCurrency" packages/utils/`

Se não existir, criar uma função simples:
```typescript
export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/os/[numero]/_components/shared/VehicleHistorySheet.tsx
git commit -m "feat(dscar-web): add VehicleHistorySheet component"
```

---

## Task 4: Frontend — Botão "Histórico" na VehicleSection

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/sections/VehicleSection.tsx`

- [ ] **Step 1: Adicionar state e imports**

No topo de `VehicleSection.tsx`, adicionar imports:

```typescript
import { useState } from "react"
import { History } from "lucide-react"
import { VehicleHistorySheet } from "../shared/VehicleHistorySheet"
import { useVehicleHistory } from "../../_hooks/useVehicleHistory"
```

Nota: `useState` já está importado de react. Ajustar o import existente para incluir o que faltar.

- [ ] **Step 2: Adicionar state e query no componente**

Dentro da function `VehicleSection`, após as declarações existentes:

```typescript
const [historyOpen, setHistoryOpen] = useState(false)
const plate = watch("plate") ?? ""
const osId = watch("id") // precisa verificar se existe no schema
const { data: vehicleHistory } = useVehicleHistory(plate, osId)
const hasHistory = (vehicleHistory?.summary.os_count ?? 0) > 0
```

Nota: verificar se o campo `id` está disponível no form. Se não, pode ser passado como prop.

- [ ] **Step 3: Adicionar botão no header da seção**

Modificar a `div` do título da seção (linha ~47-49 do original):

De:
```tsx
<div className="flex items-center gap-3 border-b pb-1.5">
  <span className={FORM_SECTION_TITLE}>Dados do Veículo</span>
</div>
```

Para:
```tsx
<div className="flex items-center justify-between border-b pb-1.5">
  <span className={FORM_SECTION_TITLE}>Dados do Veículo</span>
  {hasHistory && (
    <button
      type="button"
      onClick={() => setHistoryOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
    >
      <History className="h-3.5 w-3.5" />
      Histórico ({vehicleHistory?.summary.os_count})
    </button>
  )}
</div>
```

- [ ] **Step 4: Adicionar o Sheet no final do JSX**

Antes do `</div>` final do return, adicionar:

```tsx
<VehicleHistorySheet
  open={historyOpen}
  onOpenChange={setHistoryOpen}
  plate={plate}
  make={watch("make") ?? undefined}
  model={watch("model") ?? undefined}
  year={watch("year") ?? undefined}
  makeLogo={makeLogo ?? undefined}
  excludeId={osId}
/>
```

- [ ] **Step 5: Testar manualmente**

1. Abrir uma OS no browser (`/os/{numero}`)
2. Se o veículo tiver OS anteriores com a mesma placa, o botão "Histórico (N)" deve aparecer
3. Clicar no botão deve abrir o Sheet à direita com a lista
4. Links devem abrir a OS em nova aba

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/(app)/os/[numero]/_components/sections/VehicleSection.tsx
git commit -m "feat(dscar-web): add vehicle history button to VehicleSection"
```

---

## Task 5: Frontend — Reestruturar `/cadastros/[id]` com Tabs

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/cadastros/[id]/page.tsx`

- [ ] **Step 1: Adicionar import do Tabs**

Adicionar ao import de `@/components/ui`:

```typescript
import {
  // ... existentes ...
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui"
```

- [ ] **Step 2: Reestruturar o layout com Tabs**

No `CadastroDetailContent`, substituir o bloco `{/* Main content grid */}` (linhas ~162-307) por:

```tsx
{/* Tabs layout */}
<Tabs defaultValue="dados" className="space-y-6">
  <TabsList>
    <TabsTrigger value="dados">Dados</TabsTrigger>
    <TabsTrigger value="historico">Histórico</TabsTrigger>
  </TabsList>

  <TabsContent value="dados">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Basic info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          {/* ... conteúdo existente do card Dados Gerais (linhas 171-219) ... */}
        </CardContent>
      </Card>

      {/* Contacts */}
      {person.contacts.length > 0 && (
        <Card>
          {/* ... conteúdo existente do card Contatos (linhas 223-236) ... */}
        </Card>
      )}

      {/* Addresses */}
      {person.addresses.length > 0 && (
        <Card>
          {/* ... conteúdo existente do card Endereços (linhas 240-252) ... */}
        </Card>
      )}
    </div>
  </TabsContent>

  <TabsContent value="historico">
    <ClientHistoryTab personId={id} orders={orders} ordersLoading={ordersLoading} ordersCount={ordersData?.count ?? 0} />
  </TabsContent>
</Tabs>
```

O card de OS que estava na coluna direita é removido — agora vive na aba "Histórico".

- [ ] **Step 3: Adicionar import do ClientHistoryTab**

```typescript
import { ClientHistoryTab } from "./_components/ClientHistoryTab"
```

Nota: o componente será criado na Task 6.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/(app)/cadastros/[id]/page.tsx
git commit -m "refactor(dscar-web): restructure person detail page with Tabs"
```

---

## Task 6: Frontend — `ClientHistoryTab`

**Files:**
- Create: `apps/dscar-web/src/app/(app)/cadastros/[id]/_components/ClientHistoryTab.tsx`

- [ ] **Step 1: Criar o diretório**

Run: `mkdir -p apps/dscar-web/src/app/\\(app\\)/cadastros/\\[id\\]/_components`

- [ ] **Step 2: Criar o componente**

Criar `apps/dscar-web/src/app/(app)/cadastros/[id]/_components/ClientHistoryTab.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Car, DollarSign, FileText, Calendar } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBadge,
  Skeleton,
} from "@/components/ui"
import { formatCurrency, formatDate, formatOSNumber } from "@paddock/utils"
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types"

interface ClientHistoryTabProps {
  personId: string
  orders: ServiceOrder[]
  ordersLoading: boolean
  ordersCount: number
}

export function ClientHistoryTab({
  personId,
  orders,
  ordersLoading,
  ordersCount,
}: ClientHistoryTabProps) {
  const [plateFilter, setPlateFilter] = useState<string>("")

  // Compute summary from orders
  const summary = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered")
    const totalSpent = delivered.reduce(
      (acc, o) =>
        acc +
        (Number(o.parts_total ?? 0) +
          Number(o.services_total ?? 0) -
          Number(o.discount_total ?? 0)),
      0
    )
    const firstDate = orders.length > 0
      ? orders.reduce((min, o) => {
          const d = o.entry_date ?? o.opened_at ?? o.created_at
          return d && d < min ? d : min
        }, orders[0]?.entry_date ?? orders[0]?.opened_at ?? orders[0]?.created_at ?? "")
      : null

    return {
      totalSpent,
      osCount: ordersCount,
      avgTicket: delivered.length > 0 ? totalSpent / delivered.length : 0,
      firstDate,
    }
  }, [orders, ordersCount])

  // Group orders by plate
  const vehicles = useMemo(() => {
    const map = new Map<
      string,
      {
        plate: string
        make: string
        model: string
        year: number | null
        makeLogo: string | null
        osCount: number
        totalSpent: number
      }
    >()

    for (const os of orders) {
      if (!os.plate) continue
      const existing = map.get(os.plate)
      const osTotal =
        Number(os.parts_total ?? 0) +
        Number(os.services_total ?? 0) -
        Number(os.discount_total ?? 0)

      if (existing) {
        existing.osCount += 1
        if (os.status === "delivered") existing.totalSpent += osTotal
      } else {
        map.set(os.plate, {
          plate: os.plate,
          make: os.make ?? "",
          model: os.model ?? "",
          year: os.year ?? null,
          makeLogo: os.make_logo ?? null,
          osCount: 1,
          totalSpent: os.status === "delivered" ? osTotal : 0,
        })
      }
    }

    return Array.from(map.values())
  }, [orders])

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!plateFilter) return orders
    return orders.filter((o) => o.plate === plateFilter)
  }, [orders, plateFilter])

  if (ordersLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total Gasto"
          value={formatCurrency(summary.totalSpent)}
        />
        <MetricCard
          icon={<FileText className="h-4 w-4" />}
          label="Ordens de Serviço"
          value={String(summary.osCount)}
        />
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Ticket Médio"
          value={formatCurrency(summary.avgTicket)}
        />
        <MetricCard
          icon={<Calendar className="h-4 w-4" />}
          label="Cliente Desde"
          value={summary.firstDate ? formatDate(summary.firstDate) : "—"}
        />
      </div>

      {/* Vehicles section */}
      {vehicles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              Veículos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {vehicles.map((v) => (
                <button
                  key={v.plate}
                  type="button"
                  onClick={() =>
                    setPlateFilter(plateFilter === v.plate ? "" : v.plate)
                  }
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                    plateFilter === v.plate
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  {v.makeLogo ? (
                    <img
                      src={v.makeLogo}
                      alt={v.make}
                      className="h-8 w-8 shrink-0 rounded object-contain"
                    />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded bg-muted/50 flex items-center justify-center text-sm">
                      🚗
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold font-mono tracking-wider">
                      {v.plate}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {[v.make, v.model, v.year].filter(Boolean).join(" · ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {v.osCount} OS · {formatCurrency(v.totalSpent)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Ordens de Serviço
            </CardTitle>
            {plateFilter && (
              <button
                type="button"
                onClick={() => setPlateFilter("")}
                className="text-xs text-primary hover:underline"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma OS encontrada.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map((os) => (
                <Link
                  key={os.id}
                  href={`/os/${os.number}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-foreground">
                      OS #{formatOSNumber(os.number)}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {os.plate} · {os.make} {os.model}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {os.entry_date ? formatDate(os.entry_date) : "—"}
                      {os.delivered_at ? ` → ${formatDate(os.delivered_at)}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(os.total ?? 0)}
                    </span>
                    <StatusBadge
                      status={os.status as ServiceOrderStatus}
                      size="sm"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Ajustar `useClientOrders` para trazer mais dados**

Modificar `apps/dscar-web/src/hooks/useClientOrders.ts` para aumentar o page_size (pegar todas as OS para cálculos):

```typescript
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { PaginatedResponse, ServiceOrder } from "@paddock/types"

export function useClientOrders(customerId: string) {
  return useQuery<PaginatedResponse<ServiceOrder>>({
    queryKey: ["service-orders", "by-client", customerId],
    queryFn: () =>
      apiFetch<PaginatedResponse<ServiceOrder>>(
        `/api/proxy/service-orders/?customer=${customerId}&ordering=-opened_at&page_size=100`
      ),
    enabled: !!customerId,
  })
}
```

Nota: mudança de `page_size=10` para `page_size=100`. Para clientes com mais de 100 OS, uma paginação futura pode ser adicionada.

- [ ] **Step 4: Verificar que os campos `delivered_at`, `total`, `make_logo` existem no tipo `ServiceOrder`**

Run: `grep -n "delivered_at\|make_logo" packages/types/src/`

Se `delivered_at` não estiver no tipo, adicioná-lo na interface `ServiceOrder` em `packages/types/`.

- [ ] **Step 5: Testar manualmente**

1. Abrir `/cadastros/{id}` no browser
2. Deve aparecer as abas "Dados" e "Histórico"
3. Aba "Dados" mostra o conteúdo original
4. Aba "Histórico" mostra cards de resumo, seção de veículos, e lista de OS
5. Clicar em um card de veículo filtra a lista de OS por placa
6. Clicar em uma OS abre a página da OS

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/(app)/cadastros/[id]/_components/ClientHistoryTab.tsx apps/dscar-web/src/app/(app)/cadastros/[id]/page.tsx apps/dscar-web/src/hooks/useClientOrders.ts
git commit -m "feat(dscar-web): add client history tab with summary, vehicles, and OS list"
```

---

## Task 7: Ajustes finais e verificação

**Files:**
- Possíveis ajustes em tipos, imports, barrel files

- [ ] **Step 1: Verificar build do frontend**

Run: `cd apps/dscar-web && npx next build`
Expected: build sem erros

- [ ] **Step 2: Verificar testes do backend**

Run: `cd backend/core && python -m pytest apps/service_orders/tests/ -v --tb=short`
Expected: todos passam

- [ ] **Step 3: Testar fluxo completo E2E manualmente**

1. Criar 2+ OS com a mesma placa
2. Abrir uma dessas OS → botão "Histórico" aparece na VehicleSection
3. Clicar → Sheet abre com as outras OS listadas (a atual não aparece)
4. Ir em `/cadastros/{id}` do cliente dessas OS
5. Aba "Histórico" → cards de resumo, veículos agrupados, lista de OS

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -u
git commit -m "fix(dscar-web): adjust types and imports for vehicle/client history"
```
