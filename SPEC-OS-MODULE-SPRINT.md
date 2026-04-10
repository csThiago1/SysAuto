# SPEC — Módulo de Ordens de Serviço (Aba de Abertura)
# ERP DS Car · Paddock Solutions · Sprint OS-001
# ─────────────────────────────────────────────────────────────────────────────
# Data: 2026-04-02
# Autor: Thiago Campos (PO) + Claude (Engenheiro Sênior)
# Agentes: backend-architect · frontend-developer · code-reviewer
# ─────────────────────────────────────────────────────────────────────────────

## 1. Objetivo

Implementar a tela completa de abertura/edição de Ordem de Serviço (OS) do ERP DS Car,
incluindo todos os campos, lógica condicional, transições automáticas de status,
e os models de suporte necessários (Expert/Perito, Insurer/Seguradora).

A OS é o core do sistema. Tudo orbita em torno dela.

---

## 2. Escopo desta sprint

### Incluído
- Model `ServiceOrder` completo com todos os campos da aba de abertura
- Model `Expert` (Perito) — novo, schema do tenant
- Model `Insurer` (Seguradora) — novo, schema público
- Model `VehicleColor` — novo, schema público
- Service layer `ServiceOrderService` com transições automáticas de status
- API REST completa (CRUD + transições + busca de cliente/veículo)
- Tela Next.js de abertura/edição da OS com 7 abas
- Aba "Abertura" completamente funcional (as demais ficam como placeholder)
- Testes unitários e de integração

### Fora do escopo
- Abas de peças, serviços, observações, lembretes, fechamento, arquivos (sprints futuras)
- Calendário/agenda de OS (sprint dedicada)
- Integração Cilia (já tem spec separada)
- App mobile

---

## 3. Arquitetura de dados

### 3.1 Model: ServiceOrder (schema: tenant)

