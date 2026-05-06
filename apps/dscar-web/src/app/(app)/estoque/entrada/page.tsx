"use client"

import { useState, useRef, useEffect } from "react"
import { PackagePlus } from "lucide-react"
import { toast } from "sonner"
import { PosicaoSelector } from "@/components/inventory/PosicaoSelector"
import {
  useEntradaPeca,
  useEntradaLote,
} from "@/hooks/useInventoryMovement"
import { useProdutosPeca, useProdutosInsumo } from "@/hooks/useInventoryProduct"
import type { ProdutoComercialPeca, ProdutoComercialInsumo } from "@paddock/types"

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const UNIDADES_COMPRA = ["L", "KG", "UN", "M", "CX", "GL"] as const

const INPUT_CLS =
  "w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-muted-foreground"

/* ------------------------------------------------------------------ */
/*  Peça form state                                                    */
/* ------------------------------------------------------------------ */

interface PecaForm {
  produto_peca_id: string
  peca_canonica_id: string
  numero_serie: string
  valor_nf: string
  nivel_id: string | null
  motivo: string
}

const PECA_INITIAL: PecaForm = {
  produto_peca_id: "",
  peca_canonica_id: "",
  numero_serie: "",
  valor_nf: "",
  nivel_id: null,
  motivo: "",
}

/* ------------------------------------------------------------------ */
/*  Lote form state                                                    */
/* ------------------------------------------------------------------ */

interface LoteForm {
  produto_insumo_id: string
  material_canonico_id: string
  quantidade_compra: string
  unidade_compra: string
  fator_conversao: string
  valor_total_nf: string
  validade: string
  nivel_id: string | null
  motivo: string
}

