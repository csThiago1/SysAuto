# Sprint M2 — OS Read-Only + Offline Foundation
# docs/sprint-m2-plan.md
# Paddock Solutions · Abril 2026
# ─────────────────────────────────────────────────────────────────────────────

## Contexto

Sprint M2 do app mobile DS Car. Sprint M1 está 100% concluído (auth, navegação,
PillTabBar, stores, API client). O app roda no simulador iOS, web e Android.

**Referências obrigatórias antes de começar:**
- `docs/mobile-setup.md` — setup do ambiente, problemas conhecidos e soluções
- `docs/mobile-roadmap.md` — visão geral dos 8 sprints
- `apps/mobile/src/lib/api.ts` — cliente HTTP já configurado
- `apps/mobile/src/stores/auth.store.ts` — store de autenticação
- `apps/mobile/app/(app)/_layout.tsx` — layout de tabs atual

---

## Objetivo

Implementar consulta de Ordens de Serviço (read-only) com suporte offline via
WatermelonDB. O mecânico/consultor deve conseguir ver e buscar OS mesmo sem
conexão após o primeiro sync.

---

## Arquivos a Criar

```
apps/mobile/
├── src/
│   ├── components/
│   │   ├── os/
│   │   │   ├── OSCard.tsx              ← Card da OS na lista (nº, placa, status, dias)
│   │   │   ├── OSStatusBadge.tsx       ← Badge colorido por status
│   │   │   └── OSDetailHeader.tsx      ← Header do detalhe (placa, modelo, status)
│   │   └── common/
│   │       └── SyncIndicator.tsx       ← Indicador "última sync · X pendentes"
│   ├── hooks/
│   │   ├── useServiceOrders.ts         ← TanStack Query + fallback WatermelonDB
│   │   └── useSync.ts                  ← Controle de sincronização
│   ├── db/
│   │   ├── schema.ts                   ← WatermelonDB schema
│   │   ├── migrations.ts               ← Schema migrations
│   │   ├── models/
│   │   │   ├── ServiceOrder.ts         ← Model WatermelonDB
│   │   │   └── ServiceOrderPhoto.ts    ← Model WatermelonDB
│   │   └── sync.ts                     ← Pull adapter (backend → local)
│   └── stores/
│       └── sync.store.ts               ← Zustand: lastSync, pendingUploads (JÁ EXISTE)
│
└── app/(app)/
    ├── os/
    │   ├── index.tsx                   ← Lista de OS (SUBSTITUIR placeholder)
    │   └── [id].tsx                    ← Detalhe da OS (SUBSTITUIR placeholder)
    └── busca/
        └── index.tsx                   ← Busca global (SUBSTITUIR placeholder)
```

---

## Tarefas Detalhadas

### T1 — Instalar WatermelonDB

```bash
cd apps/mobile
npx expo install @nozbe/watermelondb
```

Verificar se `@nozbe/watermelondb` precisa de configuração nativa (babel plugin).
Adicionar ao `babel.config.js` se necessário:
```js
plugins: [
  importMetaPlugin,  // já existe — manter
  ['@nozbe/watermelondb/babel/plugin'],
]
```

**Atenção:** WatermelonDB tem suporte web limitado. Para web usar storage
`LokiJSAdapter` (in-memory) e para native usar `SQLiteAdapter`.

---

### T2 — Schema e Models WatermelonDB

**Arquivo:** `src/db/schema.ts`

```ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'service_orders',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true },
        { name: 'number', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'customer_name', type: 'string' },
        { name: 'vehicle_plate', type: 'string', isIndexed: true },
        { name: 'vehicle_model', type: 'string' },
        { name: 'vehicle_brand', type: 'string' },
        { name: 'vehicle_year', type: 'number', isOptional: true },
        { name: 'vehicle_color', type: 'string', isOptional: true },
        { name: 'customer_type', type: 'string' },
        { name: 'os_type', type: 'string' },
        { name: 'consultant_name', type: 'string', isOptional: true },
        { name: 'total_parts', type: 'number' },
        { name: 'total_services', type: 'number' },
        { name: 'created_at_remote', type: 'number' }, // timestamp
        { name: 'updated_at_remote', type: 'number' }, // timestamp
        { name: 'synced_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'service_order_photos',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'service_order_id', type: 'string', isIndexed: true },
        { name: 'folder', type: 'string' },
        { name: 'url', type: 'string' },
        { name: 'local_uri', type: 'string', isOptional: true },
        { name: 'upload_status', type: 'string' }, // pending|uploading|done|error
        { name: 'created_at_remote', type: 'number', isOptional: true },
      ],
    }),
  ],
});
```

