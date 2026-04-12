import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '@/lib/api';

// ─── MMKV storage (mesmo padrão do photo.store) ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mmkv: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  _mmkv = new MMKV({ id: 'checklist-items' });
} catch {
  // Expo Go — sem MMKV nativo, estado vive em memória
}

const mmkvStorage = {
  getItem: (name: string): string | null => _mmkv?.getString(name) ?? null,
  setItem: (name: string, value: string): void => {
    _mmkv?.set(name, value);
  },
  removeItem: (name: string): void => {
    _mmkv?.delete(name);
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type ItemStatus = 'pending' | 'ok' | 'attention' | 'critical';

export interface ChecklistItemEntry {
  status: ItemStatus;
  notes: string;
}

/** Chave composta: `{osId}:{checklistType}:{category}:{itemKey}` */
type ItemKey = string;

function buildKey(
  osId: string,
  checklistType: string,
  category: string,
  itemKey: string,
): ItemKey {
  return `${osId}:${checklistType}:${category}:${itemKey}`;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ChecklistItemsState {
  /** Mapa de chave composta → entrada do item */
  items: Record<ItemKey, ChecklistItemEntry>;

  setItemStatus(
    osId: string,
    checklistType: string,
    category: string,
    itemKey: string,
    status: ItemStatus,
  ): void;

  setItemNotes(
    osId: string,
    checklistType: string,
    category: string,
    itemKey: string,
    notes: string,
  ): void;

  getItem(
    osId: string,
    checklistType: string,
    category: string,
    itemKey: string,
  ): ChecklistItemEntry;

  /** Retorna contadores de itens para uma OS e tipo de checklist */
  getSummary(
    osId: string,
    checklistType: string,
  ): { ok: number; attention: number; critical: number; pending: number; total: number };

  /** Remove todos os itens de uma OS (ex: ao trocar de tenant) */
  clearOS(osId: string): void;
}

export const useChecklistItemsStore = create<ChecklistItemsState>()(
  persist(
    (set, get) => ({
      items: {},

      setItemStatus(osId, checklistType, category, itemKey, status) {
        const key = buildKey(osId, checklistType, category, itemKey);
        set((state) => ({
          items: {
            ...state.items,
            [key]: {
              status,
              notes: state.items[key]?.notes ?? '',
            },
          },
        }));
      },

      setItemNotes(osId, checklistType, category, itemKey, notes) {
        const key = buildKey(osId, checklistType, category, itemKey);
        set((state) => ({
          items: {
            ...state.items,
            [key]: {
              status: state.items[key]?.status ?? 'pending',
              notes,
            },
          },
        }));
      },

      getItem(osId, checklistType, category, itemKey) {
        const key = buildKey(osId, checklistType, category, itemKey);
        return get().items[key] ?? { status: 'pending', notes: '' };
      },

      getSummary(osId, checklistType) {
        const prefix = `${osId}:${checklistType}:`;
        const counts = { ok: 0, attention: 0, critical: 0, pending: 0, total: 0 };
        for (const [k, v] of Object.entries(get().items)) {
          if (k.startsWith(prefix)) {
            counts.total++;
            counts[v.status]++;
          }
        }
        return counts;
      },

      clearOS(osId) {
        set((state) => {
          const next: Record<ItemKey, ChecklistItemEntry> = {};
          for (const [k, v] of Object.entries(state.items)) {
            if (!k.startsWith(`${osId}:`)) {
              next[k] = v;
            }
          }
          return { items: next };
        });
      },
    }),
    {
      name: 'checklist-items-store',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

// ─── Upload (sync offline → backend) ─────────────────────────────────────────

interface ChecklistItemPayload {
  checklist_type: string;
  category: string;
  item_key: string;
  status: ItemStatus;
  notes: string;
}

/**
 * Sincroniza todos os itens de uma OS com o backend.
 * Chama o endpoint bulk upsert — idempotente, seguro para reenviar.
 */
export async function syncChecklistItems(osId: string): Promise<void> {
  const { items } = useChecklistItemsStore.getState();
  const prefix = `${osId}:`;

  const payload: ChecklistItemPayload[] = [];
  for (const [k, v] of Object.entries(items)) {
    if (!k.startsWith(prefix) || v.status === 'pending') continue;
    // chave: {osId}:{checklistType}:{category}:{itemKey}
    const parts = k.slice(prefix.length).split(':');
    if (parts.length < 3) continue;
    const [checklistType, category, ...itemKeyParts] = parts;
    payload.push({
      checklist_type: checklistType,
      category,
      item_key: itemKeyParts.join(':'),
      status: v.status,
      notes: v.notes,
    });
  }

  if (payload.length === 0) return;

  await api.post(`/service-orders/${osId}/checklist-items/bulk/`, { items: payload });
}
