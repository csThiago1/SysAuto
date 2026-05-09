# Modulo Financeiro-Fiscal Completo — Design Spec

**Data:** 2026-05-09
**Escopo:** Refactoring estrutural + integracoes fiscais avancadas + dashboard financeiro + automacao de fluxos
**Modulos envolvidos:** fiscal, accounts_payable, accounts_receivable, accounting, service_orders, inventory, purchasing
**Estimativa:** 7 sprints

---

## 1. Contexto e Motivacao

O sistema ja possui backends completos para fiscal (Focus NFE), contas a pagar, contas a receber e contabilidade, mas os modulos operam de forma isolada. Falta:

- Automacao dos fluxos OS -> NF-e -> AR e NF-e recebida -> estoque -> AP
- Operacoes fiscais avancadas (CCe, substituicao, inutilizacao)
- Dashboard financeiro consolidado com fluxo de caixa
- Codigo limpo: arquivos god-class, duplicacoes de types/utils, paginas gemeas

### Fluxos-alvo

**Ciclo de Saida (receita):**
```
OS -> billing -> NFS-e/NF-e (Focus) -> Conta a Receber -> Baixa -> Lancamento Contabil -> DRE
```

**Ciclo de Entrada (despesa):**
```
NF-e Recebida (Focus webhook) -> NFeEntrada (auto) -> Reconciliar itens -> Estoque -> Conta a Pagar (auto) -> Baixa -> Lancamento Contabil -> DRE
```

---

## 2. Sprint 1 — Refactoring P0: Duplicacoes e Shared Utils

**Objetivo:** Eliminar todas as duplicacoes criticas sem alterar comportamento.

### 2.1 Extrair `fetchList<T>` para `@/lib/api`

Atualmente copy-paste em 16 hooks. Exportar uma unica vez:

```typescript
// apps/dscar-web/src/lib/api.ts — adicionar export
export async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<PaginatedResponse<T> | T[]>(url);
  if (data && !Array.isArray(data) && "results" in data) return data.results;
  return data as T[];
}
```

Arquivos a atualizar (remover definicao local, adicionar import):
- `useFiscal.ts`, `useInventory.ts`, `useInventoryMovement.ts`, `useInventoryCounting.ts`
- `useInventoryLocation.ts`, `useInventoryProduct.ts`, `usePricingCatalog.ts`
- `usePricingProfile.ts`, `usePricingEngine.ts`, `useQuotes.ts`, `useCapacidade.ts`
- `usePurchasing.ts`, `useExperts.ts`, `useFichaTecnica.ts`, `useBenchmark.ts`, `useBudgets.ts`

### 2.2 Substituir formatters inline por `@paddock/utils`

**`formatDate`** — 9 arquivos redefinem inline. Substituir por:
```typescript
import { formatDate } from "@paddock/utils";
```
Arquivos: `MovimentacaoTimeline.tsx`, `contagens/page.tsx`, `contagens/[id]/page.tsx`, `contas-pagar/page.tsx`, `contas-receber/page.tsx`, `contas-pagar/[id]/page.tsx`, `contas-receber/[id]/page.tsx`, `compras/ordens/page.tsx`, `fichas-tecnicas/page.tsx`, `fichas-tecnicas/[servico_id]/page.tsx`

**`formatCurrency`** — 3 arquivos: `compras/ordens/page.tsx`, `simulador/page.tsx`, `snapshots/page.tsx`

**`formatDateTime`** — 3 arquivos: `contas-pagar/[id]/page.tsx`, `contas-receber/[id]/page.tsx`, `fichas-tecnicas/[servico_id]/page.tsx`

**`formatCNPJ`** — 1 arquivo: `InsurerDialog.tsx`

### 2.3 Centralizar STATUS_LABELS em `@paddock/utils`

Criar `packages/utils/src/status-labels.ts`:

```typescript
export const RECEIVABLE_STATUS_LABEL: Record<string, string> = {
  open: "Em Aberto", partial: "Parcial", received: "Recebido",
  overdue: "Vencido", cancelled: "Cancelado",
};

export const PAYABLE_STATUS_LABEL: Record<string, string> = {
  open: "Em Aberto", partial: "Parcial", paid: "Pago",
  overdue: "Vencido", cancelled: "Cancelado",
};

export const FISCAL_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", authorized: "Autorizada", rejected: "Rejeitada",
  cancelled: "Cancelada",
};

export const NFE_ENTRADA_STATUS_LABEL: Record<string, string> = {
  importada: "Importada", validada: "Validada", estoque_gerado: "Estoque Gerado",
};

export const BUDGET_VERSION_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", pending: "Pendente", approved: "Aprovado",
  rejected: "Rejeitado",
};

export const UNIDADE_FISICA_STATUS_LABEL: Record<string, string> = {
  available: "Disponivel", reserved: "Reservada", consumed: "Consumida",
  returned: "Devolvida",
};
```