**Arquivo:** `src/db/models/ServiceOrder.ts`
```ts
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class ServiceOrder extends Model {
  static table = 'service_orders';

  @field('remote_id') remoteId!: string;
  @field('number') number!: number;
  @field('status') status!: string;
  @field('customer_name') customerName!: string;
  @field('vehicle_plate') vehiclePlate!: string;
  @field('vehicle_model') vehicleModel!: string;
  @field('vehicle_brand') vehicleBrand!: string;
  @field('vehicle_year') vehicleYear!: number;
  @field('vehicle_color') vehicleColor!: string;
  @field('customer_type') customerType!: string;
  @field('os_type') osType!: string;
  @field('consultant_name') consultantName!: string;
  @field('total_parts') totalParts!: number;
  @field('total_services') totalServices!: number;
  @field('created_at_remote') createdAtRemote!: number;
  @field('updated_at_remote') updatedAtRemote!: number;
  @field('synced_at') syncedAt!: number;
}
```

---

### T3 — Database Provider e Adapters

**Arquivo:** `src/db/index.ts`

```ts
import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import { ServiceOrder } from './models/ServiceOrder';
import { ServiceOrderPhoto } from './models/ServiceOrderPhoto';
import { schema } from './schema';

// Web: LokiJS (in-memory, sem persistência entre sessões)
// Native: SQLite (persistente)
const adapter =
  Platform.OS === 'web'
    ? new (require('@nozbe/watermelondb/adapters/lokijs').default)({ schema })
    : new (require('@nozbe/watermelondb/adapters/sqlite').default)({
        schema,
        migrations: require('./migrations').default,
        jsi: true, // JSI mode (mais rápido no New Architecture)
      });

export const database = new Database({
  adapter,
  modelClasses: [ServiceOrder, ServiceOrderPhoto],
});
```

Adicionar `DatabaseProvider` no root layout `app/_layout.tsx`:
```tsx
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database } from '@/db';

// Dentro do RootLayout:
<DatabaseProvider database={database}>
  {/* resto dos providers */}
</DatabaseProvider>
```

---

### T4 — Sync Adapter (Pull do Backend)

**Arquivo:** `src/db/sync.ts`

Pull simples (somente leitura por ora — push vem no M5):

```ts
import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import { api } from '@/lib/api';

export async function syncServiceOrders(): Promise<void> {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const since = lastPulledAt ? new Date(lastPulledAt).toISOString() : undefined;
      const data = await api.get<SyncPullResponse>(
        `/service-orders/sync/?since=${since ?? ''}`
      );
      return {
        changes: data.changes,
        timestamp: data.timestamp,
      };
    },
    pushChanges: async () => {
      // Push implementado no Sprint M5 (abertura de OS)
    },
  });
}
```

**Backend necessário:** endpoint `GET /api/v1/service-orders/sync/?since=<iso_date>`
que retorna formato WatermelonDB sync protocol. Ver T9.

---

### T5 — Hook `useServiceOrders`

**Arquivo:** `src/hooks/useServiceOrders.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { useDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import { Q } from '@nozbe/watermelondb';
import { api } from '@/lib/api';
import { syncServiceOrders } from '@/db/sync';

// Lista paginada — TanStack Query com fallback offline via WatermelonDB
export function useServiceOrdersList(filters: OSFilters) { ... }

// Detalhe único
export function useServiceOrder(id: string) { ... }
```

---

### T6 — Tela Lista de OS

**Arquivo:** `app/(app)/os/index.tsx`

Substituir o placeholder atual por implementação completa:

- `FlatList` com `OSCard` para cada OS
- Chips horizontais de filtro por status (scrollável)
- Busca por placa ou nº OS (debounce 300ms)
- Pull-to-refresh (`refreshControl`)
- Paginação infinita (`onEndReached` + `fetchNextPage`)
- `OfflineBanner` quando sem conexão
- `SyncIndicator` no header (última sync + pendentes)
- Estado vazio com mensagem contextual
- Loading skeleton (3 cards placeholder)

**Status colors:**
```ts
const STATUS_COLORS: Record<string, string> = {
  reception: '#3b82f6',      // azul
  initial_survey: '#8b5cf6', // roxo
  budget: '#f59e0b',         // amarelo
  waiting_approval: '#f97316', // laranja
  approved: '#10b981',        // verde
  in_progress: '#06b6d4',    // ciano
  waiting_parts: '#64748b',  // cinza
  final_survey: '#8b5cf6',   // roxo
  ready: '#22c55e',          // verde escuro
  delivered: '#6b7280',      // cinza neutro
  cancelled: '#ef4444',      // vermelho
};
```

---

### T7 — Tela Detalhe da OS

**Arquivo:** `app/(app)/os/[id].tsx`

Substituir o placeholder por implementação completa:

**Header:**
- Número da OS + status badge
- Placa · Marca/Modelo · Ano · Cor
- Botão voltar

