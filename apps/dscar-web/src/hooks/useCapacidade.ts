"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useCreate, useDelete } from "@/lib/crud-mutations"
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
import { apiFetch, fetchList } from "@/lib/api"

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

export const useCreateCapacidade = () =>
  useCreate<CapacidadeTecnico, Partial<CapacidadeTecnico>>("capacidade/capacidades", {
    invalidateKey: ["capacidades"],
  })
export const useDeleteCapacidade = () =>
  useDelete("capacidade/capacidades", { invalidateKey: ["capacidades"] })

// ── Bloqueios ───────────────────────────────────────────────────────────────

export function useBloqueios() {
  return useQuery({
    queryKey: ["bloqueios-capacidade"],
    queryFn: () => fetchList<BloqueioCapacidade>(`${BASE_CAP}/bloqueios/`),
  })
}

export const useCreateBloqueio = () =>
  useCreate<BloqueioCapacidade, Partial<BloqueioCapacidade>>("capacidade/bloqueios", {
    invalidateKey: ["bloqueios-capacidade"],
  })
export const useDeleteBloqueio = () =>
  useDelete("capacidade/bloqueios", { invalidateKey: ["bloqueios-capacidade"] })

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
      fetchList<HeatmapDia>(`${BASE_CAP}/heatmap-semana/?inicio=${inicio}`),
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
