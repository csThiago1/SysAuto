"use client"

import { useState } from "react"
import { Database, Plus } from "lucide-react"
import { toast } from "sonner"
import { useBenchmarkFontes, useCreateBenchmarkFonte } from "@/hooks/useBenchmark"
import type { BenchmarkFonteTipo } from "@paddock/types"

const TIPO_LABELS: Record<BenchmarkFonteTipo, string> = {
  seguradora_pdf: "PDF Seguradora",
  seguradora_json: "API JSON",
  cotacao_externa: "Cotação Externa",
  concorrente: "Auditoria Concorrente",
}

const inputCls =
  "w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-white/20"
const labelCls = "block text-xs text-white/50 mb-1"

export default function BenchmarkFontesPage() {
  const { data: fontes = [], isLoading } = useBenchmarkFontes()
  const { mutateAsync: criar, isPending } = useCreateBenchmarkFonte()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    nome: "",
    tipo: "seguradora_pdf" as BenchmarkFonteTipo,
    confiabilidade: "0.80",
    empresa_id: "",
  })

  const set = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.empresa_id) {
      toast.error("Preencha nome e ID da empresa.")
      return
    }
    try {
      await criar({
        nome: form.nome,
        tipo: form.tipo,
        confiabilidade: form.confiabilidade,
        empresa: form.empresa_id,
      })
      toast.success("Fonte criada!")
      setShowForm(false)
      setForm({ nome: "", tipo: "seguradora_pdf", confiabilidade: "0.80", empresa_id: "" })
    } catch {
      toast.error("Erro ao criar fonte.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Fontes de Benchmark</h1>
            <p className="text-xs text-white/40 mt-0.5">
              Seguradoras, marketplaces e concorrentes como fonte de preços de mercado.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 hover:bg-primary-700 px-3 py-1.5 text-sm text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Fonte
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Nova Fonte</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nome *</label>
              <input className={inputCls} value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Porto Seguro Q1 2026" required />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select className={inputCls} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>ID da Empresa *</label>
              <input className={inputCls} value={form.empresa_id} onChange={(e) => set("empresa_id", e.target.value)} placeholder="UUID da empresa" required />
            </div>
            <div>
              <label className={labelCls}>Confiabilidade (0-1)</label>
              <input className={inputCls} type="number" min="0" max="1" step="0.05" value={form.confiabilidade} onChange={(e) => set("confiabilidade", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-white/60 hover:text-white">Cancelar</button>
            <button type="submit" disabled={isPending} className="px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-md">
              {isPending ? "Criando..." : "Criar"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : fontes.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhuma fonte cadastrada.
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right">Confiabilidade</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {fontes.map((f) => (
                <tr key={f.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white">{f.nome}</td>
                  <td className="px-4 py-3 text-white/60">{TIPO_LABELS[f.tipo]}</td>
                  <td className="px-4 py-3 text-right text-white/60">
                    {(parseFloat(f.confiabilidade) * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${f.is_active ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                      {f.is_active ? "Ativa" : "Inativa"}
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
