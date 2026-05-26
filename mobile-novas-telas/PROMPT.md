# DS Car Mobile · Prompt de Implementacao

> Cole este documento como contexto. Ele mapeia os mockups visuais para o app React Native real,
> referenciando componentes, hooks e endpoints que ja existem.

---

## 0. Identidade do projeto

Voce esta trabalhando no app **React Native + Expo** em `apps/mobile/` dentro do monorepo `grupo-dscar`.
E o app de campo do ERP DS Car — usado por consultores, tecnicos e gerentes no chao de oficina.

Os arquivos `.jsx` nesta pasta (`dscar-home.jsx`, `dscar-list.jsx`, etc.) sao **mockups visuais de referencia**.
Eles mostram a direcao de design mas usam HTML/CSS inline — nao sao codigo executavel.
A implementacao real usa React Native, StyleSheet e os tokens de `src/constants/theme.ts`.

**Objetivo:** adicionar tela de **Dashboard/Inicio** com visoes por role e melhorias visuais
nos cards de OS, usando componentes e infraestrutura que ja existem.

---

## 1. Stack real — nao desviar

| Camada | Tecnologia | Onde |
|---|---|---|
| Framework | Expo SDK 55 + React Native 0.83 | `apps/mobile/` |
| Router | Expo Router (file-based, Tabs layout) | `app/(app)/_layout.tsx` |
| DB Offline | WatermelonDB 0.28 (SQLite nativo / LokiJS Expo Go) | `src/db/` |
| State global | Zustand 5 | `src/stores/` |
| Server state | TanStack Query 5 | `src/hooks/` |
| Persistencia | MMKV (nativo) / SecureStore (auth) | `src/stores/*.store.ts` |
| Animacoes | react-native-reanimated 4 | `FrostedNavBar`, `OSCard` |
| Icones | `@expo/vector-icons` (Ionicons) | em todo o app |
| Validacao | Zod 3 | formularios |
| Haptics | expo-haptics | interacoes de tap |
| Monit | Sentry | `@sentry/react-native` |

**Proibido sem aprovacao explicita:**
- Adicionar dependencia nova ao `package.json`
- Usar `expo-linear-gradient` para KPIs (ja existe no projeto — pode usar)
- Criar fetcher fora do padrao `api.get/post/patch` de `src/lib/api.ts`
- Recriar componentes UI que ja existem em `src/components/ui/`
- Inventar cor — usar tokens de `src/constants/theme.ts`
- Usar StyleSheet inline quando StyleSheet.create resolve

---

## 2. Design tokens (ja existem em `src/constants/theme.ts`)

### 2.1 Cores

| Uso | Token | Valor |
|---|---|---|
| Fundo principal | `Colors.bg` | `#141414` |
| Header / navbar | `Colors.bgHeader` | `#1c1c1e` |
| Card gradiente topo | `Colors.cardTop` | `#3a3a3e` |
| Card gradiente base | `Colors.cardBottom` | `#1e1e22` |
| Input / ghost | `Colors.inputBg` | `rgba(255,255,255,0.08)` |
| Surface (modais) | `Colors.surface` | `#1c1c1e` |
| Borda padrao | `Colors.border` | `rgba(255,255,255,0.10)` |
| Borda glint topo | `Colors.borderGlintTop` | `rgba(255,255,255,0.22)` |
| Texto principal | `Colors.textPrimary` | `#ffffff` |
| Texto secundario | `Colors.textSecondary` | `#9ca3af` |
| Texto terciario | `Colors.textTertiary` | `#6b7280` |
| **Marca DS Car** | `Colors.brand` | `#e31b1b` |
| Brand tint (fundo) | `Colors.brandTint` | `rgba(227,27,27,0.15)` |
| Sucesso | `Colors.success` | `#16a34a` |
| Alerta | `Colors.warning` | `#f59e0b` |
| Erro | `Colors.error` | `#ef4444` |
| Info | `Colors.info` | `#3b82f6` |

### 2.2 Status de OS (17 status com cor/bg/label)

Mapeamento completo em `OS_STATUS_MAP` no `theme.ts`. Cada status tem `{ color, bg, label, semantic }`.
**Usar diretamente** — nao recriar mapeamento de cores.

### 2.3 Tipografia

