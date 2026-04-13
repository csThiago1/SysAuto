import { useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useConnectivity } from '@/hooks/useConnectivity';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerSearchResult {
  id: string;
  name: string;
  cpf_masked: string;
  phone_masked: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCustomerSearch(): {
  results: CustomerSearchResult[];
  isLoading: boolean;
  search: (query: string) => void;
  clear: () => void;
} {
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = useConnectivity();

  const search = useCallback(
    (query: string): void => {
      // Cancel any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      if (!isOnline || query.trim().length < 3) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        const trimmed = query.trim();
        if (trimmed.length < 3) {
          setResults([]);
          return;
        }

        setIsLoading(true);
        api
          .get<{ count: number; results: CustomerSearchResult[] }>(
            `/customers/search/?q=${encodeURIComponent(trimmed)}`,
          )
          .then((data) => {
            setResults(data.results);
          })
          .catch((err: unknown) => {
            console.warn('Customer search error:', err);
            setResults([]);
          })
          .finally(() => {
            setIsLoading(false);
          });
      }, 400);
    },
    [isOnline],
  );

  const clear = useCallback((): void => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setResults([]);
  }, []);

  return { results, isLoading, search, clear };
}
