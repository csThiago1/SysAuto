/**
 * useServiceOrders
 *
 * Busca ordens de serviço da API real quando disponível,
 * com fallback para mock data enquanto o backend não está online.
 *
 * Troca o flag USE_MOCK_DATA para false quando o backend estiver rodando.
 */
import { useEffect, useReducer, useCallback } from 'react';
import { ServiceOrder, OSStatus } from '../types';
import { mockOrders } from '../mockData';
import { listServiceOrders, changeStatus as apiChangeStatus, APIServiceOrder } from '../api/serviceOrders';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

type State = {
  orders: ServiceOrder[];
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: 'SET_LOADING' }
  | { type: 'SET_ORDERS'; orders: ServiceOrder[] }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'UPDATE_ORDER'; order: ServiceOrder }
  | { type: 'UPDATE_STATUS'; orderId: string; newStatus: OSStatus; changedBy: string; notes?: string };

function toFrontendOrder(api: APIServiceOrder): ServiceOrder {
  return {
    id: `OS-${api.id}`,
    clientId: String(api.customer),
    osType: 'Particular', // TODO: mapear do backend quando disponível
    vehicle: api.vehicle_description,
    plate: api.vehicle_plate,
    status: api.status,
    statusHistory: api.status_history.map(h => ({
      status: h.to_status,
      changedBy: h.changed_by,
      changedAt: h.changed_at,
      notes: h.notes || undefined,
    })),
    financialStatus: 'A Faturar',
    amountPaid: 0,
    services: [],
    parts: [],
    totalValue: parseFloat(api.total_value),
    observations: api.notes || undefined,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: true, error: null };
    case 'SET_ORDERS':
      return { orders: action.orders, loading: false, error: null };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'UPDATE_ORDER':
      return {
        ...state,
        orders: state.orders.map(o => o.id === action.order.id ? action.order : o),
      };
    case 'UPDATE_STATUS':
      return {
        ...state,
        orders: state.orders.map(o => {
          if (o.id !== action.orderId) return o;
          const now = new Date().toISOString();
          return {
            ...o,
            status: action.newStatus,
            updatedAt: now,
            statusHistory: [
              ...(o.statusHistory ?? []),
              { status: action.newStatus, changedBy: action.changedBy, changedAt: now, notes: action.notes },
            ],
          };
        }),
      };
    default:
      return state;
  }
}

export function useServiceOrders() {
  const [state, dispatch] = useReducer(reducer, {
    orders: USE_MOCK_DATA ? mockOrders : [],
    loading: !USE_MOCK_DATA,
    error: null,
  });

  const fetchOrders = useCallback(async () => {
    if (USE_MOCK_DATA) return;
    dispatch({ type: 'SET_LOADING' });
    try {
      const data = await listServiceOrders();
      dispatch({ type: 'SET_ORDERS', orders: data.results.map(toFrontendOrder) });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message ?? 'Erro ao carregar ordens.' });
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: OSStatus, changedBy = 'Sistema', notes?: string) => {
      // Optimistic update imediato
      dispatch({ type: 'UPDATE_STATUS', orderId, newStatus, changedBy, notes });

      if (!USE_MOCK_DATA) {
        try {
          const numericId = parseInt(orderId.replace('OS-', ''), 10);
          await apiChangeStatus(numericId, newStatus, changedBy, notes ?? '');
        } catch (err: any) {
          // Reverter em caso de falha — recarrega do servidor
          console.error('Falha ao atualizar status no backend:', err.message);
          fetchOrders();
        }
      }
    },
    [fetchOrders],
  );

  const updateOrder = useCallback((order: ServiceOrder) => {
    dispatch({ type: 'UPDATE_ORDER', order });
  }, []);

  return {
    orders: state.orders,
    loading: state.loading,
    error: state.error,
    updateOrderStatus,
    updateOrder,
    refetch: fetchOrders,
  };
}
