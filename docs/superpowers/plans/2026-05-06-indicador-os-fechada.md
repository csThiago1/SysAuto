# Indicador de OS Fechada — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Indicador visual de OS fechada (entregue + faturada + quitada) no detalhe, listagem e filtros.

**Architecture:** Campo computado `closure_status` nos serializers da OS (usando anotações de subquery para evitar N+1). Frontend: componente `ClosureDots` reutilizável na tabela, checklist de fechamento na ClosingTab, filtro de fechamento na listagem.

**Tech Stack:** Django REST Framework (backend), React + TanStack Query + lucide-react (frontend)

**Spec:** `docs/superpowers/specs/2026-05-06-indicador-os-fechada-design.md`

---

## File Map

### Backend
- **Modify:** `backend/core/apps/service_orders/serializers.py` — adicionar `closure_status` nos serializers de lista e detalhe
- **Modify:** `backend/core/apps/service_orders/views.py` — adicionar anotações no queryset + filtro `closure`
- **Create:** `backend/core/apps/service_orders/tests/test_closure_status.py` — testes do closure_status

### Frontend
- **Create:** `apps/dscar-web/src/components/ui/closure-dots.tsx` — componente ClosureDots reutilizável
- **Modify:** `apps/dscar-web/src/components/ui/index.ts` — exportar ClosureDots
- **Modify:** `packages/types/src/service-order.types.ts` — adicionar ClosureStatus ao tipo
- **Modify:** `apps/dscar-web/src/app/(app)/os/_components/ServiceOrderTable.tsx` — renderizar ClosureDots
- **Modify:** `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/ClosingTab.tsx` — checklist de fechamento
- **Modify:** `apps/dscar-web/src/app/(app)/os/page.tsx` — filtro de fechamento

---

## Task 1: Backend — closure_status nos Serializers + Anotações no Queryset

**Files:**
- Modify: `backend/core/apps/service_orders/serializers.py`
- Modify: `backend/core/apps/service_orders/views.py`
- Create: `backend/core/apps/service_orders/tests/test_closure_status.py`

- [ ] **Step 1: Adicionar closure_status ao ServiceOrderListSerializer**

No `backend/core/apps/service_orders/serializers.py`, adicionar ao `ServiceOrderListSerializer`:

1. Novo campo:
```python
closure_status = serializers.SerializerMethodField()
```

2. Adicionar `"closure_status"` à lista `fields` do Meta (após `"created_at"`).

3. Adicionar o método:
```python
def get_closure_status(self, obj: ServiceOrder) -> dict | None:
    """Retorna status de fechamento: entregue + faturado + quitado."""
    if obj.status != ServiceOrderStatus.DELIVERED:
        return None

    is_delivered = True
    is_invoiced = bool(obj.invoice_issued)

    # Usa anotações do queryset se disponíveis (listagem)
    if hasattr(obj, "_has_any_receivables"):
        has_any = obj._has_any_receivables  # type: ignore[attr-defined]
        has_pending = obj._has_pending_receivables  # type: ignore[attr-defined]
        is_paid = has_any and not has_pending
    else:
        # Fallback para detalhe (sem anotação)
        from apps.accounts_receivable.models import ReceivableDocument

        receivables = ReceivableDocument.objects.filter(
            service_order_id=obj.pk, is_active=True
        )
        total = receivables.count()
        if total == 0:
            is_paid = False
        else:
            pending = receivables.exclude(status="received").count()
            is_paid = pending == 0

    return {
        "is_delivered": is_delivered,
        "is_invoiced": is_invoiced,
        "is_paid": is_paid,
        "is_closed": is_delivered and is_invoiced and is_paid,
    }
```

- [ ] **Step 2: Adicionar closure_status ao ServiceOrderDetailSerializer**

Mesmo campo e método no `ServiceOrderDetailSerializer`. Como usa `fields = "__all__"`, adicionar o campo explicitamente:

```python
closure_status = serializers.SerializerMethodField()
```

E o mesmo método `get_closure_status` (copiar do ListSerializer — em ambos os serializers o código é idêntico, mas como são classes separadas sem herança comum, duplicar é a opção mais limpa).

