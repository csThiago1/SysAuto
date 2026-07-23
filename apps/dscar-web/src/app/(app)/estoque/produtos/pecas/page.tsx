"use client"

import { useState, useMemo } from "react"
import { Package, Plus, Pencil, Trash2, Search } from "lucide-react"
import { toast } from "sonner"
import type { ProdutoComercialPeca } from "@paddock/types"
import {
  useProdutosPeca,
  useProdutoPecaDelete,
  useTiposPeca,
  useCategoriasProduto,
} from "@/hooks/useInventoryProduct"
import { ProdutoPecaDialog } from "@/components/inventory/ProdutoPecaDialog"
import { ScrollFade } from "@/components/ui/scroll-fade"

const INPUT_CLS =
  "bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"

export default function ProdutosPecasPage() {
  const [search, setSearch] = useState("")
  const [tipoFilter, setTipoFilter] = useState("")
  const [catFilter, setCatFilter] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<ProdutoComercialPeca | null>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (search.trim()) p.search = search.trim()
    if (tipoFilter) p.tipo_peca = tipoFilter
    if (catFilter) p.categoria = catFilter
    return p
  }, [search, tipoFilter, catFilter])

  const { data: produtos = [], isLoading } = useProdutosPeca(params)
  const { data: tipos = [] } = useTiposPeca()
  const { data: categorias = [] } = useCategoriasProduto()
  const deleteMut = useProdutoPecaDelete()

  function handleEdit(p: ProdutoComercialPeca) {
    setEditItem(p)
    setDialogOpen(true)
  }

  function handleNew() {
    setEditItem(null)
    setDialogOpen(true)
  }

  async function handleDelete(p: ProdutoComercialPeca) {
    try {
      await deleteMut.mutateAsync(p.id)
      toast.success(`"${p.nome_interno}" removida.`)
    } catch {
      toast.error("Erro ao remover. Tente novamente.")
    }
  }

  return (
    <div className="px-0 py-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Produtos — Peças
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {produtos.length} produto{produtos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNew}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Peca
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU ou nome..."
            className={INPUT_CLS + " w-full pl-9"}
          />
        </div>
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className={INPUT_CLS + " min-w-[160px]"}
        >
          <option value="">Todos os Tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
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
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : produtos.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhuma peca encontrada.
        </div>
      ) : (
        <>
        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {produtos.map((p) => (
            <div
              key={p.id}
              onClick={() => handleEdit(p)}
              className="cursor-pointer rounded-[11px] bg-muted/30 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground/90">
                    {p.nome_interno}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-foreground/50">
                    {p.sku_interno}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(p)
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-error-500/10 hover:text-error-400 transition-colors"
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-[11px] text-muted-foreground">
                <span className="truncate">
                  {[p.tipo_peca_nome, p.posicao_veiculo_display, p.lado_display, p.categoria_nome]
                    .filter(Boolean)
                    .join(" · ") || "--"}
                </span>
                <span className="whitespace-nowrap text-right font-mono tabular-nums">
                  {p.margem_padrao_pct ? `${p.margem_padrao_pct}%` : "--"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block rounded-md border border-border bg-muted/50">
        <ScrollFade>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                  SKU
                </th>
                <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                  NOME
                </th>
                <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                  TIPO
                </th>
                <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                  POSICAO
                </th>
                <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                  LADO
                </th>
                <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                  CATEGORIA
                </th>
                <th className="label-mono text-muted-foreground text-right px-4 py-2.5">
                  MARGEM %
                </th>
                <th className="label-mono text-muted-foreground text-right px-4 py-2.5">
                  ACOES
                </th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => handleEdit(p)}
                  className="border-b border-white/5 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground/60">
                    {p.sku_interno}
                  </td>
                  <td className="px-4 py-2.5 text-foreground/90">
                    {p.nome_interno}
                  </td>
                  <td className="px-4 py-2.5 text-foreground/60">
                    {p.tipo_peca_nome || "--"}
                  </td>
                  <td className="px-4 py-2.5 text-foreground/60">
                    {p.posicao_veiculo_display}
                  </td>
                  <td className="px-4 py-2.5 text-foreground/60">
                    {p.lado_display}
                  </td>
                  <td className="px-4 py-2.5 text-foreground/60">
                    {p.categoria_nome || "--"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-foreground/60">
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
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                        className="rounded p-1 text-muted-foreground hover:text-error-400 hover:bg-error-500/10 transition-colors"
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
        </ScrollFade>
        </div>
        </>
      )}

      {/* Dialog */}
      <ProdutoPecaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        produto={editItem}
      />
    </div>
  )
}
