# OS Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "$" billing button to OS list and ClosingTab that generates receivable titles, emits NFS-e/NF-e, saves docs to OS files, and logs everything — in one atomic flow.

**Architecture:** Two new backend actions on `ServiceOrderViewSet` (`billing_preview` GET, `billing` POST) backed by a `BillingService` class. Frontend: `BillingModal` component with breakdown display, triggered from table column and ClosingTab.

**Tech Stack:** Django 5 + DRF, Celery (fiscal polling), Next.js 15, TanStack Query v5, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-27-os-billing-design.md`

---

### Task 1: Backend — Add `FINANCEIRO` photo folder

**Files:**
- Modify: `backend/core/apps/service_orders/models.py` (OSPhotoFolder)
- Create: migration via `makemigrations`

- [ ] **Step 1: Add FINANCEIRO to OSPhotoFolder choices**

In `backend/core/apps/service_orders/models.py`, find class `OSPhotoFolder` and add:

```python
FINANCEIRO = "financeiro", "Financeiro"
```

after the existing `OUTROS` entry.

- [ ] **Step 2: Create and apply migration**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec -T django \
  python manage.py makemigrations service_orders --name add_financeiro_folder
docker compose -f infra/docker/docker-compose.dev.yml exec -T django \
  python manage.py migrate_schemas
```

Expected: migration applies with OK.

- [ ] **Step 3: Verify**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec -T django \
  python manage.py shell -c "from apps.service_orders.models import OSPhotoFolder; print(OSPhotoFolder.FINANCEIRO)"
```

Expected: `financeiro`

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/service_orders/models.py backend/core/apps/service_orders/migrations/
git commit -m "feat(service_orders): add FINANCEIRO photo folder for billing docs"
```

---

### Task 2: Backend — BillingService.preview()

**Files:**
- Create: `backend/core/apps/service_orders/billing.py`

- [ ] **Step 1: Create billing service with preview method**

Create `backend/core/apps/service_orders/billing.py`:

