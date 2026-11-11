import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-crypto', () => ({ randomUUID: () => randomUUID() }));
vi.mock('@/lib/constants', () => ({
  API_BASE_URL: 'http://api',
  getTenantDomain: (slug: string) => `${slug}.test`,
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: { getState: () => ({ token: 't', activeCompany: 'dscar', logout: () => undefined }) },
}));

import { syncEntryChecklist, useEntryChecklistStore } from './entry-checklist.store';
import { usePhotoStore } from './photo.store';

const OS = 'os-1';
type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];
let respond: (call: Call) => { status: number; body: unknown };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  calls = [];
  useEntryChecklistStore.setState({ byOs: {} });
  usePhotoStore.setState({ queue: [] });
  respond = () => ({ status: 200, body: { id: `srv-${calls.length}`, url: 'u' } });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const body = init.body instanceof FormData ? init.body : JSON.parse(String(init.body ?? 'null'));
    const call: Call = { url, method: init.method ?? 'GET', body };
    calls.push(call);
    const r = respond(call);
    return json(r.status, r.body);
  });
});

function addDamage(photoClientUuids: string[] = []): string {
  return useEntryChecklistStore.getState().addDamage(OS, {
    panelKey: 'capo',
    damageType: 'risco',
    severity: 'leve',
    relation: 'pre_existente',
    point: [0, 1, 2],
    notes: 'n',
    photoClientUuids,
  });
}

const damages = () => useEntryChecklistStore.getState().byOs[OS].damages;

describe('syncEntryChecklist', () => {
  it('sobe fotos, depois PATCH do estado, depois POST de dano e pertence com client_uuid', async () => {
    usePhotoStore.getState().addPhoto({
      id: 'ph-1', osId: OS, slot: 'dano', folder: 'checklist_entrada', checklistType: 'entrada', localUri: 'file://x',
    });
    const s = useEntryChecklistStore.getState();
    s.setBodyType(OS, 'sedan');
    s.markStop(OS, 'frente', 'done');
    s.markStop(OS, 'teto', 'sem_dano');
    const dmg = addDamage(['ph-1']);
    const bel = s.addBelonging(OS, { description: 'Óculos', photoClientUuid: null });

    const result = await syncEntryChecklist(OS);

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST http://api/api/v1/service-orders/${OS}/photos/`,
      `PATCH http://api/api/v1/service-orders/${OS}/checklist/entrada/`,
      `POST http://api/api/v1/service-orders/${OS}/checklist-damages/`,
      `POST http://api/api/v1/service-orders/${OS}/belongings/`,
    ]);
    expect((calls[0].body as FormData).get('client_uuid')).toBe('ph-1');
    expect(calls[1].body).toEqual({ body_type: 'sedan', stops_done: { frente: 'done', teto: 'sem_dano' } });
    expect(calls[2].body).toEqual({
      client_uuid: dmg, panel_key: 'capo', damage_type: 'risco', severity: 'leve', relation: 'pre_existente',
      point: [0, 1, 2], notes: 'n', photo_client_uuids: ['ph-1'],
    });
    expect(calls[3].body).toEqual({ client_uuid: bel, description: 'Óculos', photo_client_uuid: null });
    expect(result).toEqual({ ok: true, pending: 0 });
    expect(damages()[0]).toMatchObject({ syncStatus: 'synced', serverId: 'srv-3' });

    calls = [];
    await syncEntryChecklist(OS);
    expect(calls.map((c) => c.method)).toEqual(['PATCH']); // nada reenviado
  });

  it('400 {photos: "pending"} mantém o dano pending', async () => {
    addDamage(['ph-x']);
    respond = (c) => (c.url.includes('checklist-damages') ? { status: 400, body: { photos: 'pending' } } : { status: 200, body: { id: 'x' } });

    expect(await syncEntryChecklist(OS)).toEqual({ ok: false, pending: 1 });
    expect(damages()[0].syncStatus).toBe('pending');
  });

  it('erro de rede mantém pending', async () => {
    addDamage();
    vi.stubGlobal('fetch', async () => { throw new TypeError('Network request failed'); });

    expect(await syncEntryChecklist(OS)).toEqual({ ok: false, pending: 1 });
    expect(damages()[0].syncStatus).toBe('pending');
  });

  it('409 checklist_locked marca error com a mensagem', async () => {
    addDamage();
    respond = () => ({ status: 409, body: { detail: 'x', code: 'checklist_locked' } });

    expect(await syncEntryChecklist(OS)).toEqual({ ok: false, pending: 0 });
    expect(damages()[0]).toMatchObject({ syncStatus: 'error', errorMessage: 'Checklist já finalizado na conferência' });
  });

  it('editar dano já sincado volta a pending e vai por PATCH no serverId', async () => {
    const dmg = addDamage();
    await syncEntryChecklist(OS);
    const serverId = damages()[0].serverId;
    useEntryChecklistStore.getState().updateDamage(OS, dmg, { severity: 'grave' });
    expect(damages()[0].syncStatus).toBe('pending');

    calls = [];
    await syncEntryChecklist(OS);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].url).toBe(`http://api/api/v1/service-orders/${OS}/checklist-damages/${serverId}/`);
    expect(calls[0].body).toMatchObject({ severity: 'grave' });
    expect(calls[0].body).not.toHaveProperty('client_uuid');
    expect(damages()[0].syncStatus).toBe('synced');
  });
});
