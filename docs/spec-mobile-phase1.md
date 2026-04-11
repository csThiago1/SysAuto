# Spec Técnica — Mobile Fase 1 (Sprints M1–M4)

**Escopo:** Fundação do app, autenticação, consulta de OS, offline-first e checklist completo de veículos.
**Referência:** `docs/mobile-roadmap.md`
**Distribuição:** Interna — APK direto (Android) + TestFlight (iOS). Sem lojas públicas.
**Stack confirmada:** React Native 0.76 · Expo SDK 52 · Expo Router v4 · WatermelonDB · Zustand · MMKV · expo-camera · expo-image-manipulator · Zod · @paddock/types

---

## 1. Arquitetura do App

### 1.1 Estrutura de Pastas

```
apps/mobile/
├── app.json                          ← Configuração Expo
├── package.json                      ← Dependências (já existe)
├── tsconfig.json                     ← strict: true
├── eas.json                          ← Build profiles (dev, preview, prod)
├── metro.config.js                   ← Monorepo resolution (@paddock/types)
│
├── app/                              ← Expo Router v4 (file-based routing)
│   ├── _layout.tsx                   ← Root layout (providers: Auth, Query, WatermelonDB)
│   ├── (auth)/                       ← Grupo não-autenticado
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   ├── (app)/                        ← Grupo autenticado (tab navigator)
│   │   ├── _layout.tsx               ← PillTabBar custom (5 tabs com glow)
│   │   ├── index.tsx                 ← Home / Lista de OS
│   │   ├── os/
│   │   │   ├── _layout.tsx           ← Stack navigator
│   │   │   ├── index.tsx             ← Lista de OS (redirect da home)
│   │   │   └── [id].tsx              ← Detalhe da OS
│   │   ├── busca/
│   │   │   └── index.tsx             ← Busca global (placa, nº OS, cliente)
│   │   ├── nova-os/
│   │   │   └── index.tsx             ← Wizard de abertura (Sprint M5)
│   │   ├── notificacoes/
│   │   │   └── index.tsx             ← Feed de notificações (mudanças de status)
│   │   ├── checklist/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx             ← Lista de checklists recentes
│   │   │   ├── [osId].tsx            ← Checklist fotográfico + itens
│   │   │   └── camera.tsx            ← Tela de câmera fullscreen
│   │   └── perfil/
│   │       └── index.tsx             ← Perfil, sync status, logout
│   └── +not-found.tsx
│
├── src/
│   ├── components/
│   │   ├── ui/                       ← Componentes base (Button, Card, Badge, Input, etc.)
│   │   ├── navigation/               ← PillTabBar, TabBarIcon, GlowEffect
│   │   ├── os/                       ← OSCard, OSStatusBadge, OSDetailHeader
│   │   ├── checklist/                ← ChecklistGrid, ChecklistSlot, ChecklistItemRow
│   │   ├── camera/                   ← CameraView, WatermarkPreview
│   │   ├── photo-editor/             ← AnnotationCanvas, ArrowTool, CircleTool, TextTool
│   │   └── common/                   ← OfflineBanner, SyncIndicator, EmptyState
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                ← Login, logout, token refresh
│   │   ├── useServiceOrders.ts       ← CRUD OS (TanStack Query + WatermelonDB)
│   │   ├── useChecklist.ts           ← Checklist state e persistência
│   │   ├── useCamera.ts              ← Captura + marca d'água
│   │   ├── usePhotoUpload.ts         ← Fila de upload com retry
│   │   ├── useSync.ts               ← Controle de sincronização
│   │   ├── useConnectivity.ts        ← NetInfo + estado online/offline
│   │   └── usePermission.ts          ← RBAC (reuso de ROLE_HIERARCHY)
│   │
│   ├── stores/
│   │   ├── auth.store.ts             ← Zustand: user, token, company, role
│   │   ├── sync.store.ts             ← Zustand: lastSync, pendingUploads, conflicts
│   │   └── checklist.store.ts        ← Zustand: checklist draft em andamento
│   │
│   ├── db/
│   │   ├── schema.ts                 ← WatermelonDB schema
│   │   ├── models/
│   │   │   ├── ServiceOrder.ts       ← Model WatermelonDB
│   │   │   ├── ServiceOrderPhoto.ts
│   │   │   ├── ChecklistItem.ts      ← Model local (novo)
│   │   │   └── ChecklistPhoto.ts     ← Model local (novo)
│   │   ├── migrations.ts             ← Schema migrations
│   │   └── sync.ts                   ← Sync adapter (pull/push protocol)
│   │
│   ├── lib/
│   │   ├── api.ts                    ← Fetch client configurado
│   │   ├── watermark.ts              ← Lógica de marca d'água
│   │   ├── compression.ts            ← Compressão de imagem
│   │   ├── annotations.ts            ← Serialização de anotações
│   │   └── constants.ts              ← URLs, timeouts, checklist templates
│   │
│   ├── types/
│   │   └── checklist.types.ts        ← Tipos locais do checklist
│   │
│   └── assets/
│       ├── silhouettes/              ← SVGs de silhueta de veículo
│       │   ├── front.svg
│       │   ├── rear.svg
│       │   ├── left-side.svg
│       │   ├── right-side.svg
│       │   ├── diagonal-front.svg
│       │   ├── diagonal-rear.svg
│       │   ├── key.svg
│       │   ├── dashboard.svg
│       │   ├── engine.svg
│       │   ├── spare-tire.svg
│       │   ├── toolkit.svg
│       │   └── fuel-gauge.svg
│       ├── logo-dscar.png
│       └── logo-dscar-watermark.png  ← Versão semitransparente para marca d'água
│
└── __tests__/
    ├── stores/
    ├── hooks/
    └── components/
```

