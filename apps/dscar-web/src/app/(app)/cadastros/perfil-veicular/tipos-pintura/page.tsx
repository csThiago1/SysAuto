"use client"

import { useTiposPintura } from "@/hooks/usePricingProfile"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

const ESTRELAS_MAX = 4

function Estrelas({ complexidade }: { complexidade: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Complexidade ${complexidade} de ${ESTRELAS_MAX}`}>
      {Array.from({ length: ESTRELAS_MAX }).map((_, i) => (
        <span
          key={i}
          className={
            i < complexidade
              ? "text-warning-400"
              : "text-muted-foreground/30"
          }
        >
          ★
        </span>
      ))}
    </span>
  )
}

export default function TiposPinturaPage() {
  const { data: tipos = [], isLoading } = useTiposPintura()

  return (
    <div className="px-0 py-3 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Tipos de Pintura</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Classificação de complexidade de pintura — influencia o custo final
          do orçamento.
        </p>
      </div>

      {isLoading ? (
        <TableSkeleton columns={4} rows={5} />
      ) : tipos.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum tipo de pintura cadastrado.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Complexidade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tipos.map((t) => (
                <TableRow
                  key={t.id}
                >
                  <TableCell className="font-mono text-xs">{t.codigo}</TableCell>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell>
                    <Estrelas complexidade={t.complexidade} />
                  </TableCell>
                  <TableCell>
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        t.is_active
                          ? "bg-success-500/10 text-success-400"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {t.is_active ? "Ativo" : "Inativo"}
                    </span>
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
