"use client"

import { useDeferredValue, useId, useState } from "react"
import { Loader2, Plus, ShoppingCart, Shield, Trash2, Warehouse } from "lucide-react"
import { toast } from "sonner"
import type { ServiceOrderStatus } from "@paddock/types"
import { formatCurrency } from "@paddock/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { StatusPecaBadge } from "@/components/purchasing/StatusPecaBadge"
import {
  useOSLaborCreate,
  useOSLaborDelete,
  useOSLaborItems,
  useServiceCatalog,
} from "@/hooks/useServiceCatalog"
import { useDeletePart, useOSParts } from "../../_hooks/useOSItems"
import { PartAddModals, type CompraPrefill, type PartAddMode } from "./PartsTab/PartAddModals"

/** Mesma trava da aba Serviços: OS pronta, entregue ou cancelada não muda o orçamento. */
const BLOCKED: ServiceOrderStatus[] = ["ready", "delivered", "cancelled"]

interface Linha {
  kind: "peca" | "servico"
  id: string
  description: string
  detail: string
  statusPeca?: string
  quantity: number
  total: number
  createdAt: string
}

interface PecaIn {
  id: string
  description: string
  origem: string
  origem_display: string
  status_peca: string
  quantity: string
  total: number | string
  created_at: string
}

interface ServicoIn {
  id: string
  description: string
  quantity: string
  total: number | string
  created_at: string
}