```python
"""
Paddock Solutions — OS Billing Service
Faturamento de OS: preview de breakdown + execução atômica (títulos + NF).
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── Constantes ────────────────────────────────────────────────────────────────

PAYMENT_METHODS = [
    ("pix", "Pix"),
    ("cash", "Dinheiro"),
    ("debit", "Débito"),
    ("credit", "Crédito à Vista"),
    ("credit_installment", "Crédito a Prazo"),
    ("boleto", "Boleto"),
    ("transfer", "Transferência Bancária"),
]

PAYMENT_TERMS = [0, 7, 10, 15, 21, 30, 45, 60]

# Defaults por tipo de título
_DEFAULTS = {
    "customer": {"method": "pix", "term": 0},
    "insurer": {"method": "boleto", "term": 30},
}

ZERO = Decimal("0.00")


def _d(val: Any) -> Decimal:
    """Converte para Decimal seguro."""
    if val is None:
        return ZERO
    return Decimal(str(val))


class BillingService:
    """Faturamento de OS: preview + execução."""

    @classmethod
    def preview(cls, order: Any) -> dict[str, Any]:
        """Calcula breakdown de faturamento sem criar nada.

        Args:
            order: ServiceOrder instance.

        Returns:
            Dict com totais, items pré-calculados e defaults de pagamento.
        """
        parts = _d(order.parts_total)
        services = _d(order.services_total)
        discount = _d(order.discount_total)
        grand_total = parts + services - discount
        deductible = _d(order.deductible_amount)
        # Limitar franquia ao total da OS
        deductible = min(deductible, grand_total)

        customer_name = order.customer_name or ""
        insurer_name = ""
        if order.customer_type == "insurer" and order.insurer:
            insurer_name = (
                getattr(order.insurer, "display_name", None)
                or getattr(order.insurer, "full_name", "")
                or "Seguradora"
            )

        items: list[dict[str, Any]] = []

        if order.customer_type == "insurer":
            # Split seguradora: franquia primeiro de serviços, depois de peças
            franquia_servicos = min(deductible, services)
            franquia_pecas = deductible - franquia_servicos
            servicos_seg = services - franquia_servicos
            pecas_seg = parts - franquia_pecas

            if deductible > ZERO:
                items.append({
                    "recipient_type": "customer",
                    "category": "deductible",
                    "label": f"Franquia \u2192 {customer_name}",
                    "amount": str(deductible),
                    "default_payment_method": "pix",
                    "default_payment_term_days": 0,
                    "note": None,
                })

            if servicos_seg > ZERO:
                items.append({
                    "recipient_type": "insurer",
                    "category": "services",
                    "label": f"Servi\u00e7os \u2192 {insurer_name}",
                    "amount": str(servicos_seg),
                    "default_payment_method": "boleto",
                    "default_payment_term_days": 30,
                    "note": None,
                })
            elif services > ZERO:
                items.append({
                    "recipient_type": "insurer",
                    "category": "services",
                    "label": f"Servi\u00e7os \u2192 {insurer_name}",
                    "amount": "0.00",
                    "default_payment_method": "boleto",
                    "default_payment_term_days": 30,
                    "note": "Franquia absorveu servi\u00e7os",
                })

            if pecas_seg > ZERO:
                items.append({
                    "recipient_type": "insurer",
                    "category": "parts",
                    "label": f"Pe\u00e7as \u2192 {insurer_name}",
                    "amount": str(pecas_seg),
                    "default_payment_method": "boleto",
                    "default_payment_term_days": 30,
                    "note": None,
                })
            elif parts > ZERO:
                items.append({
                    "recipient_type": "insurer",
                    "category": "parts",
                    "label": f"Pe\u00e7as \u2192 {insurer_name}",
                    "amount": "0.00",
                    "default_payment_method": "boleto",
                    "default_payment_term_days": 30,
                    "note": "Franquia absorveu pe\u00e7as",
                })
        else:
            # Particular: 1 título total para o cliente
            items.append({
                "recipient_type": "customer",
                "category": "full",
                "label": f"Total \u2192 {customer_name}",
                "amount": str(grand_total),
                "default_payment_method": "pix",
                "default_payment_term_days": 0,
                "note": None,
            })

        return {
            "parts_total": str(parts),
            "services_total": str(services),
            "discount_total": str(discount),
            "grand_total": str(grand_total),
            "deductible_amount": str(deductible),
            "customer_type": order.customer_type or "private",
            "customer_name": customer_name,
            "insurer_name": insurer_name,
            "items": items,
            "can_bill": not order.invoice_issued,
        }
```

- [ ] **Step 2: Verify import**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec -T django \
  python manage.py shell -c "from apps.service_orders.billing import BillingService; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/service_orders/billing.py
