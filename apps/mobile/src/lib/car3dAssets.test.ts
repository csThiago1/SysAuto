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
    static async downloadFileAsync(url: string, dest: File): Promise<File> {
      downloads.push(url);
      const body = served[url];
      if (body === undefined) throw new Error('UnableToDownload: response has status 404');
      disk.set(dest.uri, Buffer.from(body, 'binary').toString('base64'));
      return dest;
    }
  }
  return { Directory, File, Paths: { document: { uri: 'doc' } } };
});

import { ensureModel, loadRegions } from './car3dAssets';

const entry = resolveCarModel({ make: null, family: null, bodyType: 'hatch', allowNc: false });
const GLB = 'glTF\u0002\u0000\u0000\u0000resto';
const REGIONS = JSON.stringify({ model: 'placeholder-hatch.glb', paintMaterials: ['paint'], panels: { capo: [] } });

beforeEach(() => {
  disk.clear();
  downloads.length = 0;
  served = {
    'http://web/car-3d/placeholder-hatch.glb': GLB,
    'http://web/car-3d/regions/placeholder-hatch.regions.json': REGIONS,
  };
});

describe('ensureModel', () => {
  it('baixa .glb e regions.json do web uma vez e devolve data: URI', async () => {
    const uri = await ensureModel(entry);
    expect(uri).toBe(`data:model/gltf-binary;base64,${Buffer.from(GLB, 'binary').toString('base64')}`);
    expect(downloads).toEqual([
      'http://web/car-3d/placeholder-hatch.glb',
      'http://web/car-3d/regions/placeholder-hatch.regions.json',
    ]);
    expect([...disk.keys()]).toEqual(['doc/car-3d/placeholder-hatch.glb', 'doc/car-3d/placeholder-hatch.regions.json']);

    await ensureModel(entry);
    expect(downloads).toHaveLength(2); // segunda vez lê do cache
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

  it('regions inválido é apagado e falha', async () => {
    served['http://web/car-3d/regions/placeholder-hatch.regions.json'] = '<html>';
    await expect(loadRegions(entry)).rejects.toThrow();
    expect(disk.has('doc/car-3d/placeholder-hatch.regions.json')).toBe(false);
  });
});
