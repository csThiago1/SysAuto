import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import type {
  TransitionOverrideRequest,
  CreateOverridePayload,
  ResolveOverridePayload,
  TransitionPayload,
} from "@paddock/types"

const API = "/api/proxy/service-orders"

export function useTransitionWithValidation(osId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: TransitionPayload) => {
      return apiFetch(`${API}/${osId}/transition/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      void qc.invalidateQueries({ queryKey: ["service-order", osId] })
    },
    // Caller handles validation blocks — no toast here
  })
}

export function useRequestOverride(osId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateOverridePayload) => {
      return apiFetch<TransitionOverrideRequest>(`${API}/${osId}/override-request/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      toast.success("Solicitação de liberação enviada ao gerente")
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      void qc.invalidateQueries({ queryKey: ["service-order", osId] })
    },
    onError: () => {
      toast.error("Erro ao solicitar liberação")
    },
  })
}

export function usePendingOverrides() {
  return useQuery<TransitionOverrideRequest[]>({
    queryKey: ["pending-overrides"],
    queryFn: () => apiFetch<TransitionOverrideRequest[]>(`${API}/pending-overrides/`),
    refetchInterval: 30000,
  })
}

export function useResolveOverride(osId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      overrideId,
      payload,
    }: {
      overrideId: string
      payload: ResolveOverridePayload
    }) => {
      return apiFetch<TransitionOverrideRequest>(
        `${API}/${osId}/override-request/${overrideId}/resolve/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
    },
    onSuccess: (_, variables) => {
      const action = variables.payload.action === "approved" ? "aprovado" : "rejeitado"
      toast.success(`Override ${action}`)
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      void qc.invalidateQueries({ queryKey: ["service-order", osId] })
      void qc.invalidateQueries({ queryKey: ["pending-overrides"] })
    },
    onError: () => {
      toast.error("Erro ao resolver override")
    },
  })
}
