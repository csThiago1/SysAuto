"use client"

import { useTamanhos } from "@/hooks/usePricingProfile"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

export default function TamanhosPage() {
  const { data: tamanhos = [], isLoading } = useTamanhos()

  return (
    <div className="px-0 py-3 md:p-6 space-y-4">
      <div>
        <h1 className="page-title">Categorias de Tamanho</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Multiplicadores de insumos e horas aplicados por categoria de tamanho
          do veículo.
        </p>
      </div>

      {isLoading ? (
        <TableSkeleton columns={5} rows={5} />
      ) : tamanhos.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma categoria cadastrada.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">
                  Mult. Insumos
                </TableHead>
                <TableHead className="text-right">
                  Mult. Horas
                </TableHead>
                <TableHead className="text-right">Ordem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tamanhos.map((t) => (
                <TableRow
                  key={t.id}
                >
                  <TableCell className="font-mono text-xs">{t.codigo}</TableCell>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell className="text-right font-mono">
                    {t.multiplicador_insumos}×
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {t.multiplicador_horas}×
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {t.ordem}
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