Presets em `Typography`: `labelMono`, `mono`, `plate`, `osNumber`.
Componente `<Text variant="h1|h2|h3|body|label|caption">` em `src/components/ui/Text.tsx`.
Componente `<MonoLabel variant="accent" size="sm">` para OS numbers e placas.

### 2.4 Espacamento e raio

`Spacing`: xs=4, sm=8, md=12, lg=16, xl=24, xxl=32.
`Radii`: sm=8, md=12, lg=16, xl=20, full=9999.
`Shadow`: card (elevation 10), sm (elevation 4).

---

## 3. O que JA EXISTE (nao recriar)

### 3.1 Navegacao

| Componente | Arquivo | O que faz |
|---|---|---|
| `FrostedNavBar` | `src/components/navigation/FrostedNavBar.tsx` | Tab bar pill com 5 tabs (OS, Agenda, + Nova OS, Alertas, Config), animacoes spring, haptics |
| `QuickActionsSheet` | `src/components/common/QuickActionsSheet.tsx` | Bottom sheet do botao central (+): Nova OS, Novo Cliente, Novo Veiculo, Agendar, Kanban |
| `OfflineBanner` | `src/components/common/OfflineBanner.tsx` | Banner "modo offline" |

### 3.2 Telas completas

| Tela | Rota | Arquivo | Funcionalidades |
|---|---|---|---|
| Lista de OS | `/(app)/os` | `app/(app)/os/index.tsx` | FlatList, busca debounced, filtro por status (modal), toggle "Na Oficina", skeleton, empty state, paginacao, pull-to-refresh |
| Detalhe OS | `/(app)/os/[id]` | `app/(app)/os/[id].tsx` | Tabs: Geral, Pecas, Fotos, Docs, Historico + transicao de status + vistoria CTA |
| Agenda | `/(app)/agenda` | `app/(app)/agenda/index.tsx` | Calendario mensal, eventos por dia, criar evento |
| Nova OS | `/(app)/nova-os` | `app/(app)/nova-os/index.tsx` | Wizard 4 steps: Veiculo > Cliente > Tipo OS > Review |
| Notificacoes | `/(app)/notificacoes` | `app/(app)/notificacoes/index.tsx` | Lista de alertas |
| Perfil | `/(app)/perfil` | `app/(app)/perfil/index.tsx` | Config, logout |
| Checklist | `/(app)/checklist/[osId]` | `app/(app)/checklist/[osId].tsx` | Grid de itens com status ok/attention/critical |
| Camera | `/(app)/camera` | `app/(app)/camera/index.tsx` | Captura com marca d'agua |
| Photo Editor | `/(app)/photo-editor` | `app/(app)/photo-editor/index.tsx` | Anotacoes SVG (setas, circulos, texto) |
| Vistoria | `/(app)/vistoria/{entrada\|saida}/[osId]` | Inspecao de entrada/saida |
| Kanban | `/(app)/kanban` | `app/(app)/kanban/index.tsx` | Board drag-and-drop por status |
| Cadastro | `/(app)/cadastro/{cliente\|veiculo}` | Formularios de criacao |

### 3.3 Componentes UI

| Componente | Arquivo |
|---|---|
| `Button` (primary/secondary/ghost/danger) | `src/components/ui/Button.tsx` |
| `Card` (glass gradient) | `src/components/ui/Card.tsx` |
| `Text` (h1-h3, body, label, caption) | `src/components/ui/Text.tsx` |
| `Badge` | `src/components/ui/Badge.tsx` |
| `SemanticBadge` (success/error/warning/info/neutral) | `src/components/ui/SemanticBadge.tsx` |
| `MonoLabel` | `src/components/ui/MonoLabel.tsx` |
| `InfoRow` | `src/components/ui/InfoRow.tsx` |
| `EmptyState` | `src/components/ui/EmptyState.tsx` |
| `ConfirmDialog` | `src/components/ui/ConfirmDialog.tsx` |
| `StepIndicator` | `src/components/ui/StepIndicator.tsx` |
| `SegmentedControl` | `src/components/ui/SegmentedControl.tsx` |
| `Toast` | `src/components/ui/Toast.tsx` |
| `ShimmerBlock` (skeleton) | `src/components/ui/ShimmerBlock.tsx` |
| `StatusDot` | `src/components/ui/StatusDot.tsx` |
| `SplashScreen` | `src/components/ui/SplashScreen.tsx` |
| `SignatureCanvas` | `src/components/ui/SignatureCanvas.tsx` |
| `SectionDivider` | `src/components/ui/SectionDivider.tsx` |

