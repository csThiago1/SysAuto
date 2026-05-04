"use client"

interface OrigemBadgeProps {
  origem: string
  className?: string
}

const ORIGENS: Record<string, { label: string; className: string }> = {
  estoque: {
    label: "Estoque",
    className: "bg-success-500/10 text-success-400 border border-success-500/20",
  },
  compra: {
    label: "Compra",
    className: "bg-info-500/10 text-info-400 border border-info-500/20",
  },
  seguradora: {
    label: "Seguradora",
    className: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  },
  manual: {
    label: "Manual",
    className: "bg-white/5 text-white/40 border border-white/10",
  },
}

export function OrigemBadge({ origem, className = "" }: OrigemBadgeProps) {
  const config = ORIGENS[origem] ?? { label: origem, className: "bg-white/5 text-white/40 border border-white/10" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className} ${className}`}>
      {config.label}
    </span>
  )
}