### 1.2 Fluxo de Dados

```
┌─────────────┐    online     ┌──────────────┐
│  Django API  │ ◄──────────► │  Sync Layer  │
│  (Backend)   │   REST/JSON  │  (sync.ts)   │
└─────────────┘              └──────┬───────┘
                                    │
                              ┌─────▼───────┐
                              │ WatermelonDB │  ← fonte de verdade local
                              │   (SQLite)   │
                              └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
              │  TanStack  │   │  Zustand   │   │   MMKV    │
              │   Query    │   │  (stores)  │   │ (prefs)   │
              │ (server)   │   │ (UI state) │   │           │
              └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                              ┌─────▼───────┐
                              │    React     │
                              │  Components  │
                              └─────────────┘
```

**Regra:** Tela sempre lê do WatermelonDB (via TanStack Query observando WatermelonDB). Nunca faz fetch direto ao backend para exibir dados — o sync layer é o intermediário.

### 1.3 Estratégia de Sync (WatermelonDB)

O WatermelonDB implementa um protocolo de sync com duas operações:

**Pull (Backend → Mobile):**
```typescript
// GET /api/v1/mobile/sync/?last_pulled_at=1712764800
// Retorna: { changes: { service_orders: { created: [], updated: [], deleted: [] } }, timestamp }
```

**Push (Mobile → Backend):**
```typescript
// POST /api/v1/mobile/sync/
// Body: { changes: { service_orders: { created: [], updated: [] } }, lastPulledAt }
```

**Fase 1 (M2):** Somente pull (read-only). Dados fluem apenas do backend para o mobile.
**Fase 2 (M5+):** Push habilitado para criação de OS e envio de checklist.

---

## 2. Models & Schemas

### 2.1 WatermelonDB Schema (src/db/schema.ts)

```typescript
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'service_orders',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'number', type: 'number', isIndexed: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'status_display', type: 'string' },
        { name: 'customer_type', type: 'string', isOptional: true },
        { name: 'os_type', type: 'string', isOptional: true },
        { name: 'customer_name', type: 'string' },
        { name: 'customer_id', type: 'string', isOptional: true },
        { name: 'plate', type: 'string', isIndexed: true },
        { name: 'make', type: 'string' },
        { name: 'model', type: 'string' },
        { name: 'year', type: 'number', isOptional: true },
        { name: 'color', type: 'string' },
        { name: 'chassis', type: 'string' },
        { name: 'mileage_in', type: 'number', isOptional: true },
        { name: 'vehicle_location', type: 'string' },
        { name: 'consultant_name', type: 'string' },
        { name: 'parts_total', type: 'number' },
        { name: 'services_total', type: 'number' },
        { name: 'discount_total', type: 'number' },
        { name: 'total', type: 'number' },
        { name: 'notes', type: 'string' },
        { name: 'days_in_shop', type: 'number', isOptional: true },
        { name: 'entry_date', type: 'number', isOptional: true },
        { name: 'estimated_delivery_date', type: 'number', isOptional: true },
        { name: 'opened_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        // Seguradora
        { name: 'insurer_name', type: 'string', isOptional: true },
        { name: 'casualty_number', type: 'string' },
        // Sync control
        { name: 'is_dirty', type: 'boolean' },  // criado localmente, aguardando push
      ],
    }),

    tableSchema({
      name: 'service_order_photos',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'service_order_id', type: 'string', isIndexed: true },
        { name: 'folder', type: 'string' },
        { name: 'slot', type: 'string', isOptional: true },  // ex: "front", "rear", "key"
        { name: 'caption', type: 'string' },
        { name: 'local_uri', type: 'string' },       // path no filesystem local
        { name: 's3_key', type: 'string', isOptional: true },
        { name: 'url', type: 'string', isOptional: true },
        { name: 'upload_status', type: 'string' },   // pending | uploading | uploaded | error
        { name: 'annotations_json', type: 'string' }, // JSON das anotações (layers)
        { name: 'has_watermark', type: 'boolean' },
        { name: 'uploaded_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'checklist_sessions',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'service_order_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' },            // entry | initial_survey | final_survey
        { name: 'status', type: 'string' },           // draft | completed | synced
        { name: 'template_key', type: 'string' },     // bodywork | mechanical | aesthetic | general
        { name: 'photo_count', type: 'number' },
        { name: 'required_photo_count', type: 'number' },
        { name: 'ok_count', type: 'number' },
        { name: 'attention_count', type: 'number' },
        { name: 'critical_count', type: 'number' },
        { name: 'general_notes', type: 'string' },
        { name: 'completed_by', type: 'string', isOptional: true },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'checklist_items',
      columns: [
        { name: 'checklist_session_id', type: 'string', isIndexed: true },
        { name: 'category', type: 'string' },         // body_paint | glass | lights | tires | interior | accessories | mechanical
        { name: 'item_key', type: 'string' },          // ex: "dent", "scratch", "windshield"
        { name: 'label', type: 'string' },
        { name: 'severity', type: 'string' },          // ok | attention | critical | absent | not_checked
        { name: 'observation', type: 'string' },
        { name: 'sort_order', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'activity_logs',
      columns: [
        { name: 'server_id', type: 'string' },
        { name: 'service_order_id', type: 'string', isIndexed: true },
        { name: 'activity_type', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'user_name', type: 'string' },
        { name: 'metadata_json', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
```

