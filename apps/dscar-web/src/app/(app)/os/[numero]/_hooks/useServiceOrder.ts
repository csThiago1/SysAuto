"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ServiceOrder } from "@paddock/types"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import type { ServiceOrderUpdateInput } from "../_schemas/service-order.schema"

// Payload mínimo aceito pelo backend para criação de OS
export type OSCreatePayload = Record<string, unknown>

const API = "/api/proxy"

export function useServiceOrder(id: string) {
  return useQuery<ServiceOrder>({
    queryKey: ["service-orders", id],
    queryFn: () => apiFetch<ServiceOrder>(`${API}/service-orders/${id}/`),
    enabled: !!id && id !== "new",
  })
}

export function useServiceOrderCreate() {
  const qc = useQueryClient()
  return useMutation<ServiceOrder, Error, OSCreatePayload>({
    mutationFn: (data) =>
      apiFetch<ServiceOrder>(`${API}/service-orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (order) => {
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      toast.success(`OS #${order.number} criada com sucesso!`)
    },
    onError: (err) => {
      toast.error(`Erro ao criar OS: ${err.message}`)
    },
  })
}

export function useServiceOrderUpdate(id: string) {
  const qc = useQueryClient()
  return useMutation<ServiceOrder, Error, ServiceOrderUpdateInput>({
    mutationFn: (data) =>
      apiFetch<ServiceOrder>(`${API}/service-orders/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (order) => {
      void qc.setQueryData(["service-orders", id], order)
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
    },
    onError: (err) => {
      toast.error(`Erro ao salvar: ${err.message}`)
    },
  })
}

export function useNextOSNumber() {
  return useQuery<{ next_number: number }>({
    queryKey: ["service-orders-next-number"],
    queryFn: () => apiFetch<{ next_number: number }>(`${API}/service-orders/next-number/`),
  })
}
