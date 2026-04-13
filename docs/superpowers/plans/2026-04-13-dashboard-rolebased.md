# Dashboard Role-Based — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o dashboard genérico por visões específicas por perfil — Consultor (resumo pessoal) e Gerente/Admin/Diretoria (KPIs financeiros + produtividade da equipe).

**Architecture:** `DashboardStatsView` detecta o role do usuário autenticado e retorna payloads distintos. Frontend usa `useRole()` para renderizar `ConsultantDashboard` ou `ManagerDashboard` condicionalmente. Dados financeiros vêm de `ReceivableDocument` (AR) com fallback em `services_total + parts_total` se AR vazio.

**Tech Stack:** Django 5 + DRF, Next.js 15 App Router, TypeScript strict, TanStack Query v5, shadcn/ui Chart (Recharts), Tailwind CSS

---

## File Structure

**Backend:**
- Modify: `backend/core/apps/service_orders/views.py` — estender `DashboardStatsView`

**Frontend:**
- Modify: `packages/types/src/index.ts` — novos tipos de dashboard
- Create: `packages/types/src/dashboard.types.ts`
- Modify: `apps/dscar-web/src/hooks/useServiceOrders.ts` — estender `useDashboardStats`
- Modify: `apps/dscar-web/src/app/(app)/dashboard/page.tsx` — renderização condicional
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/StatCard.tsx`
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/ConsultantDashboard.tsx`
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx`
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/BillingByTypeChart.tsx`
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx`
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/OverdueOSList.tsx`

---

### Task 1: Backend — Estender DashboardStatsView

**Files:**
- Modify: `backend/core/apps/service_orders/views.py`

- [ ] **Step 1: Escrever testes para o endpoint role-based**

Criar `backend/core/apps/service_orders/tests/test_dashboard.py`:

```python
"""Testes para DashboardStatsView role-based."""
import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder


@pytest.mark.django_db
class TestDashboardStatsView:
    def _make_client(self, role: str) -> APIClient:
        client = APIClient()
        user = GlobalUser.objects.create_user(
            email=f"{role}@dscar.com",
            password="testpass",
        )
        # Simular role via força no request (dev JWT)
        client.force_authenticate(user=user)
        client.user = user
        client.user_role = role
        return client

    def test_unauthenticated_returns_401(self) -> None:
        response = APIClient().get("/api/service-orders/dashboard/stats/")
        assert response.status_code == 401

    def test_consultant_role_returns_personal_data(self) -> None:
        client = APIClient()
        user = GlobalUser.objects.create_user(email="cons@dscar.com", password="pass")
        client.force_authenticate(user=user)
        response = client.get("/api/service-orders/dashboard/stats/?role=CONSULTANT")
        assert response.status_code == 200
        data = response.data
        assert "role" in data
        assert "my_open" in data
        assert "my_deliveries_today" in data
        assert "my_overdue" in data
        assert "my_completed_week" in data

    def test_manager_role_returns_team_data(self) -> None:
        client = APIClient()
        user = GlobalUser.objects.create_user(email="mgr@dscar.com", password="pass")
        client.force_authenticate(user=user)
        response = client.get("/api/service-orders/dashboard/stats/?role=MANAGER")
        assert response.status_code == 200
        data = response.data
        assert "billing_month" in data
        assert "delivered_month" in data
        assert "avg_ticket" in data
        assert "overdue_count" in data
        assert "billing_by_type" in data
        assert "team_productivity" in data
        assert "overdue_os" in data

    def test_returns_legacy_data_by_default(self) -> None:
        """Sem role param → retorna dados legacy para compatibilidade."""
        client = APIClient()
        user = GlobalUser.objects.create_user(email="def@dscar.com", password="pass")
        client.force_authenticate(user=user)
        response = client.get("/api/service-orders/dashboard/stats/")
        assert response.status_code == 200
        assert "total_open" in response.data
```

- [ ] **Step 2: Rodar testes para confirmar falha**

```bash
cd backend/core
pytest apps/service_orders/tests/test_dashboard.py -v
```

