"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { usePecasCanonicas } from "@/hooks/usePricingCatalog"
import type { PecaCanonica } from "@paddock/types"

const TIPO_PECA_LABELS: Record<PecaCanonica["tipo_peca"], string> = {
  genuina: "Genuína",
  original: "Original",
  paralela: "Paralela",
  usada: "Usada",
  recondicionada: "Recondicionada",
}

const TIPO_PECA_COLORS: Record<PecaCanonica["tipo_peca"], string> = {
  genuina: "bg-emerald-100 text-emerald-700 border-emerald-200",
  original: "bg-blue-100 text-blue-700 border-blue-200",
  paralela: "bg-amber-100 text-amber-700 border-amber-200",
  usada: "bg-neutral-100 text-neutral-600 border-neutral-200",
  recondicionada: "bg-purple-100 text-purple-700 border-purple-200",
}

export default function PecasCanonicoPage() {
  const [search, setSearch] = useState("")
  const { data: pecas = [], isLoading } = usePecasCanonicas(search || undefined)

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Peças Canônicas</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Catálogo de peças automotivas na forma canônica — base do Motor de Orçamentos.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
        <Input
          placeholder="Buscar peça..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white h-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={4} rows={8} />
      ) : pecas.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-400">
          {search ? "Nenhuma peça encontrada." : "Nenhuma peça cadastrada."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <Table>
            <TableHeader className="bg-neutral-50">
              <TableRow>
                <TableHead className="w-52">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-36">Tipo</TableHead>
                <TableHead className="w-20">Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pecas.map((p: PecaCanonica) => (
                <TableRow key={p.id}>
                  <TableCell className="py-2 font-mono text-xs text-neutral-600">
                    {p.codigo}
                  </TableCell>
                  <TableCell className="py-2 font-medium text-neutral-800">{p.nome}</TableCell>
                  <TableCell className="py-2">
                    <Badge className={`text-xs ${TIPO_PECA_COLORS[p.tipo_peca]}`}>
                      {TIPO_PECA_LABELS[p.tipo_peca]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <span className={`text-xs ${p.is_active ? "text-emerald-600" : "text-neutral-400"}`}>
                      {p.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-neutral-400">{pecas.length} peças carregadas.</p>
    </div>
  )
}