### 2.2 Tipos TypeScript do Checklist (src/types/checklist.types.ts)

```typescript
/**
 * Tipos do módulo de checklist mobile.
 * Complementa @paddock/types com estruturas específicas do app.
 */

// ── Slots de foto obrigatórios ──────────────────────────────────────────────

export type PhotoSlotKey =
  // Externo
  | 'front'
  | 'rear'
  | 'left_side'
  | 'right_side'
  | 'diagonal_front_left'
  | 'diagonal_rear_right'
  // Detalhes
  | 'key'
  | 'dashboard_odometer'
  | 'engine'
  | 'spare_tire'
  | 'toolkit'
  | 'fuel_gauge';

export interface PhotoSlotConfig {
  key: PhotoSlotKey;
  label: string;
  silhouetteAsset: string;    // path relativo em assets/silhouettes/
  required: boolean;
  folder: 'checklist_entrada' | 'vistoria_inicial' | 'vistoria_final';
}

export const PHOTO_SLOTS: PhotoSlotConfig[] = [
  // Externo (obrigatórios)
  { key: 'front',                label: 'Frente',                    silhouetteAsset: 'front.svg',          required: true,  folder: 'checklist_entrada' },
  { key: 'rear',                 label: 'Traseira',                  silhouetteAsset: 'rear.svg',           required: true,  folder: 'checklist_entrada' },
  { key: 'left_side',            label: 'Lateral Esquerda',          silhouetteAsset: 'left-side.svg',      required: true,  folder: 'checklist_entrada' },
  { key: 'right_side',           label: 'Lateral Direita',           silhouetteAsset: 'right-side.svg',     required: true,  folder: 'checklist_entrada' },
  { key: 'diagonal_front_left',  label: 'Diagonal Diant. Esquerda', silhouetteAsset: 'diagonal-front.svg', required: true,  folder: 'checklist_entrada' },
  { key: 'diagonal_rear_right',  label: 'Diagonal Tras. Direita',   silhouetteAsset: 'diagonal-rear.svg',  required: true,  folder: 'checklist_entrada' },
  // Detalhes (obrigatórios)
  { key: 'key',                  label: 'Chave / Controle',          silhouetteAsset: 'key.svg',            required: true,  folder: 'checklist_entrada' },
  { key: 'dashboard_odometer',   label: 'Painel / Odômetro',         silhouetteAsset: 'dashboard.svg',      required: true,  folder: 'checklist_entrada' },
  { key: 'engine',               label: 'Motor (capô aberto)',       silhouetteAsset: 'engine.svg',         required: true,  folder: 'checklist_entrada' },
  { key: 'spare_tire',           label: 'Step / Estepe',             silhouetteAsset: 'spare-tire.svg',     required: true,  folder: 'checklist_entrada' },
  { key: 'toolkit',              label: 'Kit Ferramentas',           silhouetteAsset: 'toolkit.svg',        required: true,  folder: 'checklist_entrada' },
  { key: 'fuel_gauge',           label: 'Nível Combustível',         silhouetteAsset: 'fuel-gauge.svg',     required: true,  folder: 'checklist_entrada' },
];

// ── Checklist de itens (checkboxes) ─────────────────────────────────────────

export type ItemSeverity = 'ok' | 'attention' | 'critical' | 'absent' | 'not_checked';

export type ChecklistCategory =
  | 'body_paint'
  | 'glass'
  | 'lights'
  | 'tires'
  | 'interior'
  | 'accessories'
  | 'mechanical_visual';

export interface ChecklistItemTemplate {
  key: string;
  label: string;
  category: ChecklistCategory;
  defaultSeverity: ItemSeverity;
}

export const CHECKLIST_CATEGORIES: Record<ChecklistCategory, { label: string; icon: string }> = {
  body_paint:       { label: 'Lataria / Pintura',   icon: 'car' },
  glass:            { label: 'Vidros',               icon: 'square' },
  lights:           { label: 'Iluminação',           icon: 'lightbulb' },
  tires:            { label: 'Pneus',                icon: 'circle' },
  interior:         { label: 'Interior',             icon: 'armchair' },
  accessories:      { label: 'Acessórios',           icon: 'wrench' },
  mechanical_visual:{ label: 'Mecânico (visual)',    icon: 'settings' },
};

/**
 * Template padrão de itens do checklist.
 * Cada tipo de OS pode ter itens adicionais ou removidos.
 */
export const CHECKLIST_ITEMS_TEMPLATE: ChecklistItemTemplate[] = [
  // Lataria / Pintura
  { key: 'dents',           label: 'Amassados',               category: 'body_paint',        defaultSeverity: 'not_checked' },
  { key: 'scratches',       label: 'Riscos',                  category: 'body_paint',        defaultSeverity: 'not_checked' },
  { key: 'rust',            label: 'Ferrugem',                category: 'body_paint',        defaultSeverity: 'not_checked' },
  { key: 'peeling_paint',   label: 'Pintura descascando',     category: 'body_paint',        defaultSeverity: 'not_checked' },
  { key: 'bumper_front',    label: 'Para-choque dianteiro',   category: 'body_paint',        defaultSeverity: 'not_checked' },
  { key: 'bumper_rear',     label: 'Para-choque traseiro',    category: 'body_paint',        defaultSeverity: 'not_checked' },

  // Vidros
  { key: 'windshield',      label: 'Para-brisa',              category: 'glass',             defaultSeverity: 'not_checked' },
  { key: 'rear_window',     label: 'Vidro traseiro',          category: 'glass',             defaultSeverity: 'not_checked' },
  { key: 'side_windows',    label: 'Vidros laterais',         category: 'glass',             defaultSeverity: 'not_checked' },
  { key: 'mirrors',         label: 'Retrovisores',            category: 'glass',             defaultSeverity: 'not_checked' },

  // Iluminação
  { key: 'headlights',      label: 'Faróis',                  category: 'lights',            defaultSeverity: 'not_checked' },
  { key: 'taillights',      label: 'Lanternas traseiras',     category: 'lights',            defaultSeverity: 'not_checked' },
  { key: 'turn_signals',    label: 'Setas',                   category: 'lights',            defaultSeverity: 'not_checked' },
  { key: 'brake_lights',    label: 'Luz de freio',            category: 'lights',            defaultSeverity: 'not_checked' },
  { key: 'reverse_lights',  label: 'Luz de ré',               category: 'lights',            defaultSeverity: 'not_checked' },

  // Pneus (cada um independente)
  { key: 'tire_fl',         label: 'Pneu dianteiro esquerdo', category: 'tires',             defaultSeverity: 'not_checked' },
  { key: 'tire_fr',         label: 'Pneu dianteiro direito',  category: 'tires',             defaultSeverity: 'not_checked' },
  { key: 'tire_rl',         label: 'Pneu traseiro esquerdo',  category: 'tires',             defaultSeverity: 'not_checked' },
  { key: 'tire_rr',         label: 'Pneu traseiro direito',   category: 'tires',             defaultSeverity: 'not_checked' },

  // Interior
  { key: 'seats',           label: 'Bancos',                  category: 'interior',          defaultSeverity: 'not_checked' },
  { key: 'dashboard_panel', label: 'Painel / Dashboard',      category: 'interior',          defaultSeverity: 'not_checked' },
  { key: 'carpets',         label: 'Tapetes',                 category: 'interior',          defaultSeverity: 'not_checked' },
  { key: 'ac',              label: 'Ar-condicionado',         category: 'interior',          defaultSeverity: 'not_checked' },
  { key: 'multimedia',      label: 'Rádio / Multimídia',      category: 'interior',          defaultSeverity: 'not_checked' },
  { key: 'steering_wheel',  label: 'Volante',                 category: 'interior',          defaultSeverity: 'not_checked' },

  // Acessórios
  { key: 'jack',            label: 'Macaco',                  category: 'accessories',       defaultSeverity: 'not_checked' },
  { key: 'lug_wrench',      label: 'Chave de roda',           category: 'accessories',       defaultSeverity: 'not_checked' },
  { key: 'triangle',        label: 'Triângulo',               category: 'accessories',       defaultSeverity: 'not_checked' },
  { key: 'fire_extinguisher',label: 'Extintor',               category: 'accessories',       defaultSeverity: 'not_checked' },
  { key: 'docs_glove_box',  label: 'Documentos (porta-luvas)',category: 'accessories',       defaultSeverity: 'not_checked' },
  { key: 'floor_mats',      label: 'Tapetes originais',       category: 'accessories',       defaultSeverity: 'not_checked' },

  // Mecânico (visual)
  { key: 'leaks',           label: 'Vazamentos visíveis',     category: 'mechanical_visual', defaultSeverity: 'not_checked' },
  { key: 'belts',           label: 'Correias aparentes',      category: 'mechanical_visual', defaultSeverity: 'not_checked' },
  { key: 'oil_level',       label: 'Nível de óleo',           category: 'mechanical_visual', defaultSeverity: 'not_checked' },
  { key: 'battery',         label: 'Bateria',                 category: 'mechanical_visual', defaultSeverity: 'not_checked' },
  { key: 'coolant',         label: 'Nível de água/radiador',  category: 'mechanical_visual', defaultSeverity: 'not_checked' },
];

// ── Anotações nas fotos ─────────────────────────────────────────────────────

export type AnnotationType = 'arrow' | 'circle' | 'text';
export type AnnotationColor = '#FF0000' | '#FFFF00' | '#FFFFFF';

export interface AnnotationArrow {
  type: 'arrow';
  color: AnnotationColor;
  fromX: number;  // 0-1 (normalizado)
  fromY: number;
  toX: number;
  toY: number;
}

export interface AnnotationCircle {
  type: 'circle';
  color: AnnotationColor;
  centerX: number;
  centerY: number;
  radius: number;  // 0-1 (normalizado)
}

export interface AnnotationText {
  type: 'text';
  color: AnnotationColor;
  x: number;
  y: number;
  text: string;
  fontSize: number;  // em pontos lógicos
}

export type Annotation = AnnotationArrow | AnnotationCircle | AnnotationText;

export interface PhotoAnnotations {
  photoId: string;
  annotations: Annotation[];
  version: number;  // para undo stack
}
```