```python
# backend/core/apps/service_orders/models.py

class ServiceOrder(PaddockBaseModel):
    """
    Ordem de Serviço — entidade central do ERP DS Car.
    Todos os campos da aba de abertura estão aqui.
    """

    # ── Informações de abertura ──────────────────────────────────────────
    number = models.PositiveIntegerField(unique=True, editable=False)
    # Auto-increment por tenant — gerar via ServiceOrderService.create()

    consultant = models.ForeignKey(
        'users.User', on_delete=models.PROTECT,
        related_name='service_orders_as_consultant',
        help_text="Consultor responsável pela OS"
    )

    class CustomerType(models.TextChoices):
        INSURER  = 'insurer',  'Seguradora'
        PRIVATE  = 'private',  'Particular'

    customer_type = models.CharField(
        max_length=10, choices=CustomerType.choices
    )

    class OSType(models.TextChoices):
        BODYWORK    = 'bodywork',    'Chapeação'
        WARRANTY    = 'warranty',    'Garantia'
        REWORK      = 'rework',      'Retrabalho'
        MECHANICAL  = 'mechanical',  'Mecânica'
        AESTHETIC   = 'aesthetic',   'Estética'

    os_type = models.CharField(
        max_length=20, choices=OSType.choices, default=OSType.BODYWORK
    )

    # ── Seguradora (preenchido quando customer_type = 'insurer') ─────────
    insurer = models.ForeignKey(
        'insurers.Insurer', on_delete=models.PROTECT,
        null=True, blank=True, related_name='service_orders'
    )

    class InsuredType(models.TextChoices):
        INSURED = 'insured', 'Segurado'
        THIRD   = 'third',   'Terceiro'

    insured_type = models.CharField(
        max_length=10, choices=InsuredType.choices,
        null=True, blank=True,
        help_text="Segurado ou Terceiro — só quando customer_type='insurer'"
    )
    casualty_number = models.CharField(
        max_length=50, blank=True, default='',
        help_text="Número do sinistro"
    )
    deductible_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Valor da franquia — só quando insured_type='insured'"
    )
    broker_name = models.CharField(
        max_length=200, blank=True, default='',
        help_text="Nome do corretor (opcional)"
    )
    expert = models.ForeignKey(
        'experts.Expert', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='service_orders',
        help_text="Perito responsável"
    )
    expert_date = models.DateField(
        null=True, blank=True,
        help_text="Data de visita do perito"
    )
    survey_date = models.DateField(
        null=True, blank=True,
        help_text="Data da vistoria (seguradora)"
    )
    authorization_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Data/hora de autorização — ALTERA STATUS automaticamente"
    )

    # ── Particular (preenchido quando customer_type = 'private') ─────────
    quotation_date = models.DateField(
        null=True, blank=True,
        help_text="Data de orçamentação (particular)"
    )
    # authorization_date é compartilhado — serve para ambos os tipos

    # ── Dados do cliente ─────────────────────────────────────────────────
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.PROTECT,
        related_name='service_orders',
        help_text="Cliente vinculado à OS"
    )

    # ── Dados do veículo ─────────────────────────────────────────────────
    vehicle = models.ForeignKey(
        'vehicles.Vehicle', on_delete=models.PROTECT,
        related_name='service_orders',
        help_text="Veículo vinculado à OS"
    )

    # ── Entrada do veículo ───────────────────────────────────────────────
    class VehicleLocation(models.TextChoices):
        IN_TRANSIT = 'in_transit', 'Em Trânsito'
        WORKSHOP   = 'workshop',   'Na Oficina'

    vehicle_location = models.CharField(
        max_length=15, choices=VehicleLocation.choices,
        default=VehicleLocation.WORKSHOP
    )
    entry_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Data/hora de entrada do veículo na oficina"
    )
    service_authorization_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Data/hora de autorização do serviço"
    )

    # ── Agendamento e previsão ───────────────────────────────────────────
    scheduling_date = models.DateTimeField(
        null=True, blank=True
    )
    repair_days = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Dias estimados de reparo"
    )
    estimated_delivery_date = models.DateField(
        null=True, blank=True,
        help_text="Previsão de entrega (calculada: entry + repair_days)"
    )
    delivery_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Data/hora real de entrega"
    )

    # ── Vistoria final e entrega ─────────────────────────────────────────
    final_survey_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Data/hora da vistoria final — ALTERA STATUS automaticamente"
    )
    client_delivery_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Data/hora de entrega ao cliente — ALTERA STATUS automaticamente"
    )

    # ── Status (Kanban) ──────────────────────────────────────────────────
    class Status(models.TextChoices):
        RECEPTION      = 'reception',      'Recepção'
        INITIAL_SURVEY = 'initial_survey', 'Vistoria Inicial'
        BUDGET         = 'budget',         'Orçamento'
        WAITING_AUTH   = 'waiting_auth',   'Aguardando Autorização'
        AUTHORIZED     = 'authorized',     'Autorizada'
        WAITING_PARTS  = 'waiting_parts',  'Aguardando Peças'
        REPAIR         = 'repair',         'Reparo'
        MECHANIC       = 'mechanic',       'Mecânica'
        BODYWORK       = 'bodywork',       'Funilaria'
        PAINTING       = 'painting',       'Pintura'
        ASSEMBLY       = 'assembly',       'Montagem'
        POLISHING      = 'polishing',      'Polimento'
        WASHING        = 'washing',        'Lavagem'
        FINAL_SURVEY   = 'final_survey',   'Vistoria Final'
        READY          = 'ready',          'Pronto para Entrega'
        DELIVERED      = 'delivered',      'Entregue'
        CANCELLED      = 'cancelled',      'Cancelada'

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.RECEPTION
    )

    # ── Orçamento (FK para BudgetSnapshot — sprint futura) ───────────────
    # active_insurer_snapshot = FK → BudgetSnapshot (null)
    # active_private_snapshot = FK → BudgetSnapshot (null)

    # ── Financeiro (preenchido no fechamento — sprint futura) ────────────
    invoice_issued = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['customer_type']),
            models.Index(fields=['number']),
            models.Index(fields=['insurer', 'casualty_number']),
        ]

    def __str__(self) -> str:
        return f"OS #{self.number} — {self.get_status_display()}"
```

### 3.2 Model: Expert (schema: tenant)

```python
# backend/core/apps/experts/models.py

class Expert(PaddockBaseModel):
    """
    Perito — profissional que realiza vistorias para seguradoras.
    Cadastro por tenant, pois peritos podem ser diferentes por unidade.
    """
    name = models.CharField(max_length=200)
    registration_number = models.CharField(
        max_length=50, blank=True, default='',
        help_text="CREA ou registro profissional"
    )
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    insurers = models.ManyToManyField(
        'insurers.Insurer', blank=True,
        related_name='experts',
        help_text="Seguradoras para as quais este perito atua"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name
```

### 3.3 Model: Insurer (schema: público)

