"use client"

interface StatusPecaBadgeProps {
  status: string
  className?: string
}

const STATUSES: Record<string, { label: string; dotColor: string; textColor: string }> = {
  bloqueada: { label: "Bloqueada", dotColor: "bg-success-400", textColor: "text-success-400" },
  recebida: { label: "Recebida e Bloqueada", dotColor: "bg-success-400", textColor: "text-success-400" },
  aguardando_cotacao: { label: "Aguardando Cotação", dotColor: "bg-warning-400", textColor: "text-warning-400" },
  em_cotacao: { label: "Em Cotação", dotColor: "bg-info-400", textColor: "text-info-400" },
  aguardando_aprovacao: { label: "Aguardando Aprovação", dotColor: "bg-purple-400", textColor: "text-purple-400" },
  comprada: { label: "Comprada — Aguardando Entrega", dotColor: "bg-info-400", textColor: "text-info-400" },
  aguardando_seguradora: { label: "Aguardando Seguradora", dotColor: "bg-purple-400", textColor: "text-purple-400" },
  manual: { label: "Manual", dotColor: "bg-white/40", textColor: "text-muted-foreground" },
}

export function StatusPecaBadge({ status, className = "" }: StatusPecaBadgeProps) {
  const config = STATUSES[status] ?? { label: status, dotColor: "bg-white/40", textColor: "text-muted-foreground" }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${config.textColor} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  )
}
