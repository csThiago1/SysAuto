"use client"

import { Badge } from "@/components/ui/badge"
import { useBudgetVersions } from "@/hooks/useBudgets"
import type { BudgetVersionStatus } from "@paddock/types"

const STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  draft:      "Rascunho",
  sent:       "Enviado",
  approved:   "Aprovado",
  rejected:   "Rejeitado",
  expired:    "Expirado",
  revision:   "Em Revisão",
  superseded: "Superado",
}

const STATUS_COLORS: Record<BudgetVersionStatus, string> = {
  draft:      "text-white/50 bg-white/10 border-white/10",
  sent:       "text-info-400 bg-info-400/10 border-info-400/20",
  approved:   "text-success-400 bg-success-400/10 border-success-400/20",
  rejected:   "text-error-400 bg-error-400/10 border-error-400/20",
  expired:    "text-warning-400 bg-warning-400/10 border-warning-400/20",
  revision:   "text-warning-400 bg-warning-400/10 border-warning-400/20",
  superseded: "text-white/20 bg-white/5 border-white/5",
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "—"

interface Props { budgetId: number }

export function VersionHistory({ budgetId }: Props) {
  const { data: versions = [], isLoading } = useBudgetVersions(budgetId)

  if (isLoading) {
    return <div className="text-white/30 text-sm py-4">Carregando versões...</div>
  }

  if (versions.length === 0) {
    return <div className="text-white/30 text-sm py-4">Nenhuma versão encontrada.</div>
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <div
          key={v.id}
          className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">Versão {v.version_number}</span>
              <Badge className={`text-xs border ${STATUS_COLORS[v.status]}`}>
                {STATUS_LABELS[v.status]}
              </Badge>
            </div>
            <span className="text-white/40 text-xs font-mono">
              {parseFloat(v.net_total).toLocaleString("pt-BR", {
                style: "currency", currency: "BRL",
              })}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-white/40">
            <span>Criado: {fmt(v.created_at)}</span>
            <span>Enviado: {fmt(v.sent_at)}</span>
            <span>Aprovado: {fmt(v.approved_at)}</span>
          </div>
          {v.pdf_s3_key && (
            <a
              href={`/api/proxy/budgets/${budgetId}/versions/${v.id}/pdf/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-info-400 hover:text-info-300 underline"
            >
              Download PDF v{v.version_number}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
