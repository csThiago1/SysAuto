"use client"

import { useSegmentos } from "@/hooks/usePricingProfile"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

export default function SegmentosPage() {
  const { data: segmentos = [], isLoading } = useSegmentos()

  return (
    <div className="px-0 py-3 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Segmentos Veiculares</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fator de responsabilidade multiplica o custo base de serviços mais
          complexos ou de maior risco.
        </p>
      </div>

      {isLoading ? (
        <TableSkeleton columns={5} rows={5} />
      ) : segmentos.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum segmento cadastrado.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Fator</TableHead>
                <TableHead className="text-right">Ordem</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segmentos.map((s) => (
                <TableRow
                  key={s.id}
                >
                  <TableCell className="font-mono text-xs">{s.codigo}</TableCell>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell className="text-right font-mono">
                    {s.fator_responsabilidade}×
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {s.ordem}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {s.descricao || "—"}
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
