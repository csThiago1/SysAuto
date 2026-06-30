# Sprint 10 — OS: Peças, Serviços e Notificações Overdue

**Projeto:** DS Car ERP — Módulo de OS
**Sprint:** 10
**Data:** 2026-04-08
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

**Pré-requisitos:**
- Sprints 1–9 concluídos (OS backend + frontend + HR completos)
- `ServiceOrderPart` e `ServiceOrderLabor` com endpoints GET/POST/PATCH/DELETE implementados (Sprint anterior)
- `estimated_delivery_date` presente no model `ServiceOrder`

---

## Contexto e Motivação

### Por que peças e serviços são críticos

O model `ServiceOrder` já mantém `parts_total` e `services_total` calculados automaticamente via `ServiceOrder.recalculate_totals()` (chamado em `ServiceOrderPart.save()` e `ServiceOrderLabor.save()`), mas a UI da OS em `/os/[id]/page.tsx` exibe apenas o total agregado — sem listar, adicionar ou remover itens individualmente.

Hoje o card "Financeiro" mostra:
```tsx
<p className="text-2xl font-bold text-neutral-900">{formatCurrency(os.total)}</p>
```

Esse valor é correto apenas quando populado via integração Cilia (`import-cilia`). Para OS de clientes particulares — ou OS de seguradora sem Cilia — o total permanece `R$ 0,00` porque não existe UI para cadastrar peças e serviços manualmente. Sem esses valores, a OS não tem valor financeiro real para emissão de NF-e, cálculo de margem ou faturamento.

**O que muda:**
- Aba "Peças" com CRUD inline em `/os/[id]`
- Aba "Serviços" com CRUD inline em `/os/[id]`
- `parts_total` e `services_total` atualizados em tempo real após cada operação
- `os.total` refletido no card "Financeiro" sem necessidade de reload

### Por que notificações overdue são críticas

O `DashboardStatsView` já retorna `today_deliveries`, mas esse dado só é visível no dashboard. Gestores que trabalham em outras telas ficam cegos para OS com `estimated_delivery_date` vencida ou vencendo hoje. Não há alerta visual proativo.

**O que muda:**
- Endpoint `GET /api/v1/service-orders/overdue/` dedicado
- `NotificationBell` no `Header` com badge de contagem
- `OverdueDropdown` com distinção visual (vermelho = vencida, âmbar = hoje)
- Polling automático via `useOverdueOrders` com `refetchOnWindowFocus`

### Estado atual vs. pós-Sprint 10

| Funcionalidade | Antes | Depois |
|---|---|---|
| Listar peças da OS | Apenas via Cilia/JSON | Aba Peças com tabela |
| Adicionar peça manualmente | Impossível via UI | Formulário inline |
| Listar serviços da OS | Apenas via Cilia/JSON | Aba Serviços com tabela |
| Alertas de prazo | Nenhum | NotificationBell no Header |
| PDF de contracheque | `# TODO` no tasks.py:81 | Geração real com upload S3 |

---

## Escopo — Sprint 10

### US-OS-BE-10-01 — Validações de Peças e Serviços (Backend)

- [ ] **`ServiceOrderPartSerializer.validate()`** — adicionar validações de negócio:
  - `quantity` deve ser `> 0` (DecimalField permite qualquer valor, constraint apenas em banco)
  - `unit_price` deve ser `>= 0`
  - `discount` não pode ser maior que `quantity * unit_price` (desconto maior que o total da linha)
  - Mensagens de erro em português, campo explícito no response

- [ ] **`ServiceOrderLaborSerializer.validate()`** — validações análogas a Part:
  - `quantity` (horas/unidades) deve ser `> 0`
  - `unit_price` deve ser `>= 0`
  - `discount` não pode exceder `quantity * unit_price`

- [ ] **Proteção de OS encerrada** — impedir adição/edição de itens em OS com status `delivered` ou `cancelled`:
  - Validação em `ServiceOrderViewSet.parts()` e `ServiceOrderViewSet.labor()` (action POST)
  - Validação em `ServiceOrderViewSet.part_detail()` e `ServiceOrderViewSet.labor_detail()` (PATCH)
  - Resposta: `HTTP 422` com `{"detail": "Não é possível modificar itens de uma OS encerrada."}`

- [ ] **`ServiceOrderPartSerializer` — campo `product_name`** (read_only, SerializerMethodField):
  - Retorna `product.name` se `product` não for `None`, caso contrário `None`
  - Evita segundo fetch do frontend para exibir nome do produto vinculado