git commit -m "feat(billing): add BillingService.preview() — breakdown calculation"
```

---

### Task 3: Backend — BillingService.bill()

**Files:**
- Modify: `backend/core/apps/service_orders/billing.py`

- [ ] **Step 1: Add bill() method to BillingService**

Append to `backend/core/apps/service_orders/billing.py`, inside the `BillingService` class:

```python
    @classmethod
    @transaction.atomic
    def bill(
        cls,
        *,
        order: Any,
        items: list[dict[str, Any]],
        user: Any,
    ) -> dict[str, Any]:
        """Fatura OS atomicamente: cria títulos a receber + emite notas fiscais.

        Args:
            order: ServiceOrder instance (select_for_update recomendado).
            items: Lista de títulos com amount, payment_method, payment_term_days, category.
            user: GlobalUser que está faturando.

        Returns:
            Dict com receivables e fiscal_documents criados.

        Raises:
            ValueError: se OS já faturada ou status inválido.
        """
        from apps.accounts_receivable.services import ReceivableDocumentService
        from apps.fiscal.services.fiscal_service import FiscalService
        from apps.service_orders.models import ServiceOrderActivityLog

        # ── Validações ────────────────────────────────────────────────────
        BILLABLE_STATUSES = {
            "authorized", "repair", "mechanic", "bodywork", "painting",
            "assembly", "polishing", "washing", "final_survey", "ready",
            "delivered",
        }
        if order.invoice_issued:
            raise ValueError("OS já faturada.")
        if order.status not in BILLABLE_STATUSES:
            raise ValueError(
                f"Status '{order.status}' não permite faturamento. "
                f"Mínimo: autorizado."
            )

        receivables = []
        fiscal_docs = []
        today = timezone.now().date()

        for item in items:
            amount = _d(item["amount"])
            if amount <= ZERO:
                continue  # Pula títulos com valor zero

            category = item.get("category", "full")
            recipient = item.get("recipient_type", "customer")
            method = item.get("payment_method", "pix")
            term_days = int(item.get("payment_term_days", 0))
            due_date = today + timezone.timedelta(days=term_days)

            # Determinar destinatário
            if recipient == "insurer" and order.insurer:
                cust_name = (
                    getattr(order.insurer, "display_name", None)
                    or getattr(order.insurer, "full_name", "Seguradora")
                )
                cust_id = str(order.insurer.pk) if order.insurer else None
            else:
                cust_name = order.customer_name or "Cliente"
                cust_id = str(order.customer_uuid) if order.customer_uuid else None

            # Descrição do título
            desc_map = {
                "deductible": f"Franquia OS #{order.number}",
                "services": f"Serviços OS #{order.number}",
                "parts": f"Peças OS #{order.number}",
                "full": f"Faturamento OS #{order.number}",
            }
            description = desc_map.get(category, f"OS #{order.number}")

            # Determinar origin baseado na categoria
            origin_map = {
                "services": "NFSE",
                "deductible": "NFSE",
                "parts": "NFE",
                "full": "OS",
            }
            origin = origin_map.get(category, "OS")

            # ── Criar ReceivableDocument ──────────────────────────────────
            receivable = ReceivableDocumentService.create_receivable(
                customer_id=cust_id or "",
                customer_name=cust_name,
                description=description,
                amount=amount,
                due_date=due_date,
                competence_date=today,
                origin=origin,
                service_order_id=str(order.id),
                user=user,
            )
            receivables.append(receivable)

            # ── Emitir nota fiscal ────────────────────────────────────────
            try:
                config = FiscalService.get_config()
                if category in ("services", "deductible", "full"):
                    doc = FiscalService.emit_nfse(
                        service_order=order,
                        config=config,
                        triggered_by="USER",
                    )
                    fiscal_docs.append(doc)
                    receivable.fiscal_document = doc
                    receivable.save(update_fields=["fiscal_document"])

                if category in ("parts", "full"):
                    if _d(order.parts_total) > ZERO:
                        doc = FiscalService.emit_nfe(
                            service_order=order,
                            config=config,
                            triggered_by="USER",
                        )
                        fiscal_docs.append(doc)
                        if not receivable.fiscal_document:
                            receivable.fiscal_document = doc
                            receivable.save(update_fields=["fiscal_document"])
            except Exception:
                logger.exception(
                    "Erro ao emitir nota fiscal para OS #%s categoria=%s",
                    order.number, category,
                )
                # Título a receber foi criado mesmo sem NF — segue o fluxo

        # ── Marcar OS como faturada ───────────────────────────────────────
        order.invoice_issued = True
        order.save(update_fields=["invoice_issued"])

        # ── Log no histórico ──────────────────────────────────────────────
        total_billed = sum(_d(r.amount) for r in receivables)
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user=user,
            activity_type="invoice_issued",
            description=(
                f"OS faturada — {len(receivables)} título(s), "
                f"R$ {total_billed:,.2f}"
            ),
            metadata={
                "receivables_count": len(receivables),
                "fiscal_docs_count": len(fiscal_docs),
                "total_billed": str(total_billed),
                "items": [
                    {
                        "category": item.get("category"),
                        "amount": item.get("amount"),
                        "payment_method": item.get("payment_method"),
                    }
                    for item in items
                    if _d(item["amount"]) > ZERO
                ],
            },
        )

        return {
            "receivables": receivables,
            "fiscal_documents": fiscal_docs,
            "summary": {
                "total_billed": str(total_billed),
                "receivables_count": len(receivables),
                "fiscal_docs_count": len(fiscal_docs),
            },
        }
```

- [ ] **Step 2: Verify import**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec -T django \
  python manage.py shell -c "from apps.service_orders.billing import BillingService; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/service_orders/billing.py
git commit -m "feat(billing): add BillingService.bill() — atomic billing with receivables + fiscal"
```