### 3.4 Componentes de OS

`OSCard`, `OSDetailHeader`, `OSStatusBadge`, `GeneralTab`, `PartsTab`, `LaborTab`,
`PhotosTab`, `DocsTab`, `HistoryTab`, `FinancialSummary`, `StatusUpdateModal`,
`EditOSModal`, `AddPartModal`, `AddLaborModal`, `TransitionRequirementsSheet`,
`OverrideApprovalSheet`, `VistoriaCTACard`, `ChecklistProgressRow`, `PhotoGroup`,
`TransitionLogItem`, `OSDetailSkeleton` — todos em `src/components/os/`.

### 3.5 Hooks existentes

| Hook | O que faz |
|---|---|
| `useServiceOrdersList(filters)` | WatermelonDB observer + sync polling 60s. Retorna `{ orders, isLoading, isRefreshing, refetch, isOffline }` |
| `useServiceOrder(id)` | Hibrido: WDB observer (real-time) + TanStack Query (extras da API) |
| `useAuth` | Login/logout JWT |
| `useConnectivity` | Detecta online/offline |
| `useSync` | Orquestra sincronizacao |
| `useCalendar` | Agenda: eventos, buildAgendaEventsMap |
| `useInsurers` | Lista de seguradoras |
| `useOSParts` / `useOSLabor` | CRUD pecas/servicos |
| `useUpdateOSStatus` | Transicao de status |
| `useTransitionValidation` | Valida regras de transicao |
| `useCreateServiceOrder` | Cria OS |
| `useCustomerSearch` / `useCreateCustomer` | Busca/cria clientes |
| `useVehicleByPlate` | Consulta placa |
| `useKanbanOS` | Dados para Kanban |
| `useNotifications` | Busca notificacoes |
| `usePermission` | Permissoes de camera/arquivo |
| `useSignatureCapture` / `useEmployeeSignature` | Captura assinatura |
| `useOSDocuments` | Documentos da OS |

### 3.6 Stores (Zustand)

| Store | Persistencia |
|---|---|
| `auth.store.ts` (user, token, activeCompany) | SecureStore |
| `sync.store.ts` (isSyncing, lastSyncAt) | Memoria |
| `new-os.store.ts` (wizard 4 steps) | Memoria |
| `photo.store.ts` (fila upload) | MMKV |
| `checklist-items.store.ts` (itens + status) | MMKV |
| `toast.store.ts` (items + API imperativa) | Memoria |

### 3.7 API client

`src/lib/api.ts` — wrapper com `api.get<T>(path)`, `api.post<T>(path, body)`, `api.patch<T>(path, body)`.
Adiciona automaticamente: `Authorization: Bearer {token}`, `X-Tenant-Domain`, trailing slash.
Base URL: `API_BASE_URL/api/v1{path}/`.

---

## 4. Backend API — endpoints de dashboard (ja existem)

### 4.1 `GET /api/v1/service-orders/dashboard/stats/`

Retorna dados conforme role do JWT (nao por query param):

**MANAGER / ADMIN / OWNER:**
```json
{
  "role": "manager",
  "billing_month": "47820.00",
  "delivered_month": 23,
  "avg_ticket": "2079.13",
  "overdue_count": 3,
  "billing_by_type": { "insurer": "35000.00", "private": "12820.00" },
  "billing_last_6_months": [
    { "month": "Dez/25", "amount": "41200.00" },
    { "month": "Jan/26", "amount": "38900.00" }
  ],
  "team_productivity": [
    { "name": "Lucas Silva", "delivered_month": 12, "open_count": 4 }
  ],
  "overdue_os": [
    { "id": "uuid", "number": 1234, "plate": "ABC1D23", "days_overdue": 3, "status": "painting" }
  ]
}
```

**CONSULTANT:**
```json
{
  "role": "consultant",
  "my_open": 6,
  "my_deliveries_today": 3,
  "my_overdue": 1,
  "my_completed_week": 8,
  "my_recent_os": [
    { "id": "uuid", "number": 1234, "plate": "ABC1D23", "status": "painting", "days_in_shop": 5 }
  ]
}
```

