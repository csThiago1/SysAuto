# Faturamento de OS — Design Spec

**Data:** 2026-04-27
**Autor:** Thiago + Claude
**Status:** Aprovado

---

## 1. Objetivo

Botão "$" para faturamento de OS que gera títulos a receber, emite notas fiscais (NFS-e/NF-e), salva documentos na OS e registra movimentações financeiras — tudo em um único fluxo visual.

## 2. Onde aparece

- **Lista de OS** (`ServiceOrderTable`): coluna com ícone `DollarSign` por linha
- **ClosingTab**: botão "Faturar OS" na seção fiscal

Habilitado quando: `status >= authorized` E `invoice_issued === false`.

## 3. Regras de Split

### Particular (customer_type = "private")

| # | Destinatário | Valor | Nota Fiscal |
|---|---|---|---|
| 1 | Cliente | `parts_total + services_total - discount_total` | NFS-e (serviços) + NF-e (peças, se houver) |

### Seguradora (customer_type = "insurer")

Franquia (`deductible_amount`) debita primeiro de serviços; saldo restante debita de peças.

```
franquia = deductible_amount ?? 0
franquia_absorve_servicos = min(franquia, services_total)
franquia_absorve_pecas = franquia - franquia_absorve_servicos
servicos_seguradora = services_total - franquia_absorve_servicos
pecas_seguradora = parts_total - franquia_absorve_pecas
```

| # | Destinatário | Valor | Nota Fiscal | Condição |
|---|---|---|---|---|
| 1 | Cliente (franquia) | `franquia` | NFS-e | Somente se franquia > 0 |
| 2 | Seguradora (serviços) | `servicos_seguradora` | NFS-e | Somente se > 0 |
| 3 | Seguradora (peças) | `pecas_seguradora` | NF-e | Somente se > 0 |

## 4. Condições de Pagamento

### Métodos

| Código | Label |
|---|---|
| `pix` | Pix |
| `cash` | Dinheiro |
| `debit` | Débito |
| `credit` | Crédito à Vista |
| `credit_installment` | Crédito a Prazo |
| `boleto` | Boleto |
| `transfer` | Transferência Bancária |

### Prazos

| Dias | Label |
|---|---|
| 0 | À vista |
| 7 | 7 dias |
| 10 | 10 dias |
| 15 | 15 dias |
| 21 | 21 dias |
| 30 | 30 dias |
| 45 | 45 dias |
| 60 | 60 dias |

### Defaults por tipo de título

| Tipo | Método | Prazo |
|---|---|---|
| Particular (cliente) | Pix | À vista |
| Franquia (cliente) | Pix | À vista |
| Seguradora (serviços) | Boleto | 30 dias |
| Seguradora (peças) | Boleto | 30 dias |

## 5. Modal Visual — Layout

```
┌──────────────────────────────────────────────────────┐
│  $ Faturamento — OS #123                             │
│  (logo) Chevrolet Onix (QZA4C43) · Thiago Souza     │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌─ RESUMO ─────────────────────────────────────────┐│
│  │ Peças ........................ R$ 1.200,00        ││
│  │ Serviços .................... R$   480,00        ││
│  │ Descontos ................... R$   -80,00        ││
│  │ ───────────────────────────────────────          ││
│  │ TOTAL ....................... R$ 1.600,00        ││
│  │ Franquia .................... R$   500,00        ││
│  └───────────────────────────────────────────────────┘│
│                                                       │
│  ┌─ TÍTULOS A GERAR ────────────────────────────────┐│
│  │                                                   ││
│  │ 1. Franquia → Cliente                   R$ 500   ││
│  │    [Pix ▾]  [À vista ▾]  [Plano de contas ▾]    ││
│  │                                                   ││
│  │ 2. Serviços → Seguradora                R$   0*  ││
│  │    * Franquia absorveu serviços                   ││
│  │                                                   ││
│  │ 3. Peças → Seguradora                 R$ 1.180   ││
│  │    [Boleto ▾]  [30 dias ▾]  [Plano de contas ▾]  ││
│  │                                                   ││
│  └───────────────────────────────────────────────────┘│
│                                                       │
│  ⓘ Notas fiscais serão emitidas automaticamente.     │
│    PDF e XML salvos na pasta Financeiro da OS.        │
│                                                       │
│           [Cancelar]    [$ Faturar e Emitir NF]       │
└──────────────────────────────────────────────────────┘
```

