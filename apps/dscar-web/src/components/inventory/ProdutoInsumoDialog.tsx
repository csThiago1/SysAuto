"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { ProdutoComercialInsumo } from "@paddock/types"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  useCategoriasInsumo,
  useProdutoInsumoCreate,
  useProdutoInsumoUpdate,
} from "@/hooks/useInventoryProduct"

// ─── Constants ────────────────────────────────────────────────────────────────

const UNIDADE_OPTIONS = [
  { value: "L", label: "Litro (L)" },
  { value: "KG", label: "Quilograma (KG)" },
  { value: "UN", label: "Unidade (UN)" },
  { value: "M", label: "Metro (M)" },
  { value: "CX", label: "Caixa (CX)" },
]

const INPUT_CLS =
  "w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary-500"

// ─── Component ────────────────────────────────────────────────────────────────

interface ProdutoInsumoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto?: ProdutoComercialInsumo | null
}

interface FormState {
  sku_interno: string
  nome_interno: string
  codigo_fabricante: string
  codigo_ean: string
  nome_fabricante: string
  unidade_base: string
  categoria_insumo: string
  preco_venda_sugerido: string
  margem_padrao_pct: string
  observacoes: string
}

const EMPTY: FormState = {
  sku_interno: "",
  nome_interno: "",
  codigo_fabricante: "",
  codigo_ean: "",
  nome_fabricante: "",
  unidade_base: "UN",
  categoria_insumo: "",
  preco_venda_sugerido: "",
  margem_padrao_pct: "",
  observacoes: "",
}

export function ProdutoInsumoDialog({
  open,
  onOpenChange,
  produto,
}: ProdutoInsumoDialogProps) {
  const isEdit = !!produto
  const { data: categorias = [] } = useCategoriasInsumo()
  const createMut = useProdutoInsumoCreate()
  const updateMut = useProdutoInsumoUpdate(produto?.id ?? "")

  const [form, setForm] = useState<FormState>(EMPTY)

  useEffect(() => {
    if (open) {
      if (produto) {
        setForm({
          sku_interno: produto.sku_interno,
          nome_interno: produto.nome_interno,
          codigo_fabricante: produto.codigo_fabricante,
          codigo_ean: produto.codigo_ean,
          nome_fabricante: produto.nome_fabricante,
          unidade_base: produto.unidade_base,
          categoria_insumo: produto.categoria_insumo ?? "",
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
      nome_fabricante: form.nome_fabricante.trim(),
      unidade_base: form.unidade_base,
      observacoes: form.observacoes.trim(),
    }
    if (form.sku_interno.trim()) payload.sku_interno = form.sku_interno.trim()
    if (form.categoria_insumo) payload.categoria_insumo = form.categoria_insumo
    else payload.categoria_insumo = null
    if (form.preco_venda_sugerido)
      payload.preco_venda_sugerido = form.preco_venda_sugerido
    else payload.preco_venda_sugerido = null
    if (form.margem_padrao_pct)
      payload.margem_padrao_pct = form.margem_padrao_pct
    else payload.margem_padrao_pct = null

    try {
      if (isEdit) {
        await updateMut.mutateAsync(
          payload as Partial<ProdutoComercialInsumo>
        )
        toast.success("Insumo atualizado.")
      } else {
        await createMut.mutateAsync(
          payload as Partial<ProdutoComercialInsumo>
        )
        toast.success("Insumo criado.")
      }
      onOpenChange(false)
    } catch {
      toast.error("Erro ao salvar. Tente novamente.")
    }
  }

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:w-[500px] overflow-y-auto border-border bg-card"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="text-foreground">
            {isEdit ? "Editar Insumo" : "Novo Insumo"}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            {isEdit
              ? `Editando ${produto?.sku_interno || produto?.nome_interno}`
              : "Preencha os dados do insumo."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* IDENTIDADE */}
          <div className="space-y-3">
            <div className="section-divider">IDENTIDADE</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
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
                <label className="label-mono text-muted-foreground mb-0.5 block">
                  NOME INTERNO
                </label>
                <input
                  value={form.nome_interno}
                  onChange={(e) => set("nome_interno", e.target.value)}
                  placeholder="Verniz PU 2:1"
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
                  COD. FABRICANTE
                </label>
                <input
                  value={form.codigo_fabricante}
                  onChange={(e) => set("codigo_fabricante", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
                  COD. EAN
                </label>
                <input
                  value={form.codigo_ean}
                  onChange={(e) => set("codigo_ean", e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                NOME FABRICANTE
              </label>
              <input
                value={form.nome_fabricante}
                onChange={(e) => set("nome_fabricante", e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* CLASSIFICACAO */}
          <div className="space-y-3">
            <div className="section-divider">CLASSIFICACAO</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
                  UNIDADE BASE
                </label>
                <select
                  value={form.unidade_base}
                  onChange={(e) => set("unidade_base", e.target.value)}
                  className={INPUT_CLS}
                >
                  {UNIDADE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
                  CATEGORIA
                </label>
                <select
                  value={form.categoria_insumo}
                  onChange={(e) => set("categoria_insumo", e.target.value)}
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
          </div>

          {/* PRECO */}
          <div className="space-y-3">
            <div className="section-divider">PRECO</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
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
                <label className="label-mono text-muted-foreground mb-0.5 block">
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
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
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
