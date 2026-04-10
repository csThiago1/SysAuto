"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Expert, PaginatedResponse } from "@paddock/types"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

const API = "/api/proxy"

export function useExperts(insurerId?: string, search = "") {
  const params = new URLSearchParams()
  if (insurerId) params.set("insurers", insurerId)
  if (search) params.set("search", search)
  const qs = params.toString() ? `?${params.toString()}` : ""

  return useQuery<PaginatedResponse<Expert>>({
    queryKey: ["experts", insurerId, search],
    queryFn: () => apiFetch<PaginatedResponse<Expert>>(`${API}/experts/${qs}`),
  })
}

interface ExpertCreateInput {
  name: string
  registration_number?: string
  phone?: string
  email?: string
  insurer_ids?: string[]
}

export function useExpertCreate() {
  const qc = useQueryClient()
  return useMutation<Expert, Error, ExpertCreateInput>({
    mutationFn: (data) =>
      apiFetch<Expert>(`${API}/experts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (expert) => {
      void qc.invalidateQueries({ queryKey: ["experts"] })
      toast.success(`Perito "${expert.name}" cadastrado!`)
    },
    onError: (err) => {
      toast.error(`Erro ao cadastrar perito: ${err.message}`)
    },
  })
}