---

### Task 4: Backend — ViewSet actions

**Files:**
- Modify: `backend/core/apps/service_orders/views.py`

- [ ] **Step 1: Add billing_preview action**

Add to `ServiceOrderViewSet` in `backend/core/apps/service_orders/views.py`, after the `history` action:

```python
    @action(detail=True, methods=["get"], url_path="billing/preview")
    def billing_preview(self, request: Request, pk: Optional[str] = None) -> Response:
        """GET /service-orders/{id}/billing/preview/ — breakdown de faturamento."""
        order = self.get_object()
        from apps.service_orders.billing import BillingService
        preview = BillingService.preview(order)
        return Response(preview)
```

- [ ] **Step 2: Add billing action**

```python
    @action(detail=True, methods=["post"], url_path="billing")
    def billing(self, request: Request, pk: Optional[str] = None) -> Response:
        """POST /service-orders/{id}/billing/ — fatura OS atomicamente."""
        order = self.get_object()
        items = request.data.get("items", [])
        if not items:
            return Response(
                {"detail": "Nenhum item de faturamento informado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.service_orders.billing import BillingService
        try:
            result = BillingService.bill(
                order=order, items=items, user=request.user,
            )
        except ValueError as e:
            return Response(
                {"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.accounts_receivable.serializers import ReceivableDocumentSerializer
        from apps.fiscal.serializers import FiscalDocumentListSerializer
        return Response({
            "receivables": ReceivableDocumentSerializer(
                result["receivables"], many=True,
            ).data,
            "fiscal_documents": FiscalDocumentListSerializer(
                result["fiscal_documents"], many=True,
            ).data,
            "summary": result["summary"],
        }, status=status.HTTP_201_CREATED)
```

- [ ] **Step 3: Verify check**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec -T django python manage.py check
```

Expected: `System check identified no issues`

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/service_orders/views.py
git commit -m "feat(billing): add billing_preview and billing actions to ServiceOrderViewSet"
```

---

### Task 5: Frontend — Types

**Files:**
- Create: `packages/types/src/billing.types.ts`
- Modify: `packages/types/src/index.ts` (export)

- [ ] **Step 1: Create billing types**

Create `packages/types/src/billing.types.ts`:

```typescript
/**
 * @paddock/types — Billing (Faturamento de OS)
 */

export type BillingRecipientType = "customer" | "insurer"
export type BillingCategory = "deductible" | "services" | "parts" | "full"

export type PaymentMethod =
  | "pix"
  | "cash"
  | "debit"
  | "credit"
  | "credit_installment"
  | "boleto"
  | "transfer"

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  debit: "Débito",
  credit: "Crédito à Vista",
  credit_installment: "Crédito a Prazo",
  boleto: "Boleto",
  transfer: "Transferência",
}

export const PAYMENT_TERMS = [
  { days: 0, label: "À vista" },
  { days: 7, label: "7 dias" },
  { days: 10, label: "10 dias" },
  { days: 15, label: "15 dias" },
  { days: 21, label: "21 dias" },
  { days: 30, label: "30 dias" },
  { days: 45, label: "45 dias" },
  { days: 60, label: "60 dias" },
] as const

export interface BillingPreviewItem {
  recipient_type: BillingRecipientType
  category: BillingCategory
  label: string
  amount: string
  default_payment_method: PaymentMethod
  default_payment_term_days: number
  note: string | null
}

export interface BillingPreview {
  parts_total: string
  services_total: string
  discount_total: string
  grand_total: string
  deductible_amount: string
  customer_type: string
  customer_name: string
  insurer_name: string
  items: BillingPreviewItem[]
  can_bill: boolean
}

export interface BillingItemPayload {
  recipient_type: BillingRecipientType
  category: BillingCategory
  amount: string
  payment_method: PaymentMethod
  payment_term_days: number
}

export interface BillingPayload {
  items: BillingItemPayload[]
}

export interface BillingSummary {
  total_billed: string
  receivables_count: number
  fiscal_docs_count: number
}

export interface BillingResult {
  receivables: unknown[]
  fiscal_documents: unknown[]
  summary: BillingSummary
}
```