Remover definicoes duplicadas dos 8 locais identificados.

### 2.4 Mover types inline para `@paddock/types`

Adicionar a `packages/types/src/fiscal.types.ts`:
```typescript
export interface NfeRecebida {
  chave: string;
  nome_emitente: string;
  cnpj_emitente: string;
  valor_total: number;
  data_emissao: string;
  situacao: string;
  manifesto?: string;
}

export interface FiscalDocumentParams {
  document_type?: string;
  status?: string;
  service_order?: string;
}
```

Adicionar a `packages/types/src/customer.types.ts` (novo):
```typescript
export interface Customer {
  id: string;
  name: string;
  cpf_cnpj?: string;
  person_id?: string;
}
```

Corrigir typos: `ServicoCanonicoPaylod` -> `ServicoCanonicoPayload`, `MaterialCanonicoPaylod` -> `MaterialCanonicoPayload`

### 2.5 Remover stub Asaas

- Deletar `AsaasWebhookView` de `accounts_payable/views.py`
- Remover rota `asaas/webhook/` de `accounts_payable/urls.py`
- Remover qualquer referencia a Asaas em comentarios/TODOs

---

## 3. Sprint 2 — Refactoring P1: God-Files e Shared Components

**Objetivo:** Quebrar arquivos grandes, criar componentes financeiros reutilizaveis.

### 3.1 Backend — Quebrar `service_orders/`

**models.py (1789 linhas) -> models/ (5 arquivos):**

| Arquivo | Conteudo |
|---------|----------|
| `models/service_order.py` | ServiceOrder, ServiceOrderStatus, enums, CustomerType, OSType |
| `models/items.py` | ServiceOrderPart, ServiceOrderLabor, ChecklistItem |
| `models/versioning.py` | ServiceOrderVersion, ServiceOrderVersionItem, ServiceOrderEvent |
| `models/capacity.py` | CapacidadeTecnico, AreaLabel |
| `models/parecer.py` | ServiceOrderParecer, TransitionOverrideRequest, OSAreaImpacto, OSIntervencao, OSItemAdicional |
| `models/__init__.py` | Re-export tudo para manter compatibilidade |

**views.py (2226 linhas) -> views/ (5 arquivos):**

| Arquivo | Conteudo |
|---------|----------|
| `views/orders.py` | ServiceOrderViewSet (CRUD + actions) |
| `views/dashboard.py` | DashboardStatsView (delega para DashboardService) |
| `views/calendar.py` | CalendarView |
| `views/catalog.py` | ServiceCatalogViewSet, HolidayViewSet |
| `views/versioning.py` | ServiceOrderVersionViewSet, ServiceOrderEventViewSet, ServiceOrderParecerViewSet |

**services.py (1347 linhas) -> services/ (4 arquivos):**

| Arquivo | Conteudo |
|---------|----------|
| `services/order_service.py` | create, transition, change_status, add_part, add_labor |
| `services/versioning_service.py` | create_new_version, approve_version, compare_versions, apply_override, recalculate_totals |
| `services/dashboard_service.py` | _legacy_stats, _consultant_stats, _manager_stats (extraido de DashboardStatsView) |
| `services/delivery_service.py` | (ja existe, manter) |

**serializers.py (1280 linhas) -> serializers/ (3 arquivos):**

| Arquivo | Conteudo |
|---------|----------|
| `serializers/core.py` | ServiceOrder CRUD, parts, labor, photos, checklist |
| `serializers/mobile.py` | ServiceOrderMobileSyncSerializer (WatermelonDB) |
| `serializers/versioning.py` | version, diff, event, parecer serializers |

### 3.2 Backend — Extrair logica de negocio das views

**DashboardStatsView** (275 linhas de queries inline):
- Mover para `DashboardService.get_stats(user, role, period)`
- View so chama service e retorna Response

**ServiceOrderViewSet.import_cilia** (160 linhas inline):
- Mover para `CiliaImportService.import_for_order(order, params)`
- View so valida input e chama service