```python
# backend/core/apps/insurers/models.py
# Schema PÚBLICO — compartilhado entre todos os tenants

class Insurer(PaddockBaseModel):
    """
    Seguradora — dados compartilhados entre todas as unidades.
    Fica no schema público pois as seguradoras são as mesmas
    independente do tenant.
    """
    name = models.CharField(max_length=200, unique=True)
    trade_name = models.CharField(
        max_length=200, blank=True, default='',
        help_text="Nome fantasia"
    )
    cnpj = models.CharField(max_length=18, unique=True)
    brand_color = models.CharField(
        max_length=7, default='#000000',
        help_text="Cor hex da marca para exibição na UI"
    )
    abbreviation = models.CharField(
        max_length=4, blank=True, default='',
        help_text="Abreviação para avatar/logo (ex: BR, PS, AZ)"
    )
    logo = models.ImageField(
        upload_to='insurers/logos/', null=True, blank=True
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.trade_name or self.name
```

**Seed data obrigatório (fixture):**

```python
INSURERS_SEED = [
    {"name": "Bradesco Auto/RE Companhia de Seguros", "trade_name": "Bradesco Seguros", "cnpj": "27.649.497/0001-21", "brand_color": "#003DA5", "abbreviation": "BR"},
    {"name": "Porto Seguro Companhia de Seguros Gerais", "trade_name": "Porto Seguro", "cnpj": "61.198.164/0001-60", "brand_color": "#0054A6", "abbreviation": "PS"},
    {"name": "Azul Companhia de Seguros Gerais", "trade_name": "Azul Seguros", "cnpj": "33.707.437/0001-00", "brand_color": "#0078D4", "abbreviation": "AZ"},
    {"name": "HDI Seguros S.A.", "trade_name": "HDI Seguros", "cnpj": "29.980.158/0001-57", "brand_color": "#006633", "abbreviation": "HD"},
    {"name": "Tokio Marine Seguradora S.A.", "trade_name": "Tokio Marine", "cnpj": "33.164.021/0001-00", "brand_color": "#E60012", "abbreviation": "TM"},
    {"name": "Allianz Seguros S.A.", "trade_name": "Allianz", "cnpj": "61.573.796/0001-66", "brand_color": "#003781", "abbreviation": "AL"},
    {"name": "Itaú Seguros de Auto e Residência S.A.", "trade_name": "Itaú Seguros", "cnpj": "07.400.949/0001-68", "brand_color": "#003DA5", "abbreviation": "IT"},
    {"name": "Mitsui Sumitomo Seguros S.A.", "trade_name": "Mitsui Sumitomo", "cnpj": "60.106.302/0001-46", "brand_color": "#1B3C73", "abbreviation": "MS"},
    {"name": "Yelum Seguradora S.A.", "trade_name": "Yelum", "cnpj": "92.684.515/0001-37", "brand_color": "#5C2D91", "abbreviation": "YE"},
]
```

### 3.4 Model: VehicleColor (schema: público)

```python
# backend/core/apps/vehicle_catalog/models.py (adicionar ao existente)

class VehicleColor(models.Model):
    """Cores de veículos com hex para preview no frontend."""
    name = models.CharField(max_length=50, unique=True)
    hex_code = models.CharField(max_length=7, help_text="Ex: #C0C0C0")

    class Meta:
        app_label = 'vehicle_catalog'
        ordering = ['name']

    def __str__(self) -> str:
        return f"{self.name} ({self.hex_code})"
```

**Seed data:**

```python
COLORS_SEED = [
    {"name": "Prata", "hex_code": "#C0C0C0"},
    {"name": "Preto", "hex_code": "#1A1A1A"},
    {"name": "Branco", "hex_code": "#F5F5F5"},
    {"name": "Vermelho", "hex_code": "#CC0000"},
    {"name": "Azul", "hex_code": "#1A1A8B"},
    {"name": "Cinza", "hex_code": "#808080"},
    {"name": "Marrom", "hex_code": "#8B4513"},
    {"name": "Verde", "hex_code": "#006400"},
    {"name": "Dourado", "hex_code": "#DAA520"},
    {"name": "Bege", "hex_code": "#F5F5DC"},
    {"name": "Amarelo", "hex_code": "#FFD700"},
    {"name": "Laranja", "hex_code": "#FF8C00"},
    {"name": "Vinho", "hex_code": "#722F37"},
    {"name": "Rosa", "hex_code": "#FF69B4"},
]
```

---

## 4. Transições automáticas de status

Quando certos campos de data são preenchidos, o status da OS deve mudar automaticamente.
Esta lógica fica **exclusivamente** no `ServiceOrderService` — nunca no serializer ou na view.

### 4.1 Tabela de mapeamento campo → status

```python
# backend/core/apps/service_orders/services.py

AUTO_TRANSITIONS: dict[str, tuple[list[str], str]] = {
    # campo                → (status_de_origem_válidos, status_destino)
    'authorization_date':        (['budget', 'waiting_auth'],  'authorized'),
    'entry_date':                (['reception'],               'initial_survey'),
    'final_survey_date':         (['washing'],                 'final_survey'),
    'client_delivery_date':      (['ready'],                   'delivered'),
}
```

