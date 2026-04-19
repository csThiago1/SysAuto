"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, ChevronLeft } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"
import { useCreateOrcamento } from "@/hooks/useQuotes"
import type { TipoResponsabilidade } from "@paddock/types"

export default function NovoOrcamentoPage() {
  const router = useRouter()
  const { mutateAsync: criar, isPending } = useCreateOrcamento()

  const [form, setForm] = useState({
    empresa_id:            "",
    customer_id:           "",
    insurer_id:            "",
    tipo_responsabilidade: "cliente" as TipoResponsabilidade,
    sinistro_numero:       "",
    observacoes:           "",
    // Dados do veículo
    veiculo_marca:         "",
    veiculo_modelo:        "",
    veiculo_ano:           new Date().getFullYear().toString(),
    veiculo_versao:        "",
    veiculo_placa:         "",
  })

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.empresa_id || !form.customer_id || !form.veiculo_marca || !form.veiculo_modelo) {
      toast.error("Preencha empresa, cliente e dados do veículo.")
      return
    }
    try {
      const orc = await criar({
        empresa_id: form.empresa_id,
        customer_id: form.customer_id,
        insurer_id: form.insurer_id || null,
        tipo_responsabilidade: form.tipo_responsabilidade,
        sinistro_numero: form.sinistro_numero,
        observacoes: form.observacoes,
        veiculo: {
          marca:  form.veiculo_marca,
          modelo: form.veiculo_modelo,
          ano:    parseInt(form.veiculo_ano),
          versao: form.veiculo_versao || undefined,
          placa:  form.veiculo_placa || undefined,
        },
      })
      toast.success(`Orçamento ${orc.numero} criado!`)
      router.push(`/orcamentos/${orc.id}` as Route)
    } catch {
      toast.error("Erro ao criar orçamento. Tente novamente.")
    }
  }

  const inputCls =
    "w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-white/20"
  const labelCls = "block text-xs text-white/50 mb-1"

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={"/orcamentos" as Route} className="text-white/40 hover:text-white/70 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <FileText className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Novo Orçamento</h1>
          <p className="text-xs text-white/40">Preencha as informações para criar o orçamento.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Empresa e cliente */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Identificação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>ID da Empresa *</label>
              <input
                className={inputCls}
                placeholder="UUID da empresa"
                value={form.empresa_id}
                onChange={(e) => set("empresa_id", e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>ID do Cliente *</label>
              <input
                className={inputCls}
                placeholder="UUID do cliente"
                value={form.customer_id}
                onChange={(e) => set("customer_id", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Responsabilidade</label>
              <select
                className={inputCls}
                value={form.tipo_responsabilidade}
                onChange={(e) => set("tipo_responsabilidade", e.target.value)}
              >
                <option value="cliente">Cliente</option>
                <option value="seguradora">Seguradora</option>
                <option value="rcf">RCF — terceiros</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>ID da Seguradora</label>
              <input
                className={inputCls}
                placeholder="UUID da seguradora (opcional)"
                value={form.insurer_id}
                onChange={(e) => set("insurer_id", e.target.value)}
              />
            </div>
          </div>
          {(form.tipo_responsabilidade === "seguradora" || form.tipo_responsabilidade === "rcf") && (
            <div>
              <label className={labelCls}>Número do sinistro</label>
              <input
                className={inputCls}
                placeholder="Número do sinistro"
                value={form.sinistro_numero}
                onChange={(e) => set("sinistro_numero", e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Veículo */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Veículo</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Marca *</label>
              <input
                className={inputCls}
                placeholder="Ex: Toyota"
                value={form.veiculo_marca}
                onChange={(e) => set("veiculo_marca", e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Modelo *</label>
              <input
                className={inputCls}
                placeholder="Ex: Corolla"
                value={form.veiculo_modelo}
                onChange={(e) => set("veiculo_modelo", e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Ano *</label>
              <input
                className={inputCls}
                type="number"
                min="1980"
                max={new Date().getFullYear() + 1}
                value={form.veiculo_ano}
                onChange={(e) => set("veiculo_ano", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Versão</label>
              <input
                className={inputCls}
                placeholder="Ex: 2.0 XEI"
                value={form.veiculo_versao}
                onChange={(e) => set("veiculo_versao", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Placa</label>
              <input
                className={inputCls}
                placeholder="Ex: ABC-1234"
                value={form.veiculo_placa}
                onChange={(e) => set("veiculo_placa", e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className={labelCls}>Observações</label>
          <textarea
            className={inputCls + " resize-none"}
            rows={3}
            placeholder="Observações gerais sobre o orçamento..."
            value={form.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href={"/orcamentos" as Route}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-md transition-colors"
          >
            {isPending ? "Criando..." : "Criar Orçamento"}
          </button>
        </div>
      </form>
    </div>
  )
}
