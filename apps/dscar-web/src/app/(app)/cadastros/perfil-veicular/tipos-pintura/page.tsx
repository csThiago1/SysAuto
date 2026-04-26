"use client"

import { useTiposPintura } from "@/hooks/usePricingProfile"

const ESTRELAS_MAX = 4

function Estrelas({ complexidade }: { complexidade: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Complexidade ${complexidade} de ${ESTRELAS_MAX}`}>
      {Array.from({ length: ESTRELAS_MAX }).map((_, i) => (
        <span
          key={i}
          className={
            i < complexidade
              ? "text-amber-500"
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
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Tipos de Pintura</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Classificação de complexidade de pintura — influencia o custo final
          do orçamento.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : tipos.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum tipo de pintura cadastrado.
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Complexidade</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">{t.codigo}</td>
                  <td className="px-4 py-3 font-medium">{t.nome}</td>
                  <td className="px-4 py-3">
                    <Estrelas complexidade={t.complexidade} />
                  </td>
                  <td className="px-4 py-3">
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
