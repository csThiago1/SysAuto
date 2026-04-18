"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { Search, ClipboardList } from "lucide-react"
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
import { useFichas } from "@/hooks/useFichaTecnica"
import type { FichaTecnicaServico } from "@paddock/types"

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function FichasTecnicasPage() {
  const [search, setSearch] = useState("")
  const router = useRouter()
  const { data: fichas = [], isLoading } = useFichas()

  const fichasFiltradas = fichas.filter((f) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      f.servico_nome.toLowerCase().includes(q) ||
      f.servico_codigo.toLowerCase().includes(q) ||
      (f.tipo_pintura_nome ?? "").toLowerCase().includes(q)
    )
  })

  function handleRowClick(f: FichaTecnicaServico) {
    router.push(`/cadastros/fichas-tecnicas/${f.servico}` as Route)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Fichas Técnicas</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Fichas técnicas versionadas — mão de obra e insumos por serviço.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
        <Input
          placeholder="Buscar ficha..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white h-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={5} rows={8} />
      ) : fichasFiltradas.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-400">
          {search ? "Nenhuma ficha encontrada." : "Nenhuma ficha técnica cadastrada."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <Table>
            <TableHeader className="bg-neutral-50">
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead className="w-20 text-center">Versão</TableHead>
                <TableHead className="w-40">Tipo Pintura</TableHead>
                <TableHead className="w-36">Criada em</TableHead>
                <TableHead className="w-44">Criada por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fichasFiltradas.map((f) => (
                <TableRow
                  key={f.id}
                  className="cursor-pointer hover:bg-neutral-50 transition-colors"
                  onClick={() => handleRowClick(f)}
                >
                  <TableCell className="py-2">
                    <div className="font-medium text-neutral-800">{f.servico_nome}</div>
                    <div className="text-xs text-neutral-400 font-mono">{f.servico_codigo}</div>
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-mono"
                    >
                      v{f.versao}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-sm text-neutral-600">
                    {f.tipo_pintura_nome ? (
                      <Badge variant="outline" className="text-xs">
                        {f.tipo_pintura_nome}
                      </Badge>
                    ) : (
                      <span className="text-neutral-400">Genérica</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-neutral-600">
                    {formatDate(f.criada_em)}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-neutral-500 truncate max-w-[160px]">
                    {f.criada_por_email ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-neutral-400 flex items-center gap-1">
        <ClipboardList className="h-3 w-3" />
        {fichasFiltradas.length} fichas carregadas.
      </p>
    </div>
  )
}
