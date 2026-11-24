"use client"

import { useState, useMemo } from "react"
import { Plus, Pencil, Trash2, Search } from "lucide-react"
import { toast } from "sonner"
import type { ProdutoComercialPeca } from "@paddock/types"
import {
  useProdutosPeca,
  useProdutoPecaDelete,
  useTiposPeca,
  useCategoriasProduto,
} from "@/hooks/useInventoryProduct"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { ProdutoPecaDialog } from "@/components/inventory/ProdutoPecaDialog"
import { ScrollFade } from "@/components/ui/scroll-fade"
import { NativeSelect } from "@/components/ui/native-select"
import { Button } from "@/components/ui/button"


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
          <div>
            <h1 className="page-title">
              Produtos — Peças
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {produtos.length} produto{produtos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleNew}
        >
          <Plus className="h-4 w-4" />
          Nova Peca
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU ou nome..."
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          wrapperClassName="w-auto"
          className="w-auto min-w-[160px]"
        >
          <option value="">Todos os Tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          wrapperClassName="w-auto"
          className="w-auto min-w-[160px]"
        >
          <option value="">Todas Categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </NativeSelect>
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
              className="cursor-pointer rounded-md bg-muted/30 px-3 py-2.5"
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
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="py-2.5">
                  SKU
                </TableHead>
                <TableHead className="py-2.5">
                  NOME
                </TableHead>
                <TableHead className="py-2.5">
                  TIPO
                </TableHead>
                <TableHead className="py-2.5">
                  POSICAO
                </TableHead>
                <TableHead className="py-2.5">
                  LADO
                </TableHead>
                <TableHead className="py-2.5">
                  CATEGORIA
                </TableHead>
                <TableHead className="text-right py-2.5">
                  MARGEM %
                </TableHead>
                <TableHead className="text-right py-2.5">
                  ACOES
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => handleEdit(p)}
                  className="border-white/5 cursor-pointer"
                >
                  <TableCell className="py-2.5 font-mono text-xs text-foreground/60">
                    {p.sku_interno}
                  </TableCell>
                  <TableCell className="py-2.5 text-foreground/90">
                    {p.nome_interno}
                  </TableCell>
                  <TableCell className="py-2.5 text-foreground/60">
                    {p.tipo_peca_nome || "--"}
                  </TableCell>
                  <TableCell className="py-2.5 text-foreground/60">
                    {p.posicao_veiculo_display}
                  </TableCell>
                  <TableCell className="py-2.5 text-foreground/60">
                    {p.lado_display}
                  </TableCell>
                  <TableCell className="py-2.5 text-foreground/60">
                    {p.categoria_nome || "--"}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-xs text-foreground/60">
                    {p.margem_padrao_pct
                      ? `${p.margem_padrao_pct}%`
                      : "--"}
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
