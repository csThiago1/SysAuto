"use client"

import { useState } from "react"
import { Shield, CheckCircle2, XCircle, Activity } from "lucide-react"
import { useAuditoriaMotor, useMotorHealthcheck } from "@/hooks/useCapacidade"
import type { AuditoriaOperacao } from "@paddock/types"

const OPERACOES: { value: AuditoriaOperacao | ""; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "calcular_servico", label: "Calcular Serviço" },
  { value: "calcular_peca", label: "Calcular Peça" },
  { value: "simular", label: "Simular" },
  { value: "benchmark_check", label: "Benchmark Check" },
]

const selectCls =
  "text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"

export default function AuditoriaMotorPage() {
  const [operacao, setOperacao] = useState<AuditoriaOperacao | "">("")
  const [somenteErros, setSomenteErros] = useState(false)

  const { data: health } = useMotorHealthcheck()
  const { data: auditorias = [], isLoading } = useAuditoriaMotor(
    operacao || undefined,
    somenteErros ? false : undefined
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Auditoria do Motor</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Log imutável de todas as chamadas ao motor de precificação.
          </p>
        </div>
      </div>

      {/* Healthcheck */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Status",
              value: health.status === "ok" ? "Operacional" : "Degradado",
              icon: health.status === "ok" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              ),
              color: health.status === "ok" ? "text-emerald-400" : "text-red-400",
            },
            {
              label: "Total de chamadas",
              value: health.total_chamadas?.toLocaleString("pt-BR") ?? "—",
              color: "text-white",
            },
            {
              label: "Taxa de erro",
              value: health.taxa_erro_pct != null ? `${health.taxa_erro_pct.toFixed(1)}%` : "—",
              color: (health.taxa_erro_pct ?? 0) > 5 ? "text-red-400" : "text-emerald-400",
            },
            {
              label: "Tempo médio",
              value: health.tempo_medio_ms != null ? `${health.tempo_medio_ms}ms` : "—",
              color: "text-white",
            },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2">
                {"icon" in kpi && kpi.icon}
                <p className="text-xs text-white/40">{kpi.label}</p>
              </div>
              <p className={`text-lg font-semibold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className={selectCls}
          value={operacao}
          onChange={(e) => setOperacao(e.target.value as AuditoriaOperacao | "")}
        >
          {OPERACOES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={somenteErros}
            onChange={(e) => setSomenteErros(e.target.checked)}
            className="rounded"
          />
          Somente erros
        </label>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : auditorias.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhuma auditoria encontrada.
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Operação</th>
                  <th className="px-4 py-3 text-right">Tempo</th>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Erro</th>
                </tr>
              </thead>
              <tbody>
                {auditorias.map((a) => (
                  <tr key={a.id} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      {a.sucesso ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/80 text-xs font-mono">{a.operacao}</td>
                    <td className="px-4 py-3 text-right text-white/60 text-xs">
                      {a.tempo_ms}ms
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-red-400 text-xs max-w-xs truncate">
                      {a.erro_msg || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-white/5 text-xs text-white/30">
            Mostrando até 500 registros mais recentes.
          </div>
        </div>
      )}
    </div>
  )
}