- [ ] **Step 2: Export from barrel**

In `packages/types/src/index.ts`, add:

```typescript
export * from "./billing.types"
```

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/billing.types.ts packages/types/src/index.ts
git commit -m "feat(types): add billing types — preview, payload, result"
```

---

### Task 6: Frontend — useBilling hook

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_hooks/useBilling.ts`

- [ ] **Step 1: Create hook**

```typescript
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { BillingPreview, BillingPayload, BillingResult } from "@paddock/types"
import { apiFetch } from "@/lib/api"

const BASE = "/api/proxy/service-orders"

export function useBillingPreview(orderId: string) {
  return useQuery<BillingPreview>({
    queryKey: ["billing-preview", orderId],
    queryFn: () => apiFetch<BillingPreview>(`${BASE}/${orderId}/billing/preview`),
    enabled: !!orderId,
  })
}

export function useBillOS(orderId: string) {
  const qc = useQueryClient()
  return useMutation<BillingResult, Error, BillingPayload>({
    mutationFn: (payload) =>
      apiFetch<BillingResult>(`${BASE}/${orderId}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      void qc.invalidateQueries({ queryKey: ["billing-preview", orderId] })
      void qc.invalidateQueries({ queryKey: ["service-order-history", orderId] })
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/[id]/_hooks/useBilling.ts
git commit -m "feat(billing): add useBillingPreview and useBillOS hooks"
```

---

### Task 7: Frontend — BillingModal component

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/BillingModal.tsx`

- [ ] **Step 1: Create BillingModal**

