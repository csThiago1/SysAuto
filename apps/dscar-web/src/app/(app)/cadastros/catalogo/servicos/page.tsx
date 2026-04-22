"use client"

import { useState } from "react"
import { Search, Wrench } from "lucide-react"
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
import { useServicosCanonico } from "@/hooks/usePricingCatalog"
import type { ServicoCanonico } from "@paddock/types"

export default function ServicosCanonicoPage() {
  const [search, setSearch] = useState("")
  const { data: servicos = [], isLoading } = useServicosCanonico(search || undefined)

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Serviços Canônicos</h1>
          <p className="mt-1 text-sm text-white/50">
            Catálogo de serviços na forma canônica — base do Motor de Orçamentos.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
        <Input
          placeholder="Buscar serviço..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/5 h-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={5} rows={8} />
      ) : servicos.length === 0 ? (
        <div className="py-12 text-center text-sm text-white/40">
          {search ? "Nenhum serviço encontrado." : "Nenhum serviço cadastrado."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow>
                <TableHead className="w-40">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-36">Categoria</TableHead>
                <TableHead className="w-32">Unidade</TableHead>
                <TableHead className="w-44">Mult. Tamanho</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicos.map((s: ServicoCanonico) => (
                <TableRow key={s.id}>
                  <TableCell className="py-2 font-mono text-xs text-white/60">
                    {s.codigo}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="font-medium text-white/90">{s.nome}</div>
                    {s.descricao && (
                      <div className="text-xs text-white/40 truncate max-w-xs">{s.descricao}</div>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-white/60">
                    {s.categoria_nome ?? "—"}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-white/60">{s.unidade}</TableCell>
                  <TableCell className="py-2">
                    {s.aplica_multiplicador_tamanho ? (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                        Aplica
                      </Badge>
                    ) : (
                      <Badge className="bg-white/5 text-white/50 border-white/10 text-xs">
                        Não aplica
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-white/40 flex items-center gap-1">
        <Wrench className="h-3 w-3" />
        {servicos.length} serviços carregados.
      </p>
    </div>
  )
}