**Legacy (STOREKEEPER, fallback):**
```json
{
  "total_open": 24,
  "by_status": { "reception": 4, "painting": 3, "bodywork": 5 },
  "today_deliveries": 2
}
```

### 4.2 `GET /api/v1/accounting/dashboard/` (Manager+)

Dashboard financeiro completo com KPIs, cash flow, aging. Usar para dados do Gerente:
- `receivable_total` — total a receber (KPI card "A receber")
- `overdue_receivable` — vencidos (KPI card "Vencidos")

### 4.3 `GET /api/v1/accounting/faturamento/` (Manager+)

Faturamento agrupado por cliente, origem ou mes.

### 4.4 Mudancas necessarias no backend (antes de implementar mobile)

O endpoint `DashboardStatsView` precisa ser estendido para suportar os mockups:

**Manager — adicionar:**
- `by_status: Record<string, number>` — contagem de OS por status (hoje so existe no legacy)
- `scheduled_today: number` — eventos agendados para hoje (do CalendarEntry)

**Consultant — adicionar:**
- `my_by_status: Record<string, number>` — contagem das OS do consultor por status
- `my_waiting_auth: number` — OS do consultor aguardando autorizacao
- `my_waiting_parts: number` — OS do consultor aguardando pecas
- `my_scheduled_today: number` — agendamentos do consultor para hoje
- `my_next_deliveries: [{ time, plate, customer_name }]` — proximas entregas com horario

**Tecnico/STOREKEEPER — adicionar (ou criar role separado):**
- `my_os: [{ id, number, plate, vehicle, status, order_in_queue }]` — fila ordenada
- `my_completed_month: number` — concluidas no mes (nao semana)
- `my_avg_days: number` — tempo medio por OS
- `my_commission_month: string` — comissao do mes (se aplicavel)
- `my_estimated_hours_today: number` — horas previstas para hoje
- `my_next_os: { plate, stage }` — proxima OS da fila

---

## 5. O que CRIAR

### 5.1 Mudanca de navegacao — tab "Inicio"

Hoje o `app/(app)/index.tsx` faz `<Redirect href="/(app)/os" />`.

**Mudanca:** transformar `index.tsx` em tela de Dashboard. A tab "OS" do `FrostedNavBar` (que hoje e `routeName: 'index'`)
precisa ser reestruturada:

```
TAB_CONFIG atualizado (4 itens, sem central):
1. Inicio  (routeName: 'index')     → Dashboard (NOVA tela)       icon: home / home-outline
2. OS      (routeName: 'os/index')  → Lista de OS (ja existe)     icon: list / list-outline
3. Agenda  (routeName: 'agenda')    → Agenda (ja existe)          icon: calendar / calendar-outline
4. Mais    (routeName: 'mais')      → Links para areas do ERP     icon: menu / menu-outline
```

**FAB flutuante separado** (nao mais tab central):
- Botao vermelho `Colors.brand`, 56x56, `borderRadius: 18`, posicao `absolute bottom-right`
- Sombra colorida: `shadowColor: Colors.brand, shadowOpacity: 0.5, shadowRadius: 12`
- Icone "+" branco
- Tap abre `QuickActionsSheet` com acoes:
  - **Nova Ordem de Servico** (hero full-width, vermelho)
  - Grid 2x2: Novo Cliente, Novo Veiculo, Agendar, Checklist
- FAB fica visivel em TODAS as telas (exceto camera, photo-editor, checklist)
- Renderizar no `_layout.tsx`, fora do `<Tabs>`, para nao depender de tab

**Importante:** ajustar `_layout.tsx` e `FrostedNavBar.tsx` para refletir a nova estrutura.
O `FrostedNavBar` perde o `isCentral` — vira 4 tabs iguais. O FAB sai para componente separado.

### 5.2 Tela Dashboard — `app/(app)/index.tsx`

Usar `useDashboardStats()` (criar) para buscar dados e renderizar conforme role.

**Visao Gerente (role === "manager"):**
- `<DashboardHeader>` com saudacao: "Boa tarde, Lucas"
- `<KPIHeroCard>` — "FATURAMENTO · {MES}" R$ 47.820, badge ↑12%, mini bar chart (6 meses)
  - Fonte: `billing_month` + `billing_last_6_months` do endpoint OS
