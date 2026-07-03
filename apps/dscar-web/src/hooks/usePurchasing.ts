/**
 * Paddock Solutions — dscar-web
 * Hooks TanStack Query v5 para o modulo de Compras (Purchasing).
 *
 * PedidoCompra, OrdemCompra, ItemOrdemCompra, DashboardComprasStats.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdicionarItemOCInput,
  DashboardComprasStats,
  DestinoEntrega,
  OrdemCompra,
  OrdemCompraDetail,
  SupplierWithContacts,
} from "@paddock/types"
import { apiFetch, fetchList } from "@/lib/api"
import { useCreate } from "@/lib/crud-mutations"
import type { ApiSchema } from "@/types"

// Gerados dos serializers Django (match 1:1 verificado).
export type AprovacaoCotacao = ApiSchema<"AprovacaoCotacao">
export type CondicaoPagamento = ApiSchema<"CondicaoPagamento">
export type CotacaoLog = ApiSchema<"CotacaoLog">
export type ItemOrdemCompra = ApiSchema<"ItemOrdemCompra">
export type PedidoCompra = ApiSchema<"PedidoCompra">
export type PrazoEntrega = ApiSchema<"PrazoEntrega">
export type RespostaCotacao = ApiSchema<"RespostaCotacao">

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

export const useCriarOC = () =>
  useCreate<OrdemCompra, { service_order: string }>(
    "purchasing/ordens-compra",
    { invalidateKey: purchasingKeys.ordensCompra() },
  )

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

export const useCreateOrdemCompra = () =>
  useCreate<OrdemCompra, { service_order: string; observacoes?: string }>(
    "purchasing/ordens-compra",
    { invalidateKey: purchasingKeys.all },
  )

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

/**
 * @deprecated /accounts-payable/suppliers/ retornou 410.
 * Agora delega para /persons?role=SUPPLIER e mapeia para o shape SupplierWithContacts.
 */
export function useSuppliersWithContacts() {
  return useQuery<SupplierWithContacts[]>({
    queryKey: [...purchasingKeys.all, "suppliers-contacts"],
    queryFn: async () => {
      type PersonItem = {
        id: string
        full_name: string
        documents?: Array<{ doc_type: string; value: string }>
        contacts?: Array<{
          id: number
          contact_type: string
          value: string
          label: string
          is_primary: boolean
        }>
      }
      const persons = await fetchList<PersonItem>(
        `/api/proxy/persons/?role=SUPPLIER&page_size=500`,
      )
      return persons.map<SupplierWithContacts>((p) => ({
        id: p.id,
        name: p.full_name,
        cnpj: p.documents?.find((d) => d.doc_type === "CNPJ")?.value ?? "",
        phone: p.contacts?.find((c) => c.contact_type === "CELULAR")?.value ?? "",
        email: p.contacts?.find((c) => c.contact_type === "EMAIL")?.value ?? "",
        contacts: (p.contacts ?? [])
          .filter((c) => c.contact_type === "CELULAR" || c.contact_type === "WHATSAPP")
          .map((c) => ({
            id: String(c.id),
            name: c.label || "Contato",
            phone: c.value,
            role: "",
            is_whatsapp: c.contact_type === "WHATSAPP",
          })),
      }))
    },
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

export const useRegistrarCotacao = () =>
  useCreate<
    CotacaoLog,
    {
      service_order: string
      supplier: string
      supplier_contact?: string | null
      mensagem: string
      pedido_ids: string[]
    }
  >("purchasing/cotacao-logs", { invalidateKey: purchasingKeys.all })

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

export const useRegistrarResposta = () =>
  useCreate<
    RespostaCotacao,
    {
      pedido_compra: string
      supplier: string
      valor_unitario: string
      prazo_entrega?: string
      prazo_entrega_obj?: string
      condicoes_pagamento?: string
      condicao_pagamento_obj?: string
      observacoes?: string
    }
  >("purchasing/respostas-cotacao", { invalidateKey: purchasingKeys.all })

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

export const useEnviarParaAprovacao = () =>
  useCreate<AprovacaoCotacao, { service_order: string; observacoes_comprador?: string }>(
    "purchasing/aprovacoes",
    { invalidateKey: purchasingKeys.all },
  )

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

export const useCreatePrazo = () =>
  useCreate<PrazoEntrega, { label: string; dias_uteis: number }>(
    "purchasing/prazos-entrega",
    { invalidateKey: [...purchasingKeys.all, "prazos-entrega"] },
  )

export const useCreateCondicao = () =>
  useCreate<CondicaoPagamento, { label: string }>(
    "purchasing/condicoes-pagamento",
    { invalidateKey: [...purchasingKeys.all, "condicoes-pagamento"] },
  )

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
