import { useState } from 'react';
import { api } from '@/lib/api';

// ─── MMKV (fails silently in Expo Go — JSI unavailable) ───────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mmkv: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  _mmkv = new MMKV({ id: 'vehicle-plate-cache' });
} catch {
  // Expo Go — JSI não disponível
}

const CACHE_TTL_MS = 604_800_000; // 7 days
const CACHE_INDEX_KEY = 'vbp_keys';
const MAX_CACHE_ENTRIES = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VehicleInfo {
  plate: string;
  brand: string;
  model: string;
  submodel: string;
  year: number;
  color: string;
  chassi?: string;
}

interface CacheEntry {
  data: VehicleInfo;
  storedAt: number;
}

/** Resposta do endpoint GET /vehicle-catalog/plate/<plate>/ */
interface PlateAPIResponse {
  plate?: string;
  make?: string;
  model?: string;
  version?: string;
  engine?: string;
  year?: number | string;
  color?: string;
  chassis?: string;
  detail?: string;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function cacheKey(normalizedPlate: string): string {
  return `vbp_${normalizedPlate}`;
}

function getCached(normalizedPlate: string): VehicleInfo | null {
  if (!_mmkv) return null;
  try {
    const raw: string | undefined = _mmkv.getString(cacheKey(normalizedPlate));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.storedAt > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function getCachedStale(normalizedPlate: string): VehicleInfo | null {
  if (!_mmkv) return null;
  try {
    const raw: string | undefined = _mmkv.getString(cacheKey(normalizedPlate));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(normalizedPlate: string, data: VehicleInfo): void {
  if (!_mmkv) return;
  try {
    const entry: CacheEntry = { data, storedAt: Date.now() };
    _mmkv.set(cacheKey(normalizedPlate), JSON.stringify(entry));

    const indexRaw: string | undefined = _mmkv.getString(CACHE_INDEX_KEY);
    let index: string[] = [];
    try {
      index = indexRaw ? (JSON.parse(indexRaw) as string[]) : [];
    } catch {
      index = [];
    }

    const filtered = index.filter((p) => p !== normalizedPlate);
    filtered.push(normalizedPlate);

    while (filtered.length > MAX_CACHE_ENTRIES) {
      const evicted = filtered.shift();
      if (evicted) {
        try { _mmkv.delete(cacheKey(evicted)); } catch { /* ignore */ }
      }
    }

    _mmkv.set(CACHE_INDEX_KEY, JSON.stringify(filtered));
  } catch {
    // Fail silently — cache is best-effort
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVehicleByPlate(): {
  lookup: (plate: string) => Promise<VehicleInfo | null>;
  isLoading: boolean;
  error: string | null;
} {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (plate: string): Promise<VehicleInfo | null> => {
    const normalized = plate.toUpperCase().replace(/[-\s]/g, '').trim();

    if (!normalized || normalized.length < 7) {
      setError('Placa inválida');
      return null;
    }

    setError(null);

    // Check fresh cache first
    const cached = getCached(normalized);
    if (cached) {
      return cached;
    }

    setIsLoading(true);
    try {
      const data = await api.get<PlateAPIResponse>(`/vehicle-catalog/plate/${normalized}`);

      if (!data.make && !data.model) {
        setError('Placa não encontrada');
        return null;
      }

      const year = typeof data.year === 'string'
        ? parseInt(data.year.substring(0, 4), 10) || 0
        : data.year ?? 0;

      const info: VehicleInfo = {
        plate: normalized,
        brand: data.make ?? '',
        model: [data.model, data.version].filter(Boolean).join(' '),
        submodel: data.version ?? '',
        year,
        color: data.color ?? '',
        chassi: data.chassis,
      };

      setCache(normalized, info);
      return info;
    } catch {
      const stale = getCachedStale(normalized);
      if (stale) return stale;
      setError('Erro ao buscar placa');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookup, isLoading, error };
}
