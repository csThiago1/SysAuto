"use client"

interface TipoQualidadeBadgeProps {
  tipo: string
  className?: string
}

const TIPOS: Record<string, { label: string; className: string }> = {
  genuina: {
    label: "Genuína",
    className: "bg-info-500/10 text-info-400 border border-info-500/20",
  },
  reposicao: {
    label: "Reposição",
    className: "bg-success-500/10 text-success-400 border border-success-500/20",
  },
  similar: {
    label: "Similar",
    className: "bg-warning-500/10 text-warning-400 border border-warning-500/20",
  },
  usada: {
    label: "Usada",
    className: "bg-white/5 text-white/40 border border-white/10",
  },
}

export function TipoQualidadeBadge({ tipo, className = "" }: TipoQualidadeBadgeProps) {
  const config = TIPOS[tipo] ?? { label: tipo, className: "bg-white/5 text-white/40 border border-white/10" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className} ${className}`}>
      {config.label}
    </span>
  )
}
