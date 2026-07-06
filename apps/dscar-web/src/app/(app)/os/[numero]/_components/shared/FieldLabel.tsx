"use client"

/**
 * Label de campo com hint em tooltip — tira os textos de ajuda
 * permanentes ("Muda status → X") da frente do usuário sem perdê-los.
 */

import { Info, Zap } from "lucide-react"
import { FORM_LABEL } from "@paddock/utils"

interface FieldLabelProps {
  children: React.ReactNode
  /** Ajuda contextual (ícone ⓘ cinza) */
  hint?: string
  /** Efeito colateral ao preencher (ícone ⚡ âmbar) — ex: "Muda status → Entregue" */
  statusHint?: string
}

export function FieldLabel({ children, hint, statusHint }: FieldLabelProps) {
  return (
    <span className={`${FORM_LABEL} inline-flex items-center gap-1`}>
      {children}
      {statusHint && (
        <Zap
          className="h-3 w-3 cursor-help text-warning-400/80"
          aria-label={statusHint}
        >
          <title>{statusHint}</title>
        </Zap>
      )}
      {hint && (
        <Info
          className="h-3 w-3 cursor-help text-muted-foreground/60"
          aria-label={hint}
        >
          <title>{hint}</title>
        </Info>
      )}
    </span>
  )
}