---

## 3. APIs Necessárias (Backend)

### 3.1 Endpoints Existentes (reutilizar)

| Método | Endpoint | Uso no Mobile |
|--------|----------|---------------|
| `GET` | `/api/v1/service-orders/` | Lista de OS (paginada, filtros) |
| `GET` | `/api/v1/service-orders/{id}/` | Detalhe da OS |
| `POST` | `/api/v1/service-orders/` | Criar OS (Sprint M5) |
| `PATCH` | `/api/v1/service-orders/{id}/` | Atualizar status (Sprint M6) |
| `POST` | `/api/v1/service-orders/{id}/photos/` | Upload de foto |
| `GET` | `/api/v1/service-orders/{id}/activities/` | Histórico da OS |
| `POST` | `/api/v1/customers/` | Cadastro rápido de cliente |
| `GET` | `/api/v1/customers/?search=` | Busca de cliente |

### 3.2 Endpoints Novos (criar no backend)

#### `POST /api/v1/mobile/sync/pull/`
Sync incremental para WatermelonDB.

```python
# Request
{ "last_pulled_at": 1712764800 }  # timestamp Unix (0 = first sync)

# Response
{
  "changes": {
    "service_orders": {
      "created": [{ ... }],     # OS criadas desde last_pulled_at
      "updated": [{ ... }],     # OS modificadas
      "deleted": ["uuid1"]      # OS deletadas (soft delete)
    },
    "service_order_photos": { ... },
    "activity_logs": { ... }
  },
  "timestamp": 1712851200
}
```

