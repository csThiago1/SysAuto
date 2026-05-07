"use client"

import { Lock } from "lucide-react"
import type { ClosureStatus } from "@paddock/types"
import { cn } from "@/lib/utils"

interface ClosureDotsProps {
  closureStatus: ClosureStatus | null
  className?: string
}

export function ClosureDots({ closureStatus, className }: ClosureDotsProps) {
  if (!closureStatus) return null

  const { is_delivered, is_invoiced, is_paid, is_closed } = closureStatus

  if (is_closed) {
    return (
      <span title="OS Fechada: Entregue · Faturada · Quitada" className={className}>
        <Lock className="h-3.5 w-3.5 text-success-400" />
      </span>
    )
  }

  const dots = [
    { active: is_delivered, label: "Entregue" },
    { active: is_invoiced, label: "Faturada" },
    { active: is_paid, label: "Quitada" },
  ]

  const tooltip = dots.map((d) => `${d.active ? "✓" : "✗"} ${d.label}`).join(" · ")

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} title={tooltip}>
      {dots.map((d, i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full",
            d.active ? "bg-success-400" : "bg-muted-foreground/30"
          )}
        />
      ))}
    </span>
  )
}
