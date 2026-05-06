"use client"

import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCategoriasMaoObra } from "@/hooks/usePricingCatalog"
import type { CategoriaMaoObra } from "@paddock/types"

export default function CategoriasMaoObraPage() {
  const { data: categorias = [], isLoading } = useCategoriasMaoObra()

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Categorias de Mão de Obra</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Classificação de mão de obra para o catálogo técnico do Motor de Orçamentos.
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={3} rows={6} />
      ) : categorias.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma categoria de mão de obra cadastrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-24">Ordem</TableHead>
                <TableHead className="w-40">Código</TableHead>
                <TableHead>Nome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map((c: CategoriaMaoObra) => (
                <TableRow key={c.id}>
                  <TableCell className="py-2 text-sm text-muted-foreground text-center">
                    {c.ordem}
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs text-foreground/60">
                    {c.codigo}
                  </TableCell>
                  <TableCell className="py-2 font-medium text-foreground/90">{c.nome}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{categorias.length} categorias carregadas.</p>
    </div>
  )
}