### 4.2 Lógica no service

```python
class ServiceOrderService:

    @classmethod
    @transaction.atomic
    def update(
        cls,
        order_id: str,
        data: dict,
        updated_by_id: str,
        tenant_schema: str
    ) -> ServiceOrder:
        with schema_context(tenant_schema):
            order = ServiceOrder.objects.select_for_update().get(id=order_id)

            # Detectar campos de data recém-preenchidos
            triggered_transitions: list[tuple[str, str]] = []
            for field, (valid_from, target) in AUTO_TRANSITIONS.items():
                old_value = getattr(order, field)
                new_value = data.get(field)
                if old_value is None and new_value is not None:
                    if order.status in valid_from:
                        triggered_transitions.append((field, target))

            # Aplicar campos
            for key, value in data.items():
                setattr(order, key, value)

            # Aplicar transição (máximo 1 por update)
            if triggered_transitions:
                field_trigger, new_status = triggered_transitions[0]
                old_status = order.status
                order.status = new_status
                logger.info(
                    f"OS {order.number}: auto-transition "
                    f"{old_status}→{new_status} triggered by {field_trigger}"
                )
                StatusTransitionLog.objects.create(
                    service_order=order,
                    from_status=old_status,
                    to_status=new_status,
                    triggered_by_field=field_trigger,
                    changed_by_id=updated_by_id,
                )

            # Calcular previsão de entrega
            if order.entry_date and order.repair_days:
                order.estimated_delivery_date = (
                    order.entry_date + timedelta(days=order.repair_days)
                ).date()

            order.save()

            emit_dw_event.delay(
                'service_order_updated',
                {'id': str(order.id), 'status': order.status},
                tenant_schema
            )
            return order
```

### 4.3 Model: StatusTransitionLog (schema: tenant)

```python
class StatusTransitionLog(PaddockBaseModel):
    """Log imutável de transições de status da OS."""
    service_order = models.ForeignKey(
        ServiceOrder, on_delete=models.CASCADE,
        related_name='transition_logs'
    )
    from_status = models.CharField(max_length=20)
    to_status = models.CharField(max_length=20)
    triggered_by_field = models.CharField(
        max_length=50, blank=True, default='',
        help_text="Campo que disparou a transição automática (vazio = manual)"
    )
    changed_by = models.ForeignKey(
        'users.User', on_delete=models.PROTECT
    )

    class Meta:
        ordering = ['-created_at']
```

---

## 5. API REST

### 5.1 Endpoints

```
# Service Orders
GET    /api/v1/service-orders/                    → lista com filtros
POST   /api/v1/service-orders/                    → criar OS
GET    /api/v1/service-orders/{id}/               → detalhe
PATCH  /api/v1/service-orders/{id}/               → atualizar (dispara auto-transitions)
POST   /api/v1/service-orders/{id}/transition/    → transição manual de status
GET    /api/v1/service-orders/{id}/transitions/   → histórico de transições
GET    /api/v1/service-orders/next-number/        → próximo número disponível

# Experts (Peritos)
GET    /api/v1/experts/                           → lista (filtro: ?insurer_id=)
POST   /api/v1/experts/                           → criar
PATCH  /api/v1/experts/{id}/                      → atualizar

# Insurers (Seguradoras) — schema público
GET    /api/v1/insurers/                          → lista (público, com logo/cor)

# Vehicle Colors — schema público
GET    /api/v1/vehicle-catalog/colors/            → lista com hex

# Busca de cliente (dentro da OS)
GET    /api/v1/customers/search/?q=               → busca por CPF, nome ou telefone
POST   /api/v1/customers/                         → cadastro rápido inline
```

### 5.2 Serializers

```python
# ServiceOrderListSerializer — campos para Kanban/listagem
class ServiceOrderListSerializer(serializers.ModelSerializer):
    consultant_name = serializers.CharField(source='consultant.get_full_name')
    customer_name = serializers.CharField(source='customer.name')
    vehicle_display = serializers.SerializerMethodField()
    insurer_display = serializers.SerializerMethodField()  # nome + cor + abbr
    status_display = serializers.CharField(source='get_status_display')
    days_in_shop = serializers.SerializerMethodField()

    class Meta:
        model = ServiceOrder
        fields = [
            'id', 'number', 'status', 'status_display',
            'customer_type', 'os_type', 'consultant_name',
            'customer_name', 'vehicle_display', 'insurer_display',
            'entry_date', 'estimated_delivery_date', 'days_in_shop',
            'created_at',
        ]

# ServiceOrderDetailSerializer — todos os campos para a tela de edição
class ServiceOrderDetailSerializer(serializers.ModelSerializer):
    # Nested read-only para exibição
    consultant_detail = UserMinimalSerializer(source='consultant', read_only=True)
    customer_detail = CustomerSerializer(source='customer', read_only=True)
    vehicle_detail = VehicleSerializer(source='vehicle', read_only=True)
    insurer_detail = InsurerSerializer(source='insurer', read_only=True)
    expert_detail = ExpertSerializer(source='expert', read_only=True)
    transition_logs = StatusTransitionLogSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceOrder
        fields = '__all__'

# ServiceOrderCreateSerializer — validação na criação
# ServiceOrderUpdateSerializer — validação no update (campos parciais)
```