- [ ] **`recalculate_totals()` — cobertura de sinal delete** — garantir que o `delete` via queryset (`ServiceOrderPart.objects.filter(...).delete()`) também dispara recálculo (bulk delete não chama `Model.delete()`):
  - Adicionar `post_delete` signal em `apps/service_orders/signals.py` como alternativa segura
  - Ou documentar como limitação conhecida e bloquear bulk delete na API (já bloqueado — endpoints só expõem delete por `pk`)

- [ ] **`services.py` — `ServiceOrderService.add_part()`** (helper opcional, centraliza lógica):
  ```python
  @staticmethod
  def add_part(order: ServiceOrder, data: dict, created_by: GlobalUser) -> ServiceOrderPart:
      """Adiciona peça à OS e recalcula totais. Lança ValidationError se OS encerrada."""
  ```

- [ ] **`services.py` — `ServiceOrderService.add_labor()`** (análogo):
  ```python
  @staticmethod
  def add_labor(order: ServiceOrder, data: dict, created_by: GlobalUser) -> ServiceOrderLabor:
      """Adiciona serviço à OS e recalcula totais. Lança ValidationError se OS encerrada."""
  ```

---

### US-OS-BE-10-02 — Testes de Integração Parts/Labor

**Arquivo:** `backend/core/apps/service_orders/tests/test_parts_labor.py`

Herdar de `TenantTestCase` (mesmo padrão de `test_employee_views.py` — Sprint 9).

Classe base:
```python
class OSPartsTestCase(TenantTestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.user = GlobalUser.objects.create_user(
            email="tech@dscar.com", email_hash=sha256("tech@dscar.com"), password="x"
        )
        cls.os = ServiceOrder.objects.create(
            number=9001, plate="ABC1234", customer_name="Teste",
            status=ServiceOrderStatus.REPAIR, created_by=cls.user
        )
    def setUp(self) -> None:
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.client.defaults["SERVER_NAME"] = "dscar.localhost"
```

- [ ] `test_add_part_returns_201_and_updates_parts_total`
  - POST `/api/v1/service-orders/{os.id}/parts/`
  - Body: `{"description": "Parachoque dianteiro", "quantity": "1.00", "unit_price": "850.00", "discount": "0.00"}`
  - Assertar: status `201`, `response.data["total"] == 850.0`
  - Assertar: `os.refresh_from_db(); os.parts_total == Decimal("850.00")`

- [ ] `test_add_part_with_product_link`
  - Criar `Product` no setup (ou mock)
  - POST com `product: <uuid>` → assertar `product_name` no response

- [ ] `test_add_part_invalid_quantity_returns_400`
  - POST com `quantity: "-1"` → status `400`, campo `quantity` no response

- [ ] `test_add_part_discount_exceeds_total_returns_400`
  - POST com `unit_price: "100.00", quantity: "1", discount: "150.00"` → status `400`

- [ ] `test_delete_part_recalculates_total`
  - Criar part com `parts_total = 500`
  - DELETE `/api/v1/service-orders/{os.id}/parts/{part.id}/`
  - Assertar: `os.refresh_from_db(); os.parts_total == Decimal("0.00")`

- [ ] `test_patch_part_updates_total`
  - Criar part com `unit_price=100`, depois PATCH `unit_price=200`
  - Assertar: `os.parts_total == Decimal("200.00")`

- [ ] `test_add_part_to_delivered_os_returns_422`
  - OS com `status=ServiceOrderStatus.DELIVERED`
  - POST → `422`, mensagem de OS encerrada

- [ ] `test_add_labor_returns_201_and_updates_services_total`
  - POST `/api/v1/service-orders/{os.id}/labor/`
  - Body: `{"description": "Troca de óleo", "quantity": "1.00", "unit_price": "120.00", "discount": "0.00"}`
  - Assertar: `os.services_total == Decimal("120.00")`

- [ ] `test_list_parts_returns_all_items`
  - Criar 3 parts, GET `/parts/` → assertar `len(response.data) == 3`

- [ ] `test_list_labor_returns_all_items`
  - Criar 2 labor, GET `/labor/` → assertar `len(response.data) == 2`

---

### US-OS-BE-10-03 — Endpoint Overdue

**Arquivo:** `backend/core/apps/service_orders/views.py`

