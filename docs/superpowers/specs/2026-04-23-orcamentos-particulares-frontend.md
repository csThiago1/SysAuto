# Orçamentos Particulares — Frontend Spec

**Data:** 2026-04-23
**Branch:** feat/port-worktree-shamir
**Backend:** `apps.budgets` (já implementado e testado — 29/29 testes passando)

---

## Objetivo

Criar a interface frontend para o módulo de Orçamentos Particulares (`apps.budgets`). Orçamento Particular é distinto do Orçamento Cilia (MO-7/`apps.quotes`): serve clientes sem seguradora, com fluxo próprio de versões e aprovação que cria uma OS automaticamente.

---

## Rota e Navegação

- Rota raiz: `/orcamentos-particulares`
- Sidebar: item "Orç. Particulares" com ícone `ReceiptText`, posicionado entre "Orçamentos" e "Cadastros"
- Acesso mínimo: `CONSULTANT`

---

## Páginas

### 1. `/orcamentos-particulares` — Lista

- 4 KPI cards: **Total**, **Rascunhos**, **Enviados**, **Aprovados**
- Tabela com colunas: Número, Cliente, Placa, Versão ativa (status badge), Valor líquido, Data
- Filtro por status (select)
- Busca por número/placa/cliente
- Botão "Novo Orçamento" → `/orcamentos-particulares/novo`

### 2. `/orcamentos-particulares/novo` — Criação

Formulário com campos:
- Cliente (busca por nome — `GET /api/proxy/customers/`)
- Placa do veículo
- Descrição do veículo (preenchida automaticamente se placa existir via `apps.vehicles`)

Submit → `POST /api/proxy/budgets/` → redireciona para `/orcamentos-particulares/[id]`

### 3. `/orcamentos-particulares/[id]` — Detalhe

**Header (`BudgetHeader`):**
- Número do orçamento (ex: ORC-2026-000001), versão ativa, status badge
- Botões contextuais por status:
  - `draft` → "Enviar ao Cliente" (CONSULTANT+)
  - `sent` → "Aprovar" + "Rejeitar" + "Solicitar Revisão" (MANAGER+ para aprovar/rejeitar)
  - `approved` → link para OS gerada
  - `rejected`/`expired` → "Clonar Orçamento"
- Download PDF (ícone)

**Tabs:**
- **Itens** — tabela de itens da versão ativa + `ItemSheet`
- **Versões** — histórico de todas as versões com status e datas

**`ItemsTable`:**
- Colunas: Descrição, Tipo, Qtd, Preço Unit., Desconto, Total líquido
- Linha de totais (peças, MO, desconto, total)
- Botão "Adicionar Item" → abre `ItemSheet`
- Clique em item existente → abre `ItemSheet` em modo edição
- Bloqueado (read-only) se versão não for `draft`

**`ItemSheet` (Sheet lateral):**
- Campos do `BudgetVersionItem`: descrição, tipo (PART/SERVICE/etc.), bucket, payer_block, qtd, preço unit., desconto %, preço líquido (calculado), flags
- Seção "Operações de Mão de Obra": lista de operações com botão +
  - Cada operação: tipo (select), categoria MO (select), horas, valor/hora, custo MO (calculado)
- Botão Salvar / Excluir

**`VersionHistory`:**
- Lista de versões: número, status badge, data criação, data envio, data aprovação
- Link para download PDF por versão

---

## Types (`packages/types/src/budget.types.ts`)

```typescript
export type BudgetVersionStatus =
  | "draft" | "sent" | "approved" | "rejected"
  | "expired" | "revision" | "superseded"

export interface ItemOperation {
  id: number
  operation_type: { id: number; code: string; label: string }
  labor_category: { id: number; code: string; label: string }
  hours: string
  hourly_rate: string
  labor_cost: string
}

export interface BudgetVersionItem {
  id: number
  bucket: string
  payer_block: string
  item_type: "PART" | "SERVICE" | "EXTERNAL_SERVICE" | "FEE" | "DISCOUNT"
  description: string
  external_code: string
  part_type: string
  supplier: string
  quantity: string
  unit_price: string
  unit_cost: string | null
  discount_pct: string
  net_price: string
  sort_order: number
  operations: ItemOperation[]
  // flags
  flag_abaixo_padrao: boolean
  flag_acima_padrao: boolean
  flag_inclusao_manual: boolean
  flag_codigo_diferente: boolean
  flag_servico_manual: boolean
  flag_peca_da_conta: boolean
}

export interface BudgetVersion {
  id: number
  version_number: number
  status: BudgetVersionStatus
  status_display: string
  valid_until: string | null
  subtotal: string
  discount_total: string
  net_total: string
  labor_total: string
  parts_total: string
  pdf_s3_key: string
  sent_at: string | null
  approved_at: string | null
  approved_by: string
  created_by: string
  created_at: string
  items: BudgetVersionItem[]
}

export interface Budget {
  id: number
  number: string
  customer: number
  customer_name: string
  vehicle_plate: string
  vehicle_description: string
  cloned_from: number | null
  service_order: number | null
  active_version: BudgetVersion | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BudgetListItem extends Omit<Budget, "active_version"> {
  active_version: Pick<BudgetVersion, "id" | "version_number" | "status" | "status_display" | "net_total"> | null
}
```

---

## Hooks (`src/hooks/useBudgets.ts`)

| Hook | Método | Endpoint |
|------|--------|----------|
| `useBudgets(filters?)` | GET | `/budgets/` |
| `useBudget(id)` | GET | `/budgets/{id}/` |
| `useCreateBudget` | POST | `/budgets/` |
| `useCloneBudget` | POST | `/budgets/{id}/clone/` |
| `useBudgetVersions(budgetId)` | GET | `/budgets/{id}/versions/` |
| `useSendBudget` | POST | `/budgets/{id}/versions/{vId}/send/` |
| `useApproveBudget` | POST | `/budgets/{id}/versions/{vId}/approve/` |
| `useRejectBudget` | POST | `/budgets/{id}/versions/{vId}/reject/` |
| `useRequestRevision` | POST | `/budgets/{id}/versions/{vId}/revision/` |
| `useBudgetItems(budgetId, versionId)` | GET | `/budgets/{id}/versions/{vId}/items/` |
| `useCreateBudgetItem` | POST | `/budgets/{id}/versions/{vId}/items/` |
| `useDeleteBudgetItem` | DELETE | `/budgets/{id}/versions/{vId}/items/{itemId}/` |

---

## Padrões a seguir

- `fetchList<T>` para endpoints paginados (extrai `.results`)
- `queryKeys` com prefixo `budgets`
- Mutations com `try/catch` + `toast.error`
- `ConfirmDialog` para aprovar e rejeitar (ações irreversíveis)
- Formulários com React Hook Form + Zod
- Status badge com tokens `success-*`, `info-*`, `error-*`, `warning-*` (nunca cores brutas)
- `TableSkeleton` durante loading

---

## Restrições

- `ItemSheet` bloqueado se `version.status !== "draft"` (mensagem "Versão enviada — somente leitura")
- Botão "Enviar" só ativo se versão tiver ao menos 1 item
- Aprovação só permitida para MANAGER+ (verificar via `usePermission("MANAGER")`)