/** Junta peças e serviços na ordem em que entraram e soma cada grupo. */
export function montarOrcamento(
  pecas: PecaIn[],
  servicos: ServicoIn[],
): { linhas: Linha[]; totalPecas: number; totalServicos: number } {
  const linhas: Linha[] = [
    ...pecas.map((p) => ({
      kind: "peca" as const,
      id: p.id,
      description: p.description,
      detail: `Peça · ${p.origem_display || p.origem}`,
      statusPeca: p.status_peca,
      quantity: Number(p.quantity),
      total: Number(p.total),
      createdAt: p.created_at,
    })),
    ...servicos.map((l) => ({
      kind: "servico" as const,
      id: l.id,
      description: l.description,
      detail: "Serviço",
      quantity: Number(l.quantity),
      total: Number(l.total),
      createdAt: l.created_at,
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const soma = (k: Linha["kind"]) => linhas.filter((l) => l.kind === k).reduce((s, l) => s + l.total, 0)
  return { linhas, totalPecas: soma("peca"), totalServicos: soma("servico") }
}

interface OrcamentoTabProps {
  osId: string
  osStatus: ServiceOrderStatus
}

/**
 * Orçamento da OS numa lista só: peças e serviços juntos, um campo para
 * adicionar qualquer um dos dois e o total sempre no topo.
 * Margem, custo e reserva de estoque continuam nas vistas Peças/Serviços/Estoque.
 */
export function OrcamentoTab({ osId, osStatus }: OrcamentoTabProps): React.ReactElement {
  const blocked = BLOCKED.includes(osStatus)
  const inputId = useId()
  const [texto, setTexto] = useState("")
  const [avulso, setAvulso] = useState(false)
  const [preco, setPreco] = useState("")
  const [addMode, setAddMode] = useState<PartAddMode>(null)
  const [compraPrefill, setCompraPrefill] = useState<CompraPrefill | undefined>()
  const [remover, setRemover] = useState<Linha | null>(null)

  const termo = useDeferredValue(texto.trim())
  const parts = useOSParts(osId)
  const labor = useOSLaborItems(osId)
  const catalogo = useServiceCatalog(termo.length >= 2 ? { search: termo } : undefined)
  const addLabor = useOSLaborCreate(osId)
  const delLabor = useOSLaborDelete(osId)
  const delPart = useDeletePart(osId)

  const { linhas, totalPecas, totalServicos } = montarOrcamento(parts.data ?? [], labor.data ?? [])
  const sugestoes = termo.length >= 2 ? (catalogo.data?.results ?? []).slice(0, 5) : []
  const precoValido = /^\d+([.,]\d{1,2})?$/.test(preco.trim())

  function limpar(): void {
    setTexto("")
    setAvulso(false)
    setPreco("")
  }

  async function adicionarServico(description: string, unitPrice: string, catalogId: string | null): Promise<void> {
    try {
      await addLabor.mutateAsync({
        description,
        quantity: "1",
        unit_price: unitPrice.replace(",", "."),
        discount: "0",
        service_catalog: catalogId,
      })
      toast.success(`Serviço adicionado: ${description}`)
      limpar()
    } catch {
      toast.error("Erro ao adicionar serviço. Tente de novo.")
    }
  }

  function abrirPeca(mode: Exclude<PartAddMode, null>): void {
    setCompraPrefill(mode === "compra" && texto.trim() ? { description: texto.trim() } : undefined)
    setAddMode(mode)
  }

  async function confirmarRemocao(linha: Linha): Promise<void> {
    try {
      if (linha.kind === "peca") await delPart.mutateAsync(linha.id)
      else await delLabor.mutateAsync(linha.id)
      toast.success(`${linha.kind === "peca" ? "Peça" : "Serviço"} removido.`)
    } catch {
      toast.error("Erro ao remover. Tente de novo.")
    }
  }

  const carregando = parts.isLoading || labor.isLoading
  const erro = parts.isError || labor.isError

  return (
    <div className="space-y-5">
      {/* Cabeçalho: título + total sempre à vista */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-border pb-3">
        <h2 className="font-cond text-[22px] font-bold uppercase leading-none">
          Orçamento
          <span className="ml-2 font-sans text-sm font-medium normal-case text-muted-foreground">
            {linhas.length} {linhas.length === 1 ? "item" : "itens"}
          </span>
        </h2>
        <p className="flex items-baseline gap-2">
          <span className="label-mono">Total</span>
          <span className="font-mono text-[30px] leading-none">{formatCurrency(totalPecas + totalServicos)}</span>
        </p>
      </div>

      {/* Um campo só para peça ou serviço */}
      {!blocked && (
        <div className="space-y-2">
          <label htmlFor={inputId} className="label-mono">
            Adicionar peça ou serviço
          </label>
          <div className="relative">
            <Plus className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id={inputId}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                setAvulso(false)
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") limpar()
                if (e.key === "Enter" && sugestoes[0]) {
                  e.preventDefault()
                  void adicionarServico(sugestoes[0].name, sugestoes[0].suggested_price, sugestoes[0].id)
                }
              }}
              placeholder="Ex.: lanterna, alinhamento"
              autoComplete="off"
              className="h-12 pl-10 text-base md:h-12 md:text-base"
            />
          </div>

          {texto.trim().length >= 2 && (
            <div className="divide-y divide-border rounded-md border border-border bg-card" aria-live="polite">
              {sugestoes.length > 0 && (
                <div className="p-2">
                  <p className="label-mono px-2 pb-1 pt-1">Serviços do catálogo · Enter adiciona o primeiro</p>
                  <ul>
                    {sugestoes.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          disabled={addLabor.isPending}
                          onClick={() => void adicionarServico(s.name, s.suggested_price, s.id)}
                          className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded px-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                        >
                          <span className="truncate">{s.name}</span>
                          <span className="font-mono text-[15px]">{formatCurrency(Number(s.suggested_price))}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2 p-3">
                {!avulso ? (
                  <Button type="button" variant="outline" size="sm" className="w-full justify-start" onClick={() => setAvulso(true)}>
                    Serviço avulso: “{texto.trim()}”
                  </Button>
                ) : (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (precoValido) void adicionarServico(texto.trim(), preco.trim(), null)
                    }}
                  >
                    <label htmlFor={`${inputId}-preco`} className="text-sm">
                      Valor de “{texto.trim()}”
                    </label>
                    <Input
                      id={`${inputId}-preco`}
                      value={preco}
                      onChange={(e) => setPreco(e.target.value)}
                      inputMode="decimal"
                      placeholder="0,00"
                      className="w-32 font-mono"
                      aria-invalid={preco !== "" && !precoValido ? true : undefined}
                    />
                    <Button type="submit" size="sm" disabled={!precoValido || addLabor.isPending}>
                      {addLabor.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Adicionar serviço
                    </Button>
                  </form>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button type="button" variant="outline" size="sm" className="justify-start" onClick={() => abrirPeca("compra")}>
                    <ShoppingCart className="h-4 w-4" />
                    Peça: comprar
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="justify-start" onClick={() => abrirPeca("estoque")}>
                    <Warehouse className="h-4 w-4" />
                    Peça: do estoque
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="justify-start" onClick={() => abrirPeca("seguradora")}>
                    <Shield className="h-4 w-4" />
                    Peça: seguradora fornece
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista única */}
      {carregando ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : erro ? (
        <p className="rounded-md border border-error-500/40 bg-error-500/10 px-3 py-3 text-sm text-error-300">
          Não foi possível carregar o orçamento. Recarregue a página.
        </p>
      ) : linhas.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum item ainda. Digite acima o nome da peça ou do serviço.
        </p>
      ) : (
        <div>
          <div className="hidden grid-cols-[minmax(0,1fr)_180px_56px_130px_44px] gap-3 border-b border-border px-2 pb-2 md:grid">
            <span className="label-mono">Item</span>
            <span className="label-mono">Tipo</span>
            <span className="label-mono text-right">Qtd</span>
            <span className="label-mono text-right">Valor</span>
            <span className="sr-only">Ações</span>
          </div>
          <ul>
            {linhas.map((l) => (
              <li
                key={`${l.kind}-${l.id}`}
                className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto_44px] items-center gap-x-3 border-b border-border px-2 py-2 md:grid-cols-[minmax(0,1fr)_180px_56px_130px_44px]"
              >
                <div className="min-w-0">
                  <p className="break-words text-[15px] font-medium">{l.description}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground md:hidden">
                    {l.detail}
                    {l.quantity !== 1 && <span>· {l.quantity}×</span>}
                  </p>
                  {l.statusPeca && <StatusPecaBadge status={l.statusPeca} className="mt-0.5" />}
                </div>
                <span className="hidden text-sm text-muted-foreground md:block">{l.detail}</span>
                <span className="hidden text-right font-mono text-[15px] md:block">{l.quantity}</span>
                <span className="text-right font-mono text-[16px]">{formatCurrency(l.total)}</span>
                {blocked ? (
                  <span />
                ) : (
                  <button
                    type="button"
                    onClick={() => setRemover(l)}
                    aria-label={`Remover ${l.description}`}
                    className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:bg-muted/60 hover:text-error-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 px-2 text-sm md:ml-auto md:w-80">
            <dt className="text-muted-foreground">Peças</dt>
            <dd className="text-right font-mono text-[15px]">{formatCurrency(totalPecas)}</dd>
            <dt className="text-muted-foreground">Serviços</dt>
            <dd className="text-right font-mono text-[15px]">{formatCurrency(totalServicos)}</dd>
            <dt className="mt-1 border-t border-border pt-2 font-semibold">Total</dt>
            <dd className="mt-1 border-t border-border pt-2 text-right font-mono text-[22px]">
              {formatCurrency(totalPecas + totalServicos)}
            </dd>
          </dl>
        </div>
      )}

      <PartAddModals
        orderId={osId}
        mode={addMode}
        compraPrefill={compraPrefill}
        onModeChange={(mode, prefill) => {
          setAddMode(mode)
          setCompraPrefill(prefill)
          if (mode === null) limpar()
        }}
      />

      <ConfirmDialog
        open={remover !== null}
        onOpenChange={(open) => {
          if (!open) setRemover(null)
        }}
        title={remover?.kind === "peca" ? "Remover peça" : "Remover serviço"}
        description={
          remover?.kind === "peca"
            ? `Remover “${remover.description}” da OS? Se veio do estoque, a unidade volta a ficar livre.`
            : `Remover “${remover?.description ?? ""}” da OS?`
        }
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => {
          if (remover) void confirmarRemocao(remover)
          setRemover(null)
        }}
      />
    </div>
  )
}
