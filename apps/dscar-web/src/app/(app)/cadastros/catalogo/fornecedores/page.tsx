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
import { useFornecedores } from "@/hooks/usePricingCatalog"
import type { Fornecedor } from "@paddock/types"

function AvaliacaoStars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-white/40 text-xs">—</span>
  return (
    <span className="text-sm text-amber-500" title={`${value}/5`}>
      {"★".repeat(value)}{"☆".repeat(5 - value)}
    </span>
  )
}

export default function FornecedoresPage() {
  const { data: fornecedores = [], isLoading } = useFornecedores()

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Fornecedores</h1>
        <p className="mt-1 text-sm text-white/50">
          Fornecedores de peças cadastrados no catálogo técnico.
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={4} rows={6} />
      ) : fornecedores.length === 0 ? (
        <div className="py-12 text-center text-sm text-white/40">
          Nenhum fornecedor cadastrado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow>
                <TableHead>Condições de Pagamento</TableHead>
                <TableHead className="w-40">Prazo Entrega</TableHead>
                <TableHead className="w-32">Avaliação</TableHead>
                <TableHead className="w-20">Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fornecedores.map((f: Fornecedor) => (
                <TableRow key={f.id}>
                  <TableCell className="py-2 text-sm text-white/90">
                    {f.condicoes_pagamento || "—"}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-white/60">
                    {f.prazo_entrega_dias !== null ? `${f.prazo_entrega_dias} dias` : "—"}
                  </TableCell>
                  <TableCell className="py-2">
                    <AvaliacaoStars value={f.avaliacao} />
                  </TableCell>
                  <TableCell className="py-2">
                    <span className={`text-xs ${f.is_active ? "text-success-400" : "text-white/40"}`}>
                      {f.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-white/40">{fornecedores.length} fornecedores carregados.</p>
    </div>
  )
}