**ServiceOrderViewSet.photos** (90 linhas de storage):
- Mover para `PhotoService.upload(order, file, folder)`

### 3.3 Frontend — Componentes financeiros reutilizaveis

**`src/components/financeiro/FinanceiroListPage.tsx`:**

```typescript
interface FinanceiroListPageProps<T> {
  title: string;
  // data
  documents: T[];
  isLoading: boolean;
  // config
  columns: ColumnDef<T>[];
  statusLabels: Record<string, string>;
  originLabels: Record<string, string>;
  // filters
  statusOptions: { value: string; label: string }[];
  originOptions: { value: string; label: string }[];
  // actions
  onPay?: (doc: T, data: PaymentData) => Promise<void>;
  onCancel?: (doc: T, reason: string) => Promise<void>;
  // labels
  payLabel?: string;      // "Pagar" | "Receber"
  amountPaidLabel?: string; // "Pago" | "Recebido"
  entityLabel?: string;    // "Fornecedor" | "Cliente"
}
```

Usado por `contas-pagar/page.tsx` e `contas-receber/page.tsx` — cada um fica com ~50 linhas.

**`src/components/financeiro/FinanceiroDetailPage.tsx`:**

```typescript
interface FinanceiroDetailPageProps<T, P> {
  document: T | undefined;
  isLoading: boolean;
  payments: P[];
  statusLabels: Record<string, string>;
  // actions
  onPay: (data: PaymentData) => Promise<void>;
  onCancel: (reason: string) => Promise<void>;
  // labels
  payLabel: string;
  entityLabel: string;
  backHref: string;
}
```

Usado por `contas-pagar/[id]/page.tsx` e `contas-receber/[id]/page.tsx`.

**Outros componentes extraidos:**
- `PaymentDialog.tsx` — dialog de pagamento/recebimento parametrizado
- `CancelDialog.tsx` — dialog de cancelamento com justificativa
- `FinanceiroStatusBadge.tsx` — badge com cores por status
- `SummaryCards.tsx` — 4 cards de resumo (Total, Vencido, Pago/Recebido, A Vencer)

### 3.4 Frontend — Quebrar `emitir-nfe/page.tsx` (785 linhas)

```
fiscal/emitir-nfe/
├── page.tsx              # ~80 linhas (tabs + state)
├── _components/
│   ├── TabFromOS.tsx     # ~120 linhas
│   ├── TabManual.tsx     # ~200 linhas
│   ├── ItemRow.tsx       # ~80 linhas
│   └── SuccessCard.tsx   # ~60 linhas
```

---

## 4. Sprint 3 — Operacoes Fiscais Avancadas (Focus NFE)

**Objetivo:** Implementar todas as operacoes Focus que faltam.

### 4.1 Carta de Correcao Eletronica (CCe)

**Backend:**
```python
# fiscal/views.py — nova action
class FiscalDocumentViewSet:
    @action(detail=True, methods=["post"], url_path="cce")
    def carta_correcao(self, request, pk=None):
        """POST /api/v1/fiscal/documents/{pk}/cce/"""
        # body: { "correcao": "texto 15-1000 chars" }
        doc = self.get_object()
        result = FiscalService.carta_correcao(doc, request.data["correcao"])
        return Response(result, status=200)

# fiscal/services/fiscal_service.py
def carta_correcao(self, doc, texto):
    if doc.status != "authorized": raise FiscalInvalidStatus
    if doc.document_type != "NFE": raise FiscalValidationError("CCe so para NF-e")
    if doc.cce_count >= 20: raise FiscalValidationError("Limite de 20 CCe atingido")
    resp = client.cce(doc.ref, doc.cce_count + 1, texto)
    doc.cce_count = F("cce_count") + 1
    doc.save(update_fields=["cce_count"])
    FiscalEvent.objects.create(document=doc, event_type="CCE", ...)
    return {"status": "ok", "sequencial": doc.cce_count + 1}
```

**Frontend:**
- Botao "Carta de Correcao" na tabela de documentos (so NF-e autorizadas)
- Dialog com textarea (15-1000 chars) + aviso "so permite corrigir dados secundarios"

### 4.2 Substituicao de NFS-e

