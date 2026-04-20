"use client"

import { useState } from "react"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useBenchmarkEstatisticas } from "@/hooks/useBenchmark"

const formatBRL = (v: string | null) =>
  v ? parseFloat(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"

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
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">UUID do Serviço Canônico</Label>
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-xs"
              placeholder="UUID do ServicoCanonico"
              value={servicoId}
              onChange={(e) => { setServicoId(e.target.value); setBuscar(false) }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Segmento</Label>
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="Código do segmento"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Tamanho</Label>
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="Código do tamanho"
              value={tamanho}
              onChange={(e) => setTamanho(e.target.value)}
            />
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => { if (servicoId) setBuscar(true) }}
          disabled={!servicoId}
        >
          Consultar
        </Button>
      </div>

      {/* Resultado */}
      {buscar && (
        isLoading ? (
          <p className="text-xs text-white/40 py-8 text-center">Consultando...</p>
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
          <p className="text-white/40 text-sm">Sem dados para este serviço/segmento.</p>
        )
      )}
    </div>
  )
}
