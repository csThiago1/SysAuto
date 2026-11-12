import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BodyType, DamageType, PanelKey, Relation, Severity, StopKey, Vec3 } from '@paddock/car-3d';
import { api, ApiError } from '@/lib/api';
import { uploadPendingPhotos, usePhotoStore } from '@/stores/photo.store';

// ─── MMKV storage (mesmo padrão do photo.store) ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mmkv: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  _mmkv = new MMKV({ id: 'entry-checklist-queue' });
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

export type StopValue = 'done' | 'sem_dano';
export type SyncStatus = 'pending' | 'synced' | 'error';

export interface QueuedDamage {
  clientUuid: string;
  panelKey: PanelKey;
  damageType: DamageType;
  severity: Severity;
  relation: Relation;
  point: Vec3 | null;
  notes: string;
  photoClientUuids: string[];
  syncStatus: SyncStatus;
  serverId?: string;
  errorMessage?: string;
  /** Já houve um POST (pode ter chegado ao servidor sem a resposta voltar). */
  posted?: boolean;
}

export interface QueuedBelonging {
  clientUuid: string;
  description: string;
  photoClientUuid: string | null;
  syncStatus: SyncStatus;
  serverId?: string;
  errorMessage?: string;
}

type SyncFields = 'clientUuid' | 'syncStatus' | 'serverId' | 'errorMessage' | 'posted';
export type DamageInput = Omit<QueuedDamage, SyncFields>;
export type BelongingInput = Omit<QueuedBelonging, SyncFields>;

export interface EntryChecklistDraft {
  bodyType: BodyType | null;
  stops: Partial<Record<StopKey, StopValue>>;
  damages: QueuedDamage[];
  belongings: QueuedBelonging[];
}

const EMPTY: EntryChecklistDraft = { bodyType: null, stops: {}, damages: [], belongings: [] };

interface EntryChecklistState {
  byOs: Record<string, EntryChecklistDraft>;
  setBodyType(osId: string, bodyType: BodyType): void;
  markStop(osId: string, stop: StopKey, value: StopValue): void;
  /** Retorna o client_uuid do dano criado. */
  addDamage(osId: string, damage: DamageInput): string;
  /** Edição volta o dano a `pending` (o sync faz PATCH se já tiver serverId). */
  updateDamage(osId: string, clientUuid: string, patch: Partial<DamageInput>): void;
  /** Retorna o client_uuid do pertence criado. */
  addBelonging(osId: string, belonging: BelongingInput): string;
  clearOS(osId: string): void;
}

