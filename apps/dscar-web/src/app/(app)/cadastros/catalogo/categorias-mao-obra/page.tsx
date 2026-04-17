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
        <h1 className="text-2xl font-bold text-neutral-900">Categorias de Mão de Obra</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Classificação de mão de obra para o catálogo técnico do Motor de Orçamentos.
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={3} rows={6} />
      ) : categorias.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-400">
          Nenhuma categoria de mão de obra cadastrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <Table>
            <TableHeader className="bg-neutral-50">
              <TableRow>
                <TableHead className="w-24">Ordem</TableHead>
                <TableHead className="w-40">Código</TableHead>
                <TableHead>Nome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map((c: CategoriaMaoObra) => (
                <TableRow key={c.id}>
                  <TableCell className="py-2 text-sm text-neutral-500 text-center">
                    {c.ordem}
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs text-neutral-600">
                    {c.codigo}
                  </TableCell>
                  <TableCell className="py-2 font-medium text-neutral-800">{c.nome}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-neutral-400">{categorias.length} categorias carregadas.</p>
    </div>
  )
}