```tsx
"use client"

import { useState, useEffect } from "react"
import { DollarSign, Loader2, CheckCircle, AlertTriangle, FileText } from "lucide-react"
import { toast } from "sonner"
import type {
  ServiceOrder,
  BillingPreviewItem,
  PaymentMethod,
  BillingItemPayload,
} from "@paddock/types"
import { PAYMENT_METHOD_LABELS, PAYMENT_TERMS } from "@paddock/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui"
import { Button } from "@/components/ui/button"
import { useBillingPreview, useBillOS } from "../_hooks/useBilling"

interface BillingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ServiceOrder
}

interface EditableItem {
  recipient_type: "customer" | "insurer"
  category: string
  label: string
  amount: string
  payment_method: PaymentMethod
  payment_term_days: number
  note: string | null
}

function formatBRL(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "R$ 0,00"
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

export function BillingModal({ open, onOpenChange, order }: BillingModalProps) {
  const { data: preview, isLoading } = useBillingPreview(
    open ? String(order.id) : ""
  )
  const { mutateAsync: bill, isPending } = useBillOS(String(order.id))
  const [items, setItems] = useState<EditableItem[]>([])

  // Sincroniza items editáveis quando preview carrega
  useEffect(() => {
    if (!preview) return
    setItems(
      preview.items.map((it) => ({
        ...it,
        payment_method: it.default_payment_method,
        payment_term_days: it.default_payment_term_days,
      }))
    )
  }, [preview])

  function updateItem(idx: number, field: string, value: string | number) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    )
  }

  async function handleBill() {
    const payload: BillingItemPayload[] = items
      .filter((it) => parseFloat(it.amount) > 0)
      .map((it) => ({
        recipient_type: it.recipient_type,
        category: it.category as BillingItemPayload["category"],
        amount: it.amount,
        payment_method: it.payment_method,
        payment_term_days: it.payment_term_days,
      }))

    if (payload.length === 0) {
      toast.error("Nenhum título com valor para faturar.")
      return
    }

    try {
      const result = await bill({ items: payload })
      toast.success(
        `OS faturada! ${result.summary.receivables_count} título(s) — ${formatBRL(result.summary.total_billed)}`
      )
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao faturar OS.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-success-400" />
            Faturamento — OS #{order.number}
          </DialogTitle>
          <p className="text-sm text-white/40 flex items-center gap-1.5 mt-1">
            {order.make_logo && (
              <img
                src={order.make_logo}
                alt=""
                className="h-4 w-4 object-contain"
              />
            )}
            {order.make} {order.model} ({order.plate}) — {order.customer_name}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        ) : !preview ? (
          <p className="text-error-400 text-sm py-4">
            Erro ao carregar preview.
          </p>
        ) : (
          <div className="space-y-4 mt-2">
            {/* ── Resumo ──────────────────────────────────────────────── */}
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-1.5">
              <h3 className="label-mono text-white/40 mb-2">RESUMO</h3>
              <div className="flex justify-between text-sm text-white/70">
                <span>Peças</span>
                <span className="font-mono">{formatBRL(preview.parts_total)}</span>
              </div>
              <div className="flex justify-between text-sm text-white/70">
                <span>Serviços</span>
                <span className="font-mono">{formatBRL(preview.services_total)}</span>
              </div>
              {parseFloat(preview.discount_total) > 0 && (
                <div className="flex justify-between text-sm text-error-400">
                  <span>Descontos</span>
                  <span className="font-mono">-{formatBRL(preview.discount_total)}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-1.5 flex justify-between text-sm font-semibold text-white">
                <span>Total</span>
                <span className="font-mono">{formatBRL(preview.grand_total)}</span>
              </div>
              {parseFloat(preview.deductible_amount) > 0 && (
                <div className="flex justify-between text-xs text-warning-400">
                  <span>Franquia</span>
                  <span className="font-mono">{formatBRL(preview.deductible_amount)}</span>
                </div>
              )}
            </div>

            {/* ── Títulos ─────────────────────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="label-mono text-white/40">TÍTULOS A GERAR</h3>
              {items.map((item, idx) => {
                const isZero = parseFloat(item.amount) <= 0
                return (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 space-y-2 ${
                      isZero
                        ? "border-white/5 bg-white/[0.01] opacity-50"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        {item.label}
                      </span>
                      <span className="font-mono text-sm font-bold text-white">
                        {formatBRL(item.amount)}
                      </span>
                    </div>
                    {item.note && (
                      <p className="text-xs text-warning-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {item.note}
                      </p>
                    )}
                    {!isZero && (
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white"
                          value={item.payment_method}
                          onChange={(e) =>
                            updateItem(idx, "payment_method", e.target.value)
                          }
                        >
                          {Object.entries(PAYMENT_METHOD_LABELS).map(
                            ([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            )
                          )}
                        </select>
                        <select
                          className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white"
                          value={item.payment_term_days}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              "payment_term_days",
                              parseInt(e.target.value, 10)
                            )
                          }
                        >
                          {PAYMENT_TERMS.map((t) => (
                            <option key={t.days} value={t.days}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Footer info ─────────────────────────────────────────── */}
            <div className="flex items-start gap-2 text-xs text-white/40 bg-white/[0.02] rounded-lg p-3 border border-white/5">
              <FileText className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Notas fiscais serão emitidas automaticamente. PDF e XML salvos
                na pasta Financeiro da OS.
              </span>
            </div>

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBill}
                disabled={isPending || !preview.can_bill}
                className="gap-1.5 bg-success-600 hover:bg-success-700 text-white"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4" />
                )}
                Faturar e Emitir NF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/[id]/_components/BillingModal.tsx
git commit -m "feat(billing): add BillingModal component — visual breakdown + payment terms"
```

---