#### `POST /api/v1/mobile/sync/push/`
Envio de dados criados offline.

```python
# Request
{
  "changes": {
    "service_orders": {
      "created": [{ ... }],     # OS criadas offline
      "updated": [{ ... }]      # status/notas alterados offline
    },
    "checklist_sessions": {
      "created": [{ ... }]
    },
    "checklist_items": {
      "created": [{ ... }]
    }
  },
  "lastPulledAt": 1712764800
}

# Response
{ "ok": true, "conflicts": [] }
```

#### `POST /api/v1/service-orders/{id}/checklist/`
Salvar checklist completo de uma OS.

```python
# Request
{
  "type": "entry",  # entry | initial_survey | final_survey
  "template_key": "bodywork",
  "items": [
    {
      "item_key": "dents",
      "category": "body_paint",
      "severity": "attention",
      "observation": "Amassado no paralama dianteiro esquerdo"
    },
    ...
  ],
  "general_notes": "Veículo chegou com pneu dianteiro direito murcho",
  "photo_ids": ["uuid1", "uuid2", ...]  # fotos já uploadadas vinculadas
}

# Response
{ "id": "uuid", "status": "completed", "created_at": "..." }
```

#### `GET /api/v1/service-orders/{id}/checklist/`
Listar checklists de uma OS.

```python
# Response
[
  {
    "id": "uuid",
    "type": "entry",
    "status": "completed",
    "template_key": "bodywork",
    "summary": { "ok": 28, "attention": 5, "critical": 1, "absent": 2 },
    "photo_count": 14,
    "completed_by": "João Silva",
    "completed_at": "2026-04-10T14:32:00Z",
    "items": [ ... ],
    "photos": [ ... ]
  }
]
```

### 3.3 Novo Model Backend: `VehicleChecklist`

```python
# apps/service_orders/models.py (adicionar)

class ChecklistType(models.TextChoices):
    ENTRY          = "entry",          "Checklist de Entrada"
    INITIAL_SURVEY = "initial_survey", "Vistoria Inicial"
    FINAL_SURVEY   = "final_survey",   "Vistoria Final"

class ChecklistStatus(models.TextChoices):
    DRAFT     = "draft",     "Rascunho"
    COMPLETED = "completed", "Concluído"

class VehicleChecklist(PaddockBaseModel):
    """
    Sessão de checklist de um veículo, vinculada a uma OS.
    Imutável após status=completed.
    """
    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name="checklists",
    )
    type = models.CharField(max_length=20, choices=ChecklistType.choices)
    status = models.CharField(
        max_length=20,
        choices=ChecklistStatus.choices,
        default=ChecklistStatus.DRAFT,
    )
    template_key = models.CharField(max_length=30, default="general")
    general_notes = models.TextField(blank=True, default="")
    completed_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        null=True, blank=True,
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "service_orders_vehicle_checklist"
        ordering = ["-created_at"]

class ChecklistItemSeverity(models.TextChoices):
    OK          = "ok",          "OK"
    ATTENTION   = "attention",   "Atenção"
    CRITICAL    = "critical",    "Crítico"
    ABSENT      = "absent",      "Ausente"
    NOT_CHECKED = "not_checked", "Não verificado"

class VehicleChecklistItem(PaddockBaseModel):
    """Item individual do checklist (checkbox com severidade)."""
    checklist = models.ForeignKey(
        VehicleChecklist,
        on_delete=models.CASCADE,
        related_name="items",
    )
    category = models.CharField(max_length=30)    # body_paint, glass, etc.
    item_key = models.CharField(max_length=50)     # dents, scratches, etc.
    label = models.CharField(max_length=100)
    severity = models.CharField(
        max_length=20,
        choices=ChecklistItemSeverity.choices,
        default=ChecklistItemSeverity.NOT_CHECKED,
    )
    observation = models.TextField(blank=True, default="")
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "service_orders_checklist_item"
        ordering = ["sort_order"]
        unique_together = [("checklist", "item_key")]
```

---

## 4. Telas — Wireframes Textuais

### 4.0 Pill Tab Bar (`src/components/navigation/PillTabBar.tsx`)

**Referência visual:** Barra flutuante estilo pill (cápsula preta arredondada), posicionada na parte inferior da tela com margem lateral e inferior. Fundo preto sólido com cantos totalmente arredondados (borderRadius: 999).