Expected: 2 FAIL (campos role-based ausentes)

- [ ] **Step 3: Estender DashboardStatsView em views.py**

Substituir a implementação atual do método `get` de `DashboardStatsView`:

```python
class DashboardStatsView(APIView):
    """
    Endpoint de métricas do dashboard — retorno varia conforme role.
    ?role=CONSULTANT → dados pessoais
    ?role=MANAGER|ADMIN|OWNER → KPIs financeiros + equipe
    Sem parâmetro → legacy (retrocompatibilidade)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        role = request.query_params.get("role", "").upper()

        if role == "CONSULTANT":
            return Response(self._consultant_stats(request))

        if role in ("MANAGER", "ADMIN", "OWNER"):
            return Response(self._manager_stats())

        # Legacy — retrocompatibilidade
        return Response(self._legacy_stats())

    # ── Legacy ────────────────────────────────────────────────────────────────

    def _legacy_stats(self) -> dict:
        from django.db.models import Count
        total_open: int = ServiceOrder.objects.exclude(
            status__in=("delivered", "cancelled")
        ).count()
        by_status_qs = (
            ServiceOrder.objects.exclude(status__in=("delivered", "cancelled"))
            .values("status")
            .annotate(count=Count("id"))
        )
        by_status: dict[str, int] = {row["status"]: row["count"] for row in by_status_qs}
        today_deliveries: int = ServiceOrder.objects.filter(
            estimated_delivery_date=timezone.now().date()
        ).count()
        return {
            "total_open": total_open,
            "by_status": by_status,
            "today_deliveries": today_deliveries,
        }

    # ── Consultor ─────────────────────────────────────────────────────────────

    def _consultant_stats(self, request: Request) -> dict:
        from datetime import timedelta
        from django.db.models import Count
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)

        # Por enquanto: todas as OS abertas (assigned_to não existe ainda)
        open_qs = ServiceOrder.objects.exclude(status__in=("delivered", "cancelled"))
        my_open: int = open_qs.count()

        deliveries_today: int = open_qs.filter(
            estimated_delivery_date=today
        ).count()

        overdue: int = open_qs.filter(
            estimated_delivery_date__lt=today
        ).count()

        completed_week: int = ServiceOrder.objects.filter(
            status="delivered",
            delivery_date__date__gte=week_ago,
        ).count()

        recent_os = ServiceOrder.objects.exclude(
            status__in=("delivered", "cancelled")
        ).order_by("-opened_at")[:5]

        recent_list = [
            {
                "id": str(os.id),
                "number": os.number,
                "plate": os.plate,
                "customer_name": os.customer_name,
                "status": os.status,
                "status_display": os.get_status_display(),
                "days_in_shop": (today - os.opened_at.date()).days,
            }
            for os in recent_os
        ]

        return {
            "role": "consultant",
            "my_open": my_open,
            "my_deliveries_today": deliveries_today,
            "my_overdue": overdue,
            "my_completed_week": completed_week,
            "my_recent_os": recent_list,
        }

    # ── Gerente / Admin / Diretoria ───────────────────────────────────────────

    def _manager_stats(self) -> dict:
        from datetime import timedelta
        from decimal import Decimal
        from django.db.models import Sum, Count, Q
        from django.db.models.functions import TruncMonth

        today = timezone.now().date()
        month_start = today.replace(day=1)

        # ── Billing: tenta ReceivableDocument, fallback em OS totais ──────────
        billing_month = Decimal("0")
        billing_by_type: dict[str, str] = {"insurer": "0.00", "private": "0.00"}
        billing_by_insurer: list[dict] = []
        billing_last_6: list[dict] = []

        try:
            from apps.accounts_receivable.models import ReceivableDocument
            month_docs = ReceivableDocument.objects.filter(
                competence_date__gte=month_start,
                competence_date__lte=today,
            )
            billing_month = month_docs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

            # Por tipo de cliente (via origin proxy — OS insurer vs particular)
            insurer_total = month_docs.filter(origin="OS_INSURER").aggregate(
                t=Sum("amount")
            )["t"] or Decimal("0")
            private_total = month_docs.filter(origin="OS_PRIVATE").aggregate(
                t=Sum("amount")
            )["t"] or Decimal("0")
            billing_by_type = {
                "insurer": str(insurer_total),
                "private": str(private_total),
            }

            # Últimos 6 meses
            six_months_ago = today.replace(day=1)
            for i in range(5, -1, -1):
                import calendar as cal_mod
                year = today.year if today.month - i > 0 else today.year - 1
                month = (today.month - i - 1) % 12 + 1
                m_start = today.replace(year=year, month=month, day=1)
                m_end = m_start.replace(day=cal_mod.monthrange(year, month)[1])
                total = ReceivableDocument.objects.filter(
                    competence_date__range=(m_start, m_end)
                ).aggregate(t=Sum("amount"))["t"] or Decimal("0")
                billing_last_6.append({
                    "month": m_start.strftime("%b/%y"),
                    "amount": str(total),
                })

        except ImportError:
            # Fallback: soma services_total + parts_total das OS entregues no mês
            delivered_this_month = ServiceOrder.objects.filter(
                status="delivered",
                delivery_date__date__gte=month_start,
            )
            totals = delivered_this_month.aggregate(
                total=Sum(
                    models.ExpressionWrapper(
                        models.F("services_total") + models.F("parts_total") - models.F("discount_total"),
                        output_field=models.DecimalField()
                    )
                ),
                insurer=Sum(
                    models.ExpressionWrapper(
                        models.F("services_total") + models.F("parts_total") - models.F("discount_total"),
                        output_field=models.DecimalField()
                    ),
                    filter=Q(customer_type="insurer")
                ),
                private_t=Sum(
                    models.ExpressionWrapper(
                        models.F("services_total") + models.F("parts_total") - models.F("discount_total"),
                        output_field=models.DecimalField()
                    ),
                    filter=Q(customer_type="private")
                ),
            )
            billing_month = totals["total"] or Decimal("0")
            billing_by_type = {
                "insurer": str(totals["insurer"] or 0),
                "private": str(totals["private_t"] or 0),
            }

        # ── Entregas do mês ────────────────────────────────────────────────────
        delivered_month: int = ServiceOrder.objects.filter(
            status="delivered",
            delivery_date__date__gte=month_start,
        ).count()

        avg_ticket = (
            (billing_month / delivered_month).quantize(Decimal("0.01"))
            if delivered_month > 0 else Decimal("0")
        )

        # ── OS atrasadas ───────────────────────────────────────────────────────
        overdue_qs = ServiceOrder.objects.filter(
            estimated_delivery_date__lt=today
        ).exclude(status__in=("delivered", "cancelled")).order_by("estimated_delivery_date")

        overdue_count: int = overdue_qs.count()
        overdue_os = [
            {
                "id": str(os.id),
                "number": os.number,
                "plate": os.plate,
                "customer_name": os.customer_name,
                "estimated_delivery_date": str(os.estimated_delivery_date),
                "days_overdue": (today - os.estimated_delivery_date).days,
                "status": os.status,
                "status_display": os.get_status_display(),
            }
            for os in overdue_qs[:10]
        ]

        # ── Produtividade da equipe (proxy: created_by) ────────────────────────
        from django.contrib.auth import get_user_model
        User = get_user_model()
        productivity_qs = (
            ServiceOrder.objects.filter(
                status="delivered",
                delivery_date__date__gte=month_start,
            )
            .values("created_by__email")
            .annotate(
                delivered=Count("id"),
            )
            .order_by("-delivered")[:10]
        )

        open_by_user = (
            ServiceOrder.objects.exclude(status__in=("delivered", "cancelled"))
            .values("created_by__email")
            .annotate(open_count=Count("id"))
        )
        open_map = {row["created_by__email"]: row["open_count"] for row in open_by_user}

        team_productivity = [
            {
                "email": row["created_by__email"],
                "name": (row["created_by__email"] or "").split("@")[0].replace(".", " ").title(),
                "delivered_month": row["delivered"],
                "open_count": open_map.get(row["created_by__email"], 0),
            }
            for row in productivity_qs
        ]

        return {
            "role": "manager",
            "billing_month": str(billing_month),
            "delivered_month": delivered_month,
            "avg_ticket": str(avg_ticket),
            "overdue_count": overdue_count,
            "billing_by_type": billing_by_type,
            "billing_last_6_months": billing_last_6,
            "team_productivity": team_productivity,
            "overdue_os": overdue_os,
        }
```