### Task 8: Frontend — ServiceOrderTable "$" column

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/_components/ServiceOrderTable.tsx`

- [ ] **Step 1: Add imports and state**

At the top of `ServiceOrderTable.tsx`, add to imports:

```typescript
import { DollarSign, CheckCircle } from "lucide-react"
```

Add `useState` to the React import. Add inside the component, before `return`:

```typescript
const [billingOrder, setBillingOrder] = useState<ServiceOrder | null>(null)
```

Add lazy import for BillingModal at the top of the file (after other imports):

```typescript
import dynamic from "next/dynamic"
const BillingModal = dynamic(
  () => import("../[id]/_components/BillingModal").then((m) => ({ default: m.BillingModal })),
  { ssr: false }
)
```

- [ ] **Step 2: Add eligible status helper**

Inside the component, before `return`:

```typescript
const BILLABLE_STATUSES = new Set([
  "authorized", "repair", "mechanic", "bodywork", "painting",
  "assembly", "polishing", "washing", "final_survey", "ready",
])
```

- [ ] **Step 3: Add "$" column header**

In the `<TableHeader>`, add between the STATUS and the empty action column:

```tsx
<TableHead className="w-[50px] label-mono text-white/40">$</TableHead>
```

- [ ] **Step 4: Add "$" column cell**

In the `<TableRow>`, add between the Status `<TableCell>` and the action `<TableCell>`:

```tsx
                {/* Faturamento */}
                <TableCell>
                  {!order.invoice_issued && BILLABLE_STATUSES.has(order.status) ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setBillingOrder(order) }}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-success-400 hover:bg-success-500/10 transition-colors"
                      title="Faturar OS"
                    >
                      <DollarSign className="h-4 w-4" />
                    </button>
                  ) : order.invoice_issued ? (
                    <CheckCircle className="h-4 w-4 text-success-400 mx-auto" title="OS faturada" />
                  ) : null}
                </TableCell>
```

- [ ] **Step 5: Add BillingModal render**

After the closing `</Table>` div, add:

```tsx
      {billingOrder && (
        <BillingModal
          open={!!billingOrder}
          onOpenChange={(open) => { if (!open) setBillingOrder(null) }}
          order={billingOrder}
        />
      )}
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/_components/ServiceOrderTable.tsx
git commit -m "feat(billing): add $ column to OS list table with BillingModal"
```

---

### Task 9: Frontend — ClosingTab integration

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ClosingTab.tsx`

- [ ] **Step 1: Add BillingModal import and state**

At the top of `ClosingTab.tsx`, add:

```typescript
import { BillingModal } from "../BillingModal"
```

Inside the component, add state:

```typescript
const [showBillingModal, setShowBillingModal] = useState(false)
```

- [ ] **Step 2: Replace "Emitir NFS-e" button with "Faturar OS"**

Find the section that renders the "Emitir NFS-e" button (around line 374). Replace the fiscal CTA section with:

```tsx
{!order.invoice_issued && (
  <Button
    onClick={() => setShowBillingModal(true)}
    className="gap-1.5 bg-success-600 hover:bg-success-700 text-white"
  >
    <DollarSign className="h-4 w-4" />
    Faturar OS
  </Button>
)}
```

Add `DollarSign` to the lucide imports.

- [ ] **Step 3: Add BillingModal render**

At the bottom of the component return, before the final closing tags:

```tsx
<BillingModal
  open={showBillingModal}
  onOpenChange={setShowBillingModal}
  order={order}
/>
```

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ClosingTab.tsx
git commit -m "feat(billing): replace Emitir NFS-e with Faturar OS in ClosingTab"
```

---

### Task 10: Verification — end-to-end

- [ ] **Step 1: Django check**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec -T django python manage.py check
```

Expected: 0 issues

- [ ] **Step 2: Test billing preview via curl**

```bash
# Get OS ID
docker compose -f infra/docker/docker-compose.dev.yml exec -T django \
  python manage.py shell -c "
from django_tenants.utils import schema_context
with schema_context('tenant_dscar'):
    from apps.service_orders.models import ServiceOrder
    os = ServiceOrder.objects.filter(is_active=True, invoice_issued=False).first()
    if os: print(f'ID={os.id} number={os.number} type={os.customer_type} parts={os.parts_total} services={os.services_total}')
    else: print('Nenhuma OS elegível')
"
```

Then test the preview endpoint with the OS ID from above:

```bash
curl -s http://localhost:8000/api/v1/service-orders/<OS_ID>/billing/preview/ \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-Domain: dscar.localhost" | python3 -m json.tool
```

Expected: JSON with parts_total, services_total, items array.

- [ ] **Step 3: Test in browser**

1. Open OS list (`/service-orders`)
2. Verify "$" column appears with green DollarSign on eligible OS
3. Click "$" → BillingModal opens with breakdown
4. Verify correct split (particular vs seguradora)
5. Open OS detail → ClosingTab → verify "Faturar OS" button

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(billing): OS billing flow — preview, modal, table column, closing tab"
```
