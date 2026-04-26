"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

const API = "/api/proxy"

export interface CustomerResult {
  id: string
  name: string
  cpf_masked: string | null
  phone_masked: string | null
}

export interface CustomerDetail {
  id: string
  name: string
  cpf_masked: string | null
  phone: string | null          // descriptografado para edição interna
  phone_masked: string | null
  email: string | null
  birth_date: string | null
  // Endereço — campos individuais (migração 0004)
  zip_code: string
  street: string
  street_number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export interface CustomerUpdateInput {
  name?: string
  phone?: string
  email?: string
  birth_date?: string
  zip_code?: string
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}

interface SearchResponse {
  count: number
  results: CustomerResult[]
}

export function useCustomerSearch(q: string) {
  return useQuery<SearchResponse>({
    queryKey: ["customers-search", q],
    queryFn: () =>
      apiFetch<SearchResponse>(
        `${API}/customers/search/?q=${encodeURIComponent(q)}`
      ),
    enabled: q.trim().length >= 3,
    staleTime: 30_000,
  })
}

interface CustomerCreateInput {
  name: string
  phone?: string
  cpf?: string
  email?: string
  birth_date?: string
  zip_code?: string
  street?: string
  street_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}

export function useCustomerDetail(id: string | null) {
  return useQuery<CustomerDetail>({
    queryKey: ["customer-detail", id],
    queryFn: () => apiFetch<CustomerDetail>(`${API}/customers/${id}/`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}

export function useCustomerCreate() {
  const qc = useQueryClient()
  return useMutation<CustomerResult, Error, CustomerCreateInput>({
    mutationFn: (data) =>
      apiFetch<CustomerResult>(`${API}/customers/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // lgpd_consent sempre true no ERP interno — operador assume responsabilidade
        body: JSON.stringify({ ...data, lgpd_consent: true }),
      }),
    onSuccess: (customer) => {
      void qc.invalidateQueries({ queryKey: ["customers-search"] })
      toast.success(`Cliente "${customer.name}" cadastrado!`)
    },
    onError: (err) => {
      toast.error(`Erro ao cadastrar cliente: ${err.message}`)
    },
  })
}

// ── Person API (novo sistema de cadastro) ────────────────────────────────────
// Usado pelo NewOSDrawer para buscar clientes criados em Cadastros > Pessoas.

export interface PersonResult {
  id: number
  name: string
  cpf_masked: string | null
  phone_masked: string | null
}

interface PersonListItem {
  id: number
  full_name: string
  fantasy_name: string | null
  primary_contact: { type: string; value: string } | null
}

interface PersonListResponse {
  count: number
  results: PersonListItem[]
}

interface PersonSearchResponse {
  count: number
  results: PersonResult[]
}

export function usePersonSearch(q: string) {
  return useQuery<PersonListResponse, Error, PersonSearchResponse>({
    queryKey: ["persons-search", q],
    queryFn: () =>
      apiFetch<PersonListResponse>(
        `${API}/persons/?search=${encodeURIComponent(q)}&role=CLIENT&page_size=10`
      ),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
    select: (data): PersonSearchResponse => ({
      count: data.count,
      results: data.results.map((p) => ({
        id: p.id,
        name: p.full_name,
        cpf_masked: null,
        phone_masked: p.primary_contact?.value ?? null,
      })),
    }),
  })
}

interface PersonCreateInput {
  name: string
  phone?: string
  cpf?: string
  email?: string
  birth_date?: string | null
}

interface PersonDetailResponse {
  id: number
  full_name: string
}

export function usePersonCreate() {
  const qc = useQueryClient()
  return useMutation<PersonResult, Error, PersonCreateInput>({
    mutationFn: async (data) => {
      const payload: Record<string, unknown> = {
        full_name: data.name,
        person_kind: "PF",
        roles: ["CLIENT"],
      }
      if (data.phone) payload.contacts = [{ contact_type: "PHONE", value: data.phone, is_primary: true }]
      if (data.cpf) payload.documents = [{ doc_type: "CPF", value: data.cpf }]
      if (data.email) {
        const contacts = (payload.contacts as unknown[]) ?? []
        payload.contacts = [...contacts, { contact_type: "EMAIL", value: data.email }]
      }
      const res = await apiFetch<PersonDetailResponse>(`${API}/persons/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      return { id: res.id, name: res.full_name, cpf_masked: null, phone_masked: null }
    },
    onSuccess: (person) => {
      void qc.invalidateQueries({ queryKey: ["persons-search"] })
      void qc.invalidateQueries({ queryKey: ["persons"] })
      toast.success(`Cliente "${person.name}" cadastrado!`)
    },
    onError: (err) => {
      toast.error(`Erro ao cadastrar cliente: ${err.message}`)
    },
  })
}

export interface PersonDetailContact {
  contact_type: string
  value: string
  value_masked: string
  is_primary: boolean
}

export interface PersonDetailAddress {
  id: number
  address_type: string
  zip_code: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  is_primary: boolean
}

export interface PersonDetail {
  id: number
  full_name: string
  birth_date: string | null
  contacts: PersonDetailContact[]
  addresses: PersonDetailAddress[]
}

export interface PersonContactPatch {
  contact_type: string
  value: string
  is_primary: boolean
}

export interface PersonAddressPatch {
  address_type: string
  zip_code: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  is_primary: boolean
}

export interface PersonPatch {
  contacts?: PersonContactPatch[]
  addresses?: PersonAddressPatch[]
}

export function usePersonDetail(id: number | null) {
  return useQuery<PersonDetail>({
    queryKey: ["person-detail", id],
    queryFn: () => apiFetch<PersonDetail>(`${API}/persons/${id}/`),
    enabled: id != null,
    staleTime: 5 * 60_000,
  })
}

export function usePersonUpdate(id: number | null) {
  const qc = useQueryClient()
  return useMutation<void, Error, PersonPatch>({
    mutationFn: (patch) =>
      apiFetch(`${API}/persons/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["person-detail", id] })
    },
    onError: (err) => {
      toast.error(`Erro ao salvar dados do cliente: ${err.message}`)
    },
  })
}

export function useCustomerUpdate(id: string | null) {
  const qc = useQueryClient()
  return useMutation<CustomerDetail, Error, CustomerUpdateInput>({
    mutationFn: (data) =>
      apiFetch<CustomerDetail>(`${API}/customers/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customer-detail", id] })
    },
    onError: (err) => {
      toast.error(`Erro ao salvar dados do cliente: ${err.message}`)
    },
  })
}
