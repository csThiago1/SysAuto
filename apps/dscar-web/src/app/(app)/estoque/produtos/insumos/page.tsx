"use client"

import { useState, useMemo } from "react"
import { FlaskConical, Plus, Pencil, Trash2, Search } from "lucide-react"
import { toast } from "sonner"
import type { ProdutoComercialInsumo } from "@paddock/types"
import {
  useProdutosInsumo,
  useProdutoInsumoDelete,
  useCategoriasInsumo,
} from "@/hooks/useInventoryProduct"
import { ProdutoInsumoDialog } from "@/components/inventory/ProdutoInsumoDialog"

const INPUT_CLS =
  "bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary-500"

export default function ProdutosInsumosPage() {
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<ProdutoComercialInsumo | null>(null)
  const [deleteId, setDeleteId] = useState("")

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (search.trim()) p.search = search.trim()
    if (catFilter) p.categoria_insumo = catFilter
    return p
  }, [search, catFilter])

  const { data: produtos = [], isLoading } = useProdutosInsumo(params)
  const { data: categorias = [] } = useCategoriasInsumo()
  const deleteMut = useProdutoInsumoDelete(deleteId)

  function handleEdit(p: ProdutoComercialInsumo) {
    setEditItem(p)
    setDialogOpen(true)
  }

  function handleNew() {
    setEditItem(null)
    setDialogOpen(true)
  }

  async function handleDelete(p: ProdutoComercialInsumo) {
    setDeleteId(p.id)
    try {
      await deleteMut.mutateAsync()
      toast.success(`"${p.nome_interno}" removido.`)
    } catch {
      toast.error("Erro ao remover. Tente novamente.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">
              Produtos &mdash; Insumos
            </h1>
            <p className="text-xs text-white/40 mt-0.5">
              {produtos.length} insumo{produtos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNew}
          className="flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Insumo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU ou nome..."
            className={INPUT_CLS + " w-full pl-9"}
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className={INPUT_CLS + " min-w-[160px]"}
        >
          <option value="">Todas Categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : produtos.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhum insumo encontrado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="label-mono text-white/40 text-left px-4 py-2.5">
                  SKU
                </th>
                <th className="label-mono text-white/40 text-left px-4 py-2.5">
                  NOME
                </th>
                <th className="label-mono text-white/40 text-left px-4 py-2.5">
                  UNIDADE BASE
                </th>
                <th className="label-mono text-white/40 text-left px-4 py-2.5">
                  CATEGORIA
                </th>
                <th className="label-mono text-white/40 text-right px-4 py-2.5">
                  MARGEM %
                </th>
                <th className="label-mono text-white/40 text-right px-4 py-2.5">
                  ACOES
                </th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => handleEdit(p)}
                  className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-white/60">
                    {p.sku_interno}
                  </td>
                  <td className="px-4 py-2.5 text-white/90">
                    {p.nome_interno}
                  </td>
                  <td className="px-4 py-2.5 text-white/60 uppercase">
                    {p.unidade_base}
                  </td>
                  <td className="px-4 py-2.5 text-white/60">
                    {p.categoria_insumo_nome || "--"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-white/60">
                    {p.margem_padrao_pct
                      ? `${p.margem_padrao_pct}%`
                      : "--"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(p)
                        }}
                        className="rounded p-1 text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(p)
                        }}
                        className="rounded p-1 text-white/30 hover:text-error-400 hover:bg-error-500/10 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      <ProdutoInsumoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        produto={editItem}
      />
    </div>
  )
}