- [ ] **Action `overdue`** no `ServiceOrderViewSet`:

  ```python
  @extend_schema(
      summary="OS vencidas ou com entrega hoje",
      parameters=[
          OpenApiParameter("days_ahead", description="Incluir OS vencendo nos próximos N dias (default: 0)", required=False),
          OpenApiParameter("ordering", description="Ordenar por campo (default: estimated_delivery_date)", required=False),
      ],
  )
  @action(detail=False, methods=["get"], url_path="overdue")
  def overdue(self, request: Request) -> Response:
      """
      GET /api/v1/service-orders/overdue/
      Retorna OS ativas com estimated_delivery_date <= hoje (overdue)
      e OS com estimated_delivery_date == hoje (due_today), excluindo delivered/cancelled.
      """
  ```

  Lógica:
  ```python
  from django.utils import timezone
  today = timezone.localdate()
  days_ahead = int(request.query_params.get("days_ahead", 0))
  cutoff = today + timedelta(days=days_ahead)

  open_statuses = [
      s for s in ServiceOrderStatus.values
      if s not in (ServiceOrderStatus.DELIVERED, ServiceOrderStatus.CANCELLED)
  ]

  qs = (
      ServiceOrder.objects.filter(
          is_active=True,
          status__in=open_statuses,
          estimated_delivery_date__lte=cutoff,
      )
      .select_related("consultant", "insurer")
      .order_by("estimated_delivery_date")
  )
  ```

- [ ] **Payload de resposta** (cada item):
  ```json
  {
    "id": "uuid",
    "number": 1042,
    "plate": "ABC1234",
    "customer_name": "João Silva",
    "status": "repair",
    "status_display": "Reparo",
    "estimated_delivery_date": "2026-04-06",
    "days_overdue": 2,
    "urgency": "overdue"
  }
  ```
  - `days_overdue`: `(today - estimated_delivery_date).days` — negativo se ainda no prazo
  - `urgency`: `"overdue"` se `estimated_delivery_date < today`, `"due_today"` se `== today`, `"upcoming"` se `> today`

- [ ] **Serializer `ServiceOrderOverdueSerializer`** em `serializers.py`:
  ```python
  class ServiceOrderOverdueSerializer(serializers.ModelSerializer):
      status_display = serializers.CharField(source="get_status_display", read_only=True)
      days_overdue = serializers.SerializerMethodField()
      urgency = serializers.SerializerMethodField()

      class Meta:
          model = ServiceOrder
          fields = ["id", "number", "plate", "customer_name", "status", "status_display",
                    "estimated_delivery_date", "days_overdue", "urgency"]

      def get_days_overdue(self, obj: ServiceOrder) -> int:
          if not obj.estimated_delivery_date:
              return 0
          from django.utils import timezone
          return (timezone.localdate() - obj.estimated_delivery_date).days

      def get_urgency(self, obj: ServiceOrder) -> str:
          days = self.get_days_overdue(obj)
          if days > 0:
              return "overdue"
          if days == 0:
              return "due_today"
          return "upcoming"
  ```

- [ ] **Filtros adicionais**:
  - `ordering` aceita: `estimated_delivery_date`, `-estimated_delivery_date`, `number`, `days_overdue`
  - `status` — filtrar por status específico (ex: ver apenas `repair` vencidas)

- [ ] **Teste**: `test_overdue_excludes_delivered_and_cancelled` em `test_parts_labor.py` ou novo `test_overdue.py`

---

### US-OS-FE-10-01 — Aba Peças (Frontend)

**Arquivo principal:** `apps/dscar-web/src/app/(app)/os/[id]/_components/OSPartsSection.tsx`

**Tipos necessários** (em `packages/types/src/service-orders.types.ts`):
```typescript
export interface ServiceOrderPart {
  id: string;
  product: string | null;
  product_name: string | null;
  description: string;
  part_number: string;
  quantity: string;       // DecimalField → string na API
  unit_price: string;
  discount: string;
  total: number;          // property calculada
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderPartPayload {
  description: string;
  part_number?: string;
  quantity: string;
  unit_price: string;
  discount?: string;
  product?: string | null;
}
```

**Hooks** (em `apps/dscar-web/src/hooks/useServiceOrders.ts`):
```typescript
// Listar peças
export function useOSParts(osId: string): UseQueryResult<ServiceOrderPart[]>
// Adicionar peça
export function useAddOSPart(osId: string): UseMutationResult<ServiceOrderPart, Error, ServiceOrderPartPayload>
// Editar peça
export function useUpdateOSPart(osId: string): UseMutationResult<ServiceOrderPart, Error, { partId: string } & Partial<ServiceOrderPartPayload>>
// Remover peça
export function useDeleteOSPart(osId: string): UseMutationResult<void, Error, string>
```

