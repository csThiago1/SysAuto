"use client"

import { useState } from "react"
import { PackagePlus } from "lucide-react"
import { toast } from "sonner"
import { PosicaoSelector } from "@/components/inventory/PosicaoSelector"
import {
  useEntradaPeca,
  useEntradaLote,
} from "@/hooks/useInventoryMovement"

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const UNIDADES_COMPRA = ["L", "KG", "UN", "M", "CX", "GL"] as const

const INPUT_CLS =
  "w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-white/30"

/* ------------------------------------------------------------------ */
/*  Peça form state                                                    */
/* ------------------------------------------------------------------ */

interface PecaForm {
  peca_canonica_id: string
  produto_peca_id: string
  numero_serie: string
  valor_nf: string
  nivel_id: string | null
  motivo: string
}

const PECA_INITIAL: PecaForm = {
  peca_canonica_id: "",
  produto_peca_id: "",
  numero_serie: "",
  valor_nf: "",
  nivel_id: null,
  motivo: "",
}

/* ------------------------------------------------------------------ */
/*  Lote form state                                                    */
/* ------------------------------------------------------------------ */

interface LoteForm {
  material_canonico_id: string
  produto_insumo_id: string
  quantidade_compra: string
  unidade_compra: string
  fator_conversao: string
  valor_total_nf: string
  validade: string
  nivel_id: string | null
  motivo: string
}

