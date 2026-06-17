"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Lock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getResolver, hasResolverFor } from "./resolvers/index"
import type { ValidationBlock, ServiceOrder } from "@paddock/types"

type Severity = "hard" | "soft" | "warning"

interface WizardItemProps {
  block: ValidationBlock
  severity: Severity
  isResolved: boolean
  order: ServiceOrder
  onResolved: () => void
}

const ICON: Record<Severity, LucideIcon> = {
  hard: XCircle,
  soft: Lock,
  warning: AlertTriangle,
}

const COLOR: Record<Severity, string> = {
  hard: "text-error-500",
  soft: "text-warning-500",
  warning: "text-muted-foreground",
}

export function WizardItem({ block, severity, isResolved, order, onResolved }: WizardItemProps) {
  const [expanded, setExpanded] = useState(false)
  const Resolver = getResolver(block.code)
  const hasResolver = hasResolverFor(block.code)
  const Icon: LucideIcon = isResolved ? CheckCircle2 : ICON[severity]
  const colorClass = isResolved ? "text-success-500" : COLOR[severity]

  return (
    <li className="rounded-md border bg-card px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorClass}`} aria-hidden="true" />
          <span className="text-sm">{block.message}</span>
        </div>
        {!isResolved && hasResolver && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs shrink-0"
            onClick={() => setExpanded((p) => !p)}
            aria-label={expanded ? "Recolher resolver" : "Resolver aqui"}
          >
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5 mr-1" />Fechar</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5 mr-1" />Resolver aqui</>
            )}
          </Button>
        )}
      </div>

      {/* Code com resolver: expande/colapsa via botão */}
      {hasResolver && expanded && !isResolved && (
        <Resolver
          block={block}
          order={order}
          onResolved={() => {
            onResolved()
            setExpanded(false)
          }}
        />
      )}

      {/* Code sem resolver: mostra FallbackResolver inline, sem interação */}
      {!hasResolver && !isResolved && (
        <Resolver block={block} order={order} onResolved={onResolved} />
      )}
    </li>
  )
}
