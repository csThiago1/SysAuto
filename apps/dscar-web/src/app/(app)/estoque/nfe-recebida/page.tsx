"use client"

import { useState } from "react"
import { FileText, Plus } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { useNFeEntradas } from "@/hooks/useInventory"
import type { NFeEntradaStatus } from "@paddock/types"

const STATUS_LABELS: Record<NFeEntradaStatus, string> = {
  importada: "Importada",
  validada: "Validada",
  estoque_gerado: "Estoque Gerado",
}

const STATUS_COLORS: Record<NFeEntradaStatus, string> = {
  importada: "text-yellow-400 bg-yellow-400/10",
  validada: "text-blue-400 bg-blue-400/10",
  estoque_gerado: "text-success-400 bg-success-400/10",
}

export default function NFeRecebidaPage() {
  const [statusFilter, setStatusFilter] = useState("")

  const { data: notas = [], isLoading } = useNFeEntradas(
    statusFilter ? { status: statusFilter } : undefined
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">NF-e de Entrada</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {notas.length} nota{notas.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

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
      </div>

      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : notas.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhuma NF-e encontrada.
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Emitente</th>
                <th className="px-4 py-3 text-left">Data Emissão</th>
                <th className="px-4 py-3 text-right">Valor Total</th>
                <th className="px-4 py-3 text-right">Itens</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {notas.map((nfe) => (
                <tr
                  key={nfe.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/estoque/nfe-recebida/${nfe.id}`}
                >
                  <td className="px-4 py-3 text-white font-medium">
                    {nfe.numero || "—"}{nfe.serie ? ` / ${nfe.serie}` : ""}
                  </td>
                  <td className="px-4 py-3 text-white/80">{nfe.emitente_nome || "—"}</td>
                  <td className="px-4 py-3 text-white/60">
                    {nfe.data_emissao
                      ? new Date(nfe.data_emissao).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-white/80">
                    {parseFloat(nfe.valor_total).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right text-white/60">{nfe.total_itens}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[nfe.status as NFeEntradaStatus]}`}>
                      {STATUS_LABELS[nfe.status as NFeEntradaStatus]}
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
