import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCarModel } from '@paddock/car-3d/core';

// Disco falso: uri → conteúdo em base64 (o que o File do expo-file-system leria).
const disk = new Map<string, string>();
const downloads: string[] = [];
let served: Record<string, string> = {};

vi.mock('@/lib/constants', () => ({ WEB_BASE_URL: 'http://web' }));
vi.mock('expo-file-system', () => {
  const join = (parts: unknown[]): string =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists(): boolean {
      return true;
    }
    create(): void {}
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists(): boolean {
      return disk.has(this.uri);
    }
    async base64(): Promise<string> {
      return disk.get(this.uri) ?? '';
    }
    async text(): Promise<string> {
      return Buffer.from(disk.get(this.uri) ?? '', 'base64').toString('utf8');
    }
    delete(): void {
      disk.delete(this.uri);
    }
    write(content: string): void {
      disk.set(this.uri, Buffer.from(content, 'utf8').toString('base64'));
    }
    static async downloadFileAsync(url: string, dest: File, opts?: { idempotent?: boolean }): Promise<File> {
      if (disk.has(dest.uri) && opts?.idempotent !== true) throw new Error('DestinationAlreadyExists');
      downloads.push(url);
      const body = served[url];
      if (body === undefined) throw new Error('UnableToDownload: response has status 404');
      disk.set(dest.uri, Buffer.from(body, 'binary').toString('base64'));
      return dest;
    }
  }
  return { Directory, File, Paths: { document: { uri: 'doc' } } };
});

import { ensureModel, loadRegions, resolveEntryModel } from './car3dAssets';

const entry = resolveCarModel({ make: null, family: null, bodyType: 'hatch', allowNc: false });
const GLB = 'glTF\u0002\u0000\u0000\u0000resto';
const REGIONS = JSON.stringify({ model: 'placeholder-hatch.glb', paintMaterials: ['paint'], panels: { capo: [] } });

// ETag servida por URL no HEAD; `online = false` simula sem rede.
let etags: Record<string, string> = {};
let online = true;
vi.stubGlobal('fetch', async (url: string, init?: { method?: string }) => {
  if (!online) throw new TypeError('Network request failed');
  expect(init?.method).toBe('HEAD');
  const ok = etags[url] !== undefined || served[url] !== undefined;
  return { ok, headers: { get: (h: string) => (h === 'etag' ? (etags[url] ?? null) : null) } };
});

const GLB_URL = 'http://web/car-3d/placeholder-hatch.glb';
const REGIONS_URL = 'http://web/car-3d/regions/placeholder-hatch.regions.json';

beforeEach(() => {
  disk.clear();
  downloads.length = 0;
  online = true;
  served = { [GLB_URL]: GLB, [REGIONS_URL]: REGIONS };
  etags = { [GLB_URL]: '"g1"', [REGIONS_URL]: '"r1"' };
});

describe('ensureModel', () => {
  it('baixa .glb e regions.json do web uma vez e devolve data: URI', async () => {
    const uri = await ensureModel(entry);
    expect(uri).toBe(`data:model/gltf-binary;base64,${Buffer.from(GLB, 'binary').toString('base64')}`);
    expect(downloads).toEqual([
      'http://web/car-3d/placeholder-hatch.glb',
      'http://web/car-3d/regions/placeholder-hatch.regions.json',
    ]);
    expect(disk.has('doc/car-3d/placeholder-hatch.glb')).toBe(true);
    expect(disk.has('doc/car-3d/placeholder-hatch.regions.json')).toBe(true);

    await ensureModel(entry);
    expect(downloads).toHaveLength(2); // mesma ETag: lê do cache
  });

  it('sem rede, usa o cache', async () => {
    await ensureModel(entry);
    online = false;
    await expect(ensureModel(entry)).resolves.toMatch(/^data:/);
    expect(await loadRegions(entry)).toEqual(JSON.parse(REGIONS));
    expect(downloads).toHaveLength(2);
  });

  it('conteúdo que não é glTF (ex.: HTML de login) é apagado e falha', async () => {
    served['http://web/car-3d/placeholder-hatch.glb'] = '<!doctype html>';
    await expect(ensureModel(entry)).rejects.toThrow(/glb/);
    expect(disk.has('doc/car-3d/placeholder-hatch.glb')).toBe(false);
  });

  it('sem rede e sem cache: falha', async () => {
    served = {};
    await expect(ensureModel(entry)).rejects.toThrow(/404/);
  });
});

describe('loadRegions', () => {
  it('lê e valida o regions.json do cache', async () => {
    await ensureModel(entry);
    expect(await loadRegions(entry)).toEqual(JSON.parse(REGIONS));
    expect(downloads).toHaveLength(2);
  });

  it('regions recalibrado com o mesmo nome (ETag nova) é baixado de novo', async () => {
    await ensureModel(entry);
    const novo = JSON.stringify({ model: 'placeholder-hatch.glb', paintMaterials: ['paint'], panels: { capo: [], teto: [] } });
    served[REGIONS_URL] = novo;
    etags[REGIONS_URL] = '"r2"';
    expect(await loadRegions(entry)).toEqual(JSON.parse(novo));
    expect(downloads).toEqual([GLB_URL, REGIONS_URL, REGIONS_URL]); // .glb com a mesma ETag não baixa de novo
    await loadRegions(entry);
    expect(downloads).toHaveLength(3); // ETag nova gravada
  });

  it('falha ao rebaixar mantém o cache antigo', async () => {
    await ensureModel(entry);
    etags[REGIONS_URL] = '"r2"';
    delete served[REGIONS_URL]; // HEAD respondeu, GET falhou
    expect(await loadRegions(entry)).toEqual(JSON.parse(REGIONS));
  });

  it('regions inválido é apagado e falha', async () => {
    served['http://web/car-3d/regions/placeholder-hatch.regions.json'] = '<html>';
    await expect(loadRegions(entry)).rejects.toThrow();
    expect(disk.has('doc/car-3d/placeholder-hatch.regions.json')).toBe(false);
  });
});

describe('resolveEntryModel', () => {
  const online = {
    body_type: 'hatch' as const, suggested_body_type: null, finalized_at: null, vehicle_color_hex: '#ffffff',
    vehicle_make: null, vehicle_family: null, allow_nc_models: true,
  };

  it('offline (sem estado) usa o último GET guardado e resolve o mesmo modelo do online', () => {
    const vehicle = { make: online.vehicle_make, family: online.vehicle_family };
    const on = resolveEntryModel(online, undefined, false, 'hatch');
    expect(on.key).toBe('polo'); // DS Car permite NC: hatch → Polo
    expect(resolveEntryModel(undefined, vehicle, true, 'hatch').key).toBe(on.key);
  });

  it('offline com família guardada resolve pela família', () => {
    const vehicle = { make: 'chevrolet', family: 'onix' };
    expect(resolveEntryModel({ ...online, vehicle_make: 'chevrolet', vehicle_family: 'onix' }, undefined, false, 'hatch').key).toBe('onix');
    expect(resolveEntryModel(undefined, vehicle, true, 'hatch').key).toBe('onix');
  });
});