```
                                               glow roxo/azul
                                                  ╱
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│    🏠        🔍        ＋        🔔        👤              │
│   Home     Busca    Nova OS   Alertas    Perfil             │
│                                 ●                            │
│                              (ativo)                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
        fundo: #000000 · borderRadius: 999 · padding: 8
        posição: absolute bottom com SafeAreaView
```

**Spec de animação (Reanimated v3):**

```typescript
// src/components/navigation/PillTabBar.tsx
// Custom tabBar passado para Expo Router <Tabs> via tabBar prop

// Estrutura do componente:
// <Animated.View style={pillContainer}>
//   {routes.map(route => (
//     <TabBarIcon
//       key={route.key}
//       icon={route.icon}
//       isActive={route.key === activeRoute}
//       onPress={() => navigate(route)}
//     />
//   ))}
// </Animated.View>

// ── Animação do ícone ativo ─────────────────────────────
// Ao trocar de tab:
// 1. Ícone anterior: scale 1.15 → 1.0 (withSpring, damping: 15)
//                    opacity glow: 1 → 0 (withTiming, 200ms)
// 2. Ícone novo:     scale 1.0 → 1.15 (withSpring, damping: 15)
//                    opacity glow: 0 → 1 (withTiming, 200ms)

// ── Efeito Glow ─────────────────────────────────────────
// Implementação: <View> atrás do ícone com:
//   - backgroundColor: 'rgba(139, 92, 246, 0.4)' (violet-500/40%)
//   - borderRadius: 999
//   - width/height animados: 0 → 48 (quando ativo)
//   - blur via react-native-blur ou shadowColor + shadowRadius
//   - Alternativa simples: shadowColor '#8B5CF6', shadowRadius: 20, shadowOpacity animada 0→0.8

// ── Botão central "+" (Nova OS) ─────────────────────────
// Diferenciado visualmente:
//   - Ícone ligeiramente maior (24→28)
//   - Ao pressionar: scale 1.0 → 0.85 → 1.0 (withSequence + withSpring)
//   - Haptic feedback: Haptics.impactAsync(ImpactFeedbackStyle.Medium)
//   - Abre modal/wizard de Nova OS (não troca de tab)

// ── Auto-hide ao rolar ──────────────────────────────────
// useAnimatedScrollHandler detecta direção:
//   - Scroll down: translateY 0 → 100 (esconde com withTiming, 300ms)
//   - Scroll up:   translateY 100 → 0 (mostra com withTiming, 200ms)
//   - Sempre visível quando scroll está no topo
```

**Tabs e seus ícones (Lucide React Native):**

| Tab | Ícone | Rota | Descrição |
|-----|-------|------|-----------|
| Home | `Home` | `/(app)/` | Lista de OS (tela principal) |
| Busca | `Search` | `/(app)/busca` | Busca global por placa, nº OS, cliente |
| Nova OS | `Plus` | modal | Wizard de abertura de OS (Sprint M5) |
| Alertas | `Bell` | `/(app)/notificacoes` | Feed de mudanças de status |
| Perfil | `User` | `/(app)/perfil` | Dados do usuário, sync status, logout |

**Transições entre telas (Shared Element Transitions):**
- Tab → Tab: crossfade suave (200ms, Reanimated layout animations)
- Lista → Detalhe (push): slide da direita com shared element no card da OS (placa e status badge "voam" para o header do detalhe)
- Detalhe → Lista (pop): reverso do push
- Qualquer tela → Câmera: fade to black rápido (150ms) para não mostrar flash da câmera inicializando

---

### 4.1 Login (`app/(auth)/login.tsx`)

```
┌──────────────────────────────┐
│                              │
│        [Logo DS Car]         │
│     Centro Automotivo        │
│                              │
│  ┌────────────────────────┐  │
│  │ Email                  │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Senha              [👁] │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │      ENTRAR            │  │
│  └────────────────────────┘  │
│                              │
│  Esqueceu a senha?           │
│                              │
│  v1.0.0 · Paddock Solutions  │
└──────────────────────────────┘
```

### 4.2 Lista de OS (`app/(app)/os/index.tsx`)

```
┌──────────────────────────────┐
│ Ordens de Serviço      [🔍]  │
├──────────────────────────────┤
│ [Todas][Recepção][Reparo][▸] │  ← chips de filtro (scroll horizontal)
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ OS #1247  ●Reparo        │ │
│ │ ABC-1234 · HB20 Branco  │ │
│ │ João da Silva            │ │
│ │ 📅 5 dias · Previsão 15/04│ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ OS #1246  ●Recepção      │ │
│ │ DEF-5678 · Onix Prata   │ │
│ │ Maria Souza              │ │
│ │ 📅 Hoje · Sem previsão   │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ OS #1245  ●Ag. Peças     │ │
│ │ ...                      │ │
│ └──────────────────────────┘ │
│                              │
│ ↻ Puxe para atualizar       │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🏠  🔍  ＋  🔔  👤      │ │  ← Pill tab bar (glow no 🏠)
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 4.3 Detalhe da OS (`app/(app)/os/[id].tsx`)

```
┌──────────────────────────────┐
│ ← OS #1247                   │
├──────────────────────────────┤
│ ● Reparo                     │
│ ABC-1234 · HB20 1.0 2023    │
│ Branco · KM: 45.230         │
│ Cliente: João da Silva       │
│ Consultor: Ana Paula         │
│──────────────────────────────│
│ [Dados] [Fotos] [Itens] [📋]│  ← tabs
│──────────────────────────────│
│                              │
│ Peças          R$ 2.450,00  │
│ Serviços       R$ 1.800,00  │
│ Desconto       -R$  200,00  │
│ ─────────────────────────── │
│ Total          R$ 4.050,00  │
│                              │
│ 📸 12 fotos · ✓ Checklist    │
│                              │
│ [▶ Iniciar Checklist]        │  ← atalho para checklist
│ [📝 Adicionar Nota]          │
│                              │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🏠  🔍  ＋  🔔  👤      │ │  ← Pill tab bar
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 4.4 Checklist Fotográfico (`app/(app)/checklist/[osId].tsx`)