- [ ] **Step 4: Rodar testes**

```bash
pytest apps/service_orders/tests/test_dashboard.py -v
```

Expected: 4/4 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/service_orders/views.py \
        backend/core/apps/service_orders/tests/test_dashboard.py
git commit -m "feat(dashboard): DashboardStatsView role-based (consultant + manager)"
```

---

### Task 2: Frontend — Types e Hook

**Files:**
- Create: `packages/types/src/dashboard.types.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `apps/dscar-web/src/hooks/useServiceOrders.ts`

- [ ] **Step 1: Criar dashboard.types.ts**

`packages/types/src/dashboard.types.ts`:

```typescript
// ── Legacy (compatibilidade) ───────────────────────────────────────────────────
export interface DashboardStats {
  total_open: number
  by_status: Record<string, number>
  today_deliveries: number
}

// ── Consultor ─────────────────────────────────────────────────────────────────
export interface RecentOSItem {
  id: string
  number: number
  plate: string
  customer_name: string
  status: string
  status_display: string
  days_in_shop: number
}

export interface ConsultantDashboardStats {
  role: "consultant"
  my_open: number
  my_deliveries_today: number
  my_overdue: number
  my_completed_week: number
  my_recent_os: RecentOSItem[]
}

// ── Gerente / Admin / Diretoria ───────────────────────────────────────────────
export interface OverdueOSItem {
  id: string
  number: number
  plate: string
  customer_name: string
  estimated_delivery_date: string
  days_overdue: number
  status: string
  status_display: string
}

export interface TeamMember {
  email: string
  name: string
  delivered_month: number
  open_count: number
}

export interface BillingMonthPoint {
  month: string  // ex: "abr/26"
  amount: string
}

export interface ManagerDashboardStats {
  role: "manager"
  billing_month: string
  delivered_month: number
  avg_ticket: string
  overdue_count: number
  billing_by_type: { insurer: string; private: string }
  billing_last_6_months: BillingMonthPoint[]
  team_productivity: TeamMember[]
  overdue_os: OverdueOSItem[]
}

export type AnyDashboardStats = DashboardStats | ConsultantDashboardStats | ManagerDashboardStats
```

