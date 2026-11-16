"use client"

import { useState } from "react"
import { useEnquadramentos } from "@/hooks/usePricingProfile"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

export default function EnquadramentosPage() {
  const [search, setSearch] = useState("")

  const { data: enquadramentos = [], isLoading } = useEnquadramentos(
    search.trim() || undefined,
  )

  return (
    <div className="px-0 py-3 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Enquadramentos Veiculares</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mapeamento de marca/modelo para segmento, tamanho e tipo de pintura
          padrão.
        </p>
      </div>

      <Input
        type="text"
        placeholder="Buscar por marca ou modelo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-72"
      />

      {isLoading ? (
        <TableSkeleton columns={6} rows={6} />
      ) : enquadramentos.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          {search ? `Nenhum enquadramento encontrado para "${search}".` : "Nenhum enquadramento cadastrado."}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Anos</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Pintura default</TableHead>
                <TableHead className="text-right">Prioridade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enquadramentos.map((e) => (
                <TableRow
                  key={e.id}
                >
                  <TableCell className="font-medium">{e.marca}</TableCell>
                  <TableCell>{e.modelo || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {e.ano_inicio ?? "∞"} — {e.ano_fim ?? "∞"}
                  </TableCell>
                  <TableCell>
                    {e.segmento?.nome ?? e.segmento_codigo}
                  </TableCell>
                  <TableCell>
                    {e.tamanho?.nome ?? e.tamanho_codigo}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.tipo_pintura_default?.nome ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono text-xs">
                    {e.prioridade}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
