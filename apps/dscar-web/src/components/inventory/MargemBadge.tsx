/**
 * Paddock Solutions — dscar-web
 * MargemBadge: badge visual de margem (custo vs cobrado)
 * Positiva = success, Negativa = error, Zero = neutral
 */

interface MargemBadgeProps {
  custo: number
  cobrado: number
  className?: string
}

export function MargemBadge({ custo, cobrado, className }: MargemBadgeProps) {
  const margem = custo > 0 ? ((cobrado - custo) / custo) * 100 : 0
  const isPositive = margem > 0
  const isNegative = margem < 0

  const colorClass = isPositive
    ? "bg-success-500/10 text-success-400"
    : isNegative
    ? "bg-error-500/10 text-error-400"
    : "bg-white/5 text-white/40"

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${colorClass} ${className ?? ""}`}
    >
      {isPositive ? "+" : ""}
      {margem.toFixed(1)}%
    </span>
  )
}