const LOTE_INITIAL: LoteForm = {
  material_canonico_id: "",
  produto_insumo_id: "",
  quantidade_compra: "",
  unidade_compra: "UN",
  fator_conversao: "1",
  valor_total_nf: "",
  validade: "",
  nivel_id: null,
  motivo: "",
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function EntradaManualPage() {
  const [tab, setTab] = useState<"peca" | "lote">("peca")
  const [peca, setPeca] = useState<PecaForm>(PECA_INITIAL)
  const [lote, setLote] = useState<LoteForm>(LOTE_INITIAL)

  const entradaPeca = useEntradaPeca()
  const entradaLote = useEntradaLote()

  const submitting = entradaPeca.isPending || entradaLote.isPending

  /* ---- Peca submit ------------------------------------------------ */

  async function handleSubmitPeca() {
    if (!peca.peca_canonica_id || !peca.valor_nf || !peca.nivel_id || peca.motivo.length < 5) {
      toast.error("Preencha todos os campos obrigatórios (motivo mín. 5 caracteres).")
      return
    }
    try {
      await entradaPeca.mutateAsync({
        peca_canonica_id: peca.peca_canonica_id,
        valor_nf: peca.valor_nf,
        nivel_id: peca.nivel_id,
        motivo: peca.motivo,
        produto_peca_id: peca.produto_peca_id || null,
        numero_serie: peca.numero_serie || undefined,
      })
      toast.success("Peça registrada com sucesso.")
      setPeca(PECA_INITIAL)
    } catch {
      toast.error("Erro ao registrar entrada de peça. Tente novamente.")
    }
  }

  /* ---- Lote submit ------------------------------------------------ */

  async function handleSubmitLote() {
    if (
      !lote.material_canonico_id ||
      !lote.quantidade_compra ||
      !lote.fator_conversao ||
      !lote.valor_total_nf ||
      !lote.nivel_id ||
      lote.motivo.length < 5
    ) {
      toast.error("Preencha todos os campos obrigatórios (motivo mín. 5 caracteres).")
      return
    }
    try {
      await entradaLote.mutateAsync({
        material_canonico_id: lote.material_canonico_id,
        quantidade_compra: lote.quantidade_compra,
        unidade_compra: lote.unidade_compra,
        fator_conversao: lote.fator_conversao,
        valor_total_nf: lote.valor_total_nf,
        nivel_id: lote.nivel_id,
        motivo: lote.motivo,
        produto_insumo_id: lote.produto_insumo_id || null,
        validade: lote.validade || null,
      })
      toast.success("Lote registrado com sucesso.")
      setLote(LOTE_INITIAL)
    } catch {
      toast.error("Erro ao registrar entrada de lote. Tente novamente.")
    }
  }

  /* ---- Render ----------------------------------------------------- */

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06]">
            <PackagePlus className="h-5 w-5 text-primary-500" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Entrada Manual</h1>
            <p className="text-sm text-white/50">
              Cadastrar peca ou lote sem NF-e
            </p>
          </div>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 rounded-lg bg-white/5 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("peca")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "peca"
              ? "bg-primary-600 text-white"
              : "bg-white/5 text-white/60 hover:text-white/80"
          }`}
        >
          Peca
        </button>
        <button
          type="button"
          onClick={() => setTab("lote")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "lote"
              ? "bg-primary-600 text-white"
              : "bg-white/5 text-white/60 hover:text-white/80"
          }`}
        >
          Lote
        </button>
      </div>

      {/* ---- Peca Form --------------------------------------------- */}
      {tab === "peca" && (
        <div className="space-y-6">
          {/* IDENTIDADE */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-4">
            <div className="section-divider">IDENTIDADE</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  ID PECA CANONICA *
                </label>
                <input
                  type="text"
                  value={peca.peca_canonica_id}
                  onChange={(e) => setPeca({ ...peca, peca_canonica_id: e.target.value })}
                  placeholder="UUID"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  ID PRODUTO COMERCIAL (OPCIONAL)
                </label>
                <input
                  type="text"
                  value={peca.produto_peca_id}
                  onChange={(e) => setPeca({ ...peca, produto_peca_id: e.target.value })}
                  placeholder="UUID"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  NUMERO DE SERIE (OPCIONAL)
                </label>
                <input
                  type="text"
                  value={peca.numero_serie}
                  onChange={(e) => setPeca({ ...peca, numero_serie: e.target.value })}
                  placeholder="S/N"
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>

          {/* VALOR */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-4">
            <div className="section-divider">VALOR</div>
            <div className="max-w-xs">
              <label className="label-mono text-white/50 mb-0.5 block">
                VALOR NF *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={peca.valor_nf}
                  onChange={(e) => setPeca({ ...peca, valor_nf: e.target.value })}
                  placeholder="0,00"
                  className={`${INPUT_CLS} pl-9`}
                />
              </div>
            </div>
          </div>

          {/* LOCALIZACAO */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-4">
            <div className="section-divider">LOCALIZACAO</div>
            <PosicaoSelector
              value={peca.nivel_id}
              onChange={(nivelId) => setPeca({ ...peca, nivel_id: nivelId })}
            />
          </div>

          {/* MOTIVO */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-4">
            <div className="section-divider">MOTIVO</div>
            <div>
              <label className="label-mono text-white/50 mb-0.5 block">
                MOTIVO DA ENTRADA *
              </label>
              <textarea
                rows={3}
                value={peca.motivo}
                onChange={(e) => setPeca({ ...peca, motivo: e.target.value })}
                placeholder="Descreva o motivo da entrada manual (min. 5 caracteres)"
                className={`${INPUT_CLS} resize-none`}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmitPeca}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md px-6 py-2.5 text-sm transition-colors"
          >
            {entradaPeca.isPending ? "Registrando..." : "Registrar Entrada"}
          </button>
        </div>
      )}

      {/* ---- Lote Form --------------------------------------------- */}
      {tab === "lote" && (
        <div className="space-y-6">
          {/* IDENTIDADE */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-4">
            <div className="section-divider">IDENTIDADE</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  ID MATERIAL CANONICO *
                </label>
                <input
                  type="text"
                  value={lote.material_canonico_id}
                  onChange={(e) => setLote({ ...lote, material_canonico_id: e.target.value })}
                  placeholder="UUID"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  ID PRODUTO INSUMO (OPCIONAL)
                </label>
                <input
                  type="text"
                  value={lote.produto_insumo_id}
                  onChange={(e) => setLote({ ...lote, produto_insumo_id: e.target.value })}
                  placeholder="UUID"
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>

          {/* QUANTIDADES */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-4">
            <div className="section-divider">QUANTIDADES</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  QUANTIDADE COMPRA *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={lote.quantidade_compra}
                  onChange={(e) => setLote({ ...lote, quantidade_compra: e.target.value })}
                  placeholder="0"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  UNIDADE DE COMPRA *
                </label>
                <select
                  value={lote.unidade_compra}
                  onChange={(e) => setLote({ ...lote, unidade_compra: e.target.value })}
                  className={INPUT_CLS}
                >
                  {UNIDADES_COMPRA.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  FATOR DE CONVERSAO *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={lote.fator_conversao}
                  onChange={(e) => setLote({ ...lote, fator_conversao: e.target.value })}
                  placeholder="1"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  VALOR TOTAL NF *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={lote.valor_total_nf}
                    onChange={(e) => setLote({ ...lote, valor_total_nf: e.target.value })}
                    placeholder="0,00"
                    className={`${INPUT_CLS} pl-9`}
                  />
                </div>
              </div>
            </div>
            <div className="max-w-xs">
              <label className="label-mono text-white/50 mb-0.5 block">
                VALIDADE (OPCIONAL)
              </label>
              <input
                type="date"
                value={lote.validade}
                onChange={(e) => setLote({ ...lote, validade: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* LOCALIZACAO */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-4">
            <div className="section-divider">LOCALIZACAO</div>
            <PosicaoSelector
              value={lote.nivel_id}
              onChange={(nivelId) => setLote({ ...lote, nivel_id: nivelId })}
            />
          </div>

          {/* MOTIVO */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-4">
            <div className="section-divider">MOTIVO</div>
            <div>
              <label className="label-mono text-white/50 mb-0.5 block">
                MOTIVO DA ENTRADA *
              </label>
              <textarea
                rows={3}
                value={lote.motivo}
                onChange={(e) => setLote({ ...lote, motivo: e.target.value })}
                placeholder="Descreva o motivo da entrada manual (min. 5 caracteres)"
                className={`${INPUT_CLS} resize-none`}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmitLote}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md px-6 py-2.5 text-sm transition-colors"
          >
            {entradaLote.isPending ? "Registrando..." : "Registrar Entrada"}
          </button>
        </div>
      )}
    </div>
  )
}
