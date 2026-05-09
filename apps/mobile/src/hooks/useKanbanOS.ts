import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface KanbanOS {
  id: string;
  number: number;
  plate: string;
  make: string;
  model: string;
  customer_name: string;
  status: string;
  entry_date: string;
  estimated_delivery_date: string | null;
  /** Indicador leve: true quando há hard ou soft blocks para o próximo status. */
  has_transition_blocks?: boolean;
}

export interface KanbanColumn {
  key: string;
  label: string;
  statuses: string[];
  items: KanbanOS[];
}

const COLUMNS: Omit<KanbanColumn, 'items'>[] = [
  { key: 'reception', label: 'Recepção', statuses: ['reception', 'initial_survey'] },
  { key: 'budget', label: 'Orçamento', statuses: ['budget', 'waiting_auth'] },
  { key: 'authorized', label: 'Autorizado', statuses: ['authorized', 'waiting_parts'] },
  { key: 'repair', label: 'Em Reparo', statuses: ['repair', 'mechanic', 'bodywork', 'painting', 'assembly'] },
  { key: 'survey', label: 'Vistoria', statuses: ['polishing', 'washing', 'final_survey'] },
  { key: 'ready', label: 'Pronto', statuses: ['ready'] },
  { key: 'delivered', label: 'Entregue', statuses: ['delivered'] },
];

export function useKanbanOS() {
  const query = useQuery<KanbanOS[]>({
    queryKey: ['service-orders', 'kanban'],
    queryFn: () => api.get<KanbanOS[]>('/service-orders?page_size=200&is_active=true'),
  });

  const columns: KanbanColumn[] = COLUMNS.map((col) => ({
    ...col,
    items: (query.data ?? [])
      .filter((os) => col.statuses.includes(os.status))
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()),
  }));

  return {
    columns,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
