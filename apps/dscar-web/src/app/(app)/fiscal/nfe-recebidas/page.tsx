"use client"

/**
 * NF-e Recebidas (Manifestação de Destinatário) — CONSULTANT+
 * Ciclo 06C
 *
 * Lista as NF-e emitidas por terceiros com o CNPJ da empresa como tomador.
 * Permite manifestar: ciência, confirmação, desconhecimento.
 * Fonte: Focus NF-e /v2/nfes_recebidas (pass-through).
 */

import { useState } from "react"
import { Inbox, RefreshCw, CheckCircle2, HelpCircle, XCircle, Eye } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  useNfeRecebidas,
  useNfeRecebidaManifest,
  type NfeRecebida,
} from "@/hooks/useFiscal"
import { usePermission } from "@/hooks/usePermission"
import { cn } from "@/lib/utils"

// ─── Manifesto config ─────────────────────────────────────────────────────────

const MANIFESTO_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  ciencia: { label: "Ciência", icon: Eye, color: "text-blue-400", bg: "bg-blue-400/10" },
  confirmada: { label: "Confirmada", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
  desconhecida: { label: "Desconhecida", icon: HelpCircle, color: "text-amber-400", bg: "bg-amber-400/10" },
  nao_realizada: { label: "Não Realizada", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10" },
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function NfeRecebidaRow({
  nfe,
  canManifest,
  onManifest,
}: {
  nfe: NfeRecebida
  canManifest: boolean
  onManifest: (chave: string, tipo: string) => void
}) {
  const cfg = nfe.situacao_manifesto ? MANIFESTO_CONFIG[nfe.situacao_manifesto] : null

  const valorFmt = nfe.valor_total
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
        Number(nfe.valor_total)
      )
    : "—"

  const dateFmt = nfe.data_emissao
    ? new Date(nfe.data_emissao).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—"

  const cnpjFmt = (cnpj: string) =>
    cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")

  return (
    <tr className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors">
      {/* Emitente */}
      <td className="py-3 px-4">
        <p className="text-xs text-white/80 font-medium">{nfe.emitente_nome || "—"}</p>
        <p className="text-xs text-white/30 font-mono mt-0.5">{cnpjFmt(nfe.emitente_cnpj)}</p>
      </td>

      {/* Nº / Série */}
      <td className="py-3 px-4 text-xs text-white/60 tabular-nums">
        {nfe.numero}/{nfe.serie}
      </td>

      {/* Chave (truncada) */}
      <td className="py-3 px-4 text-xs font-mono text-white/30 max-w-[140px] truncate" title={nfe.chave_nfe}>
        {nfe.chave_nfe.slice(0, 10)}…{nfe.chave_nfe.slice(-6)}
      </td>

      {/* Valor */}
      <td className="py-3 px-4 text-xs text-white/80 text-right tabular-nums">
        {valorFmt}
      </td>

      {/* Emissão */}
      <td className="py-3 px-4 text-xs text-white/40">{dateFmt}</td>

      {/* Manifesto */}
      <td className="py-3 px-4">
        {cfg ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
              cfg.bg,
              cfg.color
            )}
          >
            <cfg.icon className="h-3 w-3" />
            {cfg.label}
          </span>
        ) : (
          <span className="text-xs text-white/20">Não manifestada</span>
        )}
      </td>

      {/* Ações */}
      <td className="py-3 px-4 text-right">
        {canManifest && (
          <div className="flex items-center justify-end gap-2">
            {!nfe.situacao_manifesto && (
              <button
                onClick={() => onManifest(nfe.chave_nfe, "ciencia_operacao")}
                className="text-xs text-blue-400/70 hover:text-blue-400"
              >
                Dar Ciência
              </button>
            )}
            {nfe.situacao_manifesto === "ciencia" && (
              <>
                <button
                  onClick={() => onManifest(nfe.chave_nfe, "confirmacao_operacao")}
                  className="text-xs text-green-400/70 hover:text-green-400"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => onManifest(nfe.chave_nfe, "desconhecimento_operacao")}
                  className="text-xs text-amber-400/70 hover:text-amber-400"
                >
                  Desconhecer
                </button>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NfeRecebidasPage() {
  const canManifest = usePermission("MANAGER")
  const [pagina, setPagina] = useState(1)

  const { data: nfes = [], isLoading, refetch } = useNfeRecebidas(pagina)
  const manifestMutation = useNfeRecebidaManifest()

  async function handleManifest(chave: string, tipo_evento: string) {
    let justificativa: string | undefined
    if (tipo_evento === "operacao_nao_realizada") {
      const j = window.prompt("Justificativa (mín. 15 caracteres):")
      if (!j || j.trim().length < 15) {
        toast.error("Justificativa deve ter ao menos 15 caracteres.")
        return
      }
      justificativa = j
    }

    const labels: Record<string, string> = {
      ciencia_operacao: "Ciência registrada",
      confirmacao_operacao: "Operação confirmada",
      desconhecimento_operacao: "Desconhecimento registrado",
    }

    try {
      await manifestMutation.mutateAsync({ chave, tipo_evento, justificativa })
      toast.success(labels[tipo_evento] ?? "Manifestação registrada.")
    } catch {
      toast.error("Erro ao registrar manifestação.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-xl font-bold text-white">NF-e Recebidas</h1>
            <p className="text-xs text-white/50 mt-0.5">
              NF-e emitidas por fornecedores com o CNPJ da empresa como tomador
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="text-white/50 hover:text-white"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Atualizar
        </Button>
      </div>

      {/* Info */}
      <div className="rounded-xl bg-blue-950/30 border border-blue-700/20 px-4 py-3 text-xs text-blue-300/70">
        Para manifestar uma operação, clique em "Dar Ciência" e depois "Confirmar" ou "Desconhecer".
        A manifestação é obrigatória para NF-e acima de R$&nbsp;300 mil (§ art. 5° Port. SRF 811/2008).
      </div>

      {/* Tabela */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Emitente", "NF/Série", "Chave", "Valor", "Emissão", "Manifesto", ""].map((h) => (
                <th
                  key={h}
                  className={cn(
                    "py-2.5 px-4 text-xs font-semibold text-white/30 text-left",
                    h === "Valor" && "text-right"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-white/30">
                  Consultando Focus NF-e...
                </td>
              </tr>
            ) : nfes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-white/30">
                  Nenhuma NF-e recebida encontrada.{" "}
                  {pagina > 1 && (
                    <button
                      onClick={() => setPagina(1)}
                      className="underline hover:text-white/50"
                    >
                      Voltar à primeira página
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              nfes.map((nfe) => (
                <NfeRecebidaRow
                  key={nfe.chave_nfe}
                  nfe={nfe}
                  canManifest={canManifest}
                  onManifest={handleManifest}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between text-xs text-white/30">
        <span>{nfes.length} NF-e nesta página</span>
        <div className="flex gap-2">
          <button
            disabled={pagina === 1}
            onClick={() => setPagina((p) => p - 1)}
            className="px-3 py-1 rounded border border-white/10 disabled:opacity-30 hover:border-white/20"
          >
            ← Anterior
          </button>
          <span className="px-3 py-1">Página {pagina}</span>
          <button
            disabled={nfes.length < 50}
            onClick={() => setPagina((p) => p + 1)}
            className="px-3 py-1 rounded border border-white/10 disabled:opacity-30 hover:border-white/20"
          >
            Próxima →
          </button>
        </div>
      </div>
    </div>
  )
}
