import { useState, useEffect } from 'react';
import { MMKV } from 'react-native-mmkv';
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/lib/constants';

// ─── MMKV cache ───────────────────────────────────────────────────────────────

let _mmkv: MMKV | null = null;
try { _mmkv = new MMKV({ id: 'insurers-cache' }); } catch { _mmkv = null; }

const CACHE_KEY = 'insurers_list_v3'; // v3: logo_url + cnpj + is_active adicionados ao serializer
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InsurerOption {
  id: string;
  displayName: string;   // trade_name || name
  brandColor: string;
  abbreviation: string;
  logoUrl: string;
}

interface InsurerApiItem {
  id: string;
  name: string;
  trade_name: string;
  display_name: string;
  brand_color: string;
  abbreviation: string;
  logo: string | null;    // URL resolvida (logo_url + fallback Person) — pode ser null
  logo_url: string;       // URL crua armazenada no campo Insurer.logo_url
  cnpj: string;
  is_active: boolean;
  uses_cilia: boolean;
}

interface PaginatedResponse {
  results: InsurerApiItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converte URLs relativas do Django (/media/...) em absolutas.
 * Em produção, o storage retorna URLs S3 absolutas — retorna sem alteração.
 */
function resolveLogoUrl(url: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;   // S3 / CDN — já absoluta
  return `${API_BASE_URL}${url}`;           // dev: /media/... → http://localhost:8000/media/...
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInsurers(): {
  insurers: InsurerOption[];           // full list
  filteredInsurers: InsurerOption[];   // filtered by current query
  isLoading: boolean;
  filterQuery: string;
  setFilterQuery: (q: string) => void;
} {
  const [insurers, setInsurers] = useState<InsurerOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');

  useEffect(() => {
    void loadInsurers();
  }, []);

  async function loadInsurers(): Promise<void> {
    // Check cache first
    try {
      const cached = _mmkv?.getString(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached) as { data: InsurerOption[]; ts: number };
        if (Date.now() - ts < CACHE_TTL_MS) {
          setInsurers(data);
          return;
        }
      }
    } catch { /* ignore */ }

    setIsLoading(true);
    try {
      const response = await api.get<PaginatedResponse>('/insurers/');
      const mapped: InsurerOption[] = response.results.map((item) => ({
        id: item.id,
        displayName: item.display_name || item.trade_name || item.name,
        brandColor: item.brand_color || '#6b7280',
        abbreviation: item.abbreviation || item.name.substring(0, 2).toUpperCase(),
        logoUrl: resolveLogoUrl(item.logo),
      }));
      setInsurers(mapped);
      try {
        _mmkv?.set(CACHE_KEY, JSON.stringify({ data: mapped, ts: Date.now() }));
      } catch { /* ignore */ }
    } catch (err) {
      console.warn('useInsurers: fetch failed', err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredInsurers = filterQuery.trim().length === 0
    ? insurers
    : insurers.filter((ins) =>
        ins.displayName.toLowerCase().includes(filterQuery.toLowerCase()) ||
        ins.abbreviation.toLowerCase().includes(filterQuery.toLowerCase())
      );

  return { insurers, filteredInsurers, isLoading, filterQuery, setFilterQuery };
}