Query keys:
```typescript
["service-order", osId, "parts"]    // useOSParts
["service-order", osId, "labor"]    // useOSLabor
```

**Componente `OSPartsSection`:**

- [ ] Tabela com colunas: Descrição · Código · Qtd · Preço Unit. · Desconto · Total · Ações
- [ ] Estado de vazio: `"Nenhuma peça adicionada."` com ícone `Package` (lucide)
- [ ] Linha de adição inline abaixo da tabela (não modal):
  - Campos: `description` (obrigatório), `part_number` (opcional), `quantity` (default `"1"`), `unit_price`, `discount` (default `"0"`)
  - Botão "Adicionar" → `useAddOSPart.mutate(payload)` → `onSuccess`: invalida query + limpa form
  - Botão "Cancelar" → esconde formulário inline
  - Loading state: spinner no botão "Adicionar"
- [ ] Delete com confirmação:
  - `AlertDialog` do shadcn/ui: "Remover peça? Esta ação não pode ser desfeita."
  - `onConfirm` → `useDeleteOSPart.mutate(partId)` → `onSuccess`: invalida query
- [ ] Total auto-calculado no rodapé da tabela:
  - `Σ total` de todos os itens (calculado client-side a partir dos itens retornados)
  - Exibido como `formatCurrency(sum)` em negrito à direita
- [ ] Invalidar query `["service-order", osId]` após qualquer mutação (para atualizar `os.parts_total` no card Financeiro)
- [ ] `PermissionGate role="CONSULTANT"` nos botões de adicionar/remover (STOREKEEPER só visualiza)
- [ ] Desabilitar adição/remoção se `os.status === "delivered" || os.status === "cancelled"` — tooltip explicativo

**Integração na página `/os/[id]/page.tsx`:**

