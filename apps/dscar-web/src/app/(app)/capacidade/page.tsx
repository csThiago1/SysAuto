"use client"

import { useState } from "react"
import { Users, Calendar, AlertTriangle, Clock, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  useCapacidades,
  useBloqueios,
  useHeatmapSemana,
  useCreateCapacidade,
  useDeleteCapacidade,
  useCreateBloqueio,
  useDeleteBloqueio,
} from "@/hooks/useCapacidade"
import type { CapacidadeTecnico, BloqueioCapacidade, HeatmapDia } from "@paddock/types"

function startOfWeek(d: Date): string {
  const day = d.getDay() // 0=dom
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // seg
  const seg = new Date(d)
  seg.setDate(diff)
  return seg.toISOString().slice(0, 10)
}

function utilizacaoColor(u: number): string {
  if (u < 0.5) return "bg-emerald-500"
  if (u < 0.8) return "bg-yellow-500"
  return "bg-red-500"
}

function HeatmapWidget({ dias }: { dias: HeatmapDia[] }) {
  const diasSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
        Utilização da Semana
      </h3>
      <div className="grid grid-cols-7 gap-1">
        {diasSemana.map((d, i) => (
          <div key={d} className="text-center">
            <p className="text-xs text-white/40 mb-1">{d}</p>
            {dias[i] ? (
              <div
                className={`h-8 rounded ${utilizacaoColor(dias[i].utilizacao_geral)} opacity-80`}
                title={`${(dias[i].utilizacao_geral * 100).toFixed(0)}%`}
              />
            ) : (
              <div className="h-8 rounded bg-white/10" />
            )}
            {dias[i] && (
              <p className="text-xs text-white/40 mt-1">
                {(dias[i].utilizacao_geral * 100).toFixed(0)}%
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-white/40">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />Livre</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />Médio</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Crítico</span>
      </div>
    </div>
  )
}

const inputCls = "w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-white/20"
const labelCls = "block text-xs text-white/50 mb-1"

export default function CapacidadePage() {
  const semanaInicio = startOfWeek(new Date())
  const { data: capacidades = [], isLoading: loadingCap } = useCapacidades()
  const { data: bloqueios = [], isLoading: loadingBlq } = useBloqueios()
  const { data: heatmap = [] } = useHeatmapSemana(semanaInicio)
  const { mutateAsync: criarCap, isPending: criandoCap } = useCreateCapacidade()
  const { mutateAsync: deleteCap } = useDeleteCapacidade()
  const { mutateAsync: criarBlq, isPending: criandoBlq } = useCreateBloqueio()
  const { mutateAsync: deleteBlq } = useDeleteBloqueio()

  const [showCapForm, setShowCapForm] = useState(false)
  const [showBlqForm, setShowBlqForm] = useState(false)
  const [capForm, setCapForm] = useState({ tecnico: "", categoria_mao_obra: "", horas_dia_util: "8", vigente_desde: "" })
  const [blqForm, setBlqForm] = useState({ tecnico: "", data_inicio: "", data_fim: "", motivo: "" })

  async function handleCriarCap(e: React.FormEvent) {
    e.preventDefault()
    try {
      await criarCap({ ...capForm, dias_semana: [1, 2, 3, 4, 5] })
      toast.success("Capacidade criada!")
      setShowCapForm(false)
      setCapForm({ tecnico: "", categoria_mao_obra: "", horas_dia_util: "8", vigente_desde: "" })
    } catch {
      toast.error("Erro ao criar capacidade.")
    }
  }

  async function handleCriarBlq(e: React.FormEvent) {
    e.preventDefault()
    try {
      await criarBlq(blqForm)
      toast.success("Bloqueio criado!")
      setShowBlqForm(false)
      setBlqForm({ tecnico: "", data_inicio: "", data_fim: "", motivo: "" })
    } catch {
      toast.error("Erro ao criar bloqueio.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Capacidade Técnica</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Disponibilidade e utilização da equipe técnica por categoria.
          </p>
        </div>
      </div>

      {/* Heatmap semanal */}
      {heatmap.length > 0 && <HeatmapWidget dias={heatmap} />}

      {/* Capacidades */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Capacidades por Técnico</h2>
          <button
            onClick={() => setShowCapForm(!showCapForm)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 hover:bg-primary-700 px-3 py-1.5 text-sm text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova Capacidade
          </button>
        </div>

        {showCapForm && (
          <form onSubmit={handleCriarCap} className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>UUID do Técnico *</label>
                <input className={inputCls} placeholder="UUID do Employee" value={capForm.tecnico} onChange={(e) => setCapForm(p => ({ ...p, tecnico: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>UUID da Categoria *</label>
                <input className={inputCls} placeholder="UUID de CategoriaMaoObra" value={capForm.categoria_mao_obra} onChange={(e) => setCapForm(p => ({ ...p, categoria_mao_obra: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Horas/dia útil</label>
                <input className={inputCls} type="number" min="1" max="24" step="0.5" value={capForm.horas_dia_util} onChange={(e) => setCapForm(p => ({ ...p, horas_dia_util: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Vigente desde *</label>
                <input className={inputCls} type="date" value={capForm.vigente_desde} onChange={(e) => setCapForm(p => ({ ...p, vigente_desde: e.target.value }))} required />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCapForm(false)} className="px-3 py-1.5 text-sm text-white/60 hover:text-white">Cancelar</button>
              <button type="submit" disabled={criandoCap} className="px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-md">
                {criandoCap ? "Criando..." : "Criar"}
              </button>
            </div>
          </form>
        )}

        {loadingCap ? (
          <div className="text-white/40 text-sm">Carregando...</div>
        ) : capacidades.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-white/40 text-sm">
            Nenhuma capacidade cadastrada.
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                  <th className="px-4 py-3 text-left">Técnico</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                  <th className="px-4 py-3 text-right">Horas/dia</th>
                  <th className="px-4 py-3 text-left">Vigente desde</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {capacidades.map((c) => (
                  <tr key={c.id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-white/70 font-mono text-xs">{c.tecnico}</td>
                    <td className="px-4 py-3 text-white/70 font-mono text-xs">{c.categoria_mao_obra}</td>
                    <td className="px-4 py-3 text-right text-white">{c.horas_dia_util}h</td>
                    <td className="px-4 py-3 text-white/60 text-xs">{c.vigente_desde}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteCap(c.id)} className="text-white/30 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bloqueios */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Bloqueios de Capacidade</h2>
          <button
            onClick={() => setShowBlqForm(!showBlqForm)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 hover:bg-white/5 px-3 py-1.5 text-sm text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Bloqueio
          </button>
        </div>

        {showBlqForm && (
          <form onSubmit={handleCriarBlq} className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>UUID do Técnico *</label>
                <input className={inputCls} placeholder="UUID do Employee" value={blqForm.tecnico} onChange={(e) => setBlqForm(p => ({ ...p, tecnico: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Motivo *</label>
                <input className={inputCls} placeholder="Ex: Férias, Licença médica" value={blqForm.motivo} onChange={(e) => setBlqForm(p => ({ ...p, motivo: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Data início *</label>
                <input className={inputCls} type="date" value={blqForm.data_inicio} onChange={(e) => setBlqForm(p => ({ ...p, data_inicio: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Data fim *</label>
                <input className={inputCls} type="date" value={blqForm.data_fim} onChange={(e) => setBlqForm(p => ({ ...p, data_fim: e.target.value }))} required />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowBlqForm(false)} className="px-3 py-1.5 text-sm text-white/60 hover:text-white">Cancelar</button>
              <button type="submit" disabled={criandoBlq} className="px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-md">
                {criandoBlq ? "Criando..." : "Criar"}
              </button>
            </div>
          </form>
        )}

        {loadingBlq ? (
          <div className="text-white/40 text-sm">Carregando...</div>
        ) : bloqueios.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center text-white/40 text-sm">
            Nenhum bloqueio cadastrado.
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                  <th className="px-4 py-3 text-left">Técnico</th>
                  <th className="px-4 py-3 text-left">Período</th>
                  <th className="px-4 py-3 text-left">Motivo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {bloqueios.map((b) => (
                  <tr key={b.id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-white/70 font-mono text-xs">{b.tecnico}</td>
                    <td className="px-4 py-3 text-white/60 text-xs">{b.data_inicio} → {b.data_fim}</td>
                    <td className="px-4 py-3 text-white/80">{b.motivo}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteBlq(b.id)} className="text-white/30 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
