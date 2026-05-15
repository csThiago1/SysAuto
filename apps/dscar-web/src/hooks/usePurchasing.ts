/**
 * Paddock Solutions — dscar-web
 * Hooks TanStack Query v5 para o modulo de Compras (Purchasing).
 *
 * PedidoCompra, OrdemCompra, ItemOrdemCompra, DashboardComprasStats.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdicionarItemOCInput,
  AprovacaoCotacao,
  CondicaoPagamento,
  CotacaoLog,
  DashboardComprasStats,
  DestinoEntrega,
  ItemOrdemCompra,
  OrdemCompra,
  OrdemCompraDetail,
  PedidoCompra,
  PrazoEntrega,
  RespostaCotacao,
  SupplierWithContacts,
} from "@paddock/types"
import { apiFetch, fetchList } from "@/lib/api"

const PURCHASING = "/api/proxy/purchasing"

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const purchasingKeys = {
  all: ["purchasing"] as const,
  pedidos: (params?: Record<string, string>) => [...purchasingKeys.all, "pedidos", params] as const,
  ordensCompra: () => [...purchasingKeys.all, "ordens-compra"] as const,
  ordemCompra: (id: string) => [...purchasingKeys.all, "ordem-compra", id] as const,
  dashboard: () => [...purchasingKeys.all, "dashboard"] as const,
}

// ─── Pedidos de Compra ────────────────────────────────────────────────────────

export function usePedidosCompra(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : ""
  return useQuery<PedidoCompra[]>({
    queryKey: purchasingKeys.pedidos(params),
    queryFn: () => fetchList<PedidoCompra>(`${PURCHASING}/pedidos/${qs ? `?${qs}` : ""}`),
  })
}

export function useIniciarCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<PedidoCompra>(`${PURCHASING}/pedidos/${id}/iniciar-cotacao/`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useCancelarPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<PedidoCompra>(`${PURCHASING}/pedidos/${id}/cancelar/`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

// ─── Ordens de Compra ─────────────────────────────────────────────────────────

export function useOrdensCompra() {
  return useQuery<OrdemCompra[]>({
    queryKey: purchasingKeys.ordensCompra(),
    queryFn: () => fetchList<OrdemCompra>(`${PURCHASING}/ordens-compra/`),
  })
}

export function useOrdemCompra(id: string) {
  return useQuery<OrdemCompraDetail>({
    queryKey: purchasingKeys.ordemCompra(id),
    queryFn: () => apiFetch<OrdemCompraDetail>(`${PURCHASING}/ordens-compra/${id}/`),
    enabled: !!id,
  })
}

export function useCriarOC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { service_order: string }) =>
      apiFetch<OrdemCompra>(`${PURCHASING}/ordens-compra/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.ordensCompra() })
    },
  })
}

export function useAdicionarItemOC(ocId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AdicionarItemOCInput) =>
      apiFetch<ItemOrdemCompra>(`${PURCHASING}/ordens-compra/${ocId}/itens/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.ordemCompra(ocId) })
    },
  })
}

export function useRemoverItemOC(ocId: string, itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`${PURCHASING}/ordens-compra/${ocId}/itens/${itemId}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.ordemCompra(ocId) })
    },
  })
}

export function useEnviarOC(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<OrdemCompra>(`${PURCHASING}/ordens-compra/${id}/enviar/`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useAprovarOC(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<OrdemCompra>(`${PURCHASING}/ordens-compra/${id}/aprovar/`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useRejeitarOC(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { motivo: string }) =>
      apiFetch<OrdemCompra>(`${PURCHASING}/ordens-compra/${id}/rejeitar/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useRegistrarRecebimento(ocId: string, itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<ItemOrdemCompra>(
        `${PURCHASING}/ordens-compra/${ocId}/itens/${itemId}/receber/`,
        { method: "POST" }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.ordemCompra(ocId) })
      void qc.invalidateQueries({ queryKey: purchasingKeys.pedidos() })
    },
  })
}

// ─── Montar OC (Quotation Builder flow) ──────────────────────────────────────

export function useCreateOrdemCompra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { service_order: string; observacoes?: string }) =>
      apiFetch<OrdemCompra>(`${PURCHASING}/ordens-compra/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useAddItemOC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      ocId,
      ...data
    }: {
      ocId: string
      pedido_compra_id: string
      fornecedor_nome: string
      fornecedor_cnpj?: string
      fornecedor_contato?: string
      descricao: string
      codigo_referencia?: string
      tipo_qualidade: string
      quantidade: string
      valor_unitario: string
      prazo_entrega?: string
      observacoes?: string
    }) =>
      apiFetch<ItemOrdemCompra>(`${PURCHASING}/ordens-compra/${ocId}/itens/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useOrdensCompraByOS(osId: string | undefined) {
  return useQuery<OrdemCompra[]>({
    queryKey: [...purchasingKeys.all, "ordens-by-os", osId],
    queryFn: () =>
      fetchList<OrdemCompra>(
        `${PURCHASING}/ordens-compra/?service_order=${osId}&status=rascunho`,
      ),
    enabled: !!osId,
  })
}

// ─── Suppliers with contacts ──────────────────────────────────────────────────

export function useSuppliersWithContacts() {
  return useQuery<SupplierWithContacts[]>({
    queryKey: [...purchasingKeys.all, "suppliers-contacts"],
    queryFn: () => fetchList<SupplierWithContacts>(`/api/proxy/accounts-payable/suppliers/`),
    staleTime: 5 * 60_000,
  })
}

// ─── Cotacao Logs ─────────────────────────────────────────────────────────────

export function useCotacaoLogs(serviceOrderId: string | undefined) {
  return useQuery<CotacaoLog[]>({
    queryKey: [...purchasingKeys.all, "cotacao-logs", serviceOrderId],
    queryFn: () =>
      fetchList<CotacaoLog>(`${PURCHASING}/cotacao-logs/?service_order=${serviceOrderId}`),
    enabled: !!serviceOrderId,
  })
}

export function useRegistrarCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      service_order: string
      supplier: string
      supplier_contact?: string | null
      mensagem: string
      pedido_ids: string[]
    }) =>
      apiFetch<CotacaoLog>(`${PURCHASING}/cotacao-logs/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

// ─── Respostas Cotacao ────────────────────────────────────────────────────────

export function useRespostasCotacao(serviceOrderId: string | undefined) {
  return useQuery<RespostaCotacao[]>({
    queryKey: [...purchasingKeys.all, "respostas", serviceOrderId],
    queryFn: () =>
      fetchList<RespostaCotacao>(
        `${PURCHASING}/respostas-cotacao/?service_order=${serviceOrderId}`,
      ),
    enabled: !!serviceOrderId,
  })
}

export function useRegistrarResposta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      pedido_compra: string
      supplier: string
      valor_unitario: string
      prazo_entrega?: string
      condicoes_pagamento?: string
      observacoes?: string
    }) =>
      apiFetch<RespostaCotacao>(`${PURCHASING}/respostas-cotacao/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useSelecionarResposta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (respostaId: string) =>
      apiFetch<RespostaCotacao>(
        `${PURCHASING}/respostas-cotacao/${respostaId}/selecionar/`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

// ─── Aprovacoes Cotacao ───────────────────────────────────────────────────────

export function useAprovacoes(statusFilter?: string) {
  const qs = statusFilter ? `?status=${statusFilter}` : ""
  return useQuery<AprovacaoCotacao[]>({
    queryKey: [...purchasingKeys.all, "aprovacoes", statusFilter],
    queryFn: () => fetchList<AprovacaoCotacao>(`${PURCHASING}/aprovacoes/${qs}`),
  })
}

export function useAprovacao(id: string) {
  return useQuery<AprovacaoCotacao>({
    queryKey: [...purchasingKeys.all, "aprovacao", id],
    queryFn: () => apiFetch<AprovacaoCotacao>(`${PURCHASING}/aprovacoes/${id}/`),
    enabled: !!id,
  })
}

export function useEnviarParaAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { service_order: string; observacoes_comprador?: string }) =>
      apiFetch<AprovacaoCotacao>(`${PURCHASING}/aprovacoes/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useAprovarCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
      selecoes: { pedido_compra_id: string; resposta_cotacao_id: string }[]
      observacoes_financeiro?: string
    }) =>
      apiFetch<{ detail: string; ordens_compra: { id: string; numero: string }[] }>(
        `${PURCHASING}/aprovacoes/${id}/aprovar/`,
        { method: "POST", body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useRejeitarCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo_rejeicao }: { id: string; motivo_rejeicao?: string }) =>
      apiFetch<AprovacaoCotacao>(`${PURCHASING}/aprovacoes/${id}/rejeitar/`, {
        method: "POST",
        body: JSON.stringify({ motivo_rejeicao }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

// ─── Prazos de Entrega e Condições de Pagamento ───────────────────────────────

export function usePrazosEntrega() {
  return useQuery<PrazoEntrega[]>({
    queryKey: [...purchasingKeys.all, "prazos-entrega"],
    queryFn: () => fetchList<PrazoEntrega>(`${PURCHASING}/prazos-entrega/`),
    staleTime: 30 * 60_000,
  })
}

export function useCondicoesPagamento() {
  return useQuery<CondicaoPagamento[]>({
    queryKey: [...purchasingKeys.all, "condicoes-pagamento"],
    queryFn: () => fetchList<CondicaoPagamento>(`${PURCHASING}/condicoes-pagamento/`),
    staleTime: 30 * 60_000,
  })
}

export function useCreatePrazo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { label: string; dias_uteis: number }) =>
      apiFetch<PrazoEntrega>(`${PURCHASING}/prazos-entrega/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...purchasingKeys.all, "prazos-entrega"] })
    },
  })
}

export function useCreateCondicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { label: string }) =>
      apiFetch<CondicaoPagamento>(`${PURCHASING}/condicoes-pagamento/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...purchasingKeys.all, "condicoes-pagamento"] })
    },
  })
}

export interface ReceberItemResult {
  detail: string
  unidade_fisica_id: string
  codigo_barras: string
  status_entrega: string
  destino: string
  data_recebimento: string
}

export function useReceberItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      ocId,
      itemId,
      ...data
    }: {
      ocId: string
      itemId: string
      nivel_id: string
      valor_nf: string
      destino: DestinoEntrega
      numero_serie?: string
      nfe_entrada_id?: string
    }) =>
      apiFetch<ReceberItemResult>(
        `${PURCHASING}/ordens-compra/${ocId}/itens/${itemId}/receber/`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

// ─── Inventory — Niveis (warehouse locations) ─────────────────────────────────

export interface NivelOption {
  id: string
  endereco_completo: string
}

export function useNiveis() {
  return useQuery<NivelOption[]>({
    queryKey: ["inventory", "niveis"],
    queryFn: () => fetchList<NivelOption>(`/api/proxy/inventory/niveis/`),
    staleTime: 10 * 60_000,
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useDashboardCompras() {
  return useQuery<DashboardComprasStats>({
    queryKey: purchasingKeys.dashboard(),
    queryFn: () => apiFetch<DashboardComprasStats>(`${PURCHASING}/dashboard-stats/`),
  })
}
