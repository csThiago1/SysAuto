# Indicador de OS Fechada

**Data:** 2026-05-06
**Status:** Aprovado
**Escopo:** Indicador visual de OS fechada (entregue + faturada + quitada) no detalhe, listagem e filtros

---

## Contexto

O PRD define que uma OS está **fechada** quando 3 condições simultâneas são atendidas:
1. **Entregue** — veículo retirado (`status == "delivered"`)
2. **Faturada** — todas as NFs emitidas (`invoice_issued == True`)
3. **Quitada** — todos os pagamentos recebidos (todos `ReceivableDocument` com status `"received"`)

Hoje não existe indicador visual disso. O sistema mostra apenas o status de delivery e se a NF foi emitida (na ClosingTab), mas não consolida as 3 condições nem mostra progresso de quitação.

## Decisões de Design

- Não criar campo novo no modelo ServiceOrder — closure_status é computado no serializer
- "Quitada" exige que existam títulos (ReceivableDocument) e que TODOS estejam `received`. Sem títulos = não quitada.
- Progresso visual com 3 dots na listagem (entregue/faturada/quitada)
- Filtro na listagem: Fechadas / Pendentes
- Checklist de fechamento na ClosingTab

---

## 1. Backend — closure_status no Serializer

### 1.1 Campo computado

Adicionar `closure_status` como `SerializerMethodField` em `ServiceOrderListSerializer` e `ServiceOrderDetailSerializer`.

Resposta:
```json
{
  "closure_status": {
    "is_delivered": true,
    "is_invoiced": true,
    "is_paid": false,
    "is_closed": false
  }
}
```

Lógica:
- `is_delivered`: `self.status == ServiceOrderStatus.DELIVERED`
- `is_invoiced`: `self.invoice_issued == True`
- `is_paid`: verificar se existem `ReceivableDocument` vinculados à OS e se TODOS têm status `"received"`
- `is_closed`: `is_delivered and is_invoiced and is_paid`

### 1.2 Evitar N+1 na listagem

Para a listagem, usar anotação no queryset:

```python
from django.db.models import Exists, OuterRef, Q
from apps.accounts_receivable.models import ReceivableDocument

# Anotar se tem títulos pendentes (não "received")
qs = qs.annotate(
    has_pending_receivables=Exists(
        ReceivableDocument.objects.filter(
            service_order_id=OuterRef("pk"),
            status__in=["open", "partial", "overdue"],
        )
    ),
    has_any_receivables=Exists(
        ReceivableDocument.objects.filter(
            service_order_id=OuterRef("pk"),
        )
    ),
)
```

O serializer usa as anotações quando disponíveis, senão faz a query direta (para o detalhe).

### 1.3 Filtro de fechamento

Adicionar filtro customizado no ViewSet:

**Query param:** `?closure=closed` ou `?closure=pending`

- `closed`: `status="delivered"` AND `invoice_issued=True` AND `has_any_receivables=True` AND `has_pending_receivables=False`
- `pending`: `status="delivered"` AND NOT (todas as 3 condições acima)

---

## 2. Frontend — ClosingTab (detalhe da OS)

### 2.1 Checklist de fechamento

Adicionar no topo da ClosingTab, antes do conteúdo existente, um card com o checklist:

```
┌─────────────────────────────────────────────┐
│  Fechamento da OS                           │
│                                             │
│  ✓ Entregue                                 │
│  ✓ Faturada                                 │
│  ✗ Quitada         (2 de 3 títulos pagos)   │
│                                             │
│  Pendente quitação                          │
└─────────────────────────────────────────────┘
```

- Cada item: ícone verde (CheckCircle) quando atendido, cinza (Circle) quando pendente
- Quando os 3 estiverem verdes: badge "OS FECHADA" com ícone Lock, fundo success
- Se status não é `delivered`: não mostrar o checklist (não faz sentido antes da entrega)

### 2.2 Dados

Usa o `closure_status` já retornado pelo endpoint de detalhe da OS. Sem chamada extra.

---

## 3. Frontend — Listagem de OS

### 3.1 Indicador de 3 dots

Para OS com status `delivered`, mostrar 3 dots ao lado do StatusBadge existente:

- Dot 1 = entregue (sempre verde se status é delivered)
- Dot 2 = faturada (verde se `closure_status.is_invoiced`)
- Dot 3 = quitada (verde se `closure_status.is_paid`)

`●●○` — 2 de 3 condições

Quando os 3 estiverem verdes: substituir dots por ícone Lock verde.

Tooltip no hover: "Entregue · Faturada · Pendente quitação"

Para OS que não são `delivered`: não mostrar nada extra.

### 3.2 Componente ClosureDots

Novo componente reutilizável:

```tsx
interface ClosureDotsProps {
  closureStatus: {
    is_delivered: boolean
    is_invoiced: boolean
    is_paid: boolean
    is_closed: boolean
  }
}
```

Renderiza os 3 dots ou o ícone de cadeado.

---

## 4. Frontend — Filtro na listagem

### 4.1 Dropdown de fechamento

Adicionar ao painel de filtros existente na página `/os`:

**Label:** "Fechamento"
**Opções:**
- Todas (sem filtro)
- Fechadas (`?closure=closed`)
- Pendentes (`?closure=pending`)

Só aparece como opção funcional — não bloqueia outros filtros.

---

## 5. Tipo TypeScript

Adicionar ao tipo `ServiceOrder` em `packages/types`:

```typescript
interface ClosureStatus {
  is_delivered: boolean
  is_invoiced: boolean
  is_paid: boolean
  is_closed: boolean
}

// No ServiceOrder:
closure_status: ClosureStatus | null  // null se não é delivered
```

---

## 6. Fora do Escopo

- Mudança no fluxo de billing ou pagamento
- Bloqueio de ações baseado no fechamento (ex: impedir edição)
- Notificações/alertas de OS pendentes
- Dashboard de fechamento
- Fechamento no mobile
