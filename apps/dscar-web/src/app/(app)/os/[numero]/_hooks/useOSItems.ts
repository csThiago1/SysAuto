/**
 * useOSItems — hooks para peças e serviços de uma OS
 * Segue o mesmo padrão de useServiceOrder.ts
 */
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ServiceOrderPart,
  ServiceOrderLabor,
  ServiceOrderPhoto,
  BudgetSnapshot,
  CreatePartPayload,
  CreateLaborPayload,
  DeliverOSPayload,
  OSPhotoFolder,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

const API = "/api/proxy"

// ─── Peças ────────────────────────────────────────────────────────────────────

export function useOSParts(orderId: string | undefined) {
  return useQuery<ServiceOrderPart[]>({
    queryKey: ["os-parts", orderId],
    queryFn: () => apiFetch<ServiceOrderPart[]>(`${API}/service-orders/${orderId}/parts/`),
    enabled: !!orderId,
  })
}

export function useAddPart(orderId: string) {
  const qc = useQueryClient()
  return useMutation<ServiceOrderPart, Error, CreatePartPayload>({
    mutationFn: (data) =>
      apiFetch<ServiceOrderPart>(`${API}/service-orders/${orderId}/parts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["os-parts", orderId] })
      void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
      toast.success("Peça adicionada.")
    },
  })
}

export function useUpdatePart(orderId: string) {
  const qc = useQueryClient()
  return useMutation<ServiceOrderPart, Error, { id: string; data: Partial<CreatePartPayload> }>({
    mutationFn: ({ id, data }) =>
      apiFetch<ServiceOrderPart>(`${API}/service-orders/${orderId}/parts/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["os-parts", orderId] })
      void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
      toast.success("Peça atualizada.")
    },
  })
}

export function useDeletePart(orderId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (partId) =>
      apiFetch<void>(`${API}/service-orders/${orderId}/parts/${partId}/`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["os-parts", orderId] })
      void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
      toast.success("Peça removida.")
    },
  })
}

// ─── Serviços (Mão de obra) ───────────────────────────────────────────────────

export function useOSLabor(orderId: string | undefined) {
  return useQuery<ServiceOrderLabor[]>({
    queryKey: ["os-labor", orderId],
    queryFn: () => apiFetch<ServiceOrderLabor[]>(`${API}/service-orders/${orderId}/labor/`),
    enabled: !!orderId,
  })
}

export function useAddLabor(orderId: string) {
  const qc = useQueryClient()
  return useMutation<ServiceOrderLabor, Error, CreateLaborPayload>({
    mutationFn: (data) =>
      apiFetch<ServiceOrderLabor>(`${API}/service-orders/${orderId}/labor/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["os-labor", orderId] })
      void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
      toast.success("Serviço adicionado.")
    },
  })
}

export function useUpdateLabor(orderId: string) {
  const qc = useQueryClient()
  return useMutation<ServiceOrderLabor, Error, { id: string; data: Partial<CreateLaborPayload> }>({
    mutationFn: ({ id, data }) =>
      apiFetch<ServiceOrderLabor>(`${API}/service-orders/${orderId}/labor/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["os-labor", orderId] })
      void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
      toast.success("Serviço atualizado.")
    },
  })
}

export function useDeleteLabor(orderId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (laborId) =>
      apiFetch<void>(`${API}/service-orders/${orderId}/labor/${laborId}/`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["os-labor", orderId] })
      void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
      toast.success("Serviço removido.")
    },
  })
}

// ─── Fotos ────────────────────────────────────────────────────────────────────

export function useOSPhotos(orderId: string | undefined) {
  return useQuery<ServiceOrderPhoto[]>({
    queryKey: ["os-photos", orderId],
    queryFn: () =>
      apiFetch<ServiceOrderPhoto[]>(`${API}/service-orders/${orderId}/photos/`),
    enabled: !!orderId,
  })
}

export function useUploadPhoto(orderId: string) {
  const qc = useQueryClient()
  return useMutation<ServiceOrderPhoto, Error, FormData>({
    mutationFn: (formData) =>
      apiFetch<ServiceOrderPhoto>(`${API}/service-orders/${orderId}/photos/`, {
        method: "POST",
        body: formData,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["os-photos", orderId] })
      void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
      toast.success("Foto enviada.")
    },
    onError: () => {
      toast.error("Erro ao enviar foto.")
    },
  })
}

export function useSoftDeletePhoto(orderId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (photoId) =>
      apiFetch<void>(`${API}/service-orders/${orderId}/photos/${photoId}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["os-photos", orderId] })
      toast.success("Foto removida.")
    },
  })
}

// ─── Budget Snapshots ─────────────────────────────────────────────────────────

export function useOSBudgetSnapshots(orderId: string | undefined) {
  return useQuery<BudgetSnapshot[]>({
    queryKey: ["os-budget-snapshots", orderId],
    queryFn: () =>
      apiFetch<BudgetSnapshot[]>(`${API}/service-orders/${orderId}/budget-snapshots/`),
    enabled: !!orderId,
  })
}

// ─── Entrega da OS ────────────────────────────────────────────────────────────

export function useDeliverOS(orderId: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, DeliverOSPayload>({
    mutationFn: (data) =>
      apiFetch(`${API}/service-orders/${orderId}/deliver/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      toast.success("OS entregue com sucesso.")
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao registrar entrega.")
    },
  })
}

// ─── Observações (notes patch direto na OS) ───────────────────────────────────

export function useUpdateOSNotes(orderId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (notes) =>
      apiFetch<void>(`${API}/service-orders/${orderId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
      toast.success("Observações salvas.")
    },
  })
}
