"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AuditoriaMotor,
  BloqueioCapacidade,
  CapacidadeTecnico,
  HeatmapDia,
  MotorHealthcheck,
  ProximaDataDisponivel,
  UtilizacaoCapacidade,
  VarianciaFicha,
  VarianciaPecaCusto,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

// ── Helper ─────────────────────────────────────────────────────────────────

type Paginated<T> = { results: T[]; count: number; next: string | null; previous: string | null }

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<Paginated<T> | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

const BASE_CAP = "/api/proxy/capacidade"
const BASE_VAR = "/api/proxy/pricing/variancias"
const BASE_ENGINE = "/api/proxy/pricing/engine"

// ── Capacidade Técnica ──────────────────────────────────────────────────────

export function useCapacidades() {
  return useQuery({
    queryKey: ["capacidades"],
    queryFn: () => fetchList<CapacidadeTecnico>(`${BASE_CAP}/capacidades/`),
  })
}

export function useCreateCapacidade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<CapacidadeTecnico>) =>
      apiFetch<CapacidadeTecnico>(`${BASE_CAP}/capacidades/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capacidades"] }),
  })
}

export function useDeleteCapacidade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${BASE_CAP}/capacidades/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capacidades"] }),
  })
}

// ── Bloqueios ───────────────────────────────────────────────────────────────

export function useBloqueios() {
  return useQuery({
    queryKey: ["bloqueios-capacidade"],
    queryFn: () => fetchList<BloqueioCapacidade>(`${BASE_CAP}/bloqueios/`),
  })
}

export function useCreateBloqueio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<BloqueioCapacidade>) =>
      apiFetch<BloqueioCapacidade>(`${BASE_CAP}/bloqueios/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bloqueios-capacidade"] }),
  })
}

export function useDeleteBloqueio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${BASE_CAP}/bloqueios/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bloqueios-capacidade"] }),
  })
}

// ── Cálculos ────────────────────────────────────────────────────────────────

export function useUtilizacao(
  categoriaId: string,
  inicio: string,
  fim: string,
  enabled = true
) {
  return useQuery({
    queryKey: ["capacidade-utilizacao", categoriaId, inicio, fim],
    enabled: enabled && !!categoriaId,
    queryFn: () =>
      apiFetch<UtilizacaoCapacidade>(
        `${BASE_CAP}/utilizacao/?categoria=${categoriaId}&inicio=${inicio}&fim=${fim}`
      ),
  })
}

export function useHeatmapSemana(inicio: string) {
  return useQuery({
    queryKey: ["capacidade-heatmap", inicio],
    enabled: !!inicio,
    queryFn: () =>
      apiFetch<HeatmapDia[]>(`${BASE_CAP}/heatmap-semana/?inicio=${inicio}`),
  })
}

export function useProximaData(categoriaId: string, horas: string, enabled = true) {
  return useQuery({
    queryKey: ["capacidade-proxima-data", categoriaId, horas],
    enabled: enabled && !!categoriaId,
    queryFn: () =>
      apiFetch<ProximaDataDisponivel>(
        `${BASE_CAP}/proxima-data/?categoria=${categoriaId}&horas=${horas}`
      ),
  })
}

// ── Variâncias de Ficha ─────────────────────────────────────────────────────

export function useVarianciasFicha(mes?: string, servicoId?: string) {
  const params = new URLSearchParams()
  if (mes) params.set("mes", mes)
  if (servicoId) params.set("servico_id", servicoId)
  return useQuery({
    queryKey: ["variancias-ficha", mes, servicoId],
    queryFn: () => fetchList<VarianciaFicha>(`${BASE_VAR}/fichas/?${params}`),
  })
}

export function useGerarVariancias() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mesReferencia: string | undefined = undefined) =>
      apiFetch<{ status: string; mes_referencia: string }>(
        `${BASE_VAR}/fichas/gerar/`,
        {
          method: "POST",
          body: JSON.stringify({ mes_referencia: mesReferencia }),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["variancias-ficha"] })
      qc.invalidateQueries({ queryKey: ["variancias-peca"] })
    },
  })
}

// ── Variâncias de Peça ──────────────────────────────────────────────────────

export function useVarianciasPeca(mes?: string, apenasAlertas = false) {
  const params = new URLSearchParams()
  if (mes) params.set("mes", mes)
  if (apenasAlertas) params.set("alerta", "true")
  return useQuery({
    queryKey: ["variancias-peca", mes, apenasAlertas],
    queryFn: () => fetchList<VarianciaPecaCusto>(`${BASE_VAR}/pecas/?${params}`),
  })
}

// ── Auditoria Motor ─────────────────────────────────────────────────────────

export function useAuditoriaMotor(operacao?: string, sucesso?: boolean) {
  const params = new URLSearchParams()
  if (operacao) params.set("operacao", operacao)
  if (sucesso !== undefined) params.set("sucesso", sucesso ? "true" : "false")
  return useQuery({
    queryKey: ["auditoria-motor", operacao, sucesso],
    queryFn: () => fetchList<AuditoriaMotor>(`${BASE_ENGINE}/auditoria/?${params}`),
  })
}

export function useMotorHealthcheck() {
  return useQuery({
    queryKey: ["motor-healthcheck"],
    queryFn: () => apiFetch<MotorHealthcheck>(`${BASE_ENGINE}/healthcheck/`),
    refetchInterval: 60_000, // revalida a cada 60s
  })
}