**Backend:**
```python
# fiscal/views.py
class NfseSubstituirView(APIView):
    """POST /api/v1/fiscal/nfse/substituir/"""
    # body: { "chave_nfse_substituida": "...", "service_order_id": "..." }
    # ou body manual com itens

# fiscal/services/fiscal_service.py
def emit_nfse_substitution(self, chave_substituida, service_order=None, input_data=None):
    original = FiscalDocument.objects.get(key=chave_substituida, status="authorized")
    # emite nova NFS-e com campo chave_nfse_substituida no payload
    # atualiza original.status = "substituido"
    # atualiza original.substituida_por = nova_doc
```

**Frontend:**
- Na pagina de documentos, botao "Substituir" em NFS-e autorizadas
- Abre formulario pre-preenchido com dados da nota original

### 4.3 Inutilizacao de Numeracao

**Backend:**
```python
# fiscal/views.py
class NfeInutilizacaoView(APIView):
    """POST /api/v1/fiscal/nfe/inutilizacao/"""
    # body: { "serie": 1, "numero_inicial": 10, "numero_final": 15, "justificativa": "..." }

class NfeInutilizacaoListView(APIView):
    """GET /api/v1/fiscal/nfe/inutilizacoes/"""
```

**Frontend:**
- Nova pagina `/fiscal/inutilizacao`
- Formulario: serie, numero inicial/final, justificativa
- Lista de inutilizacoes realizadas

### 4.4 Envio de NF-e/NFS-e por Email

**Backend:**
```python
# fiscal/views.py — nova action
class FiscalDocumentViewSet:
    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):
        """POST /api/v1/fiscal/documents/{pk}/send-email/"""
        # body: { "emails": ["addr@example.com"] }
        doc = self.get_object()
        result = FiscalService.send_email(doc, request.data["emails"])
        doc.email_sent_at = timezone.now()
        doc.save(update_fields=["email_sent_at"])
        return Response(result)
```

**Frontend:**
- Botao "Enviar por Email" na tabela de documentos (so autorizadas)
- Dialog com input de emails (max 10)

### 4.5 Webhook Automatico

**Backend:**
```python
# fiscal/apps.py
class FiscalConfig(AppConfig):
    def ready(self):
        from .tasks import ensure_webhooks_registered
        # agendar verificacao no startup via post_migrate signal

# fiscal/tasks.py
@shared_task
def ensure_webhooks_registered(tenant_schema):
    """Garante que webhooks Focus estao registrados para todos os eventos necessarios."""
    required_events = ["nfe", "nfsen", "nfe_recebida"]
    config = FiscalConfigModel.objects.first()
    client = FocusNFeClient(config.focus_token, ...)
    existing = client.list_webhooks()
    for event in required_events:
        if not any(h["event"] == event for h in existing):
            client.create_webhook(event, webhook_url)
```

Adicionar ao `FocusNFeClient`:
```python
def list_webhooks(self) -> list[dict]: ...
def create_webhook(self, event: str, url: str, authorization: str = "") -> dict: ...
def delete_webhook(self, hook_id: str) -> dict: ...
```

### 4.6 Preview DANFE (sem emitir)

**Backend:**
```python
# fiscal/views.py
class DanfePreviewView(APIView):
    """POST /api/v1/fiscal/nfe/danfe-preview/"""
    # Recebe payload NF-e, envia para Focus /v2/nfe/danfe, retorna PDF
```

---

## 5. Sprint 4 — Ciclo de Entrada Completo

**Objetivo:** NF-e recebida -> NFeEntrada -> estoque -> conta a pagar, tudo automatizado.

### 5.1 Auto-import de NF-e Recebida via Webhook

Quando webhook `nfe_recebida` chega:
1. Focus notifica nosso endpoint
2. Backend busca dados completos da NF-e via `GET /v2/nfe_recebidas/{chave}`
3. Cria `NFeEntrada` automaticamente com status `importada`
4. Envia notificacao no frontend (novo campo `NFeEntrada.auto_imported = True`)

```python
# fiscal/views.py — FocusWebhookView.post() — adicionar handler
if event == "nfe_recebida":
    chave = payload.get("chave")
    NFeEntradaAutoImportService.import_from_webhook(chave, config)
```

