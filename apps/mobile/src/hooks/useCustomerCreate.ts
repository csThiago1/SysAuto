import { useState } from 'react';
import { api } from '@/lib/api';
import type { CustomerSearchResult } from '@/hooks/useCustomerSearch';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerCreateInput {
  name: string;
  cpf?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCustomerCreate(): {
  create: (input: CustomerCreateInput) => Promise<CustomerSearchResult>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
} {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (input: CustomerCreateInput): Promise<CustomerSearchResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.post<CustomerSearchResult>('/customers/', {
        ...input,
        lgpd_consent: true,
      });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar cliente';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = (): void => setError(null);

  return { create, isLoading, error, clearError };
}