**Seções (ScrollView):**
1. **Dados Gerais** — cliente, tipo OS, consultor, data abertura, valor total
2. **Fotos** — galeria horizontal por pasta (checklist_entrada, acompanhamento, etc.)
3. **Peças & Serviços** — lista simples com nome e valor
4. **Histórico** — timeline de mudanças de status (ActivityLog)

---

### T8 — Tela Busca

**Arquivo:** `app/(app)/busca/index.tsx`

- Campo de busca com foco automático
- Busca por: placa, nº OS, nome do cliente
- Resultados em tempo real (debounce 300ms)
- Histórico de buscas recentes (MMKV)
- Funciona offline (busca no WatermelonDB local)

---

### T9 — Backend: Endpoint de Sync

**Arquivo:** `backend/core/apps/service_orders/views.py`

Adicionar action `sync` no `ServiceOrderViewSet`:

```python
@action(detail=False, methods=['get'], url_path='sync')
def sync(self, request):
    """
    Endpoint de sync incremental para WatermelonDB.
    Retorna OS criadas/atualizadas desde `since`.
    """
    since = request.query_params.get('since')
    qs = ServiceOrder.objects.select_related('vehicle', 'customer')

    if since:
        from django.utils.dateparse import parse_datetime
        since_dt = parse_datetime(since)
        if since_dt:
            qs = qs.filter(updated_at__gte=since_dt)

    serializer = ServiceOrderSyncSerializer(qs, many=True)

    return Response({
        'changes': {
            'service_orders': {
                'created': serializer.data,
                'updated': [],
                'deleted': [],
            }
        },
        'timestamp': int(timezone.now().timestamp() * 1000),
    })
```

---

## Agentes Recomendados por Tarefa

| Tarefa | Agente | Motivo |
|--------|--------|--------|
| T1–T3 (WatermelonDB setup) | `expo:building-native-ui` + `general-purpose` | Setup de DB nativo com adapters por plataforma |
| T4 (Sync adapter) | `backend-developer` + `expo:native-data-fetching` | Envolve backend Django + mobile |
| T5 (hooks) | `expo:native-data-fetching` | TanStack Query + WatermelonDB juntos |
| T6 (Lista OS) | `expo:building-native-ui` | FlatList, paginação, filtros, skeleton |
| T7 (Detalhe OS) | `expo:building-native-ui` | Layout complexo, galeria de fotos |
| T8 (Busca) | `expo:building-native-ui` | Busca offline + histórico MMKV |
| T9 (Backend sync) | `django-developer` | Django viewset action |

**Para o sprint completo em paralelo:**
```
Agente A (frontend): T1 → T2 → T3 → T5 → T6 → T7 → T8
Agente B (backend):  T9 (independente, pode rodar em paralelo com T1-T8)
```

---

## Critérios de Aceite

- [ ] Lista de OS carrega do backend com paginação infinita
- [ ] Filtros por status funcionam (chips horizontais)
- [ ] Busca por placa e nº OS com debounce
- [ ] Pull-to-refresh sincroniza dados novos
- [ ] Detalhe exibe todas as seções (dados, fotos, peças, histórico)
- [ ] App funciona offline após primeiro sync (lista + detalhe)
- [ ] Indicador visual de modo offline (OfflineBanner)
- [ ] SyncIndicator mostra última sync e pendentes
- [ ] TypeScript strict — 0 erros
- [ ] `npx expo-doctor` — 17/17 checks passando

---

## Dependências a Instalar

```bash
cd apps/mobile
npx expo install @nozbe/watermelondb
npx expo install react-native-mmkv  # para histórico de buscas e prefs
```

> **MMKV no monorepo:** assim como outros pacotes nativos, pode precisar de override
> de versão no root `package.json` se houver conflito. Verificar com `npx expo-doctor`.

---

## Contexto de Auth para Testes

Em dev, o backend aceita JWT HS256 gerado pelo `useAuth.loginDev()`:
- Email: qualquer email
- Senha: `paddock123`
- Token gerado localmente, sem precisar do backend rodando

Para testar o sync real (T4/T9), o backend Django precisa estar rodando:
```bash
make dev  # sobe todos os serviços via Docker
```

---

## Estado dos Arquivos Placeholder a Substituir

| Arquivo | Status atual | Ação |
|---------|-------------|------|
| `app/(app)/os/index.tsx` | Placeholder "Sprint M2" | **Substituir** completamente |
| `app/(app)/os/[id].tsx` | Placeholder com ID | **Substituir** completamente |
| `app/(app)/busca/index.tsx` | Placeholder | **Substituir** completamente |
| `app/(app)/nova-os/index.tsx` | Placeholder | Manter — Sprint M5 |
| `app/(app)/notificacoes/index.tsx` | Placeholder | Manter — Sprint M6 |

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
*Sprint M2 planejado em: Abril 2026*