Títulos com valor zero são exibidos com nota explicativa e não geram ReceivableDocument nem nota fiscal.

## 6. Backend

### Endpoint

```
POST /api/v1/service-orders/{id}/billing/
```

**Permissão:** CONSULTANT+ (criação), MANAGER+ aprovação implícita na emissão fiscal.

**Validações:**
- OS existe e `is_active = True`
- `status` em `[authorized, repair, mechanic, bodywork, painting, assembly, polishing, washing, final_survey, ready, delivered]`
- `invoice_issued = False` (não permite faturamento duplo)
- Para NF-e: todas as peças devem ter NCM 8 dígitos
- Destinatário (cliente ou seguradora Person) deve ter CPF/CNPJ e endereço com município IBGE

**Payload:**
```json
{
  "items": [
    {
      "recipient_type": "customer | insurer",
      "category": "deductible | services | parts | full",
      "amount": 500.00,
      "payment_method": "pix",
      "payment_term_days": 0,
      "chart_of_account_id": null
    }
  ]
}
```

**Response (201):**
```json
{
  "receivables": [ReceivableDocument...],
  "fiscal_documents": [FiscalDocument...],
  "summary": {
    "total_billed": 1680.00,
    "receivables_count": 2,
    "fiscal_docs_count": 2
  }
}
```

### Fluxo Atômico (`@transaction.atomic`)

1. Validar OS (status, invoice_issued, dados do destinatário)
2. Para cada item com `amount > 0`:
   a. Criar `ReceivableDocument` (origin = "OS", status = "OPEN")
   b. Emitir nota fiscal:
      - `category in (services, deductible)` → NFS-e via `FiscalService.emit_nfse()`
      - `category == parts` → NF-e via `FiscalService.emit_nfe()`
      - `category == full` → NFS-e (serviços) + NF-e (peças, se parts_total > 0)
   c. Vincular `ReceivableDocument.fiscal_document = doc`
3. Quando notas forem autorizadas (polling via Celery):
   - Salvar PDF/XML como `ServiceOrderPhoto` na pasta `financeiro`
4. Criar `ServiceOrderActivityLog` tipo `invoice_issued`
5. Setar `ServiceOrder.invoice_issued = True`
6. Retornar response

### Service: `BillingService`

Nova classe em `apps/service_orders/services.py`:

```python
class BillingService:
    @classmethod
    @transaction.atomic
    def bill(
        cls,
        order: ServiceOrder,
        items: list[dict],
        billed_by: GlobalUser,
    ) -> dict:
        """Fatura OS: cria títulos a receber + emite notas fiscais."""
```

## 7. Frontend

### Componentes

```
service-orders/[id]/_components/
  BillingModal.tsx          ← Modal principal de faturamento
  BillingBreakdown.tsx      ← Seção resumo (peças/serviços/descontos/total)
  BillingItemRow.tsx        ← Linha de título (destinatário, valor, método, prazo)
```

### Hook

```typescript
// Em _hooks/useBilling.ts
export function useBillingPreview(orderId: string)
  // GET /service-orders/{id}/billing/preview/
  // Retorna breakdown calculado pelo backend (sem criar nada)

export function useBillOS()
  // POST /service-orders/{id}/billing/
  // Mutation que executa o faturamento
```

### Endpoint Preview

```
GET /api/v1/service-orders/{id}/billing/preview/
```

Retorna o breakdown calculado sem criar nada — para popular o modal:

