"use client"

import { useState } from "react"
import { Layers } from "lucide-react"
import { useLotes } from "@/hooks/useInventory"

export default function LotesPage() {
  const [apenasComSaldo, setApenasComSaldo] = useState(false)

  const { data: lotes = [], isLoading } = useLotes(
    apenasComSaldo ? { saldo_gt: "0" } : undefined
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Lotes de Insumo</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {lotes.length} lote{lotes.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={apenasComSaldo}
            onChange={(e) => setApenasComSaldo(e.target.checked)}
            className="rounded border-white/20 bg-white/5"
          />
          Apenas com saldo
        </label>
      </div>

      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : lotes.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhum lote encontrado.
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                <th className="px-4 py-3 text-left">Código de Barras</th>
                <th className="px-4 py-3 text-left">Material</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">% Restante</th>
                <th className="px-4 py-3 text-right">Custo Unitário</th>
                <th className="px-4 py-3 text-left">Validade</th>
                <th className="px-4 py-3 text-left">Localização</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((lote) => (
                <tr key={lote.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{lote.codigo_barras}</td>
                  <td className="px-4 py-3 text-white">{lote.material_nome}</td>
                  <td className="px-4 py-3 text-right text-white/80">
                    {lote.saldo} {lote.unidade_base}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            lote.saldo_percentual > 50
                              ? "bg-success-500"
                              : lote.saldo_percentual > 20
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(lote.saldo_percentual, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-white/60 w-10 text-right">
                        {lote.saldo_percentual}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-white/80">
                    R$ {parseFloat(lote.valor_unitario_base).toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-white/60">
                    {lote.validade
                      ? new Date(lote.validade).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-white/60">{lote.localizacao || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