- [ ] **Step 3: Adicionar anotações no get_queryset**

No `backend/core/apps/service_orders/views.py`, modificar `get_queryset` para adicionar anotações.

Adicionar imports no topo (verificar quais já existem):
```python
from django.db.models import Exists, OuterRef
from apps.accounts_receivable.models import ReceivableDocument
```

No método `get_queryset`, após a construção do `qs` e antes do `if self.request.query_params.get("exclude_closed")`:

```python
# Anotações para closure_status (evita N+1 na listagem)
qs = qs.annotate(
    _has_any_receivables=Exists(
        ReceivableDocument.objects.filter(
            service_order_id=OuterRef("pk"),
            is_active=True,
        )
    ),
    _has_pending_receivables=Exists(
        ReceivableDocument.objects.filter(
            service_order_id=OuterRef("pk"),
            is_active=True,
        ).exclude(status="received")
    ),
)
```

- [ ] **Step 4: Adicionar filtro de fechamento**

No mesmo `get_queryset`, após o bloco `exclude_closed`, adicionar:

```python
closure = self.request.query_params.get("closure")
if closure == "closed":
    qs = qs.filter(
        status=ServiceOrderStatus.DELIVERED,
        invoice_issued=True,
        _has_any_receivables=True,
        _has_pending_receivables=False,
    )
elif closure == "pending":
    # Delivered mas NÃO totalmente fechada
    qs = qs.filter(status=ServiceOrderStatus.DELIVERED).exclude(
        invoice_issued=True,
        _has_any_receivables=True,
        _has_pending_receivables=False,
    )
```

- [ ] **Step 5: Escrever testes**

Criar `backend/core/apps/service_orders/tests/test_closure_status.py`:

