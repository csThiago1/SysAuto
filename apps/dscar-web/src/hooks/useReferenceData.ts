// apps/dscar-web/src/hooks/useReferenceData.ts
import { useQuery } from '@tanstack/react-query';
import { listLaborCategories, listOperationTypes } from '../api/referenceData';

export function useOperationTypes() {
  return useQuery({
    queryKey: ['ref', 'operation-types'],
    queryFn: listOperationTypes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLaborCategories() {
  return useQuery({
    queryKey: ['ref', 'labor-categories'],
    queryFn: listLaborCategories,
    staleTime: 5 * 60 * 1000,
  });
}