- [ ] **Step 2: Exportar de index.ts**

```typescript
export * from "./dashboard.types"
```

- [ ] **Step 3: Atualizar useDashboardStats em useServiceOrders.ts**

Localizar a função `useDashboardStats` e substituir:

```typescript
import type {
  AnyDashboardStats,
  ConsultantDashboardStats,
  ManagerDashboardStats,
  DashboardStats,
} from "@paddock/types"

export function useDashboardStats(role?: string) {
  const param = role ? `?role=${role}` : ""
  return useQuery({
    queryKey: ["dashboard-stats", role ?? "legacy"],
    queryFn: () =>
      apiFetch<AnyDashboardStats>(`${API}/service-orders/dashboard/stats/${param}`),
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/dashboard.types.ts \
        packages/types/src/index.ts \
        apps/dscar-web/src/hooks/useServiceOrders.ts
git commit -m "feat(dashboard): dashboard types + useDashboardStats role param"
```

---

### Task 3: Frontend — ConsultantDashboard

**Files:**
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/StatCard.tsx`
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/ConsultantDashboard.tsx`

- [ ] **Step 1: Criar StatCard**

`apps/dscar-web/src/app/(app)/dashboard/_components/StatCard.tsx`:

```typescript
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  colorClass?: string
  trend?: { value: number; label: string }
}

export function StatCard({ title, value, subtitle, icon: Icon, colorClass = "text-primary-600", trend }: Props) {
  return (
    <div className="bg-white rounded-md border border-neutral-200 shadow-card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</p>
          <p className={cn("text-3xl font-bold mt-0.5", colorClass)}>{value}</p>
          {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn("rounded-full bg-neutral-100 p-2.5", colorClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <p className={cn("text-xs", trend.value >= 0 ? "text-emerald-600" : "text-red-500")}>
          {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value)} {trend.label}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar ConsultantDashboard**

`apps/dscar-web/src/app/(app)/dashboard/_components/ConsultantDashboard.tsx`:

```typescript
"use client"

