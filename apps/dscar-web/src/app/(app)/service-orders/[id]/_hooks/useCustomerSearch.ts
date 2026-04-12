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