- Grid 3 colunas KPI cards:
  - Ticket med: `avg_ticket` (do endpoint OS)
  - A receber: **buscar do endpoint `/api/v1/accounting/dashboard/`** (campo `receivable_total`)
  - Vencidos: **buscar do endpoint `/api/v1/accounting/dashboard/`** (campo `overdue_receivable`)
- "OPERACIONAL · HOJE": 4 stats — OS abertas, atrasadas (`overdue_count`), entregas (`delivered_month`), agendadas
  - Agendadas: **precisa backend** — contar eventos do calendario para hoje
- `<PipelineDistribution>` — distribuicao de OS por etapa
  - **Precisa backend:** adicionar `by_status` na resposta manager (hoje so existe no legacy)
- "ACOES RAPIDAS": botoes Nova OS + Agendar

**Visao Consultora (role === "consultant"):**
- `<DashboardHeader>` com saudacao: "Boa tarde, Marina · Consultora"
- Card hero "OPERACIONAL · HOJE":
  - Entregas hoje: `my_deliveries_today`
  - Atrasados (badge vermelho): `my_overdue`
  - Agendadas: **precisa backend** — contar eventos do calendario
- Linha 2:
  - OS abertas: `my_open`
  - Aprovacoes pendentes: **precisa backend** — contar OS com `status='waiting_auth'` do consultor
  - Aguardando peca: **precisa backend** — contar OS com `status='waiting_parts'` do consultor
- `<PipelineDistribution>` — **precisa backend:** adicionar `my_by_status` na resposta consultant
- "PROXIMAS ENTREGAS" — lista com horario + placa + cliente
  - **Precisa backend:** entregas agendadas para hoje com horario (do calendario)

**Visao Tecnico (role nao reconhecido / STOREKEEPER):**
- `<DashboardHeader>` com saudacao: "Bom dia, Carlos · Pintor"
- Card hero vermelho "MINHA JORNADA · HOJE": total_open + today_deliveries + horas previstas
  - Horas previstas: **precisa backend** — somar horas estimadas das OS atribuidas
- CTA: "Proxima: {placa} {etapa} →" — primeira OS da fila
- 3 stats: concluidas mes (`my_completed_week` adaptar para mes), tempo medio, **comissao mes**
  - Comissao: **precisa backend** — calcular comissao do tecnico
- "MINHA FILA" — lista numerada 1-N com placa, modelo, etapa

### 5.3 Tela "Mais" — `app/(app)/mais/index.tsx`

Lista de links para areas do ERP que nao cabem nas tabs:
- Kanban
- Busca avancada
- Notificacoes / Alertas
- Perfil / Configuracoes
- (Futuro: Estoque, Financeiro, Compras — desktop-only por enquanto)

### 5.3b QuickActionsSheet atualizado

O FAB abre um bottom sheet redesenhado (conforme mockup ④):
- **Hero full-width vermelho:** "Nova Ordem de Servico" + subtitulo "Atalho rapido — placa + cliente"
- **Grid 2x2:**
  - Novo Cliente (icon: person-add-outline)
  - Novo Veiculo (icon: car-outline)
  - Agendar (icon: calendar-outline)
  - Checklist (icon: checkbox-outline) ← **NOVO**, abre seletor de OS para iniciar checklist

### 5.4 Foto do veiculo no OSCard

Os mockups mostram uma foto 64x64 do veiculo no card de OS. Essa foto ja existe: e a foto
de **frente** capturada no checklist de vistoria de entrada.

**Origem da foto:**
- Checklist slot `frente` + `checklist_type: 'entrada'` (ver `PhotoSlotGrid.tsx`)
- Armazenada em `ServiceOrderPhoto` com `slot='frente'`, `checklist_type='entrada'`
- WatermelonDB ja tem tabela `service_order_photos` com `url` e `local_uri`

**Abordagem sugerida:**
1. No backend sync, incluir `cover_photo_url` na resposta de sync (foto frente da vistoria de entrada)
2. Adicionar coluna `cover_photo_url` no schema WatermelonDB (migration v6)
3. No `OSCard`, renderizar a foto com fallback para icone de carro (ja existe o fallback gradient)

**Alternativa sem mudar backend:** buscar a primeira foto do `service_order_photos` local (WDB)
onde `slot='frente'` e `service_order_id` bate. Mais lento, mas funciona offline.

