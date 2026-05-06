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
import { useMateriaisCanonico } from "@/hooks/usePricingCatalog"
import type { MaterialCanonico } from "@paddock/types"

const TIPO_MATERIAL_COLORS: Record<MaterialCanonico["tipo"], string> = {
  consumivel: "bg-info-500/10 text-info-400 border-info-500/20",
  ferramenta: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

const TIPO_MATERIAL_LABELS: Record<MaterialCanonico["tipo"], string> = {
  consumivel: "Consumível",
  ferramenta: "Ferramenta",
}

export default function MateriaisCanonicoPage() {
  const [search, setSearch] = useState("")
  const { data: materiais = [], isLoading } = useMateriaisCanonico(search || undefined)

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Materiais Canônicos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catálogo de materiais e insumos na forma canônica — base do Motor de Orçamentos.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar material..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted/50 h-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={4} rows={8} />
      ) : materiais.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search ? "Nenhum material encontrado." : "Nenhum material cadastrado."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-48">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-28">Unid. Base</TableHead>
                <TableHead className="w-32">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiais.map((m: MaterialCanonico) => (
                <TableRow key={m.id}>
                  <TableCell className="py-2 font-mono text-xs text-foreground/60">
                    {m.codigo}
                  </TableCell>
                  <TableCell className="py-2 font-medium text-foreground/90">{m.nome}</TableCell>
                  <TableCell className="py-2 text-sm text-foreground/60">{m.unidade_base}</TableCell>
                  <TableCell className="py-2">
                    <Badge className={`text-xs ${TIPO_MATERIAL_COLORS[m.tipo]}`}>
                      {TIPO_MATERIAL_LABELS[m.tipo]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{materiais.length} materiais carregados.</p>
    </div>
  )
}