```python
# fiscal/services/auto_import.py (novo)
class NFeEntradaAutoImportService:
    @staticmethod
    @transaction.atomic
    def import_from_webhook(chave: str, config: FiscalConfigModel) -> NFeEntrada:
        if NFeEntrada.objects.filter(chave_acesso=chave).exists():
            return  # idempotente
        client = FocusNFeClient(config.focus_token, ...)
        nfe_data = client.get_nfe_recebida(chave)
        nfe_entrada = NFeEntrada.objects.create(
            chave_acesso=chave,
            emitente_cnpj=nfe_data["cnpj_emitente"],
            emitente_nome=nfe_data["nome_emitente"],
            valor_total=nfe_data["valor_total"],
            data_emissao=nfe_data["data_emissao"],
            status="importada",
            auto_imported=True,
        )
        for item in nfe_data.get("items", []):
            NFeEntradaItem.objects.create(nfe_entrada=nfe_entrada, ...)
        return nfe_entrada
```

### 5.2 Auto-criacao de Conta a Pagar

Ao validar NFeEntrada (reconciliar itens + gerar estoque), criar AP automaticamente:

```python
# fiscal/services/ingestao.py — apos gerar estoque
def criar_registros_estoque(self, nfe_id, realizado_por_id):
    # ... logica existente ...
    # NOVO: criar conta a pagar
    PayableDocumentService.create_payable(
        supplier_id=self._get_or_create_supplier(nfe.emitente_cnpj, nfe.emitente_nome),
        description=f"NF-e {nfe.chave_acesso[-6:]} - {nfe.emitente_nome}",
        amount=nfe.valor_total,
        due_date=nfe.data_emissao + timedelta(days=30),  # default 30 dias
        origin="NFE_E",
        document_number=nfe.chave_acesso,
        nfe_entrada=nfe,
        user=realizado_por,
    )
```

### 5.3 Matching com Pedido de Compra

```python
# fiscal/services/matching.py (novo)
class PurchaseOrderMatchingService:
    @staticmethod
    def find_matches(nfe_entrada: NFeEntrada) -> list[PurchaseOrder]:
        """Busca POs pendentes do mesmo fornecedor."""
        return PurchaseOrder.objects.filter(
            supplier__cnpj=nfe_entrada.emitente_cnpj,
            status__in=["approved", "sent"],
        )

    @staticmethod
    def link(nfe_entrada: NFeEntrada, purchase_order: PurchaseOrder):
        nfe_entrada.purchase_order = purchase_order
        nfe_entrada.save(update_fields=["purchase_order"])
        # Atualizar status do PO se todos itens recebidos
```

**Frontend:**
- Na pagina de NF-e Entrada, mostrar card "Pedidos de Compra Relacionados"
- Botao "Vincular" para associar manualmente
- Auto-sugestao baseada no CNPJ do fornecedor

### 5.4 Novos campos nos models

```python
# fiscal/models.py — NFeEntrada
auto_imported = BooleanField(default=False)
purchase_order = ForeignKey("purchasing.PurchaseOrder", null=True, on_delete=SET_NULL)
payable_document = ForeignKey("accounts_payable.PayableDocument", null=True, on_delete=SET_NULL)

# accounts_payable/models.py — PayableDocument
nfe_entrada = ForeignKey("fiscal.NFeEntrada", null=True, on_delete=SET_NULL)
```

### 5.5 Download de XML/DANFE de NF-e Recebida

Adicionar ao `FocusNFeClient`:
```python
def get_nfe_recebida(self, chave: str) -> dict: ...
def get_nfe_recebida_xml(self, chave: str) -> bytes: ...
def get_nfe_recebida_danfe(self, chave: str) -> bytes: ...
```

**Frontend:**
- Botoes "XML" e "DANFE" na lista de NF-e recebidas

---

## 6. Sprint 5 — Ciclo de Saida Completo

**Objetivo:** OS billing -> NF-e/NFS-e -> AR -> contabilidade, end-to-end.

### 6.1 Melhorar fluxo billing -> AR

O `BillingService.bill_service_order` ja cria AR via `create_from_billing()`, mas o metodo tem 250 linhas. Decompor:

```python
class BillingService:
    def bill_service_order(self, os, user, payment_term_days=30):
        items = self._build_billing_items(os)
        fiscal_docs = self._emit_fiscal_documents(os, items, user)
        receivables = self._create_receivables(os, items, fiscal_docs, payment_term_days)
        journal = self._post_accounting_entries(os, items, receivables)
        self._log_activity(os, user, fiscal_docs, receivables)
        return BillingResult(fiscal_docs, receivables, journal)
```

### 6.2 Vincular FiscalDocument -> ReceivableDocument

Ja existe FK `fiscal_document` em ReceivableDocument (migracao 0003). Garantir que billing preenche:

```python
def _create_receivables(self, os, items, fiscal_docs, payment_term_days):
    for doc in fiscal_docs:
        receivable = ReceivableDocumentService.create_receivable(
            ...,
            fiscal_document=doc,
        )
```

### 6.3 Parcelamento automatico

```python
# accounts_receivable/services.py — novo metodo
def create_installments(self, base_data, num_parcelas, interval_days=30):
    """Cria N titulos a receber com vencimentos escalonados."""
    valor_parcela = base_data["amount"] / num_parcelas
    parcelas = []
    for i in range(num_parcelas):
        data = {**base_data}
        data["amount"] = valor_parcela
        data["due_date"] = base_data["due_date"] + timedelta(days=i * interval_days)
        data["description"] = f"{base_data['description']} ({i+1}/{num_parcelas})"
        data["document_number"] = f"{base_data.get('document_number', '')}-{i+1}"
        parcelas.append(self.create_receivable(**data))
    return parcelas
```

Mesmo pattern para `accounts_payable`.

**Frontend:**
- No formulario de novo titulo (AP/AR), campo "Parcelas" (1-12)
- Preview das parcelas antes de confirmar

---

## 7. Sprint 6 — Dashboard Financeiro Completo

**Objetivo:** Visao consolidada de saude financeira com KPIs e graficos.

### 7.1 Backend — FinancialDashboardService

```python
# accounting/services/dashboard_service.py (novo)
class FinancialDashboardService:
    def get_summary(self, start_date, end_date, cost_center_id=None):
        return {
            "receita_mes": self._total_received(start_date, end_date),
            "despesa_mes": self._total_paid(start_date, end_date),
            "saldo": receita - despesa,
            "ar_vencidos": self._overdue_receivables(),
            "ap_vencidos": self._overdue_payables(),
            "fluxo_caixa_30d": self._cash_flow_projection(),
            "notas_emitidas": self._fiscal_summary("emitidas", start_date, end_date),
            "notas_recebidas": self._fiscal_summary("recebidas", start_date, end_date),
            "notas_pendentes": self._pending_fiscal_count(),
            "faturamento_por_os": self._billing_by_os(start_date, end_date),
            "faturamento_por_cliente": self._billing_by_customer(start_date, end_date),
            "aging_ar": self._aging_report("AR"),
            "aging_ap": self._aging_report("AP"),
        }

    def _cash_flow_projection(self):
        """Projecao 30 dias baseada em vencimentos AP/AR."""
        weeks = []
        for i in range(4):
            week_start = date.today() + timedelta(weeks=i)
            week_end = week_start + timedelta(days=6)
            entradas = ReceivableDocument.objects.filter(
                due_date__range=(week_start, week_end),
                status__in=["open", "partial", "overdue"],
            ).aggregate(total=Sum("amount_remaining"))["total"] or 0
            saidas = PayableDocument.objects.filter(
                due_date__range=(week_start, week_end),
                status__in=["open", "partial", "overdue"],
            ).aggregate(total=Sum(F("amount") - F("amount_paid")))["total"] or 0
            weeks.append({"semana": i + 1, "entradas": entradas, "saidas": saidas})
        return weeks

    def _aging_report(self, tipo):
        """Aging por faixa: 0-30, 31-60, 61-90, 90+."""
        Model = ReceivableDocument if tipo == "AR" else PayableDocument
        today = date.today()
        faixas = [
            ("0-30", today - timedelta(days=30), today),
            ("31-60", today - timedelta(days=60), today - timedelta(days=31)),
            ("61-90", today - timedelta(days=90), today - timedelta(days=61)),
            ("90+", date(2000, 1, 1), today - timedelta(days=91)),
        ]
        return [
            {
                "faixa": f,
                "count": Model.objects.filter(
                    status="overdue", due_date__range=(start, end)
                ).count(),
                "total": Model.objects.filter(
                    status="overdue", due_date__range=(start, end)
                ).aggregate(t=Sum("amount"))["t"] or 0,
            }
            for f, start, end in faixas
        ]
```

### 7.2 Backend — Endpoint

```python
# accounting/views.py
class FinancialDashboardView(APIView):
    """GET /api/v1/accounting/dashboard/?start_date=2026-05-01&end_date=2026-05-31"""
    permission_classes = [IsAuthenticated, IsManagerOrAbove]
```

### 7.3 Frontend — Dashboard Redesenhado

