"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { ProdutoComercialPeca, PosicaoVeiculo, LadoPeca } from "@paddock/types"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  useTiposPeca,
  useCategoriasProduto,
  useProdutoPecaCreate,
  useProdutoPecaUpdate,
} from "@/hooks/useInventoryProduct"

// ─── Constants ────────────────────────────────────────────────────────────────

const POSICAO_OPTIONS: { value: PosicaoVeiculo; label: string }[] = [
  { value: "dianteiro", label: "Dianteiro" },
  { value: "traseiro", label: "Traseiro" },
  { value: "lateral_esq", label: "Lateral Esquerdo" },
  { value: "lateral_dir", label: "Lateral Direito" },
  { value: "superior", label: "Superior" },
  { value: "inferior", label: "Inferior" },
  { value: "na", label: "N/A" },
]

const LADO_OPTIONS: { value: LadoPeca; label: string }[] = [
  { value: "esquerdo", label: "Esquerdo" },
  { value: "direito", label: "Direito" },
  { value: "central", label: "Central" },
  { value: "na", label: "N/A" },
]

const INPUT_CLS =
  "w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary-500"

// ─── Component ────────────────────────────────────────────────────────────────

interface ProdutoPecaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto?: ProdutoComercialPeca | null
}

interface FormState {
  sku_interno: string
  nome_interno: string
  codigo_fabricante: string
  codigo_ean: string
  codigo_distribuidor: string
  nome_fabricante: string
  tipo_peca: string
  posicao_veiculo: PosicaoVeiculo
  lado: LadoPeca
  categoria: string
  preco_venda_sugerido: string
  margem_padrao_pct: string
  observacoes: string
}

const EMPTY: FormState = {
  sku_interno: "",
  nome_interno: "",
  codigo_fabricante: "",
  codigo_ean: "",
  codigo_distribuidor: "",
  nome_fabricante: "",
  tipo_peca: "",
  posicao_veiculo: "na",
  lado: "na",
  categoria: "",
  preco_venda_sugerido: "",
  margem_padrao_pct: "",
  observacoes: "",
}