### 5.3 Filtros da listagem

```python
# Filtros disponíveis no GET /service-orders/
filterset_fields = {
    'status': ['exact', 'in'],
    'customer_type': ['exact'],
    'os_type': ['exact'],
    'insurer': ['exact'],
    'consultant': ['exact'],
    'entry_date': ['gte', 'lte', 'date'],
    'estimated_delivery_date': ['gte', 'lte'],
    'created_at': ['gte', 'lte', 'date'],
}
search_fields = ['number', 'casualty_number', 'customer__name', 'vehicle__plate']
ordering_fields = ['number', 'created_at', 'entry_date', 'estimated_delivery_date']
```

---

## 6. Frontend — Tela de Abertura/Edição da OS

### 6.1 Estrutura de arquivos

```
app/(dashboard)/service-orders/
  page.tsx                       ← listagem + Kanban (placeholder nesta sprint)
  [id]/
    page.tsx                     ← Server Component — busca OS por id
    loading.tsx                  ← Skeleton da OS
    error.tsx                    ← Error boundary
    _components/
      ServiceOrderForm.tsx       ← Client Component principal — orquestra as abas
      tabs/
        OpeningTab.tsx           ← Aba "Abertura" — COMPLETA nesta sprint
        PartsTab.tsx             ← Placeholder
        ServicesTab.tsx          ← Placeholder
        NotesTab.tsx             ← Placeholder
        RemindersTab.tsx         ← Placeholder
        ClosingTab.tsx           ← Placeholder
        FilesTab.tsx             ← Placeholder
      sections/
        OpeningInfoSection.tsx   ← Consultor + tipo + tipo de OS
        InsurerSection.tsx       ← Seguradora + sinistro + perito + datas
        PrivateSection.tsx       ← Particular — datas
        CustomerSection.tsx      ← Dados do cliente + busca/cadastro inline
        VehicleSection.tsx       ← Dados do veículo + busca por placa
        EntrySection.tsx         ← Local + entrada + autorização
        SchedulingSection.tsx    ← Agendamento + previsão
        FinalSurveySection.tsx   ← Vistoria final + entrega
      shared/
        StatusBadge.tsx          ← Badge do status com cor semântica
        InsurerSelect.tsx        ← Select com logo/cor da seguradora
        VehicleBrandSelect.tsx   ← Select cascata marca→modelo→versão com logo
        ColorSelect.tsx          ← Select de cor com preview
        ExpertCombobox.tsx       ← Combobox de perito com botão de cadastro
        DateTimeNow.tsx          ← Input datetime com botão "Agora"
        CustomerSearch.tsx       ← Busca por CPF/nome + cadastro inline
    _hooks/
      useServiceOrder.ts         ← TanStack Query: get, update, create
      useExperts.ts              ← TanStack Query: list, create
      useInsurers.ts             ← TanStack Query: list (schema público)
      useVehicleCatalog.ts       ← TanStack Query: brands, models, versions, colors, plate
      useCustomerSearch.ts       ← TanStack Query: search, create
      useAutoTransition.ts       ← Hook que monitora campos de data e mostra feedback
    _schemas/
      service-order.schema.ts    ← Zod schemas (create, update, detail)
      expert.schema.ts
      insurer.schema.ts
  new/
    page.tsx                     ← Criar nova OS (redireciona para [id]/ após salvar)
```

### 6.2 Comportamento da UI — Regras

**Campos condicionais:**
- `customer_type = 'insurer'` → mostra InsurerSection, esconde PrivateSection
- `customer_type = 'private'` → mostra PrivateSection, esconde InsurerSection
- `insured_type = 'insured'` → mostra campo de franquia
- `insured_type = 'third'` → esconde campo de franquia

