import { useState } from 'react';
import { api } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mmkv: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  _mmkv = new MMKV({ id: 'vehicle-plate-cache' });
} catch { /* Expo Go */ }

const CACHE_TTL_MS = 604_800_000;
const CACHE_INDEX_KEY = 'vbp_keys';
const MAX_CACHE_ENTRIES = 50;

export interface VehicleInfo {
  plate: string; brand: string; model: string; submodel: string;
  year: number; color: string; chassi?: string;
}
interface CacheEntry { data: VehicleInfo; storedAt: number; }
interface PlateAPIResponse {
  plate?: string; make?: string; model?: string; version?: string;
  engine?: string; year?: number | string; color?: string;
  chassis?: string; detail?: string;
}

function cacheKey(p: string): string { return `vbp_${p}`; }
function getCached(p: string): VehicleInfo | null {
  if (!_mmkv) return null;
  try { const r: string | undefined = _mmkv.getString(cacheKey(p)); if (!r) return null; const e = JSON.parse(r) as CacheEntry; if (Date.now() - e.storedAt > CACHE_TTL_MS) return null; return e.data; } catch { return null; }
}
function getCachedStale(p: string): VehicleInfo | null {
  if (!_mmkv) return null;
  try { const r: string | undefined = _mmkv.getString(cacheKey(p)); if (!r) return null; return (JSON.parse(r) as CacheEntry).data; } catch { return null; }
}
function setCache(p: string, data: VehicleInfo): void {
  if (!_mmkv) return;
  try {
    _mmkv.set(cacheKey(p), JSON.stringify({ data, storedAt: Date.now() }));
    let index: string[] = [];
    try { const r: string | undefined = _mmkv.getString(CACHE_INDEX_KEY); index = r ? (JSON.parse(r) as string[]) : []; } catch { index = []; }
    const filtered = index.filter((x) => x !== p); filtered.push(p);
    while (filtered.length > MAX_CACHE_ENTRIES) { const ev = filtered.shift(); if (ev) { try { _mmkv.delete(cacheKey(ev)); } catch { /* */ } } }
    _mmkv.set(CACHE_INDEX_KEY, JSON.stringify(filtered));
  } catch { /* best-effort */ }
}

export function useVehicleByPlate(): { lookup: (plate: string) => Promise<VehicleInfo | null>; isLoading: boolean; error: string | null; } {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (plate: string): Promise<VehicleInfo | null> => {
    const normalized = plate.toUpperCase().replace(/[-\s]/g, '').trim();
    if (!normalized || normalized.length < 7) { setError('Placa inválida'); return null; }
    setError(null);
    const cached = getCached(normalized);
    if (cached) return cached;

    setIsLoading(true);
    try {
      const data = await api.get<PlateAPIResponse>(`/vehicle-catalog/plate/${normalized}`);
      if (!data.make && !data.model) { setError('Placa não encontrada'); return null; }
      const year = typeof data.year === 'string' ? parseInt(data.year.substring(0, 4), 10) || 0 : data.year ?? 0;
      const info: VehicleInfo = { plate: normalized, brand: data.make ?? '', model: [data.model, data.version].filter(Boolean).join(' '), submodel: data.version ?? '', year, color: data.color ?? '', chassi: data.chassis };
      setCache(normalized, info);
      return info;
    } catch {
      const stale = getCachedStale(normalized);
      if (stale) return stale;
      setError('Erro ao buscar placa');
      return null;
    } finally { setIsLoading(false); }
  };

  return { lookup, isLoading, error };
}
