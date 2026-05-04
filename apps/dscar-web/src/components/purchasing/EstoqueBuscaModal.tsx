"use client"

import { useState } from "react"
import { useBuscarPecas } from "@/hooks/useServiceOrders"
import type { PecaEstoqueResult, TipoQualidade } from "@paddock/types"

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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg border border-white/10 bg-[#0f0f0f] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2 className="text-lg font-semibold text-white">Buscar no Estoque</h2>
        <p className="mt-1 text-sm text-white/60">
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
            className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex gap-2">
          <select
            value={tipoPeca}
            onChange={(e) => setTipoPeca(e.target.value)}
            className="bg-white/5 border border-white/10 text-white/60 rounded-md px-2 py-1.5 text-xs focus:outline-none"
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
            className="bg-white/5 border border-white/10 text-white/60 rounded-md px-2 py-1.5 text-xs focus:outline-none"
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
            <p className="text-sm text-white/40 py-4 text-center">Buscando...</p>
          )}

          {!isLoading && busca.length >= 2 && resultados?.length === 0 && (
            <p className="text-sm text-white/40 py-4 text-center">
              Nenhuma peca encontrada.
            </p>
          )}

          {busca.length < 2 && !selected && (
            <p className="text-sm text-white/40 py-4 text-center">
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
                    ? "border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">
                      {item.nome_interno}
                    </span>
                    <span className="ml-2 text-xs text-white/40 font-mono">
                      {item.sku_interno}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${
                      item.estoque_disponivel > 0
                        ? "bg-success-500/10 text-success-400 border border-success-500/20"
                        : "bg-white/5 text-white/30 border border-white/10"
                    }`}
                  >
                    {item.estoque_disponivel} disp.
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
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
          <div className="mt-4 rounded-md border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  {selected.nome_interno}
                </p>
                <p className="text-xs text-white/40 font-mono mt-0.5">
                  {selected.sku_interno}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-white/40 hover:text-white/60"
              >
                Trocar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  Valor cobrado ao cliente *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">
                    R$
                  </span>
                  <input
                    type="text"
                    value={valorCobrado}
                    onChange={(e) => setValorCobrado(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-white/20"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  Tipo de peca *
                </label>
                <select
                  value={tipoQualidade}
                  onChange={(e) =>
                    setTipoQualidade(e.target.value as TipoQualidade)
                  }
                  className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none"
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
                className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
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
              className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
