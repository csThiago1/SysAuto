import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast.store';
import { serviceOrderKeys } from './useServiceOrders';

export interface ApontamentoTecnico {
  id: string;
  name: string;
}

export interface Apontamento {
  id: string;
  tecnico: ApontamentoTecnico;
  iniciado_em: string;
  encerrado_em: string | null;
  horas_apontadas: string;
  observacao: string;
  status: 'iniciado' | 'encerrado' | 'validado';
  created_at: string;
}

interface CreateTimerPayload {
  tecnico_id: string;
}

interface CreateManualPayload {
  tecnico_id: string;
  iniciado_em: string;
  encerrado_em: string;
  observacao?: string;
}

export const apontamentoKeys = {
  all: (osId: string) => ['apontamentos', osId] as const,
};

export function useApontamentos(osId: string) {
  return useQuery<Apontamento[]>({
    queryKey: apontamentoKeys.all(osId),
    queryFn: () => api.get<Apontamento[]>(`/service-orders/${osId}/apontamentos/`),
    enabled: osId.length > 0,
  });
}

export function useCreateApontamento(osId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTimerPayload | CreateManualPayload) =>
      api.post<Apontamento>(`/service-orders/${osId}/apontamentos/`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: apontamentoKeys.all(osId) });
      void qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(osId) });
    },
    onError: () => {
      toast.error('Erro ao criar apontamento');
    },
  });
}

export function useEncerrarApontamento(osId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (apontamentoId: string) =>
      api.post<Apontamento>(
        `/service-orders/${osId}/apontamentos/${apontamentoId}/encerrar/`,
        {},
      ),
    onSuccess: () => {
      toast.success('Apontamento encerrado');
      void qc.invalidateQueries({ queryKey: apontamentoKeys.all(osId) });
      void qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(osId) });
    },
    onError: () => {
      toast.error('Erro ao encerrar apontamento');
    },
  });
}

interface StaffMember {
  id: string;
  name: string;
  job_title: string;
  job_title_display: string;
}

const STATUS_TO_DEPARTMENT: Record<string, string> = {
  mechanic: 'mechanical',
  bodywork: 'bodywork',
  painting: 'painting',
  polishing: 'polishing',
  washing: 'washing',
  assembly: 'bodywork',
  repair: 'mechanical',
};

export function useStaffByDepartment(osStatus: string) {
  const dept = STATUS_TO_DEPARTMENT[osStatus];
  const queryParam = dept ? `?departments=${dept}` : '';

  return useQuery<StaffMember[]>({
    queryKey: ['staff', dept ?? 'all'],
    queryFn: () => api.get<StaffMember[]>(`/auth/staff/${queryParam}`),
  });
}