**Layout:**
```
[4 KPI Cards: Receita | Despesa | Saldo | NFs Pendentes]
[Grafico Fluxo de Caixa 30d — barras empilhadas entradas vs saidas]
[2 colunas: AR Vencidos | AP Vencidos — listas com link]
[Tabela: Faturamento por OS do mes — top 10]
[2 colunas: Aging AR | Aging AP — graficos donut por faixa]
```

**Hook:**
```typescript
// useFinanceiro.ts — novo
export function useFinancialDashboard(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["financial-dashboard", startDate, endDate],
    queryFn: () => apiFetch(`/api/proxy/accounting/dashboard/?start_date=${startDate}&end_date=${endDate}`),
  });
}
```

### 7.4 Relatorio de Faturamento

**Nova pagina:** `/financeiro/faturamento`

- Filtros: periodo (mes/trimestre/ano), agrupamento (cliente/tipo servico/seguradora/consultor)
- Tabela com totais por grupo
- Export CSV
- Grafico de barras comparativo

### 7.5 Relatorio de Inadimplencia

**Nova pagina:** `/financeiro/inadimplencia`

- Lista de clientes com AR vencido
- Ordenado por valor total em aberto
- Filtro por faixa de atraso (0-30, 31-60, 61-90, 90+)
- Detalhes expandiveis com titulos individuais

---

## 8. Sprint 7 — Extras e Polimento

**Objetivo:** Features adicionais de alto valor e baixa complexidade.

### 8.1 Alertas de Vencimento

```python
# Celery task diaria — accounts_payable/tasks.py e accounts_receivable/tasks.py
@shared_task
def task_check_upcoming_due_dates(tenant_schema):
    """Verifica titulos vencendo em 3, 7 e 15 dias."""
    with schema_context(tenant_schema):
        for days in [3, 7, 15]:
            target_date = date.today() + timedelta(days=days)
            ap = PayableDocument.objects.filter(due_date=target_date, status="open")
            ar = ReceivableDocument.objects.filter(due_date=target_date, status="open")
            # Criar notificacao no sistema (NotificationService ou campo em model)
```

**Frontend:**
- Badge no menu "Financeiro" com count de alertas
- Lista de alertas no dashboard

### 8.2 Despesa Recorrente -> AP Automatico

O model `DespesaRecorrente` ja existe em `accounting/` mas nao gera AP automaticamente.

```python
# accounting/tasks.py — nova task mensal
@shared_task
def task_generate_recurring_expenses(tenant_schema):
    """No dia 1 de cada mes, gera AP para cada DespesaRecorrente ativa."""
    with schema_context(tenant_schema):
        today = date.today()
        despesas = DespesaRecorrente.objects.filter(
            is_active=True,
            vigente_desde__lte=today,
        ).filter(Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=today))

        for d in despesas:
            PayableDocumentService.create_payable(
                supplier_id=d.supplier_id,  # novo FK
                description=f"{d.get_tipo_display()} - {today.strftime('%m/%Y')}",
                amount=d.valor,
                due_date=date(today.year, today.month, d.dia_vencimento),
                origin="AUTO",
                expense_account=d.conta_contabil,
                user=None,  # sistema
            )
```

Campos novos em `DespesaRecorrente`:
```python
supplier = ForeignKey("accounts_payable.Supplier", null=True, on_delete=SET_NULL)
dia_vencimento = PositiveIntegerField(default=10)  # dia do mes
```

### 8.3 Resumo Fiscal Mensal

```python
# fiscal/services/resumo_fiscal.py (novo)
class ResumoFiscalService:
    def get_monthly_summary(self, year, month):
        docs = FiscalDocument.objects.filter(
            status="authorized",
            created_at__year=year,
            created_at__month=month,
        )
        return {
            "total_nfse": docs.filter(document_type="NFSE").aggregate(Sum("amount")),
            "total_nfe": docs.filter(document_type="NFE").aggregate(Sum("amount")),
            "total_iss": FiscalDocumentItem.objects.filter(
                document__in=docs, document__document_type="NFSE"
            ).aggregate(Sum("valor_iss")),
            "total_icms": ...,
            "total_pis": ...,
            "total_cofins": ...,
            "count_emitidas": docs.count(),
            "count_canceladas": FiscalDocument.objects.filter(
                status="cancelled", created_at__year=year, created_at__month=month
            ).count(),
        }
```

