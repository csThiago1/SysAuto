"use client"

import { useState } from "react"
import { useEnquadramentos } from "@/hooks/usePricingProfile"

export default function EnquadramentosPage() {
  const [search, setSearch] = useState("")

  const { data: enquadramentos = [], isLoading } = useEnquadramentos(
    search.trim() || undefined,
  )

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Enquadramentos Veiculares</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mapeamento de marca/modelo para segmento, tamanho e tipo de pintura
          padrão.
        </p>
      </div>

      <input
        type="text"
        placeholder="Buscar por marca ou modelo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : enquadramentos.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          {search ? `Nenhum enquadramento encontrado para "${search}".` : "Nenhum enquadramento cadastrado."}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Marca</th>
                <th className="px-4 py-3 text-left font-medium">Modelo</th>
                <th className="px-4 py-3 text-left font-medium">Anos</th>
                <th className="px-4 py-3 text-left font-medium">Segmento</th>
                <th className="px-4 py-3 text-left font-medium">Tamanho</th>
                <th className="px-4 py-3 text-left font-medium">Pintura default</th>
                <th className="px-4 py-3 text-right font-medium">Prioridade</th>
              </tr>
            </thead>
            <tbody>
              {enquadramentos.map((e) => (
                <tr
                  key={e.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{e.marca}</td>
                  <td className="px-4 py-3">{e.modelo || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {e.ano_inicio ?? "∞"} — {e.ano_fim ?? "∞"}
                  </td>
                  <td className="px-4 py-3">
                    {e.segmento?.nome ?? e.segmento_codigo}
                  </td>
                  <td className="px-4 py-3">
                    {e.tamanho?.nome ?? e.tamanho_codigo}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.tipo_pintura_default?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs">
                    {e.prioridade}
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
