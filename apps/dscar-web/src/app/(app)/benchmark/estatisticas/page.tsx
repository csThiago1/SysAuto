"use client"

import { useState } from "react"
import { BarChart3 } from "lucide-react"
import { useBenchmarkEstatisticas } from "@/hooks/useBenchmark"

const formatBRL = (v: string | null) =>
  v ? parseFloat(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"

const inputCls =
  "text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-white/20"

export default function BenchmarkEstatisticasPage() {
  const [servicoId, setServicoId] = useState("")
  const [segmento, setSegmento] = useState("")
  const [tamanho, setTamanho] = useState("")
  const [buscar, setBuscar] = useState(false)

  const { data: stats, isLoading } = useBenchmarkEstatisticas(
    buscar ? servicoId : "",
    segmento,
    tamanho
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Estatísticas de Benchmark</h1>
          <p className="text-xs text-white/40 mt-0.5">
            p50/p90 de mercado para um serviço por segmento e tamanho.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">UUID do Serviço Canônico</label>
            <input
              className={inputCls + " w-full"}
              placeholder="UUID do ServicoCanonico"
              value={servicoId}
              onChange={(e) => { setServicoId(e.target.value); setBuscar(false) }}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Segmento</label>
            <input
              className={inputCls + " w-full"}
              placeholder="Código do segmento"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Tamanho</label>
            <input
              className={inputCls + " w-full"}
              placeholder="Código do tamanho"
              value={tamanho}
              onChange={(e) => setTamanho(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => { if (servicoId) setBuscar(true) }}
          disabled={!servicoId}
          className="px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-md"
        >
          Consultar
        </button>
      </div>

      {/* Resultado */}
      {buscar && (
        isLoading ? (
          <div className="text-white/40 text-sm">Consultando...</div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Amostras", value: String(stats.count), color: "text-white" },
                { label: "Mínimo", value: formatBRL(stats.minimo), color: "text-white/70" },
                { label: "p50 (Mediana)", value: formatBRL(stats.p50), color: "text-blue-400" },
                { label: "p90 (Teto)", value: formatBRL(stats.p90), color: "text-yellow-400" },
                { label: "Máximo", value: formatBRL(stats.maximo), color: "text-white/70" },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/40">{kpi.label}</p>
                  <p className={`text-lg font-semibold mt-1 ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {stats.count < 8 && (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-400">
                Atenção: apenas {stats.count} amostra{stats.count !== 1 ? "s" : ""} disponível
                (mínimo 8 para p90 confiável). Janela: {stats.janela_dias} dias.
              </div>
            )}
          </div>
        ) : (
          <div className="text-white/40 text-sm">Sem dados para este serviço/segmento.</div>
        )
      )}
    </div>
  )
}
