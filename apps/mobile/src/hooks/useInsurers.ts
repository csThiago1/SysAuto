import { useState, useEffect } from 'react';
import { MMKV } from 'react-native-mmkv';
import { api } from '@/lib/api';

// ─── MMKV cache ───────────────────────────────────────────────────────────────

let _mmkv: MMKV | null = null;
try { _mmkv = new MMKV({ id: 'insurers-cache' }); } catch { _mmkv = null; }

const CACHE_KEY = 'insurers_list_v2'; // bump version to bust stale cache
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
  logo: string;       // InsurerMinimalSerializer returns 'logo', not 'logo_url'
}

interface PaginatedResponse {
  results: InsurerApiItem[];
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
        logoUrl: item.logo,   // InsurerMinimalSerializer uses 'logo' field
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
