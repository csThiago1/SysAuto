"use client"

import { useState } from "react"
import { Printer, Plus, Trash2, Wifi } from "lucide-react"
import { toast } from "sonner"
import {
  useImpressoras,
  useImpressoraCreate,
  useImpressoraUpdate,
  useImpressoraDelete,
  useTestarImpressora,
} from "@/hooks/useInventory"
import type { ImpressoraEtiqueta, ModeloImpressora } from "@paddock/types"

const MODELOS: { value: ModeloImpressora; label: string }[] = [
  { value: "zebra_zpl", label: "Zebra ZPL" },
  { value: "bixolon_spp", label: "Bixolon SPP" },
  { value: "brother_ql", label: "Brother QL" },
]

function ImpressoraRow({ impressora }: { impressora: ImpressoraEtiqueta }) {
  const testar = useTestarImpressora(impressora.id)
  const deleteMutation = useImpressoraDelete(impressora.id)

  async function handleTestar() {
    try {
      const result = await testar.mutateAsync()
      toast.success(result.detail)
    } catch {
      toast.error("Impressora não respondeu.")
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync()
      toast.success("Impressora removida.")
    } catch {
      toast.error("Erro ao remover impressora.")
    }
  }

  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3 text-white font-medium">{impressora.nome}</td>
      <td className="px-4 py-3 text-white/60">{impressora.modelo_display}</td>
      <td className="px-4 py-3 text-white/60 font-mono text-xs">{impressora.endpoint}</td>
      <td className="px-4 py-3 text-white/60 text-xs">
        {impressora.largura_mm} × {impressora.altura_mm} mm
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          impressora.is_active
            ? "text-emerald-400 bg-emerald-400/10"
            : "text-white/40 bg-white/5"
        }`}>
          {impressora.is_active ? "Ativa" : "Inativa"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestar}
            disabled={testar.isPending}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
          >
            <Wifi className="h-3 w-3" />
            Testar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Remover
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function ImpressorasPage() {
  const { data: impressoras = [], isLoading } = useImpressoras()
  const createMutation = useImpressoraCreate()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    nome: "",
    modelo: "zebra_zpl" as ModeloImpressora,
    endpoint: "",
    largura_mm: 100,
    altura_mm: 50,
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createMutation.mutateAsync(form)
      toast.success("Impressora cadastrada.")
      setShowForm(false)
      setForm({ nome: "", modelo: "zebra_zpl", endpoint: "", largura_mm: 100, altura_mm: 50 })
    } catch {
      toast.error("Erro ao cadastrar impressora.")
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Printer className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Impressoras de Etiqueta</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {impressoras.length} impressora{impressoras.length !== 1 ? "s" : ""} cadastrada{impressoras.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Impressora
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white">Nova Impressora</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-white/50">Nome</label>
              <input
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Zebra GK420d"
                className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Modelo</label>
              <select
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value as ModeloImpressora })}
                className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {MODELOS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs text-white/50">Endpoint (URL ou IP:porta)</label>
              <input
                required
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                placeholder="Ex: http://192.168.1.100:9100"
                className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Largura (mm)</label>
              <input
                type="number"
                value={form.largura_mm}
                onChange={(e) => setForm({ ...form, largura_mm: parseInt(e.target.value) })}
                className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Altura (mm)</label>
              <input
                type="number"
                value={form.altura_mm}
                onChange={(e) => setForm({ ...form, altura_mm: parseInt(e.target.value) })}
                className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 rounded-md transition-colors"
            >
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : impressoras.length === 0 && !showForm ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhuma impressora cadastrada.
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Modelo</th>
                <th className="px-4 py-3 text-left">Endpoint</th>
                <th className="px-4 py-3 text-left">Etiqueta</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {impressoras.map((impressora) => (
                <ImpressoraRow key={impressora.id} impressora={impressora} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