**Frontend:**
- Card no dashboard financeiro com resumo de impostos do mes
- Pagina `/fiscal/resumo` com detalhamento mensal

### 8.4 NFS-e Recebida

Focus suporta webhook `nfse_recebida`. Implementar handler similar ao `nfe_recebida`:
- Receber webhook
- Listar NFS-e recebidas
- Armazenar para consulta

---

## 9. Novos Models/Campos Consolidados

### fiscal/models.py — FiscalDocument
```python
substituida_por = ForeignKey("self", null=True, on_delete=SET_NULL, related_name="substitui")
cce_count = PositiveIntegerField(default=0)
email_sent_at = DateTimeField(null=True, blank=True)
```

### fiscal/models.py — NFeEntrada
```python
auto_imported = BooleanField(default=False)
chave_acesso = CharField(max_length=44, unique=True, null=True)
purchase_order = ForeignKey("purchasing.PurchaseOrder", null=True, on_delete=SET_NULL)
payable_document = ForeignKey("accounts_payable.PayableDocument", null=True, on_delete=SET_NULL)
```

### accounts_payable/models.py — PayableDocument
```python
nfe_entrada = ForeignKey("fiscal.NFeEntrada", null=True, on_delete=SET_NULL)
```

### accounting/models.py — DespesaRecorrente
```python
supplier = ForeignKey("accounts_payable.Supplier", null=True, on_delete=SET_NULL)
dia_vencimento = PositiveIntegerField(default=10)
```

---

## 10. Novas Rotas Consolidadas

### Backend
```
# Sprint 3 — Fiscal avancado
POST   /api/v1/fiscal/documents/{pk}/cce/           CCe
POST   /api/v1/fiscal/documents/{pk}/send-email/     Envio email
POST   /api/v1/fiscal/nfse/substituir/               Substituicao NFS-e
POST   /api/v1/fiscal/nfe/inutilizacao/              Inutilizacao
GET    /api/v1/fiscal/nfe/inutilizacoes/             Lista inutilizacoes
POST   /api/v1/fiscal/nfe/danfe-preview/             Preview DANFE

# Sprint 4 — Entrada
GET    /api/v1/fiscal/nfe-recebidas/{chave}/xml/     Download XML recebida
GET    /api/v1/fiscal/nfe-recebidas/{chave}/danfe/   Download DANFE recebida
POST   /api/v1/fiscal/nfe-entrada/{id}/auto-ap/      Gerar AP automatico
POST   /api/v1/fiscal/nfe-entrada/{id}/match-po/     Vincular PO

# Sprint 5 — Parcelamento
POST   /api/v1/accounts-receivable/documents/installments/   Criar parcelas AR
POST   /api/v1/accounts-payable/documents/installments/      Criar parcelas AP

# Sprint 6 — Dashboard
GET    /api/v1/accounting/dashboard/                 Dashboard financeiro
GET    /api/v1/accounting/faturamento/               Relatorio faturamento
GET    /api/v1/accounting/inadimplencia/             Relatorio inadimplencia
GET    /api/v1/fiscal/resumo-mensal/                 Resumo fiscal

# Sprint 7 — Alertas
GET    /api/v1/financeiro/alertas/                   Alertas de vencimento
```

### Frontend (novas paginas)
```
/fiscal/inutilizacao             — Inutilizacao de numeracao
/fiscal/resumo                   — Resumo fiscal mensal
/financeiro/faturamento          — Relatorio de faturamento
/financeiro/inadimplencia        — Relatorio de inadimplencia
```

---

## 11. Principios de Implementacao

1. **Nenhum arquivo com mais de 400 linhas** — se passar, quebrar
2. **Types sempre em `@paddock/types`** — nunca inline em hooks/pages
3. **Utils sempre em `@paddock/utils`** — nunca inline (formatters, labels, validators)
4. **fetchList e apiFetch** — unica fonte em `@/lib/api`
5. **Service layer** — views nunca com logica de negocio; views delegam para services
6. **Componentes reutilizaveis** — se 2 paginas tem 50%+ de overlap, extrair componente
7. **Padrão inventory/** — models, views, services e serializers em pastas quando arquivo > 300 linhas
8. **Eventos ao inves de acoplamento** — billing emite resultado, cada app decide o que fazer
9. **Idempotencia** — toda operacao fiscal deve ser safe para retry
10. **Graceful degradation** — falha em contabilidade nunca bloqueia fiscal/financeiro
