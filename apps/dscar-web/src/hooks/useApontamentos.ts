import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { v7 as uuidv7 } from "uuid";
import { apiFetch, fetchList } from "@/lib/api";

const API = "/api/proxy";

export interface StaffUser {
  id: string;
  name: string;
  role: string;
  job_title: string | null;
  job_title_display: string | null;
  is_active: boolean;
}

export interface ApontamentoGlobal {
  id: string;
  tecnico: { id: string; name: string };
  iniciado_em: string;
  encerrado_em: string | null;
  horas_apontadas: string;
  observacao: string;
  status: "iniciado" | "encerrado" | "validado";
  created_at: string;
  os_id: string;
  os_numero: number;
  os_plate: string;
  os_model: string;
}

export function useStaff() {
  return useQuery<StaffUser[]>({
    queryKey: ["auth-staff"],
    queryFn: () => fetchList<StaffUser>(`${API}/auth/staff/`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useApontamentosGlobais(params: Record<string, string>) {
  const search = new URLSearchParams(params).toString();
  return useQuery<ApontamentoGlobal[]>({
    queryKey: ["apontamentos-globais", params],
    queryFn: () =>
      fetchList<ApontamentoGlobal>(`${API}/service-orders/apontamentos/?${search}`),
    enabled: Boolean(params.tecnico),
  });
}

interface IniciarPayload {
  osId: string;
  tecnicoId: string;
}

export function useIniciarApontamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ osId, tecnicoId }: IniciarPayload) =>
      apiFetch(`${API}/service-orders/${osId}/apontamentos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tecnico_id: tecnicoId, client_uuid: uuidv7() }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["apontamentos-globais"] });
    },
  });
}

interface EncerrarPayload {
  osId: string;
  apontamentoId: string;
}

export function useEncerrarApontamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ osId, apontamentoId }: EncerrarPayload) =>
      apiFetch(
        `${API}/service-orders/${osId}/apontamentos/${apontamentoId}/encerrar/`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["apontamentos-globais"] });
    },
  });
}

interface ManualPayload {
  osId: string;
  tecnicoId: string;
  iniciadoEm: string; // ISO UTC
  encerradoEm: string; // ISO UTC
  observacao?: string;
}

export function useApontamentoManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ osId, tecnicoId, iniciadoEm, encerradoEm, observacao }: ManualPayload) =>
      apiFetch(`${API}/service-orders/${osId}/apontamentos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tecnico_id: tecnicoId,
          iniciado_em: iniciadoEm,
          encerrado_em: encerradoEm,
          observacao: observacao ?? "",
          client_uuid: uuidv7(),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["apontamentos-globais"] });
    },
  });
}