const LOTE_INITIAL: LoteForm = {
  produto_insumo_id: "",
  material_canonico_id: "",
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

  /* ---- Search state ---------------------------------------------- */
  const [pecaSearch, setPecaSearch] = useState("")
  const [insumoSearch, setInsumoSearch] = useState("")
  const [pecaDropdownOpen, setPecaDropdownOpen] = useState(false)
  const [insumoDropdownOpen, setInsumoDropdownOpen] = useState(false)

  const pecaDropdownRef = useRef<HTMLDivElement>(null)
  const insumoDropdownRef = useRef<HTMLDivElement>(null)

  /* ---- Product queries ------------------------------------------- */
  const { data: produtosPeca = [] } = useProdutosPeca(
    pecaSearch.length >= 2 ? { busca: pecaSearch } : undefined
  )
  const { data: produtosInsumo = [] } = useProdutosInsumo(
    insumoSearch.length >= 2 ? { busca: insumoSearch } : undefined
  )

  /* ---- Mutations ------------------------------------------------- */
  const entradaPeca = useEntradaPeca()
  const entradaLote = useEntradaLote()
  const submitting = entradaPeca.isPending || entradaLote.isPending

  /* ---- Close dropdown on outside click --------------------------- */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pecaDropdownRef.current && !pecaDropdownRef.current.contains(e.target as Node)) {
        setPecaDropdownOpen(false)
      }
      if (insumoDropdownRef.current && !insumoDropdownRef.current.contains(e.target as Node)) {
        setInsumoDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  /* ---- Product selection handlers -------------------------------- */

  function handleSelectProdutoPeca(produto: ProdutoComercialPeca) {
    setPeca({
      ...peca,
      produto_peca_id: produto.id,
      peca_canonica_id: produto.peca_canonica || "",
    })
    setPecaSearch(produto.nome_interno)
    setPecaDropdownOpen(false)
  }

  function handleSelectProdutoInsumo(produto: ProdutoComercialInsumo) {
    setLote({
      ...lote,
      produto_insumo_id: produto.id,
      material_canonico_id: produto.material_canonico || "",
      unidade_compra: produto.unidade_base || lote.unidade_compra,
    })
    setInsumoSearch(produto.nome_interno)
    setInsumoDropdownOpen(false)
  }

  function clearPecaSelection() {
    setPeca({ ...peca, produto_peca_id: "", peca_canonica_id: "" })
    setPecaSearch("")
    setPecaDropdownOpen(false)
  }

  function clearInsumoSelection() {
    setLote({ ...lote, produto_insumo_id: "", material_canonico_id: "" })
    setInsumoSearch("")
    setInsumoDropdownOpen(false)
  }

  /* ---- Peca submit ---------------------------------------------- */

  async function handleSubmitPeca() {
    if (
      (!peca.produto_peca_id && !peca.peca_canonica_id) ||
      !peca.valor_nf ||
      !peca.nivel_id ||
      peca.motivo.length < 5
    ) {
      toast.error("Preencha todos os campos obrigatórios (motivo mín. 5 caracteres).")
      return
    }
    try {
      await entradaPeca.mutateAsync({
        peca_canonica_id: peca.peca_canonica_id || undefined,
        valor_nf: peca.valor_nf,
        nivel_id: peca.nivel_id,
        motivo: peca.motivo,
        produto_peca_id: peca.produto_peca_id || null,
        numero_serie: peca.numero_serie || undefined,
      })
      toast.success("Peça registrada com sucesso.")
      setPeca(PECA_INITIAL)
      setPecaSearch("")
    } catch {
      toast.error("Erro ao registrar entrada de peça. Tente novamente.")
    }
  }

  /* ---- Lote submit ---------------------------------------------- */

  async function handleSubmitLote() {
    if (
      (!lote.produto_insumo_id && !lote.material_canonico_id) ||
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
        material_canonico_id: lote.material_canonico_id || undefined,
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
      setInsumoSearch("")
    } catch {
      toast.error("Erro ao registrar entrada de lote. Tente novamente.")
    }
  }

  /* ---- Render --------------------------------------------------- */

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
            <PackagePlus className="h-5 w-5 text-primary-500" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Entrada Manual</h1>
            <p className="text-sm text-muted-foreground">
              Cadastrar peça ou lote sem NF-e
            </p>
          </div>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("peca")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "peca"
              ? "bg-primary-600 text-foreground"
              : "bg-muted/50 text-foreground/60 hover:text-foreground/80"
          }`}
        >
          Peça
        </button>
        <button
          type="button"
          onClick={() => setTab("lote")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "lote"
              ? "bg-primary-600 text-foreground"
              : "bg-muted/50 text-foreground/60 hover:text-foreground/80"
          }`}
        >
          Lote
        </button>
      </div>

      {/* ---- Peça Form ------------------------------------------- */}
      {tab === "peca" && (
        <div className="space-y-6">
          {/* IDENTIDADE */}
          <div className="bg-muted/50 border border-border rounded-lg p-5 space-y-4">
            <div className="section-divider">IDENTIDADE</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Product search select */}
              <div className="md:col-span-2" ref={pecaDropdownRef}>
                <label className="label-mono text-muted-foreground mb-0.5 block">PRODUTO *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={pecaSearch}
                    onChange={(e) => {
                      setPecaSearch(e.target.value)
                      setPecaDropdownOpen(true)
                      if (!e.target.value) {
                        clearPecaSelection()
                      }
                    }}
                    onFocus={() => {
                      if (pecaSearch.length >= 2 && !peca.produto_peca_id) {
                        setPecaDropdownOpen(true)
                      }
                    }}
                    placeholder="Buscar por nome ou SKU..."
                    className={INPUT_CLS}
                  />
                  {pecaDropdownOpen &&
                    pecaSearch.length >= 2 &&
                    produtosPeca.length > 0 &&
                    !peca.produto_peca_id && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                        {produtosPeca.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectProdutoPeca(p)}
                            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex justify-between items-center"
                          >
                            <span>{p.nome_interno}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {p.sku_interno}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
                {peca.produto_peca_id && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-success-400">Selecionado</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {peca.produto_peca_id.slice(0, 8)}...
                    </span>
                    <button
                      type="button"
                      onClick={clearPecaSelection}
                      className="text-xs text-error-400 hover:text-error-300"
                    >
                      Limpar
                    </button>
                  </div>
                )}
                {pecaSearch.length >= 2 &&
                  produtosPeca.length === 0 &&
                  !peca.produto_peca_id && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhum produto encontrado.
                    </p>
                  )}
              </div>

              {/* Serial number */}
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
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
          <div className="bg-muted/50 border border-border rounded-lg p-5 space-y-4">
            <div className="section-divider">VALOR</div>
            <div className="max-w-xs">
              <label className="label-mono text-muted-foreground mb-0.5 block">
                VALOR NF *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
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

          {/* LOCALIZAÇÃO */}
          <div className="bg-muted/50 border border-border rounded-lg p-5 space-y-4">
            <div className="section-divider">LOCALIZAÇÃO</div>
            <PosicaoSelector
              value={peca.nivel_id}
              onChange={(nivelId) => setPeca({ ...peca, nivel_id: nivelId })}
            />
          </div>

          {/* MOTIVO */}
          <div className="bg-muted/50 border border-border rounded-lg p-5 space-y-4">
            <div className="section-divider">MOTIVO</div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
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
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-medium rounded-md px-6 py-2.5 text-sm transition-colors"
          >
            {entradaPeca.isPending ? "Registrando..." : "Registrar Entrada"}
          </button>
        </div>
      )}

      {/* ---- Lote Form ------------------------------------------- */}
      {tab === "lote" && (
        <div className="space-y-6">
          {/* IDENTIDADE */}
          <div className="bg-muted/50 border border-border rounded-lg p-5 space-y-4">
            <div className="section-divider">IDENTIDADE</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product search select */}
              <div className="md:col-span-2" ref={insumoDropdownRef}>
                <label className="label-mono text-muted-foreground mb-0.5 block">PRODUTO *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={insumoSearch}
                    onChange={(e) => {
                      setInsumoSearch(e.target.value)
                      setInsumoDropdownOpen(true)
                      if (!e.target.value) {
                        clearInsumoSelection()
                      }
                    }}
                    onFocus={() => {
                      if (insumoSearch.length >= 2 && !lote.produto_insumo_id) {
                        setInsumoDropdownOpen(true)
                      }
                    }}
                    placeholder="Buscar por nome ou SKU..."
                    className={INPUT_CLS}
                  />
                  {insumoDropdownOpen &&
                    insumoSearch.length >= 2 &&
                    produtosInsumo.length > 0 &&
                    !lote.produto_insumo_id && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                        {produtosInsumo.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectProdutoInsumo(p)}
                            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex justify-between items-center"
                          >
                            <span>{p.nome_interno}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {p.sku_interno}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
                {lote.produto_insumo_id && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-success-400">Selecionado</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {lote.produto_insumo_id.slice(0, 8)}...
                    </span>
                    <button
                      type="button"
                      onClick={clearInsumoSelection}
                      className="text-xs text-error-400 hover:text-error-300"
                    >
                      Limpar
                    </button>
                  </div>
                )}
                {insumoSearch.length >= 2 &&
                  produtosInsumo.length === 0 &&
                  !lote.produto_insumo_id && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhum produto encontrado.
                    </p>
                  )}
              </div>
            </div>
          </div>

          {/* QUANTIDADES */}
          <div className="bg-muted/50 border border-border rounded-lg p-5 space-y-4">
            <div className="section-divider">QUANTIDADES</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
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
                <label className="label-mono text-muted-foreground mb-0.5 block">
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
                <label className="label-mono text-muted-foreground mb-0.5 block">
                  FATOR DE CONVERSÃO *
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
                <label className="label-mono text-muted-foreground mb-0.5 block">
                  VALOR TOTAL NF *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
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
              <label className="label-mono text-muted-foreground mb-0.5 block">
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

          {/* LOCALIZAÇÃO */}
          <div className="bg-muted/50 border border-border rounded-lg p-5 space-y-4">
            <div className="section-divider">LOCALIZAÇÃO</div>
            <PosicaoSelector
              value={lote.nivel_id}
              onChange={(nivelId) => setLote({ ...lote, nivel_id: nivelId })}
            />
          </div>

          {/* MOTIVO */}
          <div className="bg-muted/50 border border-border rounded-lg p-5 space-y-4">
            <div className="section-divider">MOTIVO</div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
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
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-medium rounded-md px-6 py-2.5 text-sm transition-colors"
          >
            {entradaLote.isPending ? "Registrando..." : "Registrar Entrada"}
          </button>
        </div>
      )}
    </div>
  )
}
