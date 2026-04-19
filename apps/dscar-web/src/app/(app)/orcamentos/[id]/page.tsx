"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, FileText, CheckCircle, XCircle, Send, Copy } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"
import {
  useOrcamento,
  useEnviarOrcamento,
  useRecusarOrcamento,
  useAprovarOrcamento,
  useNovaVersaoOrcamento,
} from "@/hooks/useQuotes"
import type { StatusOrcamento } from "@paddock/types"

const STATUS_LABELS: Record<StatusOrcamento, string> = {
  rascunho:      "Rascunho",
  enviado:       "Enviado",
  aprovado:      "Aprovado",
  aprovado_parc: "Aprovado Parcial",
  recusado:      "Recusado",
  expirado:      "Expirado",
  convertido_os: "Convertido em OS",
}

const STATUS_COLORS: Record<StatusOrcamento, string> = {
  rascunho:      "text-white/50 bg-white/10",
  enviado:       "text-blue-400 bg-blue-400/10",
  aprovado:      "text-emerald-400 bg-emerald-400/10",
  aprovado_parc: "text-yellow-400 bg-yellow-400/10",
  recusado:      "text-red-400 bg-red-400/10",
  expirado:      "text-orange-400 bg-orange-400/10",
  convertido_os: "text-purple-400 bg-purple-400/10",
}

const ACAO_LABELS: Record<string, string> = {
  trocar:             "Trocar",
  reparar:            "Reparar",
  pintar:             "Pintar",
  remocao_instalacao: "R&I",
}

