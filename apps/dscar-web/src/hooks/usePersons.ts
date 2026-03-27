/**
 * usePersons
 * Busca pessoas da API real ou usa mock data (controlado por VITE_USE_MOCK_DATA).
 */
import { useEffect, useState, useCallback } from 'react';
import { Person } from '../types';
import { mockPeople } from '../mockData';
import { listPersons, APIPerson } from '../api/persons';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

function toFrontendPerson(api: APIPerson): Person {
  const typeMap: Record<APIPerson['person_type'], Person['type']> = {
    CLIENT: 'Cliente',
    EMPLOYEE: 'Colaborador',
    INSURER: 'Seguradora',
    BROKER: 'Corretor',
  };
  return {
    id: String(api.id),
    name: api.full_name,
    type: typeMap[api.person_type],
    phone: api.phone,
    email: api.email,
  };
}

export function usePersons() {
  const [people, setPeople] = useState<Person[]>(USE_MOCK_DATA ? mockPeople : []);
  const [loading, setLoading] = useState(!USE_MOCK_DATA);
  const [error, setError] = useState<string | null>(null);

  const fetchPersons = useCallback(async () => {
    if (USE_MOCK_DATA) return;
    setLoading(true);
    try {
      const data = await listPersons({ page: 1 });
      setPeople(data.results.map(toFrontendPerson));
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao carregar pessoas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPersons(); }, [fetchPersons]);

  return { people, setPeople, loading, error, refetch: fetchPersons };
}
