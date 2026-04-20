"use client"

import { useState } from "react"
import { BarChart3, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useBenchmarkEstatisticas } from "@/hooks/useBenchmark"
import { useServicosCanonico } from "@/hooks/usePricingCatalog"
import { useSegmentosVeiculares, useCategoriasTamanho } from "@/hooks/usePricingProfile"

const formatBRL = (v: string | null) =>
  v ? parseFloat(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"

export default function BenchmarkEstatisticasPage() {
  const [servicoSearch, setServicoSearch] = useState("")
  const [servicoSelecionado, setServicoSelecionado] = useState<{ id: string; nome: string } | null>(null)
  const [segmento, setSegmento] = useState("")
  const [tamanho, setTamanho] = useState("")
  const [buscar, setBuscar] = useState(false)

  const { data: servicos = [] } = useServicosCanonico(servicoSearch.length >= 2 ? servicoSearch : undefined)
  const { data: segmentos = [] } = useSegmentosVeiculares()
  const { data: tamanhos = [] } = useCategoriasTamanho()

  const { data: stats, isLoading } = useBenchmarkEstatisticas(
    buscar && servicoSelecionado ? servicoSelecionado.id : "",
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
            Preços p50/p90 de mercado por tipo de serviço, segmento e tamanho de veículo.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
        {/* Busca de serviço */}
        <div className="space-y-1.5">
          <Label className="text-white/70 text-xs">Serviço *</Label>
          {servicoSelecionado ? (
            <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2">
              <span className="text-sm text-white">{servicoSelecionado.nome}</span>
              <button
                type="button"
                onClick={() => { setServicoSelecionado(null); setServicoSearch(""); setBuscar(false) }}
                className="text-white/30 hover:text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                <Input
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-8"
                  placeholder="Ex: funilaria, pintura, polimento…"
                  value={servicoSearch}
                  onChange={(e) => { setServicoSearch(e.target.value); setBuscar(false) }}
                />
              </div>
              {servicos.length > 0 && (
                <div className="rounded-md border border-white/10 overflow-hidden max-h-44 overflow-y-auto">
                  {servicos.slice(0, 8).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setServicoSelecionado({ id: s.id, nome: s.nome }); setServicoSearch("") }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                    >
                      <span className="text-sm text-white">{s.nome}</span>
                      {s.categoria_nome && <span className="text-xs text-white/30">{s.categoria_nome}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Segmento do veículo</Label>
            <select
              className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            >
              <option value="">Todos os segmentos</option>
              {segmentos.map((s) => (
                <option key={s.codigo} value={s.codigo}>{s.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Tamanho do veículo</Label>
            <select
              className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={tamanho}
              onChange={(e) => setTamanho(e.target.value)}
            >
              <option value="">Todos os tamanhos</option>
              {tamanhos.map((t) => (
                <option key={t.codigo} value={t.codigo}>{t.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <Button size="sm" onClick={() => setBuscar(true)} disabled={!servicoSelecionado}>
          Consultar preços de mercado
        </Button>
      </div>

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
