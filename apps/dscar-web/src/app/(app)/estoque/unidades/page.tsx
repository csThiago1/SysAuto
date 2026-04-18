"use client"

import { useState } from "react"
import { Package, Search } from "lucide-react"
import { useUnidades } from "@/hooks/useInventory"
import type { UnidadeFisicaStatus } from "@paddock/types"

const STATUS_LABELS: Record<UnidadeFisicaStatus, string> = {
  available: "Disponível",
  reserved: "Reservada",
  consumed: "Consumida",
  returned: "Devolvida",
  lost: "Perdida",
}

const STATUS_COLORS: Record<UnidadeFisicaStatus, string> = {
  available: "text-emerald-400 bg-emerald-400/10",
  reserved: "text-yellow-400 bg-yellow-400/10",
  consumed: "text-white/40 bg-white/5",
  returned: "text-blue-400 bg-blue-400/10",
  lost: "text-red-400 bg-red-400/10",
}

export default function UnidadesPage() {
  const [statusFilter, setStatusFilter] = useState("")

  const { data: unidades = [], isLoading } = useUnidades(
    statusFilter ? { status: statusFilter } : undefined
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Unidades Físicas</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {unidades.length} unidade{unidades.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : unidades.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhuma unidade encontrada.
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                <th className="px-4 py-3 text-left">Código de Barras</th>
                <th className="px-4 py-3 text-left">Peça</th>
                <th className="px-4 py-3 text-left">Localização</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{u.codigo_barras}</td>
                  <td className="px-4 py-3 text-white">{u.peca_nome}</td>
                  <td className="px-4 py-3 text-white/60">{u.localizacao || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[u.status as UnidadeFisicaStatus]}`}>
                      {STATUS_LABELS[u.status as UnidadeFisicaStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
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
