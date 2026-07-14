"use client"

import { useTamanhos } from "@/hooks/usePricingProfile"
import { TableSkeleton } from "@/components/ui/table-skeleton"

export default function TamanhosPage() {
  const { data: tamanhos = [], isLoading } = useTamanhos()

  return (
    <div className="px-0 py-3 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Categorias de Tamanho</h1>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-right font-medium">
                  Mult. Insumos
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Mult. Horas
                </th>
                <th className="px-4 py-3 text-right font-medium">Ordem</th>
              </tr>
            </thead>
            <tbody>
              {tamanhos.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">{t.codigo}</td>
                  <td className="px-4 py-3 font-medium">{t.nome}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {t.multiplicador_insumos}×
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {t.multiplicador_horas}×
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {t.ordem}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