### 5.5 StageProgressBar nos OSCards (opcional, PR separado)

Adicionar `<StageProgressBar>` inline no `OSCard` — barra de progresso com 6 segmentos
coloridos mostrando em qual macro-etapa a OS esta, conforme mockup `dscar-list.jsx` V6c.

---

## 6. Componentes a CRIAR

Diretorio: `src/components/dashboard/`

### 6.1 `<KPIHeroCard>`

```tsx
interface KPIHeroCardProps {
  title: string;           // "Faturamento mensal"
  value: string;           // "R$ 47.820"
  delta?: string;          // "+12%"
  deltaPositive?: boolean;
  series?: { month: string; value: number }[];  // 6 pontos para mini bar chart
}
```
- `LinearGradient` com `Colors.brand` → shade escuro
- Valor em texto grande (fontSize 32, fontWeight 700)
- Mini bar chart: 6 barras brancas com 30% opacity, sem eixos — usar `View` com height proporcional
- **Nao usar lib de graficos** — barras simples com `View` + height calculado

### 6.2 `<KPICard>`

```tsx
interface KPICardProps {
  label: string;
  value: string;
  hint?: string;
  variant?: 'neutral' | 'success' | 'error' | 'warning' | 'accent';
  icon?: keyof typeof Ionicons.glyphMap;
}
```
- Usa `<Card>` existente como base
- Label em `text-xs uppercase`, valor em fontSize 24 fontWeight 700
- Cor do valor conforme `variant` (usar `Colors[variant]` ou `SemanticColors[variant].color`)

### 6.3 `<PipelineDistribution>`

```tsx
interface PipelineDistributionProps {
  counts: Record<string, number>;  // { reception: 4, bodywork: 3, ... }
}
```
- Renderiza cada status como row: dot colorido + label + barra de progresso + contagem
- Usar `OS_STATUS_MAP` para cores e labels
- Barra: `View` com width proporcional ao total, `backgroundColor` do status
- Contagem em `MonoLabel`

### 6.4 `<DashboardHeader>`

```tsx
interface DashboardHeaderProps {
  userName: string;
}
```
- Logo DS Car (usar `require('../../../assets/dscar-logo.png')` — mesmo padrao do OSHeader)
- Saudacao contextual: hora < 12 → "Bom dia", < 18 → "Boa tarde", else → "Boa noite"
- Botao de notificacoes com badge dot

### 6.5 `<OverdueOSList>`

```tsx
interface OverdueOSListProps {
  items: { id: string; number: number; plate: string; days_overdue: number; status: string }[];
  onPress: (id: string) => void;
}
```
- Lista horizontal ou vertical de OS atrasadas
- Destaque em `Colors.error` para `days_overdue`
- Touch navega para detalhe da OS

### 6.6 `<StageProgressBar>` (para OSCard)

```tsx
interface StageProgressBarProps {
  currentStatus: string;
}
```
- 6 segmentos horizontais representando macro-etapas:
  Recepcao → Funilaria → Pintura → Montagem → Lavagem → Entrega
- Segmentos concluidos: cor da etapa. Atual: cor + altura maior. Pendentes: `Colors.border`
- Usar `OS_STATUS_MAP` para mapear status → macro-etapa

---

## 7. Hook a CRIAR

### 7.1 `useDashboardStats()`

```tsx
// src/hooks/useDashboardStats.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ManagerStats {
  role: 'manager';
  billing_month: string;
  delivered_month: number;
  avg_ticket: string;
  overdue_count: number;
  billing_by_type: { insurer: string; private: string };
  billing_last_6_months: { month: string; amount: string }[];
  team_productivity: { name: string; delivered_month: number; open_count: number }[];
  overdue_os: { id: string; number: number; plate: string; days_overdue: number; status: string }[];
}

interface ConsultantStats {
  role: 'consultant';
  my_open: number;
  my_deliveries_today: number;
  my_overdue: number;
  my_completed_week: number;
  my_recent_os: { id: string; number: number; plate: string; status: string; days_in_shop: number }[];
}

interface LegacyStats {
  role?: undefined;
  total_open: number;
  by_status: Record<string, number>;
  today_deliveries: number;
}

type DashboardStats = ManagerStats | ConsultantStats | LegacyStats;

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.get<DashboardStats>('/service-orders/dashboard/stats'),
    staleTime: 1000 * 60 * 2,  // 2 min
    refetchOnWindowFocus: true,
  });
}
```