**Transições automáticas (feedback visual):**
- Quando `authorization_date` é preenchido e status permite transição → mostrar toast verde "Status atualizado para Autorizada" + badge muda instantaneamente (otimistic update)
- Quando `final_survey_date` é preenchido → toast + badge muda para "Vistoria Final"
- Quando `client_delivery_date` é preenchido → toast + badge muda para "Entregue"

**Cálculo automático:**
- `repair_days` preenchido + `entry_date` existente → calcula `estimated_delivery_date` automaticamente no frontend (confirmado pelo backend no save)

**Busca de cliente:**
- Campo CPF/CNPJ com botão de busca → GET /customers/search/?q=
- Se encontrar: preenche dados, vincula
- Se não encontrar: abre modal/drawer de cadastro rápido inline
- Após cadastro: vincula automaticamente

**Busca de veículo por placa:**
- Botão "Consultar API" → GET /vehicle-catalog/plate/{plate}/
- Preenche marca, modelo, versão, cor, chassi, combustível, ano, valor FIPE
- Se placa não encontrada na API → permite preenchimento manual via selects cascata

**Select de seguradora:**
- Exibe logo colorida (abbreviation + brand_color) ao lado do select
- Atualiza dinamicamente ao trocar

**Select de cor:**
- Bolinha de preview com hex_code ao lado do select
- Atualiza ao trocar

**Select de marca:**
- Avatar com abbreviation ao lado do select
- Cascata: marca → modelo → versão (3 selects dependentes)

### 6.3 Zod Schemas

```typescript
// _schemas/service-order.schema.ts

import { z } from 'zod'

export const serviceOrderCreateSchema = z.object({
  consultant_id: z.string().uuid(),
  customer_type: z.enum(['insurer', 'private']),
  os_type: z.enum(['bodywork', 'warranty', 'rework', 'mechanical', 'aesthetic']),

  // Seguradora (condicional)
  insurer_id: z.string().uuid().nullable().optional(),
  insured_type: z.enum(['insured', 'third']).nullable().optional(),
  casualty_number: z.string().max(50).optional(),
  deductible_amount: z.number().nonnegative().nullable().optional(),
  broker_name: z.string().max(200).optional(),
  expert_id: z.string().uuid().nullable().optional(),
  expert_date: z.string().date().nullable().optional(),
  survey_date: z.string().date().nullable().optional(),

  // Particular
  quotation_date: z.string().date().nullable().optional(),

  // Compartilhado
  authorization_date: z.string().datetime().nullable().optional(),

  // Cliente e veículo
  customer_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),

  // Entrada
  vehicle_location: z.enum(['in_transit', 'workshop']).default('workshop'),
  entry_date: z.string().datetime().nullable().optional(),
  service_authorization_date: z.string().datetime().nullable().optional(),

  // Agendamento
  scheduling_date: z.string().datetime().nullable().optional(),
  repair_days: z.number().int().positive().nullable().optional(),
  estimated_delivery_date: z.string().date().nullable().optional(),
  delivery_date: z.string().datetime().nullable().optional(),

  // Vistoria final
  final_survey_date: z.string().datetime().nullable().optional(),
  client_delivery_date: z.string().datetime().nullable().optional(),
}).refine(
  (data) => {
    if (data.customer_type === 'insurer') {
      return !!data.insurer_id && !!data.insured_type
    }
    return true
  },
  { message: "Seguradora e tipo de segurado são obrigatórios para OS de seguradora" }
)

export type ServiceOrderCreate = z.infer<typeof serviceOrderCreateSchema>
```

---

## 7. Design — Especificação visual

### 7.1 Paleta de status (badges do Kanban)

```typescript
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  reception:      { bg: 'bg-blue-50',    text: 'text-blue-800' },
  initial_survey: { bg: 'bg-blue-50',    text: 'text-blue-800' },
  budget:         { bg: 'bg-amber-50',   text: 'text-amber-800' },
  waiting_auth:   { bg: 'bg-amber-50',   text: 'text-amber-800' },
  authorized:     { bg: 'bg-green-50',   text: 'text-green-800' },
  waiting_parts:  { bg: 'bg-orange-50',  text: 'text-orange-800' },
  repair:         { bg: 'bg-purple-50',  text: 'text-purple-800' },
  mechanic:       { bg: 'bg-purple-50',  text: 'text-purple-800' },
  bodywork:       { bg: 'bg-purple-50',  text: 'text-purple-800' },
  painting:       { bg: 'bg-purple-50',  text: 'text-purple-800' },
  assembly:       { bg: 'bg-purple-50',  text: 'text-purple-800' },
  polishing:      { bg: 'bg-teal-50',    text: 'text-teal-800' },
  washing:        { bg: 'bg-teal-50',    text: 'text-teal-800' },
  final_survey:   { bg: 'bg-emerald-50', text: 'text-emerald-800' },
  ready:          { bg: 'bg-green-50',   text: 'text-green-800' },
  delivered:      { bg: 'bg-gray-100',   text: 'text-gray-800' },
  cancelled:      { bg: 'bg-red-50',     text: 'text-red-800' },
}
```

