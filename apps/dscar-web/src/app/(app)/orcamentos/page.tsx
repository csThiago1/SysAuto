"use client"

import { useState } from "react"
import { FileText, Plus } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { useOrcamentos } from "@/hooks/useQuotes"
import type { StatusOrcamento } from "@paddock/types"

const STATUS_LABELS: Record<StatusOrcamento, string> = {
  rascunho:      "Rascunho",
  enviado:       "Enviado",
  aprovado:      "Aprovado",
  aprovado_parc: "Aprovado Parcial",
  recusado:      "Recusado",
  expirado:      "Expirado",
  convertido_os: "Convertido em OS",
}

const STATUS_COLORS: Record<StatusOrcamento, string> = {
  rascunho:      "text-white/50 bg-white/10",
  enviado:       "text-blue-400 bg-blue-400/10",
  aprovado:      "text-emerald-400 bg-emerald-400/10",
  aprovado_parc: "text-yellow-400 bg-yellow-400/10",
  recusado:      "text-red-400 bg-red-400/10",
  expirado:      "text-orange-400 bg-orange-400/10",
  convertido_os: "text-purple-400 bg-purple-400/10",
}

const formatBRL = (v: string | number) =>
  parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function OrcamentosPage() {
  const [statusFilter, setStatusFilter] = useState("")

  const { data: orcamentos = [], isLoading } = useOrcamentos(
    statusFilter ? { status: statusFilter } : undefined
  )

  const rascunhos  = orcamentos.filter((o) => o.status === "rascunho").length
  const enviados   = orcamentos.filter((o) => o.status === "enviado").length
  const aprovados  = orcamentos.filter((o) => ["aprovado", "aprovado_parc"].includes(o.status)).length
  const totalValue = orcamentos
    .filter((o) => o.status !== "recusado" && o.status !== "expirado")
    .reduce((acc, o) => acc + parseFloat(o.total), 0)

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Orçamentos</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {orcamentos.length} orçamento{orcamentos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link
          href={"/orcamentos/novo" as Route}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 hover:bg-primary-700 px-3 py-1.5 text-sm text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Orçamento
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Rascunhos",  value: rascunhos,  color: "text-white/50" },
          { label: "Enviados",   value: enviados,   color: "text-blue-400" },
          { label: "Aprovados",  value: aprovados,  color: "text-emerald-400" },
          { label: "Volume",     value: formatBRL(totalValue), color: "text-yellow-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/40">{kpi.label}</p>
            <p className={`text-xl font-semibold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
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

      {/* Tabela */}
      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : orcamentos.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhum orçamento encontrado.
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Veículo</th>
                <th className="px-4 py-3 text-left">Seguradora</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Validade</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {orcamentos.map((orc) => (
                <tr
                  key={orc.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => { window.location.href = `/orcamentos/${orc.id}` }}
                >
                  <td className="px-4 py-3 text-white font-medium">
                    {orc.numero} <span className="text-white/40 text-xs">v{orc.versao}</span>
                  </td>
                  <td className="px-4 py-3 text-white/80">{orc.customer_nome}</td>
                  <td className="px-4 py-3 text-white/60">
                    {orc.veiculo_marca} {orc.veiculo_modelo} {orc.veiculo_ano}
                    {orc.veiculo_placa && (
                      <span className="ml-1 text-xs text-white/30">{orc.veiculo_placa}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60">{orc.seguradora ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-white/80">{formatBRL(orc.total)}</td>
                  <td className="px-4 py-3 text-white/60">
                    {new Date(orc.validade).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[orc.status]}`}>
                      {STATUS_LABELS[orc.status]}
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
