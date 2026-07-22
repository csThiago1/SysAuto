"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

const API = "/api/proxy"

// ── Perito = Person com role EXPERT ─────────────────────────────────────────
// Peritos são cadastrados via Person API (/persons/), não existe mais um
// app "experts" separado — consolidado em persons.Person + ExpertProfile.

export interface ExpertResult {
  id: number
  name: string
  phone: string | null
}

interface PersonListItem {
  id: number
  full_name: string
  primary_contact: { type: string; value: string } | null
}

interface PersonListResponse {
  count: number
  results: PersonListItem[]
}

export function useExperts(insurerId?: string | null, search = "") {
  const params = new URLSearchParams({ role: "EXPERT", page_size: "10" })
  if (insurerId) params.set("insurer_id", insurerId)
  if (search) params.set("search", search)

  return useQuery<PersonListResponse, Error, { results: ExpertResult[] }>({
    queryKey: ["experts", insurerId, search],
    queryFn: () => apiFetch<PersonListResponse>(`${API}/persons/?${params.toString()}`),
    select: (data) => ({
      results: data.results.map((p) => ({
        id: p.id,
        name: p.full_name,
        phone: p.primary_contact?.value ?? null,
      })),
    }),
  })
}

interface ExpertCreateInput {
  name: string
  phone?: string
  insurer_ids?: string[]
}

export function useExpertCreate() {
  const qc = useQueryClient()
  return useMutation<ExpertResult, Error, ExpertCreateInput>({
    mutationFn: async (data) => {
      const payload = {
        full_name: data.name,
        person_kind: "PF",
        roles: ["EXPERT"],
        contacts: data.phone
          ? [{ contact_type: "CELULAR", value: data.phone, is_primary: true }]
          : [],
      }
      const person = await apiFetch<{ id: number; full_name: string }>(`${API}/persons/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (data.insurer_ids?.length) {
        await apiFetch(`${API}/persons/${person.id}/expert-profile/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ insurers: data.insurer_ids }),
        })
      }
      return { id: person.id, name: person.full_name, phone: data.phone ?? null }
    },
    onSuccess: (expert) => {
      void qc.invalidateQueries({ queryKey: ["experts"] })
      toast.success(`Perito "${expert.name}" cadastrado!`)
    },
    onError: (err) => {
      toast.error(`Erro ao cadastrar perito: ${err.message}`)
    },
  })
}
