"use client"

import { useState } from "react"
import { ArrowLeft, CheckCircle, AlertCircle, Package, Layers } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useNFeEntrada, useGerarEstoque, useReconciliarItem } from "@/hooks/useInventory"
import type { NFeEntradaItem, ReconciliarItemInput, StatusReconciliacao } from "@paddock/types"

const RECONCILIACAO_LABELS: Record<StatusReconciliacao, string> = {
  pendente: "Pendente",
  peca: "Peça",
  insumo: "Insumo",
  ignorado: "Ignorado",
}

const RECONCILIACAO_COLORS: Record<StatusReconciliacao, string> = {
  pendente: "text-yellow-400 bg-yellow-400/10",
  peca: "text-emerald-400 bg-emerald-400/10",
  insumo: "text-blue-400 bg-blue-400/10",
  ignorado: "text-white/40 bg-white/5",
}

export default function NFeEntradaDetailPage({ params }: { params: { id: string } }) {
  const { data: nfe, isLoading } = useNFeEntrada(params.id)
  const gerarEstoqueMutation = useGerarEstoque(params.id)

  const pendentes = nfe?.itens.filter((i) => i.status_reconciliacao === "pendente").length ?? 0

  async function handleGerarEstoque() {
    try {
      const result = await gerarEstoqueMutation.mutateAsync()
      toast.success(
        `Estoque gerado: ${result.unidades_criadas} unidades, ${result.lotes_criados} lotes. ` +
        `${result.pendentes_reconciliacao} itens pendentes.`
      )
    } catch {
      toast.error("Erro ao gerar estoque. Verifique se todos os itens estão reconciliados.")
    }
  }

  if (isLoading) {
    return <div className="p-6 text-white/40 text-sm">Carregando...</div>
  }

  if (!nfe) {
    return <div className="p-6 text-white/40 text-sm">NF-e não encontrada.</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/estoque/nfe-recebida" className="text-white/40 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">
              NF-e {nfe.numero || nfe.id.slice(0, 8)}
              {nfe.serie ? ` / ${nfe.serie}` : ""}
            </h1>
            <p className="text-xs text-white/40 mt-0.5">{nfe.emitente_nome}</p>
          </div>
        </div>

        {!nfe.estoque_gerado && (
          <button
            onClick={handleGerarEstoque}
            disabled={gerarEstoqueMutation.isPending || pendentes > 0}
            className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-colors"
          >
            <Package className="h-4 w-4" />
            {gerarEstoqueMutation.isPending ? "Gerando..." : "Gerar Estoque"}
          </button>
        )}

        {nfe.estoque_gerado && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle className="h-4 w-4" />
            Estoque gerado
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Valor Total", value: parseFloat(nfe.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
          { label: "Data Emissão", value: nfe.data_emissao ? new Date(nfe.data_emissao).toLocaleDateString("pt-BR") : "—" },
          { label: "CNPJ Emitente", value: nfe.emitente_cnpj || "—" },
          { label: "Total de Itens", value: String(nfe.itens.length) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/40 mb-1">{label}</p>
            <p className="text-sm font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {pendentes > 0 && !nfe.estoque_gerado && (
        <div className="flex items-center gap-2 text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {pendentes} item{pendentes !== 1 ? "s" : ""} pendente{pendentes !== 1 ? "s" : ""} de reconciliação. Reconcilie todos antes de gerar estoque.
        </div>
      )}

      {/* Itens */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-white/70">Itens da NF-e</h2>
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs">
                <th className="px-4 py-3 text-left w-8">#</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3 text-right">Vl. Unit. c/ Trib.</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Reconciliação</th>
                <th className="px-4 py-3 text-left">Mapeado</th>
              </tr>
            </thead>
            <tbody>
              {nfe.itens.map((item) => (
                <tr key={item.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white/40 text-xs">{item.numero_item}</td>
                  <td className="px-4 py-3">
                    <p className="text-white text-sm">{item.descricao_original}</p>
                    {item.ncm && <p className="text-white/40 text-xs mt-0.5">NCM: {item.ncm}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-white/80">
                    {item.quantidade} {item.unidade_compra}
                  </td>
                  <td className="px-4 py-3 text-right text-white/80">
                    R$ {parseFloat(item.valor_unitario_com_tributos).toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right text-white/80">
                    {parseFloat(item.valor_total_com_tributos).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${RECONCILIACAO_COLORS[item.status_reconciliacao]}`}>
                      {RECONCILIACAO_LABELS[item.status_reconciliacao]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {item.peca_nome && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" /> {item.peca_nome}
                      </span>
                    )}
                    {item.material_nome && (
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" /> {item.material_nome}
                      </span>
                    )}
                    {!item.peca_nome && !item.material_nome && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {nfe.chave_acesso && (
        <p className="text-xs text-white/30 font-mono break-all">
          Chave: {nfe.chave_acesso}
        </p>
      )}
    </div>
  )
}
