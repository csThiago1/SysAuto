"use client"

import { useState } from "react"
import { TrendingUp, AlertTriangle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useVarianciasFicha, useVarianciasPeca, useGerarVariancias } from "@/hooks/useCapacidade"

const formatPct = (v: string) => {
  const n = parseFloat(v)
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`
}

const pctColor = (v: string) => {
  const n = Math.abs(parseFloat(v))
  if (n < 0.1) return "text-emerald-400"
  if (n < 0.2) return "text-yellow-400"
  return "text-red-400"
}

const selectCls = "text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none"

export default function VarianciasPage() {
  const [tab, setTab] = useState<"fichas" | "pecas">("fichas")
  const [mes, setMes] = useState("")
  const [apenasAlertas, setApenasAlertas] = useState(false)

  const { data: fichas = [], isLoading: loadingFichas } = useVarianciasFicha(mes || undefined)
  const { data: pecas = [], isLoading: loadingPecas } = useVarianciasPeca(mes || undefined, apenasAlertas)
  const { mutateAsync: gerar, isPending: gerando } = useGerarVariancias()

  async function handleGerar() {
    try {
      const resultado = await gerar(undefined)
      toast.success(`Enfileirado para ${resultado.mes_referencia}`)
    } catch {
      toast.error("Erro ao gerar variâncias.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Variâncias do Motor</h1>
            <p className="text-xs text-white/40 mt-0.5">
              Desvios entre estimado (ficha técnica) e realizado (apontamento/NF-e).
            </p>
          </div>
        </div>
        <button
          onClick={handleGerar}
          disabled={gerando}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 hover:bg-white/5 px-3 py-1.5 text-sm text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${gerando ? "animate-spin" : ""}`} />
          {gerando ? "Gerando..." : "Gerar variâncias"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-white/5 p-1 w-fit">
        {(["fichas", "pecas"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === t ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
            }`}
          >
            {t === "fichas" ? "Fichas Técnicas" : "Custo de Peças"}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-white/50 mb-1">Mês de referência</label>
          <input
            type="month"
            className={selectCls}
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </div>
        {tab === "pecas" && (
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={apenasAlertas}
              onChange={(e) => setApenasAlertas(e.target.checked)}
              className="rounded"
            />
            Somente alertas (&gt;15%)
          </label>
        )}
      </div>

      {/* Tabela Fichas */}
      {tab === "fichas" && (
        loadingFichas ? (
          <div className="text-white/40 text-sm">Carregando...</div>
        ) : fichas.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
            Sem variâncias de ficha para o período selecionado.
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                  <th className="px-4 py-3 text-left">Serviço Canônico</th>
                  <th className="px-4 py-3 text-left">Mês</th>
                  <th className="px-4 py-3 text-right">OS</th>
                  <th className="px-4 py-3 text-right">Δ Horas</th>
                  <th className="px-4 py-3 text-right">Δ Insumo</th>
                </tr>
              </thead>
              <tbody>
                {fichas.map((f) => (
                  <tr key={f.id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-white/70 font-mono text-xs max-w-[200px] truncate">{f.servico_canonico_id}</td>
                    <td className="px-4 py-3 text-white/60 text-xs">{f.mes_referencia.slice(0, 7)}</td>
                    <td className="px-4 py-3 text-right text-white/60">{f.qtd_os}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${pctColor(f.variancia_horas_pct)}`}>
                      {formatPct(f.variancia_horas_pct)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${pctColor(f.variancia_insumo_pct)}`}>
                      {formatPct(f.variancia_insumo_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Tabela Peças */}
      {tab === "pecas" && (
        loadingPecas ? (
          <div className="text-white/40 text-sm">Carregando...</div>
        ) : pecas.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
            Sem variâncias de peça para o período selecionado.
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                  <th className="px-4 py-3 text-left">Peça Canônica</th>
                  <th className="px-4 py-3 text-left">Mês</th>
                  <th className="px-4 py-3 text-right">Amostras</th>
                  <th className="px-4 py-3 text-right">Custo Snapshot</th>
                  <th className="px-4 py-3 text-right">Custo NF-e</th>
                  <th className="px-4 py-3 text-right">Δ</th>
                  <th className="px-4 py-3 text-center">Alerta</th>
                </tr>
              </thead>
              <tbody>
                {pecas.map((p) => (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-white/70 font-mono text-xs max-w-[180px] truncate">{p.peca_canonica_id}</td>
                    <td className="px-4 py-3 text-white/60 text-xs">{p.mes_referencia.slice(0, 7)}</td>
                    <td className="px-4 py-3 text-right text-white/60">{p.qtd_amostras}</td>
                    <td className="px-4 py-3 text-right text-white/70">
                      R$ {parseFloat(p.custo_snapshot_medio).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-white/70">
                      R$ {parseFloat(p.custo_nfe_medio).toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${pctColor(p.variancia_pct)}`}>
                      {formatPct(p.variancia_pct)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.alerta && (
                        <AlertTriangle className="h-4 w-4 text-yellow-400 inline-block" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