```python
"""Testes para o closure_status de OS (entregue + faturada + quitada)."""
import hashlib
from decimal import Decimal
from datetime import date

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus
from apps.accounts_receivable.models import ReceivableDocument


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class ClosureStatusTestCase(TenantTestCase):
    """Testes para closure_status no endpoint de OS."""

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.user = GlobalUser.objects.create_user(
            email="closure@dscar.com",
            email_hash=_sha256("closure@dscar.com"),
            password="x",
        )
        # OS totalmente fechada
        cls.os_closed = ServiceOrder.objects.create(
            number=9301,
            plate="CLO1234",
            customer_name="Cliente Fechado",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=True,
            created_by=cls.user,
            parts_total=Decimal("1000"),
            services_total=Decimal("500"),
        )
        ReceivableDocument.objects.create(
            customer_id=cls.os_closed.id,
            customer_name="Cliente Fechado",
            description="Serviços OS 9301",
            amount=Decimal("1500"),
            amount_received=Decimal("1500"),
            due_date=date.today(),
            competence_date=date.today(),
            status="received",
            service_order_id=cls.os_closed.pk,
        )

        # OS entregue + faturada, mas NÃO quitada
        cls.os_pending_payment = ServiceOrder.objects.create(
            number=9302,
            plate="PEN1234",
            customer_name="Cliente Pendente",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=True,
            created_by=cls.user,
            parts_total=Decimal("2000"),
            services_total=Decimal("1000"),
        )
        ReceivableDocument.objects.create(
            customer_id=cls.os_pending_payment.id,
            customer_name="Cliente Pendente",
            description="Serviços OS 9302",
            amount=Decimal("3000"),
            amount_received=Decimal("0"),
            due_date=date.today(),
            competence_date=date.today(),
            status="open",
            service_order_id=cls.os_pending_payment.pk,
        )

        # OS entregue mas NÃO faturada (sem títulos)
        cls.os_not_invoiced = ServiceOrder.objects.create(
            number=9303,
            plate="NIN1234",
            customer_name="Cliente Não Faturado",
            status=ServiceOrderStatus.DELIVERED,
            invoice_issued=False,
            created_by=cls.user,
        )

        # OS em reparo (não delivered)
        cls.os_in_repair = ServiceOrder.objects.create(
            number=9304,
            plate="REP1234",
            customer_name="Cliente Em Reparo",
            status=ServiceOrderStatus.REPAIR,
            created_by=cls.user,
        )

    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.client.defaults["SERVER_NAME"] = "tenant.test.com"

    def test_closed_os_has_all_true(self) -> None:
        """OS entregue + faturada + todos títulos received → is_closed=True."""
        resp = self.client.get(f"/api/v1/service-orders/{self.os_closed.pk}/")
        self.assertEqual(resp.status_code, 200)
        cs = resp.data["closure_status"]
        self.assertTrue(cs["is_delivered"])
        self.assertTrue(cs["is_invoiced"])
        self.assertTrue(cs["is_paid"])
        self.assertTrue(cs["is_closed"])

    def test_pending_payment_not_closed(self) -> None:
        """OS entregue + faturada + título open → is_closed=False."""
        resp = self.client.get(f"/api/v1/service-orders/{self.os_pending_payment.pk}/")
        self.assertEqual(resp.status_code, 200)
        cs = resp.data["closure_status"]
        self.assertTrue(cs["is_delivered"])
        self.assertTrue(cs["is_invoiced"])
        self.assertFalse(cs["is_paid"])
        self.assertFalse(cs["is_closed"])

    def test_not_invoiced_not_closed(self) -> None:
        """OS entregue + não faturada → is_closed=False."""
        resp = self.client.get(f"/api/v1/service-orders/{self.os_not_invoiced.pk}/")
        self.assertEqual(resp.status_code, 200)
        cs = resp.data["closure_status"]
        self.assertTrue(cs["is_delivered"])
        self.assertFalse(cs["is_invoiced"])
        self.assertFalse(cs["is_paid"])
        self.assertFalse(cs["is_closed"])

    def test_non_delivered_returns_null(self) -> None:
        """OS que não é delivered → closure_status=null."""
        resp = self.client.get(f"/api/v1/service-orders/{self.os_in_repair.pk}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.data["closure_status"])

    def test_list_includes_closure_status(self) -> None:
        """Listagem inclui closure_status em OS delivered."""
        resp = self.client.get("/api/v1/service-orders/", {"status": "delivered"})
        self.assertEqual(resp.status_code, 200)
        for item in resp.data["results"]:
            if item["status"] == "delivered":
                self.assertIsNotNone(item["closure_status"])

    def test_filter_closure_closed(self) -> None:
        """Filtro ?closure=closed retorna apenas OS totalmente fechadas."""
        resp = self.client.get("/api/v1/service-orders/", {"closure": "closed"})
        self.assertEqual(resp.status_code, 200)
        numbers = [r["number"] for r in resp.data["results"]]
        self.assertIn(self.os_closed.number, numbers)
        self.assertNotIn(self.os_pending_payment.number, numbers)
        self.assertNotIn(self.os_not_invoiced.number, numbers)

    def test_filter_closure_pending(self) -> None:
        """Filtro ?closure=pending retorna OS entregues com pendências."""
        resp = self.client.get("/api/v1/service-orders/", {"closure": "pending"})
        self.assertEqual(resp.status_code, 200)
        numbers = [r["number"] for r in resp.data["results"]]
        self.assertNotIn(self.os_closed.number, numbers)
        self.assertIn(self.os_pending_payment.number, numbers)
        self.assertIn(self.os_not_invoiced.number, numbers)
```

- [ ] **Step 6: Rodar os testes**

Run: `docker exec paddock_django python -m pytest apps/service_orders/tests/test_closure_status.py -v --tb=short`
Expected: todos passam

- [ ] **Step 7: Commit**

```bash
git add backend/core/apps/service_orders/serializers.py backend/core/apps/service_orders/views.py backend/core/apps/service_orders/tests/test_closure_status.py
git commit -m "feat(service-orders): add closure_status (delivered+invoiced+paid) to serializers"
```

---

## Task 2: Frontend — Tipo ClosureStatus + Componente ClosureDots

**Files:**
- Modify: `packages/types/src/service-order.types.ts`
- Create: `apps/dscar-web/src/components/ui/closure-dots.tsx`
- Modify: `apps/dscar-web/src/components/ui/index.ts`

- [ ] **Step 1: Adicionar tipo ClosureStatus**

