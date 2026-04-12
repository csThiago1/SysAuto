import { useState } from 'react';
import { useConnectivity } from '@/hooks/useConnectivity';

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

interface PlacaFipeResponse {
  placa?: string;
  marca?: string;
  modelo?: string;
  submodelo?: string;
  ano?: string | number;
  cor?: string;
  chassi?: string;
  error?: string;
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

    // Maintain index (max 50 entries — evict oldest by FIFO)
    const indexRaw: string | undefined = _mmkv.getString(CACHE_INDEX_KEY);
    let index: string[] = [];
    try {
      index = indexRaw ? (JSON.parse(indexRaw) as string[]) : [];
    } catch {
      index = [];
    }

    // Remove if already present (re-insert at end)
    const filtered = index.filter((p) => p !== normalizedPlate);
    filtered.push(normalizedPlate);

    // Evict oldest entries if over limit
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
  const isOnline = useConnectivity();

  const lookup = async (plate: string): Promise<VehicleInfo | null> => {
    const normalized = plate.toUpperCase().replace(/[-\s]/g, '').trim();

    if (!normalized) {
      setError('Placa inválida');
      return null;
    }

    setError(null);

    // Check fresh cache first
    const cached = getCached(normalized);
    if (cached) return cached;

    // Offline: return stale cache if available, otherwise null
    if (!isOnline) {
      const stale = getCachedStale(normalized);
      if (stale) return stale;
      setError('Sem conexão');
      return null;
    }

    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      let res: Response;
      try {
        res = await fetch('https://placa-fipe.apibrasil.com.br/placa/consulta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placa: normalized }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        setError('Erro ao buscar placa');
        return null;
      }

      const data = (await res.json()) as PlacaFipeResponse;

      if (data.error || !data.marca || !data.modelo) {
        setError('Placa não encontrada');
        return null;
      }

      // Parse year — may be "2019/2020", take first 4 chars
      const yearRaw = String(data.ano ?? '0');
      const year = parseInt(yearRaw.substring(0, 4), 10) || 0;

      const info: VehicleInfo = {
        plate: normalized,
        brand: data.marca,
        model: data.modelo,
        submodel: data.submodelo ?? '',
        year,
        color: data.cor ?? '',
        chassi: data.chassi,
      };

      setCache(normalized, info);
      return info;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Erro ao buscar placa');
      } else {
        // Offline or network failure — try stale cache
        const stale = getCachedStale(normalized);
        if (stale) return stale;
        setError('Sem conexão');
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookup, isLoading, error };
}