### 7.2 Layout da aba de abertura

A aba usa seções colapsáveis com ícones e labels em vermelho DS Car (#ea0e03).
Cada seção tem um título uppercase com borda inferior sutil.

Grid responsivo:
- Desktop (>1024px): grid de 3-5 colunas conforme a seção
- Tablet (768-1024px): grid de 2 colunas
- Mobile (<768px): stack vertical (1 coluna)

### 7.3 Componentes reutilizáveis a criar

- `DateTimeNow` — input datetime-local + botão "Agora" (verde) que preenche com `new Date()`
- `InsurerSelect` — select + avatar colorido dinâmico
- `VehicleBrandSelect` — select + avatar com abbreviation
- `ColorSelect` — select + bolinha de preview
- `ExpertCombobox` — combobox com busca + botão "+" que abre drawer de cadastro
- `CustomerSearch` — input CPF/CNPJ com busca → ou cadastro inline
- `StatusBadge` — pill com cor semântica baseada no status

---

## 8. Testes

### 8.1 Backend (pytest)

```python
# Testes obrigatórios — backend-architect gera, code-reviewer valida

class TestServiceOrderCreation:
    def test_create_os_insurer_generates_number(self): ...
    def test_create_os_private_generates_number(self): ...
    def test_number_auto_increment_per_tenant(self): ...
    def test_insurer_os_requires_insurer_and_type(self): ...
    def test_private_os_ignores_insurer_fields(self): ...

class TestAutoTransitions:
    def test_authorization_date_triggers_authorized(self): ...
    def test_authorization_date_ignored_if_wrong_status(self): ...
    def test_final_survey_date_triggers_final_survey(self): ...
    def test_client_delivery_date_triggers_delivered(self): ...
    def test_transition_log_created_on_auto_transition(self): ...
    def test_only_one_transition_per_update(self): ...

class TestManualTransitions:
    def test_valid_transition_succeeds(self): ...
    def test_invalid_transition_raises(self): ...
    def test_transition_requires_manager_for_skip(self): ...

class TestEstimatedDelivery:
    def test_calculated_from_entry_plus_repair_days(self): ...
    def test_recalculated_on_repair_days_change(self): ...

class TestLGPD:
    def test_customer_cpf_encrypted_in_os_query(self): ...
    def test_logs_dont_contain_pii(self): ...

class TestMultitenancy:
    def test_os_isolated_between_tenants(self): ...
    def test_insurer_visible_across_tenants(self): ...
```

### 8.2 Frontend (Vitest + Testing Library)

```typescript
// Testes obrigatórios — frontend-developer gera, code-reviewer valida

describe('OpeningTab', () => {
  it('shows insurer section when customer_type is insurer', () => {})
  it('hides insurer section when customer_type is private', () => {})
  it('shows deductible field only for insured type', () => {})
  it('hides deductible field for third party', () => {})
})

describe('useAutoTransition', () => {
  it('shows success toast when authorization_date triggers transition', () => {})
  it('updates status badge optimistically', () => {})
  it('reverts on API error', () => {})
})

describe('VehicleBrandSelect', () => {
  it('loads models when brand changes', () => {})
  it('loads versions when model changes', () => {})
  it('clears downstream selects on parent change', () => {})
})

describe('CustomerSearch', () => {
  it('searches by CPF and fills data', () => {})
  it('shows create form when not found', () => {})
})

describe('ServiceOrderForm validation', () => {
  it('requires insurer when customer_type is insurer', () => {})
  it('requires customer and vehicle always', () => {})
})
```

---

## 9. Plano de execução — dispatch de agentes

### Fase 1 — Backend (sequencial)
```
→ backend-architect

Tarefa 1.1: Criar apps Django (experts, insurers)
  - python manage.py startapp experts
  - python manage.py startapp insurers
  - Registrar em TENANT_APPS (experts) e SHARED_APPS (insurers)
  - Adicionar VehicleColor ao vehicle_catalog existente

Tarefa 1.2: Implementar models
  - Expert (schema tenant)
  - Insurer (schema público)
  - VehicleColor (schema público)
  - ServiceOrder (schema tenant) — todos os campos da seção 3.1
  - StatusTransitionLog (schema tenant)
  - Factories para todos (factory-boy)

Tarefa 1.3: Migrations + seed data
  - makemigrations experts insurers vehicle_catalog service_orders
  - Management command: load_insurers (seed de seguradoras)
  - Management command: load_vehicle_colors (seed de cores)

Tarefa 1.4: Service layer
  - ServiceOrderService.create()
  - ServiceOrderService.update() — com auto-transitions
  - ServiceOrderService.transition() — transição manual
  - ServiceOrderService.get_next_number()

Tarefa 1.5: API REST
  - Serializers (list, detail, create, update)
  - ViewSets com permissões
  - Filtros e busca
  - Endpoint de transição manual
  - Endpoint de histórico de transições
```

### Fase 2 — Frontend (paralelo com revisão do backend)
```
→ frontend-developer

Tarefa 2.1: Schemas e hooks
  - Zod schemas completos
  - useServiceOrder (get, create, update)
  - useExperts, useInsurers, useVehicleCatalog, useCustomerSearch
  - useAutoTransition

Tarefa 2.2: Componentes shared
  - StatusBadge, InsurerSelect, VehicleBrandSelect
  - ColorSelect, ExpertCombobox, DateTimeNow
  - CustomerSearch

Tarefa 2.3: Sections da aba de abertura
  - OpeningInfoSection
  - InsurerSection + PrivateSection (condicional)
  - CustomerSection
  - VehicleSection
  - EntrySection
  - SchedulingSection
  - FinalSurveySection

Tarefa 2.4: Orquestração
  - ServiceOrderForm.tsx (tabs + form state)
  - OpeningTab.tsx (compõe as sections)
  - Placeholder tabs (6 abas)
  - page.tsx [id] e new/

Tarefa 2.5: Testes
  - Vitest para hooks e componentes
  - Testes de comportamento condicional
```

### Fase 3 — QA (após fases 1 e 2)
```
→ code-reviewer

Tarefa 3.1: Auditoria de segurança
  - LGPD compliance (EncryptedField nos dados de cliente)
  - Multitenancy (nenhuma query vazando entre tenants)
  - Permissões (IsAuthenticated + HasCompanyAccess em todos os endpoints)
  - Secrets não hardcoded

Tarefa 3.2: Qualidade de código
  - Type hints completos (Python)
  - TypeScript strict sem `any`
  - N+1 queries (select_related/prefetch_related)
  - Tratamento de erros (sem except: pass)
  - Black + isort no backend
  - ESLint clean no frontend

Tarefa 3.3: Testes
  - Cobertura mínima 70% em código novo
  - Testes de erro (não só happy path)
  - Auto-transitions testadas com todos os edge cases
  - Multitenancy testada com 2 tenants

Tarefa 3.4: Relatório final
  - Formato: 🔴 Crítico / 🟡 Importante / 🟢 Sugestão / ✅ Aprovado
```

---

## 10. Critérios de aceite

- [ ] OS pode ser criada como Seguradora ou Particular
- [ ] Campos condicionais aparecem/escondem conforme tipo
- [ ] Seguradora exibe logo com cor ao lado do select
- [ ] Franquia só aparece para Segurado (não Terceiro)
- [ ] Perito pode ser buscado ou cadastrado inline
- [ ] Cliente pode ser buscado por CPF ou cadastrado inline
- [ ] Veículo pode ser buscado por placa (API) ou preenchido manualmente
- [ ] Select de marca/modelo/versão funciona em cascata
- [ ] Cor do veículo mostra preview visual
- [ ] Logo da montadora aparece ao lado do select
- [ ] Preencher data de autorização com "Agora" muda status automaticamente
- [ ] Badge de status atualiza instantaneamente na UI
- [ ] Previsão de entrega calculada automaticamente
- [ ] Histórico de transições de status acessível
- [ ] Todas as 7 abas navegáveis (6 com placeholder)
- [ ] Zero queries N+1 na listagem e detalhe
- [ ] CPF/email/telefone criptografados no banco
- [ ] Nenhum dado entre tenants vaza
- [ ] Testes cobrindo auto-transitions, validações e multitenancy

---

## 11. Referência rápida — Prompt para iniciar a sprint

```bash
cd ~/projetos/grupo-dscar
claude

# Copiar este arquivo para o projeto:
# cp SPEC-OS-MODULE-SPRINT.md ~/projetos/grupo-dscar/.claude/specs/

# Iniciar execução:
"Leia o arquivo .claude/specs/SPEC-OS-MODULE-SPRINT.md e execute a Fase 1 completa
usando o agente backend-architect. Siga todas as regras do CLAUDE.md.
Ao terminar, faça commit: feat(service-orders): implementa models e API REST da OS"
```