Em `packages/types/src/service-order.types.ts`, antes da interface `ServiceOrder`, adicionar:

```typescript
export interface ClosureStatus {
  is_delivered: boolean;
  is_invoiced: boolean;
  is_paid: boolean;
  is_closed: boolean;
}
```

Na interface `ServiceOrder`, após o campo `invoice_issued: boolean;`, adicionar:

```typescript
closure_status: ClosureStatus | null;
```

- [ ] **Step 2: Criar componente ClosureDots**

Criar `apps/dscar-web/src/components/ui/closure-dots.tsx`:

```tsx
"use client"

import { Lock } from "lucide-react"
import type { ClosureStatus } from "@paddock/types"
import { cn } from "@/lib/utils"

interface ClosureDotsProps {
  closureStatus: ClosureStatus | null
  className?: string
}

export function ClosureDots({ closureStatus, className }: ClosureDotsProps) {
  if (!closureStatus) return null

  const { is_delivered, is_invoiced, is_paid, is_closed } = closureStatus

  if (is_closed) {
    return (
      <span title="OS Fechada: Entregue · Faturada · Quitada" className={className}>
        <Lock className="h-3.5 w-3.5 text-success-400" />
      </span>
    )
  }

  const dots = [
    { active: is_delivered, label: "Entregue" },
    { active: is_invoiced, label: "Faturada" },
    { active: is_paid, label: "Quitada" },
  ]

  const tooltip = dots.map((d) => `${d.active ? "✓" : "✗"} ${d.label}`).join(" · ")

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} title={tooltip}>
      {dots.map((d, i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full",
            d.active ? "bg-success-400" : "bg-muted-foreground/30"
          )}
        />
      ))}
    </span>
  )
}
```

- [ ] **Step 3: Exportar no barrel**

Em `apps/dscar-web/src/components/ui/index.ts`, adicionar após a linha do `EmptyState`:

```typescript
export { ClosureDots } from "./closure-dots";
```

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/service-order.types.ts apps/dscar-web/src/components/ui/closure-dots.tsx apps/dscar-web/src/components/ui/index.ts
git commit -m "feat(dscar-web): add ClosureStatus type and ClosureDots component"
```

---

## Task 3: Frontend — ClosureDots na Tabela de OS

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/_components/ServiceOrderTable.tsx`

- [ ] **Step 1: Importar ClosureDots**

Adicionar ao import de `@/components/ui`:

```typescript
import { ClosureDots } from "@/components/ui"
```

- [ ] **Step 2: Renderizar ClosureDots ao lado do StatusBadge**

Encontrar o bloco que renderiza o StatusBadge (em torno da linha 164-167):

```tsx
{/* Status */}
<TableCell>
  <StatusBadge status={order.status} />
</TableCell>
```

Substituir por:

```tsx
{/* Status */}
<TableCell>
  <div className="flex items-center gap-2">
    <StatusBadge status={order.status} />
    <ClosureDots closureStatus={order.closure_status} />
  </div>
</TableCell>
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/os/_components/ServiceOrderTable.tsx
git commit -m "feat(dscar-web): show ClosureDots next to StatusBadge in OS table"
```

---

## Task 4: Frontend — Checklist de Fechamento na ClosingTab

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/ClosingTab.tsx`

- [ ] **Step 1: Adicionar o checklist no topo**

No `ClosingTab.tsx`, adicionar imports:

```typescript
import { Lock, Circle, CheckCircle2 } from "lucide-react"
```

Nota: `CheckCircle2` já está importado. Adicionar `Lock` e `Circle` ao import existente.

Após a linha `const isReady = order.status === "ready"` (linha ~70), adicionar:

```typescript
const cs = order.closure_status
```

No JSX, inserir o checklist **antes** do status banner (antes de `{isDelivered && (`), ou seja logo após o `<div className="space-y-4 max-w-2xl">`:

```tsx
{/* Closure checklist — só para OS entregues */}
{cs && (
  <div className={cn(
    "rounded-xl border p-4",
    cs.is_closed
      ? "bg-success-500/10 border-success-500/20"
      : "bg-muted/50 border-border"
  )}>
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-foreground/80">Fechamento da OS</h2>
      {cs.is_closed && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-500/20 border border-success-500/30 px-3 py-1 text-xs font-semibold text-success-400">
          <Lock className="h-3 w-3" />
          OS Fechada
        </span>
      )}
    </div>
    <div className="space-y-2">
      <ClosureCheckItem label="Entregue" done={cs.is_delivered} />
      <ClosureCheckItem label="Faturada" done={cs.is_invoiced} />
      <ClosureCheckItem label="Quitada" done={cs.is_paid} />
    </div>
  </div>
)}
```

E adicionar a helper function no final do arquivo (antes do export ou após o componente principal):

```tsx
function ClosureCheckItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-success-400" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground/40" />
      )}
      <span className={cn("text-sm", done ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  )
}
```

Adicionar `import { cn } from "@/lib/utils"` se não existir (já está importado, verificar).

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/ClosingTab.tsx
git commit -m "feat(dscar-web): add closure checklist to ClosingTab"
```

