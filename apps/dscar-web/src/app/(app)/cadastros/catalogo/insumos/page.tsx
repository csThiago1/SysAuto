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
import { useInsumosMaterial } from "@/hooks/usePricingCatalog"
import type { InsumoMaterial } from "@paddock/types"

export default function InsumosPage() {
  const { data: insumos = [], isLoading } = useInsumosMaterial()

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Insumos / Materiais</h1>
        <p className="mt-1 text-sm text-white/50">
          SKUs específicos de materiais canônicos — marcas, GTINs e fatores de conversão.
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={5} rows={8} />
      ) : insumos.length === 0 ? (
        <div className="py-12 text-center text-sm text-white/40">
          Nenhum insumo cadastrado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow>
                <TableHead className="w-40">SKU Interno</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-32">Marca</TableHead>
                <TableHead className="w-36">GTIN/EAN</TableHead>
                <TableHead className="w-32">Fator Conv.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insumos.map((i: InsumoMaterial) => (
                <TableRow key={i.id}>
                  <TableCell className="py-2 font-mono text-xs text-white/60">
                    {i.sku_interno}
                  </TableCell>
                  <TableCell className="py-2 font-medium text-white/90">{i.descricao}</TableCell>
                  <TableCell className="py-2 text-sm text-white/60">{i.marca || "—"}</TableCell>
                  <TableCell className="py-2 font-mono text-xs text-white/60">
                    {i.gtin || "—"}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-white/60">
                    {i.fator_conversao} {i.unidade_compra}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-white/40">{insumos.length} insumos carregados.</p>
    </div>
  )
}
