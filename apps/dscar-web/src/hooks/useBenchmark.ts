"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  BenchmarkAmostra,
  BenchmarkEstatisticas,
  BenchmarkFonte,
  BenchmarkIngestao,
  SugestaoIA,
  SugestaoIACreatePayload,
  SugestaoIAResponse,
} from "@paddock/types"

import { apiFetch, fetchList } from "@/lib/api"
import { useCreate } from "@/lib/crud-mutations"

const BASE = "/api/proxy/pricing"

export const benchmarkKeys = {
  fontes: () => ["benchmark", "fontes"] as const,
  ingestoes: () => ["benchmark", "ingestoes"] as const,
  amostras: (params?: Record<string, string>) => ["benchmark", "amostras", params] as const,
  amostrasPendentes: () => ["benchmark", "amostras", { revisao_pendente: "1" }] as const,
  estatisticas: (servicoId: string, segmento: string, tamanho: string) =>
    ["benchmark", "stats", servicoId, segmento, tamanho] as const,
  sugestoes: () => ["ia", "sugestoes"] as const,
}

// ─── Fontes ──────────────────────────────────────────────────────────────────

export function useBenchmarkFontes() {
  return useQuery({
    queryKey: benchmarkKeys.fontes(),
    queryFn: () => fetchList<BenchmarkFonte>(`${BASE}/benchmark/fontes/`),
  })
}

export const useCreateBenchmarkFonte = () =>
  useCreate<BenchmarkFonte, Partial<BenchmarkFonte>>("pricing/benchmark/fontes", {
    invalidateKey: benchmarkKeys.fontes(),
  })

// ─── Ingestões ────────────────────────────────────────────────────────────────

export function useBenchmarkIngestoes() {
  return useQuery({
    queryKey: benchmarkKeys.ingestoes(),
    queryFn: () => fetchList<BenchmarkIngestao>(`${BASE}/benchmark/ingestoes/`),
  })
}

export function useCreateBenchmarkIngestao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) =>
      apiFetch<BenchmarkIngestao>(`${BASE}/benchmark/ingestoes/`, {
        method: "POST",
        body: formData,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: benchmarkKeys.ingestoes() }),
  })
}

// ─── Amostras ────────────────────────────────────────────────────────────────

export function useAmostrasPendentes() {
  return useQuery({
    queryKey: benchmarkKeys.amostrasPendentes(),
    queryFn: () =>
      fetchList<BenchmarkAmostra>(`${BASE}/benchmark/amostras/?revisao_pendente=1`),
  })
}

export function useAmostrasPorIngestao(ingestaoId: string) {
  return useQuery({
    queryKey: benchmarkKeys.amostras({ ingestao: ingestaoId }),
    queryFn: () =>
      fetchList<BenchmarkAmostra>(`${BASE}/benchmark/amostras/?ingestao=${ingestaoId}`),
    enabled: !!ingestaoId,
  })
}

export function useAceitarMatch(amostraId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (canonical_id: string) =>
      apiFetch<{ alias_criado: boolean }>(
        `${BASE}/benchmark/amostras/${amostraId}/aceitar-match/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canonical_id }),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: benchmarkKeys.amostrasPendentes() })
    },
  })
}

export function useDescartarAmostra(amostraId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (motivo: string) =>
      apiFetch<{ status: string }>(
        `${BASE}/benchmark/amostras/${amostraId}/descartar/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo }),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: benchmarkKeys.amostrasPendentes() })
    },
  })
}

// ─── Estatísticas ────────────────────────────────────────────────────────────

export function useBenchmarkEstatisticas(
  servicoId: string,
  segmento: string,
  tamanho: string
) {
  return useQuery({
    queryKey: benchmarkKeys.estatisticas(servicoId, segmento, tamanho),
    queryFn: () =>
      apiFetch<BenchmarkEstatisticas>(
        `${BASE}/benchmark/estatisticas/servico/${servicoId}/?segmento=${segmento}&tamanho=${tamanho}`
      ),
    enabled: !!servicoId,
  })
}

// ─── IA Composição ────────────────────────────────────────────────────────────

export const useSugerirComposicao = () =>
  useCreate<SugestaoIAResponse, SugestaoIACreatePayload>("pricing/ia/sugerir-composicao", {
    invalidateKey: benchmarkKeys.sugestoes(),
  })

export function useAvaliarSugestao(sugestaoId: string) {
  return useMutation({
    mutationFn: (data: {
      avaliacao: "util" | "parcial" | "ruim"
      servicos_aceitos_ids?: string[]
      pecas_aceitas_ids?: string[]
    }) =>
      apiFetch<{ status: string }>(`${BASE}/ia/${sugestaoId}/avaliar/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  })
}

export function useSugestoesIA() {
  return useQuery({
    queryKey: benchmarkKeys.sugestoes(),
    queryFn: () => fetchList<SugestaoIA>(`${BASE}/ia/`),
  })
}