---

## Task 5: Frontend — Filtro de Fechamento na Listagem

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/page.tsx`

- [ ] **Step 1: Adicionar state e filtro**

No `ServiceOrdersPage`, após a linha `const [excludeClosed, setExcludeClosed] = useState(true)`:

```typescript
const [closure, setClosure] = useState<string>("ALL")
```

No bloco de `filters`, após `if (excludeClosed && status === "ALL") filters.exclude_closed = "true"`:

```typescript
if (closure !== "ALL") filters.closure = closure
```

- [ ] **Step 2: Adicionar o dropdown de fechamento no JSX**

Após o dropdown de `customerType` (após o `</select>` do "Qualquer Tipo") e antes do `{hasFilters && (`:

```tsx
<select
  className={SELECT_CLS}
  value={closure}
  onChange={(e) => setClosure(e.target.value)}
>
  <option value="ALL">Fechamento</option>
  <option value="closed">Fechadas</option>
  <option value="pending">Pendentes</option>
</select>
```

- [ ] **Step 3: Incluir closure no clearFilters e hasFilters**

Encontrar a função `clearFilters` e adicionar `setClosure("ALL")`.

Encontrar a condição `hasFilters` e adicionar `|| closure !== "ALL"`.

- [ ] **Step 4: Adicionar chip de filtro ativo**

Na seção de "Active filter chips", adicionar um chip para closure (seguindo o padrão dos outros chips):

```tsx
{closure !== "ALL" && (
  <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-foreground/80">
    {closure === "closed" ? "Fechadas" : "Pendentes"}
    <button type="button" onClick={() => setClosure("ALL")} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors" aria-label="Remover filtro de fechamento">
      <X className="h-3 w-3" />
    </button>
  </span>
)}
```

- [ ] **Step 5: Incluir closure no useEffect de reset de página**

Encontrar o `useEffect` que reseta a página quando filtros mudam (deve ter as dependências dos filtros). Adicionar `closure` às dependências.

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/(app)/os/page.tsx
git commit -m "feat(dscar-web): add closure filter (closed/pending) to OS list"
```

---

## Task 6: Verificação final

- [ ] **Step 1: Rodar testes do backend**

Run: `docker exec paddock_django python -m pytest apps/service_orders/tests/test_closure_status.py -v`
Expected: todos passam

- [ ] **Step 2: TypeScript check**

Run: `cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep -E "closure|ClosureDots|ClosingTab|ServiceOrderTable|os/page"`
Expected: nenhum erro nos nossos arquivos

- [ ] **Step 3: Teste manual E2E**

1. Abrir uma OS `delivered` + `invoice_issued=true` com títulos pagos → deve mostrar 🔒 na listagem e "OS Fechada" na ClosingTab
2. Abrir uma OS `delivered` + `invoice_issued=true` com título pendente → deve mostrar ●●○ na listagem
3. Abrir uma OS em reparo → sem dots na listagem, sem checklist na ClosingTab
4. Filtrar por "Fechadas" → só OS 100% fechadas
5. Filtrar por "Pendentes" → só OS delivered com pendência

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -u
git commit -m "fix(dscar-web): closure indicator adjustments"
```