```
┌──────────────────────────────┐
│ ← Checklist · OS #1247       │
│ Progresso: ████████░░ 8/12   │
├──────────────────────────────┤
│ [📸 Fotos] [☑ Itens]        │  ← tabs dentro do checklist
├──────────────────────────────┤
│ EXTERNO                      │
│ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │ 🚗  │ │ 🚗  │ │ 🚗  │    │
│ │Front│ │Rear │ │Left │    │
│ │  ✓  │ │  ✓  │ │  ⏳ │    │
│ └─────┘ └─────┘ └─────┘    │
│ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │Right│ │DiagF│ │DiagR│    │
│ │  ✓  │ │  ✓  │ │  ✓  │    │
│ └─────┘ └─────┘ └─────┘    │
│                              │
│ DETALHES                     │
│ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │ 🔑  │ │ 📊  │ │ ⚙️  │    │
│ │Chave│ │Odo. │ │Motor│    │
│ │  ✓  │ │  ✓  │ │  ⏳ │    │
│ └─────┘ └─────┘ └─────┘    │
│ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │Step │ │Ferr.│ │Comb.│    │
│ │  ⏳ │ │  ⏳ │ │  ⏳ │    │
│ └─────┘ └─────┘ └─────┘    │
│                              │
│ EXTRAS                       │
│ ┌─────┐                     │
│ │  +  │ Adicionar foto extra │
│ └─────┘                     │
│                              │
│ [Concluir Checklist Fotos]   │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🏠  🔍  ＋  🔔  👤      │ │  ← Pill tab bar (oculta ao rolar)
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 4.5 Câmera (`app/(app)/checklist/camera.tsx`)

```
┌──────────────────────────────┐
│                              │
│   ┌──────────────────────┐   │
│   │                      │   │
│   │   [silhueta guia     │   │
│   │    semitransparente  │   │
│   │    do slot atual]    │   │
│   │                      │   │
│   │                      │   │
│   │   viewfinder da      │   │
│   │   câmera             │   │
│   │                      │   │
│   └──────────────────────┘   │
│                              │
│ Frente do Veículo            │  ← label do slot
│ Alinhe o veículo com a guia  │
│                              │
│  [⚡]    [ ◉ ]    [🔄]      │  ← flash, capturar, flip
│                              │
│        Slot 1 de 12          │
└──────────────────────────────┘
```

### 4.6 Editor de Anotações (modal sobre foto)

```
┌──────────────────────────────┐
│ ← Anotar Foto         [Salvar]│
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │                        │  │
│  │   [foto capturada]     │  │
│  │                        │  │
│  │    ←──── seta ────→    │  │
│  │       (  O  )          │  │
│  │     círculo            │  │
│  │   "Risco profundo"     │  │
│  │                        │  │
│  └────────────────────────┘  │
│                              │
│ [↩ Desfazer] [↪ Refazer]    │
│                              │
│ Ferramentas:                 │
│ [→Seta] [◯Círculo] [Aa Text]│
│                              │
│ Cores:                       │
│ [🔴] [🟡] [⚪]              │
│                              │
│ Observação:                  │
│ ┌────────────────────────┐  │
│ │ Risco profundo no       │  │
│ │ paralama dianteiro...   │  │
│ └────────────────────────┘  │
└──────────────────────────────┘
```

### 4.7 Checklist de Itens (tab dentro do checklist)

```
┌──────────────────────────────┐
│ ← Checklist · OS #1247       │
│ OK: 22 · Atenção: 5 · ⚠ 1  │
├──────────────────────────────┤
│ [📸 Fotos] [☑ Itens]        │
├──────────────────────────────┤
│ 🚗 LATARIA / PINTURA         │
│ ├ Amassados        [Atenção▾]│
│ │ obs: Paralama diant. esq.  │
│ ├ Riscos           [OK     ▾]│
│ ├ Ferrugem         [OK     ▾]│
│ └ Pintura descasc. [Crítico▾]│
│   obs: Teto lado esquerdo    │
│                              │
│ 🪟 VIDROS                     │
│ ├ Para-brisa       [OK     ▾]│
│ ├ Vidro traseiro   [OK     ▾]│
│ ├ Vidros laterais  [OK     ▾]│
│ └ Retrovisores     [Atenção▾]│
│   obs: Retrovisor dir. solto │
│                              │
│ 💡 ILUMINAÇÃO                 │
│ ├ Faróis           [OK     ▾]│
│ ├ ...                        │
│                              │
│ Observação geral:            │
│ ┌────────────────────────┐  │
│ │ Pneu diant. dir. murcho│  │
│ └────────────────────────┘  │
│                              │
│ [Concluir Checklist]         │
└──────────────────────────────┘
```

---

## 5. Dependências NPM Adicionais

```json
{
  "dependencies": {
    "@nozbe/watermelondb": "^0.27.0",
    "@react-native-community/netinfo": "^11.0.0",
    "react-native-mmkv": "^3.0.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.20.0",
    "react-native-svg": "^15.0.0",
    "react-native-view-shot": "^4.0.0",
    "react-native-blur": "^4.4.0",
    "expo-haptics": "~14.0.0",
    "expo-file-system": "~18.0.0",
    "expo-notifications": "~0.29.0",
    "react-native-html-to-pdf": "^0.12.0",
    "lucide-react-native": "^0.460.0",
    "date-fns": "^3.0.0",
    "@expo/vector-icons": "^14.0.0"
  },
  "devDependencies": {
    "@nozbe/watermelondb/babel/plugin": "^0.27.0",
    "jest": "^29.0.0",
    "@testing-library/react-native": "^12.0.0"
  }
}
```

---

## 6. Marca d'Água — Implementação Técnica

```typescript
// src/lib/watermark.ts