export const useEntryChecklistStore = create<EntryChecklistState>()(
  persist(
    (set) => {
      const edit = (osId: string, fn: (d: EntryChecklistDraft) => Partial<EntryChecklistDraft>): void => {
        set((state) => {
          const draft = state.byOs[osId] ?? EMPTY;
          return { byOs: { ...state.byOs, [osId]: { ...draft, ...fn(draft) } } };
        });
      };

      return {
        byOs: {},

        setBodyType: (osId, bodyType) => edit(osId, () => ({ bodyType })),

        markStop: (osId, stop, value) => edit(osId, (d) => ({ stops: { ...d.stops, [stop]: value } })),

        addDamage: (osId, damage) => {
          const clientUuid = Crypto.randomUUID();
          edit(osId, (d) => ({ damages: [...d.damages, { ...damage, clientUuid, syncStatus: 'pending' }] }));
          return clientUuid;
        },

        updateDamage: (osId, clientUuid, patch) =>
          edit(osId, (d) => ({
            damages: d.damages.map((x) =>
              x.clientUuid === clientUuid ? { ...x, ...patch, syncStatus: 'pending', errorMessage: undefined } : x,
            ),
          })),

        addBelonging: (osId, belonging) => {
          const clientUuid = Crypto.randomUUID();
          edit(osId, (d) => ({
            belongings: [...d.belongings, { ...belonging, clientUuid, syncStatus: 'pending' }],
          }));
          return clientUuid;
        },

        clearOS: (osId) =>
          set((state) => {
            const { [osId]: _removed, ...rest } = state.byOs;
            return { byOs: rest };
          }),
      };
    },
    {
      name: 'entry-checklist-queue',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

// ─── Sync (fila offline → backend) ────────────────────────────────────────────

export const LOCKED_MESSAGE = 'Checklist já finalizado na conferência';

const CreatedSchema = z.object({ id: z.string() });
const ErrorBodySchema = z.object({ code: z.string().optional(), photos: z.unknown().optional() });

type Outcome = { syncStatus: SyncStatus; serverId?: string; errorMessage?: string };

/** 400 {photos:"pending"}, rede, 5xx e 401 → continua pending; 409 e demais 400 → error. */
function failure(err: unknown): Outcome {
  if (!(err instanceof ApiError)) return { syncStatus: 'pending' };
  const body = ErrorBodySchema.safeParse(err.data);
  const data = body.success ? body.data : {};
  if (err.status === 409) {
    return { syncStatus: 'error', errorMessage: data.code === 'checklist_locked' ? LOCKED_MESSAGE : 'HTTP 409' };
  }
  if (err.status === 400 && data.photos !== 'pending') {
    return { syncStatus: 'error', errorMessage: 'Dados recusados pelo servidor' };
  }
  return { syncStatus: 'pending' };
}

function damagePayload(d: QueuedDamage): Record<string, unknown> {
  return {
    panel_key: d.panelKey,
    damage_type: d.damageType,
    severity: d.severity,
    relation: d.relation,
    // o backend e a conferência web leem o ponto como {x, y, z}
    point: d.point ? { x: d.point[0], y: d.point[1], z: d.point[2] } : null,
    notes: d.notes,
    photo_client_uuids: d.photoClientUuids,
  };
}

async function send<T extends QueuedDamage | QueuedBelonging>(
  osId: string,
  kind: 'damages' | 'belongings',
  item: T,
  request: () => Promise<unknown>,
): Promise<void> {
  let outcome: Outcome;
  try {
    const { id } = CreatedSchema.parse(await request());
    outcome = { syncStatus: 'synced', serverId: id, errorMessage: undefined };
  } catch (err: unknown) {
    outcome = { ...failure(err), serverId: item.serverId };
    const status = err instanceof ApiError ? err.status : 'rede';
    console.warn(`[entry checklist sync] osId=${osId} ${kind} client_uuid=${item.clientUuid} erro=${status}`);
  }
  useEntryChecklistStore.setState((state) => {
    const draft = state.byOs[osId];
    if (!draft) return state;
    const list = draft[kind] as T[];
    const next = list.map((x) => {
      if (x.clientUuid !== item.clientUuid) return x;
      // Editado durante o envio: guarda o serverId e deixa pending para o próximo sync.
      if (x !== item) return { ...x, serverId: outcome.serverId ?? x.serverId };
      return { ...x, ...outcome };
    });
    return { byOs: { ...state.byOs, [osId]: { ...draft, [kind]: next } } };
  });
}

/** Grava `posted` antes do POST (persiste mesmo se o app morrer no meio) e devolve o item gravado. */
function markPosted(osId: string, d: QueuedDamage): QueuedDamage {
  const next = { ...d, posted: true };
  useEntryChecklistStore.setState((state) => {
    const draft = state.byOs[osId];
    if (!draft) return state;
    const damages = draft.damages.map((x) => (x === d ? next : x));
    return { byOs: { ...state.byOs, [osId]: { ...draft, damages } } };
  });
  return next;
}

async function requestDamage(base: string, d: QueuedDamage, replay: boolean): Promise<unknown> {
  if (d.serverId) return api.patch(`${base}/checklist-damages/${d.serverId}/`, damagePayload(d));
  const created = CreatedSchema.parse(
    await api.post(`${base}/checklist-damages/`, { client_uuid: d.clientUuid, ...damagePayload(d) }),
  );
  // Replay: o backend devolve o registro do 1º POST sem aplicar edições feitas depois dele.
  return replay ? api.patch(`${base}/checklist-damages/${created.id}/`, damagePayload(d)) : created;
}

/** Fotos `error` (ex.: tentativa sem rede) citadas por itens pending desta OS voltam a `pending`. */
function retryReferencedPhotos(draft: EntryChecklistDraft): void {
  const refs = new Set<string>();
  for (const d of draft.damages) if (d.syncStatus === 'pending') d.photoClientUuids.forEach((id) => refs.add(id));
  for (const b of draft.belongings) if (b.syncStatus === 'pending' && b.photoClientUuid) refs.add(b.photoClientUuid);
  const { queue, retryPhoto } = usePhotoStore.getState();
  for (const p of queue) if (p.uploadStatus === 'error' && refs.has(p.id)) retryPhoto(p.id);
}

/**
 * Ordem: fotos → PATCH do estado → POST/PATCH de cada dano e pertence pending.
 * Idempotente por client_uuid (o backend devolve o existente).
 */
export async function syncEntryChecklist(osId: string): Promise<{ ok: boolean; pending: number }> {
  const before = useEntryChecklistStore.getState().byOs[osId];
  if (before) retryReferencedPhotos(before);
  await uploadPendingPhotos();

  const draft = useEntryChecklistStore.getState().byOs[osId];
  if (!draft) return { ok: true, pending: 0 };
  const base = `/service-orders/${osId}`;
  let stateOk = true;

  const state: Record<string, unknown> = {};
  if (draft.bodyType) state.body_type = draft.bodyType;
  if (Object.keys(draft.stops).length > 0) state.stops_done = draft.stops;
  if (Object.keys(state).length > 0) {
    try {
      await api.patch(`${base}/checklist/entrada/`, state);
    } catch (err: unknown) {
      stateOk = false;
      const status = err instanceof ApiError ? err.status : 'rede';
      console.warn(`[entry checklist sync] osId=${osId} estado erro=${status}`);
    }
  }

  for (const d of draft.damages.filter((x) => x.syncStatus === 'pending')) {
    const item = d.serverId || d.posted ? d : markPosted(osId, d);
    await send(osId, 'damages', item, () => requestDamage(base, item, !!d.posted));
  }
  for (const b of draft.belongings.filter((x) => x.syncStatus === 'pending')) {
    await send(osId, 'belongings', b, () =>
      api.post(`${base}/belongings/`, {
        client_uuid: b.clientUuid,
        description: b.description,
        photo_client_uuid: b.photoClientUuid,
      }),
    );
  }

  const after = useEntryChecklistStore.getState().byOs[osId] ?? EMPTY;
  const items = [...after.damages, ...after.belongings];
  const pending = items.filter((x) => x.syncStatus === 'pending').length;
  return { ok: stateOk && items.every((x) => x.syncStatus === 'synced'), pending };
}