export function ProdutoPecaDialog({
  open,
  onOpenChange,
  produto,
}: ProdutoPecaDialogProps) {
  const isEdit = !!produto
  const { data: tipos = [] } = useTiposPeca()
  const { data: categorias = [] } = useCategoriasProduto()
  const createMut = useProdutoPecaCreate()
  const updateMut = useProdutoPecaUpdate(produto?.id ?? "")

  const [form, setForm] = useState<FormState>(EMPTY)

  useEffect(() => {
    if (open) {
      if (produto) {
        setForm({
          sku_interno: produto.sku_interno,
          nome_interno: produto.nome_interno,
          codigo_fabricante: produto.codigo_fabricante,
          codigo_ean: produto.codigo_ean,
          codigo_distribuidor: produto.codigo_distribuidor,
          nome_fabricante: produto.nome_fabricante,
          tipo_peca: produto.tipo_peca ?? "",
          posicao_veiculo: produto.posicao_veiculo,
          lado: produto.lado,
          categoria: produto.categoria ?? "",
          preco_venda_sugerido: produto.preco_venda_sugerido ?? "",
          margem_padrao_pct: produto.margem_padrao_pct ?? "",
          observacoes: produto.observacoes,
        })
      } else {
        setForm(EMPTY)
      }
    }
  }, [open, produto])

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.nome_interno.trim()) {
      toast.error("Nome interno obrigatorio.")
      return
    }
    const payload: Record<string, unknown> = {
      nome_interno: form.nome_interno.trim(),
      codigo_fabricante: form.codigo_fabricante.trim(),
      codigo_ean: form.codigo_ean.trim(),
      codigo_distribuidor: form.codigo_distribuidor.trim(),
      nome_fabricante: form.nome_fabricante.trim(),
      posicao_veiculo: form.posicao_veiculo,
      lado: form.lado,
      observacoes: form.observacoes.trim(),
    }
    if (form.sku_interno.trim()) payload.sku_interno = form.sku_interno.trim()
    if (form.tipo_peca) payload.tipo_peca = form.tipo_peca
    else payload.tipo_peca = null
    if (form.categoria) payload.categoria = form.categoria
    else payload.categoria = null
    if (form.preco_venda_sugerido)
      payload.preco_venda_sugerido = form.preco_venda_sugerido
    else payload.preco_venda_sugerido = null
    if (form.margem_padrao_pct)
      payload.margem_padrao_pct = form.margem_padrao_pct
    else payload.margem_padrao_pct = null

    try {
      if (isEdit) {
        await updateMut.mutateAsync(payload as Partial<ProdutoComercialPeca>)
        toast.success("Peca atualizada.")
      } else {
        await createMut.mutateAsync(payload as Partial<ProdutoComercialPeca>)
        toast.success("Peca criada.")
      }
      onOpenChange(false)
    } catch {
      toast.error("Erro ao salvar. Tente novamente.")
    }
  }

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:w-[500px] overflow-y-auto border-white/10 bg-[#141414]">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-white">
            {isEdit ? "Editar Peca" : "Nova Peca"}
          </SheetTitle>
          <SheetDescription className="text-white/40">
            {isEdit
              ? `Editando ${produto?.sku_interno || produto?.nome_interno}`
              : "Preencha os dados do produto."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* IDENTIDADE */}
          <div className="space-y-3">
            <div className="section-divider">IDENTIDADE</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  SKU INTERNO
                </label>
                <input
                  value={form.sku_interno}
                  onChange={(e) => set("sku_interno", e.target.value)}
                  placeholder="Auto se vazio"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  NOME INTERNO
                </label>
                <input
                  value={form.nome_interno}
                  onChange={(e) => set("nome_interno", e.target.value)}
                  placeholder="Para-choque dianteiro"
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  COD. FABRICANTE
                </label>
                <input
                  value={form.codigo_fabricante}
                  onChange={(e) => set("codigo_fabricante", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  COD. EAN
                </label>
                <input
                  value={form.codigo_ean}
                  onChange={(e) => set("codigo_ean", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  COD. DISTRIBUIDOR
                </label>
                <input
                  value={form.codigo_distribuidor}
                  onChange={(e) => set("codigo_distribuidor", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  NOME FABRICANTE
                </label>
                <input
                  value={form.nome_fabricante}
                  onChange={(e) => set("nome_fabricante", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>

          {/* CLASSIFICACAO */}
          <div className="space-y-3">
            <div className="section-divider">CLASSIFICACAO</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  TIPO PECA
                </label>
                <select
                  value={form.tipo_peca}
                  onChange={(e) => set("tipo_peca", e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="">-- Selecione --</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  CATEGORIA
                </label>
                <select
                  value={form.categoria}
                  onChange={(e) => set("categoria", e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="">-- Selecione --</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  POSICAO
                </label>
                <select
                  value={form.posicao_veiculo}
                  onChange={(e) =>
                    set("posicao_veiculo", e.target.value)
                  }
                  className={INPUT_CLS}
                >
                  {POSICAO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  LADO
                </label>
                <select
                  value={form.lado}
                  onChange={(e) => set("lado", e.target.value)}
                  className={INPUT_CLS}
                >
                  {LADO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PRECO */}
          <div className="space-y-3">
            <div className="section-divider">PRECO</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  PRECO VENDA SUGERIDO
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.preco_venda_sugerido}
                  onChange={(e) =>
                    set("preco_venda_sugerido", e.target.value)
                  }
                  placeholder="0.00"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="label-mono text-white/50 mb-0.5 block">
                  MARGEM PADRAO %
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.margem_padrao_pct}
                  onChange={(e) => set("margem_padrao_pct", e.target.value)}
                  placeholder="0.00"
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>

          {/* OBSERVACOES */}
          <div className="space-y-3">
            <div className="section-divider">OBSERVACOES</div>
            <textarea
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              rows={3}
              placeholder="Observacoes..."
              className={INPUT_CLS + " resize-none"}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