import Link from "next/link"
import { ClipboardList, Truck, AlertTriangle, CheckCircle } from "lucide-react"
import { StatCard } from "./StatCard"
import type { ConsultantDashboardStats } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"

interface Props {
  data: ConsultantDashboardStats
}

export function ConsultantDashboard({ data }: Props) {
  return (
    <div className="space-y-6">
      {/* Cards KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Minhas OS Abertas"
          value={data.my_open}
          icon={ClipboardList}
          colorClass="text-blue-600"
        />
        <StatCard
          title="Entregas Hoje"
          value={data.my_deliveries_today}
          icon={Truck}
          colorClass="text-emerald-600"
        />
        <StatCard
          title="OS Atrasadas"
          value={data.my_overdue}
          icon={AlertTriangle}
          colorClass={data.my_overdue > 0 ? "text-red-600" : "text-neutral-400"}
        />
        <StatCard
          title="Entregues esta Semana"
          value={data.my_completed_week}
          icon={CheckCircle}
          colorClass="text-violet-600"
        />
      </div>

      {/* OS recentes */}
      <div className="bg-white rounded-md border border-neutral-200 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-700">Minhas OS em Andamento</h2>
        </div>
        {data.my_recent_os.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">Nenhuma OS em andamento.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="text-[11px] font-semibold uppercase text-neutral-400">
                <th className="px-4 py-2.5 text-left">Placa</th>
                <th className="px-4 py-2.5 text-left">Cliente</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Dias na Oficina</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.my_recent_os.map((os) => {
                const config = SERVICE_ORDER_STATUS_CONFIG[os.status as keyof typeof SERVICE_ORDER_STATUS_CONFIG]
                return (
                  <tr key={os.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/service-orders/${os.id}`} className="font-plate text-sm font-bold text-neutral-800 hover:text-primary-600">
                        {os.plate}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{os.customer_name || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${config?.badge ?? ""}`}>
                        {os.status_display}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={os.days_in_shop > 14 ? "text-red-600 font-semibold" : "text-neutral-600"}>
                        {os.days_in_shop}d
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/dashboard/_components/StatCard.tsx \
        apps/dscar-web/src/app/\(app\)/dashboard/_components/ConsultantDashboard.tsx
git commit -m "feat(dashboard): ConsultantDashboard — cards KPI pessoal + OS recentes"
```

---

### Task 4: Frontend — ManagerDashboard

**Files:**
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/BillingByTypeChart.tsx`
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx`
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/OverdueOSList.tsx`
- Create: `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx`

- [ ] **Step 1: Criar BillingByTypeChart**

`apps/dscar-web/src/app/(app)/dashboard/_components/BillingByTypeChart.tsx`:

```typescript
"use client"

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import type { BillingMonthPoint } from "@paddock/types"

interface Props {
  data: BillingMonthPoint[]
  byType: { insurer: string; private: string }
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`
  return `R$${value.toFixed(0)}`
}

export function BillingByTypeChart({ data, byType }: Props) {
  const chartData = data.map((d) => ({
    month: d.month,
    valor: Number(d.amount),
  }))

  const totalMonth = Number(byType.insurer) + Number(byType.private)
  const insurerPct = totalMonth > 0 ? Math.round((Number(byType.insurer) / totalMonth) * 100) : 0

  return (
    <div className="bg-white rounded-md border border-neutral-200 shadow-card p-4">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-700">Faturamento — Últimos 6 Meses</h3>
        <div className="flex gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded bg-blue-500" />
            Seguradora {insurerPct}%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500" />
            Particular {100 - insurerPct}%
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) =>
              value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            }
          />
          <Bar dataKey="valor" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Faturamento" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Criar TeamProductivityTable**

`apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx`:

```typescript
import type { TeamMember } from "@paddock/types"

interface Props {
  members: TeamMember[]
}

export function TeamProductivityTable({ members }: Props) {
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-md border border-neutral-200 shadow-card p-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Produtividade da Equipe</h3>
        <p className="text-sm text-neutral-400 py-4 text-center">Nenhum dado de produtividade este mês.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-md border border-neutral-200 shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100">
        <h3 className="text-sm font-semibold text-neutral-700">Produtividade da Equipe (mês)</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-neutral-50">
          <tr className="text-[11px] font-semibold uppercase text-neutral-400">
            <th className="px-4 py-2.5 text-left">Colaborador</th>
            <th className="px-4 py-2.5 text-right">OS Abertas</th>
            <th className="px-4 py-2.5 text-right">Entregues (mês)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {members.map((m) => (
            <tr key={m.email} className="hover:bg-neutral-50">
              <td className="px-4 py-2.5 font-medium text-neutral-800">{m.name}</td>
              <td className="px-4 py-2.5 text-right text-neutral-600">{m.open_count}</td>
              <td className="px-4 py-2.5 text-right">
                <span className="font-semibold text-emerald-700">{m.delivered_month}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Criar OverdueOSList**

`apps/dscar-web/src/app/(app)/dashboard/_components/OverdueOSList.tsx`:

```typescript
"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import type { OverdueOSItem } from "@paddock/types"

interface Props {
  items: OverdueOSItem[]
}

export function OverdueOSList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-md border border-neutral-200 shadow-card p-4 flex items-center gap-2">
        <span className="text-emerald-500 text-sm font-medium">✓ Nenhuma OS atrasada</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-md border border-red-100 shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-red-100 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h3 className="text-sm font-semibold text-red-700">{items.length} OS Atrasadas</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-red-50">
          <tr className="text-[11px] font-semibold uppercase text-red-400">
            <th className="px-4 py-2 text-left">OS / Placa</th>
            <th className="px-4 py-2 text-left">Cliente</th>
            <th className="px-4 py-2 text-right">Previsão</th>
            <th className="px-4 py-2 text-right">Atraso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-red-50">
          {items.map((os) => (
            <tr key={os.id} className="hover:bg-red-50/50">
              <td className="px-4 py-2">
                <Link href={`/service-orders/${os.id}`} className="font-medium text-neutral-800 hover:text-primary-600">
                  #{os.number} · {os.plate}
                </Link>
              </td>
              <td className="px-4 py-2 text-neutral-500">{os.customer_name || "—"}</td>
              <td className="px-4 py-2 text-right text-neutral-500">
                {new Date(os.estimated_delivery_date + "T12:00:00").toLocaleDateString("pt-BR")}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-red-600">
                {os.days_overdue}d
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Criar ManagerDashboard**

`apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx`:

```typescript
"use client"

import { DollarSign, Truck, TrendingUp, AlertTriangle } from "lucide-react"
import { StatCard } from "./StatCard"
import { BillingByTypeChart } from "./BillingByTypeChart"
import { TeamProductivityTable } from "./TeamProductivityTable"
import { OverdueOSList } from "./OverdueOSList"
import type { ManagerDashboardStats } from "@paddock/types"

interface Props {
  data: ManagerDashboardStats
}

export function ManagerDashboard({ data }: Props) {
  function formatCurrency(value: string): string {
    return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  return (
    <div className="space-y-6">
      {/* Cards KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Faturamento Mês"
          value={formatCurrency(data.billing_month)}
          icon={DollarSign}
          colorClass="text-emerald-600"
          subtitle="receitas do mês"
        />
        <StatCard
          title="OS Entregues"
          value={data.delivered_month}
          icon={Truck}
          colorClass="text-blue-600"
          subtitle="no mês corrente"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(data.avg_ticket)}
          icon={TrendingUp}
          colorClass="text-violet-600"
        />
        <StatCard
          title="OS Atrasadas"
          value={data.overdue_count}
          icon={AlertTriangle}
          colorClass={data.overdue_count > 0 ? "text-red-600" : "text-neutral-400"}
        />
      </div>

      {/* Gráficos + Produtividade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BillingByTypeChart
          data={data.billing_last_6_months}
          byType={data.billing_by_type}
        />
        <TeamProductivityTable members={data.team_productivity} />
      </div>

      {/* OS Atrasadas */}
      <OverdueOSList items={data.overdue_os} />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/dashboard/_components/
git commit -m "feat(dashboard): BillingByTypeChart + TeamProductivityTable + OverdueOSList + ManagerDashboard"
```

---

### Task 5: Frontend — Dashboard Page com renderização condicional

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Reescrever dashboard/page.tsx**

`apps/dscar-web/src/app/(app)/dashboard/page.tsx`:

```typescript
"use client"

import { useSession } from "next-auth/react"
import { useDashboardStats } from "@/hooks"
import { ConsultantDashboard } from "./_components/ConsultantDashboard"
import { ManagerDashboard } from "./_components/ManagerDashboard"
import type {
  ConsultantDashboardStats,
  ManagerDashboardStats,
  PaddockRole,
} from "@paddock/types"

const MANAGER_ROLES: PaddockRole[] = ["OWNER", "ADMIN", "MANAGER"]
const CONSULTANT_ROLES: PaddockRole[] = ["CONSULTANT", "STOREKEEPER"]

export default function DashboardPage() {
  const { data: session } = useSession()
  const role = (session?.role as PaddockRole | undefined) ?? "CONSULTANT"

  const isManager = MANAGER_ROLES.includes(role)
  const roleParam = isManager ? "MANAGER" : "CONSULTANT"

  const { data, isLoading, isError } = useDashboardStats(roleParam)

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {isManager
            ? "Visão gerencial — KPIs financeiros e produtividade da equipe."
            : "Resumo das suas atividades do dia."}
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-md border border-neutral-200 shadow-card h-28 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Erro ao carregar dados do dashboard. Tente recarregar a página.
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {isManager && (data as ManagerDashboardStats).role === "manager" && (
            <ManagerDashboard data={data as ManagerDashboardStats} />
          )}
          {!isManager && (data as ConsultantDashboardStats).role === "consultant" && (
            <ConsultantDashboard data={data as ConsultantDashboardStats} />
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que recharts está disponível**

```bash
grep "recharts" /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/dscar-web/package.json
```

Se não estiver presente:
```bash
cd apps/dscar-web
pnpm add recharts
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd apps/dscar-web
npx tsc --noEmit
```

Expected: 0 erros

- [ ] **Step 4: Commit final**

```bash
git add apps/dscar-web/src/app/\(app\)/dashboard/page.tsx \
        apps/dscar-web/package.json
git commit -m "feat(dashboard): dashboard role-based — ConsultantDashboard + ManagerDashboard"
```

---

## Checklist de Self-Review

- [ ] Spec cobertura: endpoint backend, tipos, ConsultantDashboard, ManagerDashboard, renderização condicional — todos contemplados
- [ ] Fallback em `_manager_stats` para quando `accounts_receivable` não tiver dados — sem crash
- [ ] `fipe_value` não aparece em nenhum cálculo de faturamento
- [ ] `PaddockRole` importado de `@paddock/types` — consistente com RBAC existente
- [ ] `recharts` já presente no shadcn/ui — verificar antes de instalar separado
- [ ] Tipos discriminados por `role: "consultant" | "manager"` — sem ambiguidade em runtime
