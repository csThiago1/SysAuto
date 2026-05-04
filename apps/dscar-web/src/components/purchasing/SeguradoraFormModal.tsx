"use client"

import { useState } from "react"
import type { TipoQualidade } from "@paddock/types"

interface SeguradoraFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    description: string
    tipo_qualidade: string
    unit_price: string
    quantity: string
  }) => void
}

const TIPO_QUALIDADE_OPTIONS: { value: TipoQualidade; label: string }[] = [
  { value: "genuina", label: "Genuina" },
  { value: "reposicao", label: "Reposicao" },
  { value: "similar", label: "Similar" },
  { value: "usada", label: "Usada" },
]

export function SeguradoraFormModal({ open, onClose, onSubmit }: SeguradoraFormModalProps) {
  const [description, setDescription] = useState("")
  const [tipoQualidade, setTipoQualidade] = useState<TipoQualidade>("genuina")
  const [unitPrice, setUnitPrice] = useState("")
  const [quantity, setQuantity] = useState("1")

  function handleReset() {
    setDescription("")
    setTipoQualidade("genuina")
    setUnitPrice("")
    setQuantity("1")
  }

  function handleClose() {
    handleReset()
    onClose()
  }

  function handleSubmit() {
    if (!description || !unitPrice) return
    onSubmit({
      description,
      tipo_qualidade: tipoQualidade,
      unit_price: unitPrice,
      quantity,
    })
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
        className="w-full max-w-lg rounded-lg border border-white/10 bg-[#0f0f0f] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2 className="text-lg font-semibold text-white">
          Peca de Fornecimento da Seguradora
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Registre a peca que a seguradora vai fornecer. Status ficara como
          &ldquo;Aguardando Recebimento&rdquo;.
        </p>

        {/* Fields */}
        <div className="mt-5 space-y-4">
          {/* Descricao */}
          <div>
            <label className="label-mono text-white/50 mb-0.5 block">
              Descricao *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Parachoque dianteiro, Farol esquerdo..."
              className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Tipo de peca + Valor cobrado */}
          <div className="grid grid-cols-2 gap-3">
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
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-md pl-9 pr-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
                />
              </div>
            </div>
          </div>

          {/* Quantidade */}
          <div className="w-24">
            <label className="label-mono text-white/50 mb-0.5 block">
              Quantidade
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-white/20"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!description || !unitPrice}
            className="rounded-md bg-purple-500 hover:bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Registrar
          </button>
        </div>
      </div>
    </div>
  )
}