const formatBRL = (v: string | number) =>
  parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function OrcamentoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: orc, isLoading, error } = useOrcamento(id)
  const { mutateAsync: enviar,    isPending: enviando }  = useEnviarOrcamento(id)
  const { mutateAsync: recusar,   isPending: recusando } = useRecusarOrcamento(id)
  const { mutateAsync: aprovar,   isPending: aprovando } = useAprovarOrcamento(id)
  const { mutateAsync: novaVersao, isPending: clonando } = useNovaVersaoOrcamento(id)

  const [showAprovar, setShowAprovar] = useState(false)

  if (isLoading) return <div className="p-6 text-white/40 text-sm">Carregando orçamento...</div>
  if (error || !orc) return <div className="p-6 text-red-400 text-sm">Orçamento não encontrado.</div>

  async function handleEnviar() {
    try {
      await enviar()
      toast.success("Orçamento enviado ao cliente.")
    } catch {
      toast.error("Erro ao enviar orçamento.")
    }
  }

  async function handleRecusar() {
    try {
      await recusar()
      toast.success("Orçamento recusado.")
    } catch {
      toast.error("Erro ao recusar orçamento.")
    }
  }

  async function handleAprovar() {
    try {
      const res = await aprovar({ intervencoes_ids: null, itens_adicionais_ids: null, areas_negadas: null })
      toast.success(`OS #${res.os_number} criada com sucesso!`)
      router.push(`/os/${res.os_id}` as Route)
    } catch {
      toast.error("Erro ao aprovar orçamento.")
    }
  }

  async function handleNovaVersao() {
    try {
      const nova = await novaVersao()
      toast.success(`Versão ${nova.versao} criada.`)
      router.push(`/orcamentos/${nova.id}` as Route)
    } catch {
      toast.error("Erro ao criar nova versão.")
    }
  }

  const canEnviar  = orc.status === "rascunho"
  const canAprovar = ["rascunho", "enviado"].includes(orc.status)
  const canRecusar = !["convertido_os", "expirado"].includes(orc.status)
  const canClone   = orc.status === "aprovado" || orc.status === "aprovado_parc"

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href={"/orcamentos" as Route} className="text-white/40 hover:text-white/70 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <FileText className="h-5 w-5 text-primary-500" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white">{orc.numero}</h1>
              <span className="text-white/40 text-sm">v{orc.versao}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[orc.status]}`}>
                {STATUS_LABELS[orc.status]}
              </span>
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              {orc.customer_nome} · {orc.veiculo_marca} {orc.veiculo_modelo} {orc.veiculo_ano}
              {orc.veiculo_placa && ` · ${orc.veiculo_placa}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {canClone && (
            <button
              onClick={handleNovaVersao}
              disabled={clonando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-white/20 text-white/70 hover:text-white hover:border-white/40 rounded-md transition-colors disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" />
              Nova versão
            </button>
          )}
          {canEnviar && (
            <button
              onClick={handleEnviar}
              disabled={enviando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar
            </button>
          )}
          {canRecusar && orc.status !== "rascunho" && (
            <button
              onClick={handleRecusar}
              disabled={recusando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Recusar
            </button>
          )}
          {canAprovar && (
            <button
              onClick={handleAprovar}
              disabled={aprovando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {aprovando ? "Aprovando..." : "Aprovar → OS"}
            </button>
          )}
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40">Subtotal</p>
          <p className="text-lg font-semibold text-white mt-1">{formatBRL(orc.subtotal)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40">Desconto</p>
          <p className="text-lg font-semibold text-red-400 mt-1">-{formatBRL(orc.desconto)}</p>
        </div>
        <div className="rounded-lg border border-primary-500/20 bg-primary-500/5 p-4">
          <p className="text-xs text-white/40">Total</p>
          <p className="text-lg font-semibold text-primary-400 mt-1">{formatBRL(orc.total)}</p>
        </div>
      </div>

      {/* Intervenções por área */}
      {orc.areas.map((area) => {
        const ivs = orc.intervencoes.filter((iv) => iv.area_impacto === area.id)
        if (ivs.length === 0) return null
        return (
          <div key={area.id} className="rounded-lg border border-white/10 overflow-hidden">
            <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-medium text-white">{area.titulo}</span>
              <span className="text-xs text-white/40">{ivs.length} intervenção{ivs.length !== 1 ? "ões" : ""}</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="px-4 py-2 text-left">Peça</th>
                  <th className="px-4 py-2 text-left">Ação</th>
                  <th className="px-4 py-2 text-left">Fornecimento</th>
                  <th className="px-4 py-2 text-right">Horas MO</th>
                  <th className="px-4 py-2 text-right">Peça</th>
                  <th className="px-4 py-2 text-right">MO</th>
                  <th className="px-4 py-2 text-right">Insumos</th>
                  <th className="px-4 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {ivs.map((iv) => (
                  <tr key={iv.id} className="border-b border-white/5">
                    <td className="px-4 py-2 text-white/80">{iv.peca_nome || iv.peca_canonica}</td>
                    <td className="px-4 py-2 text-white/60">{ACAO_LABELS[iv.acao] ?? iv.acao}</td>
                    <td className="px-4 py-2 text-white/50 capitalize">{iv.fornecimento}</td>
                    <td className="px-4 py-2 text-right text-white/60">{parseFloat(iv.horas_mao_obra).toFixed(1)}h</td>
                    <td className="px-4 py-2 text-right text-white/60">{formatBRL(iv.valor_peca)}</td>
                    <td className="px-4 py-2 text-right text-white/60">{formatBRL(iv.valor_mao_obra)}</td>
                    <td className="px-4 py-2 text-right text-white/60">{formatBRL(iv.valor_insumos)}</td>
                    <td className="px-4 py-2 text-right text-white font-medium">{formatBRL(iv.preco_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {/* Itens adicionais */}
      {orc.itens_adicionais.length > 0 && (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <div className="px-4 py-2.5 bg-white/5 border-b border-white/10">
            <span className="text-sm font-medium text-white">Serviços Adicionais</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="px-4 py-2 text-left">Serviço</th>
                <th className="px-4 py-2 text-right">Qtd</th>
                <th className="px-4 py-2 text-right">Unitário</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orc.itens_adicionais.map((item) => (
                <tr key={item.id} className="border-b border-white/5">
                  <td className="px-4 py-2 text-white/80">{item.servico_nome || item.service_catalog}</td>
                  <td className="px-4 py-2 text-right text-white/60">{item.quantidade}</td>
                  <td className="px-4 py-2 text-right text-white/60">{formatBRL(item.preco_unitario)}</td>
                  <td className="px-4 py-2 text-right text-white font-medium">{formatBRL(item.preco_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sem intervenções */}
      {orc.intervencoes.length === 0 && orc.itens_adicionais.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhuma intervenção adicionada. Use a API para adicionar via{" "}
          <code className="text-white/60">POST /api/v1/quotes/orcamentos/{id}/intervencoes/</code>
        </div>
      )}
    </div>
  )
}