- [ ] Adicionar Tabs do shadcn/ui (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`):
  ```tsx
  <Tabs defaultValue="overview">
    <TabsList>
      <TabsTrigger value="overview">Visão Geral</TabsTrigger>
      <TabsTrigger value="parts">
        Peças {os.parts.length > 0 && <Badge>{os.parts.length}</Badge>}
      </TabsTrigger>
      <TabsTrigger value="services">
        Serviços {os.labor_items.length > 0 && <Badge>{os.labor_items.length}</Badge>}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="overview">
      {/* grid atual com Veículo + Cliente + Financeiro + Datas */}
    </TabsContent>
    <TabsContent value="parts">
      <OSPartsSection osId={id} osStatus={os.status} />
    </TabsContent>
    <TabsContent value="services">
      <OSServicesSection osId={id} osStatus={os.status} />
    </TabsContent>
  </Tabs>
  ```

---

### US-OS-FE-10-02 — Aba Serviços (Frontend)

**Arquivo:** `apps/dscar-web/src/app/(app)/os/[id]/_components/OSServicesSection.tsx`

**Tipos** (em `packages/types/src/service-orders.types.ts`):
```typescript
export interface ServiceOrderLabor {
  id: string;
  description: string;
  quantity: string;       // horas ou unidades
  unit_price: string;     // valor por hora/unidade
  discount: string;
  total: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderLaborPayload {
  description: string;
  quantity: string;
  unit_price: string;
  discount?: string;
}
```

**Hooks** (em `useServiceOrders.ts`):
```typescript
export function useOSLabor(osId: string): UseQueryResult<ServiceOrderLabor[]>
export function useAddOSLabor(osId: string): UseMutationResult<ServiceOrderLabor, Error, ServiceOrderLaborPayload>
export function useUpdateOSLabor(osId: string): UseMutationResult<ServiceOrderLabor, Error, { laborId: string } & Partial<ServiceOrderLaborPayload>>
export function useDeleteOSLabor(osId: string): UseMutationResult<void, Error, string>
```

**Componente `OSServicesSection`** — estrutura análoga a `OSPartsSection`, com as seguintes diferenças:

- [ ] Colunas: Descrição do Serviço · Qtd/Horas · Valor Unit. · Desconto · Total · Ações
- [ ] Sem campo `part_number` (não se aplica a serviços)
- [ ] Label do campo `quantity`: "Qtd / Horas" (contexto de mão-de-obra)
- [ ] Label do campo `unit_price`: "Valor / Hora"
- [ ] Estado de vazio: `"Nenhum serviço adicionado."` com ícone `Wrench` (lucide)
- [ ] Mesma lógica de: adição inline, delete com `AlertDialog`, total no rodapé, `PermissionGate`, disable em OS encerrada
- [ ] Invalidar `["service-order", osId]` após mutação (atualiza `os.services_total`)

---

### US-OS-FE-10-03 — Notificação Bell (Frontend)

#### Hook `useOverdueOrders`

**Arquivo:** `apps/dscar-web/src/hooks/useOverdueOrders.ts`

```typescript
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import type { OverdueServiceOrder } from "@paddock/types";

export function useOverdueOrders(): UseQueryResult<OverdueServiceOrder[]> {
  return useQuery({
    queryKey: ["service-orders", "overdue"],
    queryFn: () => fetchOverdueOrders(),
    staleTime: 60_000,           // 1 minuto
    refetchInterval: 5 * 60_000, // polling a cada 5 minutos
    refetchOnWindowFocus: true,
  });
}
```

**Tipo** (em `packages/types/src/service-orders.types.ts`):
```typescript
export interface OverdueServiceOrder {
  id: string;
  number: number;
  plate: string;
  customer_name: string;
  status: ServiceOrderStatus;
  status_display: string;
  estimated_delivery_date: string;  // "YYYY-MM-DD"
  days_overdue: number;
  urgency: "overdue" | "due_today" | "upcoming";
}
```

#### Componente `NotificationBell`

**Arquivo:** `apps/dscar-web/src/components/header/NotificationBell.tsx`

- [ ] Ícone `Bell` (lucide-react)
- [ ] Badge vermelho com contagem (`overdue + due_today`):
  - Oculto quando `count === 0`
  - Exibe `"99+"` quando `count > 99`
  - `animate-pulse` quando `count > 0` (alerta visual)
- [ ] Abre `OverdueDropdown` ao clicar (Popover do shadcn/ui)
- [ ] Estado de loading: `Loader2` girando no lugar do ícone
- [ ] Acessibilidade: `aria-label="Notificações de OS"`, `aria-haspopup="true"`

#### Componente `OverdueDropdown`

**Arquivo:** `apps/dscar-web/src/components/header/OverdueDropdown.tsx`

- [ ] Header do dropdown: "OS Vencidas / Hoje" + contagem total
- [ ] Seção "Atrasadas" (urgency === `"overdue"`) — borda/fundo vermelho (`bg-error-50 border-l-4 border-error-500`):
  - Cada item: `OS #XXXX · ABC1234 · <customer_name>`
  - Sub-linha: `<status_display> · Vencida há N dia(s)`
  - `N` em vermelho negrito
- [ ] Seção "Entregam hoje" (urgency === `"due_today"`) — borda/fundo âmbar (`bg-warning-50 border-l-4 border-warning-500`):
  - Cada item: `OS #XXXX · ABC1234 · <customer_name>`
  - Sub-linha: `<status_display> · Entrega hoje`
- [ ] Cada item é `<Link href={"/os/${item.id}"}>`  — fecha o popover ao navegar
- [ ] Estado vazio: `"Nenhuma OS vencida ou com entrega hoje."` com ícone `CheckCircle2` verde
- [ ] Máximo de 10 itens visíveis + link "Ver todas" → `/os?overdue=true`
- [ ] Loading: 3 `Skeleton` de `h-12 w-full`
- [ ] Erro: `"Erro ao carregar notificações."` com botão "Tentar novamente"

#### Integração no `Header`

**Arquivo:** `apps/dscar-web/src/components/Header.tsx`

- [ ] Importar e renderizar `<NotificationBell />` à direita do header, antes do avatar do usuário
- [ ] `NotificationBell` deve ser envolvido em `PermissionGate role="CONSULTANT"` (STOREKEEPER não vê notificações de OS)

---

### US-HR-TASK-10-01 — PDF Contracheque S3 (TODO pendente Sprint 9)

**Arquivo:** `backend/core/apps/hr/tasks.py`

O `task_generate_payslip_pdf` (linha 81) tem `# TODO: implementar geração de PDF e upload para R2/S3` desde a Sprint 5/6. Esta sprint completa a implementação.

**Dependências Python** a adicionar em `requirements.txt`:
- `weasyprint>=62.0` — geração de PDF a partir de HTML

- [ ] **Template HTML do contracheque** em `backend/core/apps/hr/templates/hr/payslip.html`:
  - Dados do colaborador: nome, cargo, setor, matrícula, mês de referência
  - Tabela de proventos: salário base, bônus, horas extras
  - Tabela de descontos: INSS, IRRF, vales, outros descontos
  - Linha de total líquido
  - Rodapé: razão social da empresa, CNPJ, data de emissão
  - Estilos inline (WeasyPrint não suporta CSS externo por padrão)

- [ ] **`generate_payslip_pdf(payslip: Payslip) -> bytes`** em `backend/core/apps/hr/services.py`:
  ```python
  from weasyprint import HTML
  from django.template.loader import render_to_string

  def generate_payslip_pdf(payslip: Payslip) -> bytes:
      """Renderiza template HTML e converte para PDF via WeasyPrint."""
      html_string = render_to_string("hr/payslip.html", {"payslip": payslip})
      return HTML(string=html_string).write_pdf()
  ```

- [ ] **`upload_payslip_to_s3(pdf_bytes: bytes, payslip: Payslip) -> str`** em `services.py`:
  ```python
  import boto3
  from django.conf import settings

  def upload_payslip_to_s3(pdf_bytes: bytes, payslip: Payslip) -> str:
      """Faz upload do PDF para S3 e retorna a S3 key."""
      key = f"payslips/{payslip.employee.id}/{payslip.reference_month}.pdf"
      s3 = boto3.client("s3")
      s3.put_object(
          Bucket=settings.AWS_S3_BUCKET,
          Key=key,
          Body=pdf_bytes,
          ContentType="application/pdf",
          ServerSideEncryption="AES256",
      )
      return key
  ```

- [ ] **Completar `task_generate_payslip_pdf`** (substituir TODO):
  ```python
  @shared_task(bind=True, max_retries=3)
  def task_generate_payslip_pdf(self, payslip_id: str) -> None:
      try:
          from apps.hr.models import Payslip
          from apps.hr.services import generate_payslip_pdf, upload_payslip_to_s3
          payslip = Payslip.objects.select_related("employee").get(id=payslip_id)
          pdf_bytes = generate_payslip_pdf(payslip)
          pdf_key = upload_payslip_to_s3(pdf_bytes, payslip)
          Payslip.objects.filter(id=payslip_id).update(
              pdf_file_key=pdf_key,
              updated_at=timezone.now(),
          )
          logger.info("[HR] PDF gerado e enviado para S3: %s", pdf_key)
      except Payslip.DoesNotExist:
          logger.error("[HR] Payslip %s não encontrado", payslip_id)
      except Exception as exc:
          logger.error("[HR] task_generate_payslip_pdf failed: %s", exc)
          raise self.retry(exc=exc, countdown=60)
  ```

- [ ] **Model `Payslip` — campo `pdf_file_key`** — verificar se já existe; se não, adicionar migration:
  ```python
  pdf_file_key = models.CharField(max_length=500, blank=True, default="", verbose_name="S3 Key do PDF")
  ```

- [ ] **Endpoint `GET /hr/payslips/{id}/pdf/`** — retorna URL presignada S3 (15 min):
  ```python
  @action(detail=True, methods=["get"], url_path="pdf")
  def pdf(self, request: Request, pk: str | None = None) -> Response:
      payslip = self.get_object()
      if not payslip.pdf_file_key:
          return Response({"detail": "PDF ainda não gerado."}, status=status.HTTP_404_NOT_FOUND)
      url = generate_presigned_url(payslip.pdf_file_key, expiration=900)
      return Response({"url": url})
  ```

- [ ] **Frontend** — atualizar botão "Baixar PDF" em `/rh/folha/contracheque/page.tsx`:
  - Antes: placeholder sem funcionalidade
  - Depois: chama `GET /hr/payslips/{id}/pdf/` → abre URL presignada em nova aba

---

## Arquivos a Criar/Modificar

```
backend/core/
├── apps/service_orders/
│   ├── serializers.py             MODIFICAR — validações + ServiceOrderOverdueSerializer
│   ├── views.py                   MODIFICAR — action overdue + proteção OS encerrada
│   ├── services.py                MODIFICAR — add_part() + add_labor() helpers
│   └── tests/
│       ├── test_parts_labor.py    CRIAR — testes integração parts/labor (10 casos)
│       └── test_overdue.py        CRIAR — testes endpoint overdue (3 casos)
│
└── apps/hr/
    ├── tasks.py                   MODIFICAR — implementar task_generate_payslip_pdf (linha 81)
    ├── services.py                MODIFICAR — generate_payslip_pdf() + upload_payslip_to_s3()
    ├── views.py                   MODIFICAR — action pdf() no PayslipViewSet
    ├── templates/hr/
    │   └── payslip.html           CRIAR — template HTML do contracheque
    └── migrations/
        └── 0003_payslip_pdf_key.py  CRIAR (se pdf_file_key não existir)

packages/types/src/
└── service-orders.types.ts        MODIFICAR — ServiceOrderPart, ServiceOrderLabor,
                                               ServiceOrderLaborPayload, ServiceOrderPartPayload,
                                               OverdueServiceOrder

apps/dscar-web/src/
├── app/(app)/os/[id]/
│   ├── page.tsx                   MODIFICAR — adicionar Tabs (overview/parts/services)
│   └── _components/
│       ├── OSPartsSection.tsx     CRIAR — CRUD inline de peças
│       └── OSServicesSection.tsx  CRIAR — CRUD inline de serviços
├── components/header/
│   ├── NotificationBell.tsx       CRIAR — ícone Bell + badge + Popover
│   └── OverdueDropdown.tsx        CRIAR — lista overdue/due_today + links
├── components/Header.tsx          MODIFICAR — integrar NotificationBell
├── hooks/
│   ├── useServiceOrders.ts        MODIFICAR — useOSParts, useOSLabor e mutações
│   └── useOverdueOrders.ts        CRIAR — hook com polling 5min
└── app/(app)/rh/folha/
    └── contracheque/page.tsx      MODIFICAR — botão PDF funcional
```

---

## Definição de Pronto (DoD)

### Backend

- [ ] `python -m pytest apps/service_orders/tests/test_parts_labor.py` — 10/10 passando
- [ ] `python -m pytest apps/service_orders/tests/test_overdue.py` — 3/3 passando
- [ ] `manage.py check` — 0 issues
- [ ] `make lint` (Black + isort) — sem erros
- [ ] `make typecheck` (mypy) — sem erros novos
- [ ] Endpoint `GET /api/v1/service-orders/overdue/` documentado no Swagger (`drf-spectacular`)
- [ ] `ServiceOrderOverdueSerializer` com campos `days_overdue` e `urgency`
- [ ] OS encerrada (`delivered` / `cancelled`) retorna `422` ao tentar adicionar/editar item

### HR PDF

- [ ] `task_generate_payslip_pdf` sem TODO — implementação completa
- [ ] PDF gerado com WeasyPrint contém: dados do colaborador, proventos, descontos, total líquido
- [ ] PDF salvo no S3 com key `payslips/{employee_id}/{reference_month}.pdf`
- [ ] `Payslip.pdf_file_key` populado após geração
- [ ] Endpoint `GET /hr/payslips/{id}/pdf/` retorna URL presignada (15 min)
- [ ] Migration criada se `pdf_file_key` não existir no model

### Frontend

- [ ] `npx tsc --noEmit` — 0 erros (TypeScript strict)
- [ ] `make lint` (ESLint) — sem erros
- [ ] Aba "Peças" funcional: listar, adicionar inline, editar, deletar com confirmação
- [ ] Aba "Serviços" funcional: listar, adicionar inline, editar, deletar com confirmação
- [ ] Total da aba auto-calculado client-side sem reload
- [ ] Card "Financeiro" atualiza `parts_total`/`services_total` após mutação (query invalidada)
- [ ] `NotificationBell` exibe badge com contagem correta
- [ ] Badge oculto quando `count === 0`
- [ ] Badge exibe `"99+"` para `count > 99`
- [ ] `OverdueDropdown` diferencia overdue (vermelho) de due_today (âmbar)
- [ ] Cada item do dropdown navega para `/os/[id]`
- [ ] `useOverdueOrders` com `staleTime: 60_000`, `refetchInterval: 5 * 60_000`, `refetchOnWindowFocus: true`
- [ ] OS encerrada: botões de adicionar/deletar desabilitados com tooltip explicativo
- [ ] `PermissionGate role="CONSULTANT"` nos botões de edição
- [ ] Botão PDF no contracheque abre URL presignada em nova aba

---

## Notas Técnicas

### Por que `422 Unprocessable Entity` para OS encerrada (não `400`)

`400 Bad Request` indica dados malformados. Uma OS encerrada com body válido é semanticamente correto, mas a operação viola regra de negócio. `422` (Unprocessable Entity) é mais preciso: o servidor entendeu o request, mas não pode processá-lo no estado atual. Django REST Framework retorna `400` por default nas `ValidationError` dos serializers; o `422` deve ser retornado explicitamente na view action antes de chamar o serializer.

### Por que adição inline (não modal) em Peças/Serviços

Modais interrompem o fluxo cognitivo quando o usuário precisa adicionar múltiplos itens sequencialmente (5-15 peças por OS é comum). A linha inline ao final da tabela permite adicionar → pressionar "Adicionar" → nova linha aparecer imediatamente, sem fechar/reabrir dialog. Pattern consolidado em ERPs (ex: tabelas de NF-e).

### Por que `quantity` e `unit_price` são `string` no tipo TypeScript

O `DecimalField` do Django é serializado como `string` pelo DRF para evitar perda de precisão de ponto flutuante em `JSON.parse`. O frontend deve usar `parseFloat()` apenas para exibição com `formatCurrency()`, nunca para operações aritméticas (somar como strings resulta em concatenação). Os campos de input devem ser `type="text"` com validação Zod de `z.string().regex(/^\d+(\.\d{1,2})?$/)`.

### Por que polling (não WebSocket) no `useOverdueOrders`

Overdue orders são dado com latência aceitável de 1-5 min. WebSocket seria overkill para esse caso (já existe infraestrutura de `Django Channels` para Kanban realtime — o canal já está saturado com eventos de status). Polling com `refetchInterval: 5 * 60_000` + `refetchOnWindowFocus` é suficiente e não adiciona complexidade.

### Por que WeasyPrint para PDF de contracheque

O projeto usa `nfelib` para NF-e (XML) e Focus NFS-e para notas de serviço. Para contracheques, o formato é livre — não há obrigação fiscal de layout específico. WeasyPrint renderiza HTML+CSS para PDF, permitindo reutilizar o design system (paleta de cores, tipografia) sem necessidade de biblioteca de PDF de baixo nível (como ReportLab). A limitação de CSS externo é contornada com estilos inline no template.

### Por que `ServerSideEncryption: "AES256"` no upload S3

Contracheques contêm dados pessoais sensíveis (salário, descontos, INSS, IRRF) protegidos por LGPD. Criptografia em repouso no S3 é obrigatória. AES-256 (SSE-S3) é o mínimo; SSE-KMS pode ser avaliado em sprints futuras para auditoria de acesso mais granular.

### `recalculate_totals()` via `update()` (não `save()`)

`ServiceOrder.recalculate_totals()` usa `ServiceOrder.objects.filter(pk=self.pk).update(...)` — não `self.save()`. Isso evita disparar signals e callbacks desnecessários na OS principal quando apenas os totais mudam. Side effect: `updated_at` é atualizado explicitamente no `update()` (já implementado).

---

## Sequência de Implementação Sugerida

```
1. Backend — Serializers e validações
   ├── ServiceOrderPartSerializer.validate()
   ├── ServiceOrderLaborSerializer.validate()
   └── ServiceOrderOverdueSerializer (novo)

2. Backend — Views
   ├── Proteção de OS encerrada em parts/labor actions
   └── Action overdue() no ServiceOrderViewSet

3. Backend — Testes
   ├── test_parts_labor.py (10 casos)
   └── test_overdue.py (3 casos)

4. HR — PDF (task pendente Sprint 9)
   ├── Template payslip.html
   ├── generate_payslip_pdf() + upload_payslip_to_s3() em services.py
   ├── task_generate_payslip_pdf() completo
   └── Action pdf() no PayslipViewSet

5. Tipos TypeScript
   ├── ServiceOrderPart, ServiceOrderLabor
   ├── ServiceOrderPartPayload, ServiceOrderLaborPayload
   └── OverdueServiceOrder

6. Hooks Frontend
   ├── useOSParts, useAddOSPart, useUpdateOSPart, useDeleteOSPart
   ├── useOSLabor, useAddOSLabor, useUpdateOSLabor, useDeleteOSLabor
   └── useOverdueOrders

7. Componentes Frontend
   ├── OSPartsSection.tsx
   ├── OSServicesSection.tsx
   └── NotificationBell.tsx + OverdueDropdown.tsx

8. Integração
   ├── page.tsx /os/[id] — Tabs + OSPartsSection + OSServicesSection
   ├── Header.tsx — NotificationBell
   └── contracheque/page.tsx — botão PDF

9. Typecheck + Lint final
   ├── npx tsc --noEmit
   └── make lint
```
