"use client"

import { useEmpresas } from "@/hooks/usePricingProfile"

export default function EmpresasPage() {
  const { data: empresas = [], isLoading } = useEmpresas()

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Empresas cadastradas no motor de orçamentos.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : empresas.length === 0 ? (
        <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma empresa cadastrada.
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Nome Fantasia</th>
                <th className="px-4 py-3 text-left font-medium">CNPJ</th>
                <th className="px-4 py-3 text-left font-medium">Razão Social</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{e.nome_fantasia}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{e.cnpj}</td>
                  <td className="px-4 py-3">{e.razao_social}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        e.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {e.is_active ? "Ativa" : "Inativa"}
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
