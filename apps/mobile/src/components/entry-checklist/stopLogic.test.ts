import { describe, expect, it } from 'vitest';
import { STOPS } from '@paddock/car-3d/core';
import type { PhotoQueueItem } from '@/stores/photo.store';
import type { EntryChecklistDraft, QueuedDamage } from '@/stores/entry-checklist.store';
import { checkStop, highlightsFor, stopPhotos } from './stopLogic';

const stop = (key: string) => STOPS.find((s) => s.key === key)!;

const photo = (slot: string, extra: Partial<PhotoQueueItem> = {}): PhotoQueueItem => ({
  id: `p-${slot}`, osId: 'os', slot, folder: 'checklist_entrada', checklistType: 'entrada', localUri: 'file://x',
  uploadStatus: 'pending', remoteUrl: null, errorMessage: null, createdAt: 0, ...extra,
});

const damage = (panelKey: QueuedDamage['panelKey'], severity: QueuedDamage['severity']): QueuedDamage => ({
  clientUuid: `d-${panelKey}-${severity}`, panelKey, damageType: 'risco', severity, relation: 'nao_sei',
  point: null, notes: '', photoClientUuids: ['p'], syncStatus: 'pending',
});

const draft = (d: Partial<EntryChecklistDraft> = {}): EntryChecklistDraft => ({
  bodyType: 'hatch', stops: {}, damages: [], belongings: [], ...d,
});

describe('stopPhotos', () => {
  it('só fotos desta OS na pasta checklist_entrada com slot da parada ou de dano da parada', () => {
    const queue = [
      photo('frente'),
      photo('dano_frente'),
      photo('traseira'),
      photo('frente', { id: 'outra-os', osId: 'os-2' }),
      photo('frente', { id: 'vistoria-antiga', folder: 'vistoria_inicial' }),
    ];
    expect(stopPhotos(queue, 'os', stop('frente')).map((p) => p.id)).toEqual(['p-frente', 'p-dano_frente']);
  });
});

describe('checkStop', () => {
  it('frente sem fotos e sem dano: faltam os 2 slots e o dano/sem dano', () => {
    expect(checkStop(stop('frente'), draft(), [], false)).toEqual({
      ok: false,
      missing: ['frente', 'diag_diant', 'dano_ou_sem_dano'],
    });
  });

  it('dano em peça da parada conta; dano de outra parada não', () => {
    const photos = [photo('frente'), photo('diag_diant')];
    expect(checkStop(stop('frente'), draft({ damages: [damage('teto', 'leve')] }), photos, false).ok).toBe(false);
    expect(checkStop(stop('frente'), draft({ damages: [damage('capo', 'leve')] }), photos, false).ok).toBe(true);
  });

  it('"sem dano" vale tocado agora ou já gravado na parada', () => {
    expect(checkStop(stop('teto'), draft(), [], true).ok).toBe(true);
    expect(checkStop(stop('teto'), draft({ stops: { teto: 'sem_dano' } }), [], false).ok).toBe(true);
  });

  it('foto de dano não preenche slot obrigatório', () => {
    expect(checkStop(stop('lado_direito'), draft(), [photo('dano_lado_direito')], true).missing).toEqual(['lateral_dir']);
  });
});

describe('highlightsFor', () => {
  it('uma cor por peça, a da pior gravidade', () => {
    expect(highlightsFor([damage('capo', 'leve'), damage('capo', 'grave'), damage('grade', 'moderada')])).toEqual([
      { panel: 'capo', color: '#ea0e03' },
      { panel: 'grade', color: '#ff8a00' },
    ]);
  });
});
