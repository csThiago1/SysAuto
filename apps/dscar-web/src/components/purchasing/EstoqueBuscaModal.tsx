"use client"

import { useState } from "react"
import { useBuscarPecas } from "@/hooks/useServiceOrders"
import type { PecaEstoqueResult, TipoQualidade } from "@paddock/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface EstoqueBuscaModalProps {
  open: boolean
  onClose: () => void
  osId: string
  onSelect: (data: {
    unidade_fisica_id: string
    tipo_qualidade: string
    unit_price: string
    description: string
  }) => void
}

const TIPO_QUALIDADE_OPTIONS: { value: TipoQualidade; label: string }[] = [
  { value: "genuina", label: "Genuina" },
  { value: "reposicao", label: "Reposicao" },
  { value: "similar", label: "Similar" },
  { value: "usada", label: "Usada" },
]

export function EstoqueBuscaModal({ open, onClose, onSelect }: EstoqueBuscaModalProps) {
  const [busca, setBusca] = useState("")
  const [tipoPeca, setTipoPeca] = useState("")
  const [categoria, setCategoria] = useState("")

  // Selection state
  const [selected, setSelected] = useState<PecaEstoqueResult | null>(null)
  const [valorCobrado, setValorCobrado] = useState("")
  const [tipoQualidade, setTipoQualidade] = useState<TipoQualidade>("genuina")

  const params: Record<string, string> = {}
  if (busca.length >= 2) params.busca = busca
  if (tipoPeca) params.tipo_peca = tipoPeca
  if (categoria) params.categoria = categoria

  const { data: resultados, isLoading } = useBuscarPecas(
    busca.length >= 2 ? params : undefined,
  )

  function handleSelect(item: PecaEstoqueResult) {
    if (item.estoque_disponivel === 0) return
    setSelected(item)
    setValorCobrado(item.preco_venda_sugerido ?? "")
  }

  function handleConfirm() {
    if (!selected || !valorCobrado) return
    onSelect({
      unidade_fisica_id: selected.id,
      tipo_qualidade: tipoQualidade,
      unit_price: valorCobrado,
      description: selected.nome_interno,
    })
    handleReset()
    onClose()
  }

  function handleReset() {
    setBusca("")
    setTipoPeca("")
    setCategoria("")
    setSelected(null)
    setValorCobrado("")
    setTipoQualidade("genuina")
  }

  function handleClose() {
    handleReset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar no Estoque</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground/60">
          Encontre a peca no estoque e bloqueie para esta OS.
        </p>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Buscar por nome, SKU, codigo fabricante..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setSelected(null)
            }}
            className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border"
          />
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex gap-2">
          <select
            value={tipoPeca}
            onChange={(e) => setTipoPeca(e.target.value)}
            className="bg-muted/50 border border-border text-foreground/60 rounded-md px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">Tipo de peca</option>
            <option value="genuina">Genuina</option>
            <option value="reposicao">Reposicao</option>
            <option value="similar">Similar</option>
            <option value="usada">Usada</option>
          </select>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="bg-muted/50 border border-border text-foreground/60 rounded-md px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="">Categoria</option>
            <option value="mecanica">Mecanica</option>
            <option value="eletrica">Eletrica</option>
            <option value="funilaria">Funilaria</option>
            <option value="pintura">Pintura</option>
          </select>
        </div>

        {/* Results */}
        <div className="mt-4 space-y-1">
          {isLoading && busca.length >= 2 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Buscando...</p>
          )}

          {!isLoading && busca.length >= 2 && resultados?.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma peca encontrada.
            </p>
          )}

          {busca.length < 2 && !selected && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Digite pelo menos 2 caracteres para buscar.
            </p>
          )}

          {!selected &&
            resultados?.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                disabled={item.estoque_disponivel === 0}
                className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors ${
                  item.estoque_disponivel === 0
                    ? "border-border bg-muted/30 opacity-40 cursor-not-allowed"
                    : "border-border bg-muted/30 hover:bg-muted/50 cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {item.nome_interno}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">
                      {item.sku_interno}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${
                      item.estoque_disponivel > 0
                        ? "bg-success-500/10 text-success-400 border border-success-500/20"
                        : "bg-muted/50 text-muted-foreground border border-border"
                    }`}
                  >
                    {item.estoque_disponivel} disp.
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{item.tipo_peca_nome}</span>
                  {item.posicao && (
                    <span className="font-mono">{item.posicao}</span>
                  )}
                </div>
              </button>
            ))}
        </div>

        {/* Selection panel */}
        {selected && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {selected.nome_interno}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {selected.sku_interno}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-muted-foreground hover:text-foreground/60"
              >
                Trocar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
                  Valor cobrado ao cliente *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$
                  </span>
                  <input
                    type="text"
                    value={valorCobrado}
                    onChange={(e) => setValorCobrado(e.target.value)}
                    className="w-full bg-muted/50 border border-border text-foreground rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-border"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
                  Tipo de peca *
                </label>
                <select
                  value={tipoQualidade}
                  onChange={(e) =>
                    setTipoQualidade(e.target.value as TipoQualidade)
                  }
                  className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none"
                >
                  {TIPO_QUALIDADE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!valorCobrado}
                className="rounded-md bg-success-500 hover:bg-success-600 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Bloquear e Adicionar
              </button>
            </div>
          </div>
        )}

        {/* Close button when no selection */}
        {!selected && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
