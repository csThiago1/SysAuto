"use client"

import { useSegmentos } from "@/hooks/usePricingProfile"

export default function SegmentosPage() {
  const { data: segmentos = [], isLoading } = useSegmentos()

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Segmentos Veiculares</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fator de responsabilidade multiplica o custo base de serviços mais
          complexos ou de maior risco.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : segmentos.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum segmento cadastrado.
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-right font-medium">Fator</th>
                <th className="px-4 py-3 text-right font-medium">Ordem</th>
                <th className="px-4 py-3 text-left font-medium">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {segmentos.map((s) => (
                <tr
                  key={s.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">{s.codigo}</td>
                  <td className="px-4 py-3 font-medium">{s.nome}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {s.fator_responsabilidade}×
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {s.ordem}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {s.descricao || "—"}
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