import * as ImageManipulator from 'expo-image-manipulator';
import { Asset } from 'expo-asset';

interface WatermarkConfig {
  shopName: string;       // "DS Car Centro Automotivo"
  userName: string;       // nome do usuário logado
  timestamp: Date;
  logoAsset: string;      // require('../assets/logo-dscar-watermark.png')
}

/**
 * Aplica marca d'água na foto capturada.
 * Processamento 100% local (no device) — funciona offline.
 *
 * Estratégia:
 * 1. Redimensionar para max 1920px (maior eixo)
 * 2. Compor overlay com logo semitransparente (topo)
 * 3. Compor overlay com texto (rodapé): "DS Car · João Silva · 10/04/2026 14:32"
 * 4. Salvar como JPEG 80%
 *
 * Como expo-image-manipulator não suporta texto nativo, usamos:
 * - react-native-view-shot para renderizar overlay HTML → PNG
 * - ImageManipulator para compor original + overlay
 *
 * Alternativa mais performática (se necessário):
 * - Skia (react-native-skia) para composição direta em canvas nativo
 */
export async function applyWatermark(
  photoUri: string,
  config: WatermarkConfig
): Promise<string> {
  // 1. Resize
  const resized = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 1920 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 2-3. Gerar overlay com ViewShot (logo + texto)
  // ... (implementar com react-native-view-shot)

  // 4. Compor imagens
  // ... (implementar composição)

  return resized.uri;
}
```

---

## 7. Distribuição Interna — Setup Técnico

### 7.1 EAS Build Profiles (`eas.json`)

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "buildConfiguration": "Release" },
      "android": { "buildType": "apk" },
      "channel": "preview"
    },
    "production": {
      "distribution": "internal",
      "ios": { "buildConfiguration": "Release" },
      "android": { "buildType": "apk" },
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {}
}
```

**Nota:** `"distribution": "internal"` em todos os perfis — nunca `"store"`. O perfil `production` gera o build final mas não submete a nenhuma loja.

### 7.2 Página de Distribuição Interna

Landing page simples hospedada em `app.dscar.paddock.solutions` (pode ser uma rota no hub ou página estática no S3):

```
┌──────────────────────────────────┐
│        [Logo DS Car]             │
│   App DS Car — Centro Automotivo │
│                                  │
│   Versão: 1.2.0 (10/06/2026)    │
│                                  │
│   ┌────────────────────────────┐ │
│   │  📱 Baixar para Android    │ │  ← link direto pro APK
│   └────────────────────────────┘ │
│   ┌────────────────────────────┐ │
│   │  🍎 Baixar para iPhone     │ │  ← link do TestFlight
│   └────────────────────────────┘ │
│                                  │
│        [QR Code Android]         │
│        [QR Code iPhone]          │
│                                  │
│   Novidades nesta versão:        │
│   • Editor de anotações em fotos │
│   • Assinatura digital           │
│                                  │
│   Paddock Solutions              │
└──────────────────────────────────┘
```

### 7.3 OTA Updates (EAS Update)

```bash
# Publicar atualização OTA (sem novo build nativo)
eas update --branch production --message "Fix: checklist não salvava offline"

# O app verifica updates ao abrir e aplica silenciosamente
# Configuração em app.json:
# "updates": { "url": "https://u.expo.dev/...", "fallbackToCacheTimeout": 3000 }
```

O app busca updates ao iniciar. Se houver nova versão JS, baixa em background e aplica no próximo restart. O usuário não faz nada.

### 7.4 CI/CD (GitHub Actions)

```yaml
# .github/workflows/mobile-build.yml
# Trigger: push na branch main com mudanças em apps/mobile/
# 1. Roda testes (jest)
# 2. Gera build via EAS Build (preview ou production)
# 3. Publica OTA via EAS Update se não houve mudança nativa
# 4. Notifica no Slack/WhatsApp com link de download
```

---

## 8. Métricas de Sucesso (Fase 1)

| Métrica | Target |
|---------|--------|
| Tempo para fazer checklist completo (12 fotos + itens) | < 8 minutos |
| Tamanho médio de foto com marca d'água | < 500KB |
| Tempo de sync incremental (100 OS) | < 3 segundos |
| Crash rate | < 0.5% |
| Storage local usado por 100 OS com fotos | < 200MB |
| Tempo de abertura do app (cold start) | < 2 segundos |
| Instalação na equipe (Onda 1 — piloto) | 100% dos consultores do piloto (3-4 pessoas) |
| Adoção (Onda 2 — 30 dias após M6) | 80% da equipe com app instalado e ativo |
| OS com checklist mobile (Onda 3 — 30 dias após M8) | 90% das novas OS |

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
*Documento criado em: Abril 2026*