```json
{
  "parts_total": "1200.00",
  "services_total": "480.00",
  "discount_total": "80.00",
  "grand_total": "1600.00",
  "deductible_amount": "500.00",
  "customer_type": "insurer",
  "customer_name": "Thiago Souza",
  "insurer_name": "Porto Seguro",
  "items": [
    {
      "recipient_type": "customer",
      "category": "deductible",
      "label": "Franquia → Cliente",
      "amount": "500.00",
      "default_payment_method": "pix",
      "default_payment_term_days": 0
    },
    {
      "recipient_type": "insurer",
      "category": "services",
      "label": "Serviços → Porto Seguro",
      "amount": "0.00",
      "note": "Franquia absorveu serviços"
    },
    {
      "recipient_type": "insurer",
      "category": "parts",
      "label": "Peças → Porto Seguro",
      "amount": "1180.00",
      "default_payment_method": "boleto",
      "default_payment_term_days": 30
    }
  ]
}
```

### Integração na Lista de OS

`ServiceOrderTable.tsx`: nova coluna entre STATUS e AÇÃO:

```tsx
<TableHead className="w-[50px]">$</TableHead>
// ...
<TableCell>
  {!order.invoice_issued && isStatusEligible(order.status) ? (
    <button onClick={(e) => { e.stopPropagation(); openBilling(order) }}>
      <DollarSign className="h-4 w-4 text-success-400" />
    </button>
  ) : order.invoice_issued ? (
    <CheckCircle className="h-4 w-4 text-success-400" />
  ) : null}
</TableCell>
```

### Integração na ClosingTab

Botão "Faturar OS" substitui o botão "Emitir NFS-e" atual quando `invoice_issued === false`.

## 8. Efeitos Colaterais

Após faturamento bem-sucedido:

| Ação | Destino |
|---|---|
| `ReceivableDocument` criado | Contas a Receber (`/financeiro/contas-receber`) |
| NFS-e/NF-e emitida | Documentos Fiscais (`/fiscal/documentos`) |
| PDF/XML salvos | Aba Arquivos da OS (pasta `financeiro`) |
| Log de atividade | Aba Histórico da OS (tipo `invoice_issued`) |
| `invoice_issued = true` | ServiceOrder (desabilita botão "$") |
| Dashboard atualizado | Faturamento do dia/mês reflete novo valor |

## 9. Validações e Edge Cases

| Caso | Comportamento |
|---|---|
| OS já faturada | Botão desabilitado, tooltip "OS já faturada" |
| Status < authorized | Botão desabilitado |
| Peças sem NCM | Erro no backend, modal exibe mensagem |
| Cliente sem CPF/CNPJ | Erro no backend, modal exibe "Complete o cadastro do cliente" |
| Seguradora sem Person | Erro no backend |
| Franquia > total | Franquia limitada ao total da OS |
| Serviços = 0 | Título de serviços não é gerado |
| Peças = 0 | Título de peças não é gerado; NF-e não emitida |
| Focus offline | FiscalDocument criado como PENDING; polling Celery retenta |

## 10. Arquivos a Criar/Modificar

### Backend (criar)
- `apps/service_orders/services.py` → `BillingService` (nova classe)
- `apps/service_orders/views.py` → `billing` e `billing_preview` actions no ViewSet

### Backend (modificar)
- `apps/service_orders/models.py` → ActivityType `invoice_issued` (se não existir)

### Frontend (criar)
- `service-orders/[id]/_components/BillingModal.tsx`
- `service-orders/[id]/_hooks/useBilling.ts`

### Frontend (modificar)
- `service-orders/_components/ServiceOrderTable.tsx` → coluna "$"
- `service-orders/[id]/_components/tabs/ClosingTab.tsx` → botão "Faturar OS"
- `packages/types/src/service-order.types.ts` → tipos de billing

### Tipos
- `packages/types/src/billing.types.ts` (novo)
