"use client"

import { CheckCircle2, Loader2, Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WizardFooterProps {
  targetLabel: string
  allBlockingResolved: boolean
  hasSoftBlocks: boolean
  isAdvancing: boolean
  onAdvance: () => void
  onRequestOverride: () => void
}

export function WizardFooter({
  targetLabel,
  allBlockingResolved,
  hasSoftBlocks,
  isAdvancing,
  onAdvance,
  onRequestOverride,
}: WizardFooterProps) {
  return (
    <div className="space-y-2 pt-1">
      {allBlockingResolved ? (
        <div className="rounded-md bg-success-500/10 border border-success-500/20 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-success-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium">Tudo pronto para avançar</span>
          </div>
          <Button
            size="sm"
            disabled={isAdvancing}
            onClick={onAdvance}
          >
            {isAdvancing && (
              <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
            )}
            Avançar para {targetLabel}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Resolva os itens acima para liberar a transição.
        </p>
      )}

      {hasSoftBlocks && !allBlockingResolved && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={onRequestOverride}
        >
          <Unlock className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          Solicitar liberação do gerente
        </Button>
      )}
    </div>
  )
}
