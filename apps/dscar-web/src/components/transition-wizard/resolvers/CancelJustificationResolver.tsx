"use client"

import { useEffect } from "react"
import { useJustification } from "../JustificationContext"
import type { ResolverProps } from "./index"

const MIN_LENGTH = 10

export function CancelJustificationResolver({ onResolved }: ResolverProps) {
  const { justification, setJustification } = useJustification()
  const len = justification.trim().length
  const isValid = len >= MIN_LENGTH

  useEffect(() => {
    if (isValid) onResolved()
  }, [isValid, onResolved])

  return (
    <div className="mt-2 space-y-1">
      <textarea
        aria-label="Motivo do cancelamento"
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        rows={3}
        placeholder="Explique o motivo do cancelamento (mínimo 10 caracteres)..."
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
      />
      <p className={`text-xs ${isValid ? "text-success-400" : "text-muted-foreground"}`}>
        {len}/{MIN_LENGTH} caracteres
      </p>
    </div>
  )
}
