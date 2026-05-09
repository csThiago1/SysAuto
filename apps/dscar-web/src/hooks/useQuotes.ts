"use client";

/**
 * Paddock Solutions — useQuotes
 * Motor de Orçamentos MO-7: orçamentos, intervenções, itens adicionais.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AdicionarIntervencaoPayload,
  AdicionarItemAdicionalPayload,
  AprovarOrcamentoPayload,
  AprovarOrcamentoResponse,
  Orcamento,
  OrcamentoCreatePayload,
  OrcamentoIntervencao,
  OrcamentoItemAdicional,
  OrcamentoList,
} from "@paddock/types";
import { apiFetch, fetchList } from "@/lib/api";

const BASE = "/api/proxy/quotes";

// ── Query Keys ────────────────────────────────────────────────────────────────

export const quoteKeys = {
  all:    ["orcamentos"] as const,
  lists:  () => [...quoteKeys.all, "list"] as const,
  list:   (filters?: Record<string, string>) => [...quoteKeys.lists(), filters] as const,
  detail: (id: string) => [...quoteKeys.all, id] as const,
};

// ── Hooks de leitura ──────────────────────────────────────────────────────────

export function useOrcamentos(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters ?? {}).toString();
  return useQuery({
    queryKey: quoteKeys.list(filters),
    queryFn:  () => fetchList<OrcamentoList>(`${BASE}/orcamentos/${params ? "?" + params : ""}`),
  });
}

export function useOrcamento(id: string) {
  return useQuery({
    queryKey: quoteKeys.detail(id),
    queryFn:  () => apiFetch<Orcamento>(`${BASE}/orcamentos/${id}/`),
    enabled:  !!id,
  });
}

// ── Mutações de criação ───────────────────────────────────────────────────────

export function useCreateOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrcamentoCreatePayload) =>
      apiFetch<Orcamento>(`${BASE}/orcamentos/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: quoteKeys.lists() }),
  });
}

export function useAdicionarIntervencao(orcamentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdicionarIntervencaoPayload) =>
      apiFetch<OrcamentoIntervencao>(`${BASE}/orcamentos/${orcamentoId}/intervencoes/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: quoteKeys.detail(orcamentoId) }),
  });
}

export function useAdicionarItemAdicional(orcamentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdicionarItemAdicionalPayload) =>
      apiFetch<OrcamentoItemAdicional>(`${BASE}/orcamentos/${orcamentoId}/itens-adicionais/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: quoteKeys.detail(orcamentoId) }),
  });
}

// ── Mutações de fluxo ─────────────────────────────────────────────────────────

export function useEnviarOrcamento(orcamentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<Orcamento>(`${BASE}/orcamentos/${orcamentoId}/enviar/`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quoteKeys.detail(orcamentoId) });
      qc.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}

export function useRecusarOrcamento(orcamentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<Orcamento>(`${BASE}/orcamentos/${orcamentoId}/recusar/`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quoteKeys.detail(orcamentoId) });
      qc.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}

export function useAprovarOrcamento(orcamentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AprovarOrcamentoPayload) =>
      apiFetch<AprovarOrcamentoResponse>(`${BASE}/orcamentos/${orcamentoId}/aprovar/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quoteKeys.detail(orcamentoId) });
      qc.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}

export function useNovaVersaoOrcamento(orcamentoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<OrcamentoList>(`${BASE}/orcamentos/${orcamentoId}/nova-versao/`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: quoteKeys.lists() }),
  });
}