**Seguir o padrao dos hooks vizinhos:** mesmo formato de queryKey, mesmo estilo de retorno.

---

## 8. Padrao visual dos mockups — traducao para React Native

| Mockup (HTML/CSS) | React Native equivalente |
|---|---|
| `div` com `style={{...}}` | `<View style={styles.xxx}>` |
| `span` com texto | `<Text variant="body">` (componente custom) |
| `background: linear-gradient(...)` | `<LinearGradient colors={[...]} />` (expo-linear-gradient) |
| `borderRadius: 18` | `borderRadius: Radii.xl` (20) ou valor explicito |
| `padding: '10px 16px'` | `paddingVertical: 10, paddingHorizontal: Spacing.lg` |
| `display: flex, flexDirection: column` | padrao do RN — nao precisa declarar |
| `display: grid, gridTemplateColumns: repeat(3, 1fr)` | `<View style={{ flexDirection: 'row', gap: 8 }}>` com filhos `flex: 1` |
| `overflow: auto` | `<ScrollView>` ou `<FlatList>` |
| `position: fixed, bottom: 0` | Ja resolvido pelo `FrostedNavBar` |
| `backdrop-filter: blur(20px)` | `expo-blur` (ja no projeto) |
| `box-shadow` | `Shadow.card` ou `Shadow.sm` |
| `cursor: pointer` | `<TouchableOpacity activeOpacity={0.75}>` |
| `font-family: 'Geist Mono'` | `Typography.mono` (Menlo/monospace) |
| `input` | `<TextInput>` (RN) — ja usado em `os/index.tsx` |

### Cores dos mockups → tokens reais

| Mockup | Token real |
|---|---|
| `#0a0a0c` (bg) | `Colors.bg` (`#141414`) |
| `#15151a` (card) | `Colors.cardBottom` (`#1e1e22`) ou `Colors.surface` |
| `#22222a` (border) | `Colors.border` |
| `#8b8b94` (muted) | `Colors.textSecondary` (`#9ca3af`) |
| `#f5f5f7` (fg) | `Colors.textPrimary` (`#ffffff`) |
| `#ea0e03` (accent) | `Colors.brand` (`#e31b1b`) |
| `accent` em gradiente | `Colors.brand` → `Colors.brandShade` |

---

## 9. Microinteracoes

- **Haptics:** usar `Haptics.impactAsync(ImpactFeedbackStyle.Light)` em todos os taps (ja padrao no app)
- **Animacao de entrada:** `Animated.timing` fade+slide (padrao do `OSCard`)
- **Pull-to-refresh:** `RefreshControl` com `tintColor={Colors.brand}` (padrao de `os/index.tsx`)
- **Skeleton:** usar `ShimmerBlock` existente ou padrao de `SkeletonCard` de `os/index.tsx`
- **Toast:** `toast.success()`, `toast.error()` — API imperativa em `src/stores/toast.store.ts`
- **Bottom sheet:** `<Modal transparent animationType="slide">` + overlay (padrao de `QuickActionsSheet`)

---

## 10. Plano de PRs

### PR 1 — Hook + componentes base do dashboard

**Criar:**
- `src/hooks/useDashboardStats.ts`
- `src/components/dashboard/KPIHeroCard.tsx`
- `src/components/dashboard/KPICard.tsx`
- `src/components/dashboard/PipelineDistribution.tsx`
- `src/components/dashboard/DashboardHeader.tsx`
- `src/components/dashboard/OverdueOSList.tsx`

**Criterio:** componentes renderizam com dados mock, tipados, sem erros de TypeScript.

### PR 2 — Tela Dashboard por role

**Modificar:**
- `app/(app)/index.tsx` — de Redirect para tela de Dashboard com 3 visoes por role
- `app/(app)/_layout.tsx` — ajustar tabs (Inicio, OS, +, Agenda, Mais)
- `src/components/navigation/FrostedNavBar.tsx` — atualizar TAB_CONFIG

**Criar:**
- `app/(app)/mais/index.tsx` — tela "Mais" com links
- `app/(app)/os/index.tsx` — manter como esta (agora e tab separada, nao mais a home)

**Criterio:** gerente ve KPIs financeiros, consultor ve dados pessoais, tecnico ve jornada.
Pull-to-refresh funciona. Skeleton durante loading.

### PR 3 — Foto do veiculo + StageProgressBar no OSCard

**Criar:**
- `src/components/os/StageProgressBar.tsx`

**Modificar:**
- `src/components/os/OSCard.tsx`:
  - Adicionar thumbnail 64x64 da foto de frente (slot `frente`, checklist_type `entrada`)
  - Fallback: icone de carro com gradiente colorido (similar aos mockups)
  - Adicionar `<StageProgressBar>` abaixo do status badge
- Schema WatermelonDB: avaliar se precisa `cover_photo_url` na migration v6
- Backend sync: incluir `cover_photo_url` no `ServiceOrderSyncSerializer`

**Criterio:** foto aparece nos cards com OS que ja tem vistoria. Cards sem foto mostram fallback.
Sem impacto em performance da FlatList (memo comparison deve incluir cover_photo).

---

## 11. Regras

### TypeScript
- strict — nunca `any`, usar `unknown` + narrowing
- Retornos de funcoes sempre tipados
- Props sempre em `interface` nomeada

### Estilo
- Sempre `StyleSheet.create` — nunca objetos inline em `style={{}}`
- Cores: sempre `Colors.xxx` — nunca hex hardcoded
- Espacamento: sempre `Spacing.xxx` — nunca numeros magicos
- Hit targets: minimo 44x44 px para todo elemento tocavel
- Padding lateral das telas: `Spacing.lg` (16px)

### Dados
- Endpoints DRF retornam paginado: `{ results: T[], count, next, previous }`
- Para o dashboard: endpoint retorna objeto direto (nao paginado)
- Sempre `try/catch` em chamadas de API
- Nunca `console.log` em producao — usar `console.warn` em catch se necessario

### Acessibilidade
- `accessibilityRole` em todo elemento interativo
- `accessibilityLabel` descritivo
- `accessibilityState` para estados (selected, disabled)

---

## 12. Quando algo estiver ambiguo

1. **Prefira a versao mais simples.** Mobile odeia complexidade.
2. Marque `// TODO(dashboard): <descricao>` para decisoes pendentes.
3. **Nao adicione feature** fora das secoes 5 e 6 sem aprovacao.
4. Se precisar de dado que nao existe no endpoint, **proponha a mudanca no backend** antes de implementar workaround.
5. Se um token nao existe em `theme.ts`, **proponha o valor** antes de adicionar.

---

## 13. Referencia dos mockups visuais

| Arquivo | Conteudo | Usar como referencia para |
|---|---|---|
| `dscar-home.jsx` | Dashboard com nav + saudacao + KPI hero | Layout geral da tela Inicio |
| `dscar-home-roles.jsx` | 3 visoes: Tecnico, Consultor, Gerente | Conteudo por role |
| `dscar-list.jsx` | 6 variacoes da lista de OS (V1-V6) | StageProgressBar, layout dos cards |
| `dscar-detail.jsx` | Detalhe OS com tabs | Ja implementado — referencia visual |
| `dscar-agenda.jsx` | Agenda com calendario mensal | Ja implementado — referencia visual |
| `dscar-extras.jsx` | V6c refinada com header, busca, filtros | Ja implementado — referencia visual |
| `dscar-icons.jsx` | Icones e componentes base | Traduzir para Ionicons |
| `design-canvas.jsx` | Canvas de design com tweaks | Explorar opcoes visuais |
| `tweaks-panel.jsx` | Painel de ajustes visuais | Ignorar — ferramenta de design |
| `preview.jsx` | Preview wrapper | Ignorar — ferramenta de design |

---

## 14. Definition of Done (cada PR)

- [ ] `pnpm typecheck` passa sem erros em `apps/mobile`
- [ ] App roda sem crash no Expo Go (iOS e Android)
- [ ] Componentes usam tokens de `theme.ts` — zero hex hardcoded
- [ ] Hit targets >= 44px
- [ ] Skeleton states em cada bloco com dados async
- [ ] Pull-to-refresh funciona na tela de Dashboard
- [ ] Nenhuma dependencia nova adicionada
- [ ] Codigo revisado — sem `any`, sem `console.log`, sem estilos inline

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
*Baseado no app mobile real (Expo SDK 55) · Maio 2026*
