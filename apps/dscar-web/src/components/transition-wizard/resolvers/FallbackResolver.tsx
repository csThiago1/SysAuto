"use client"

import type { ResolverProps } from "./index"

export function FallbackResolver({ block }: ResolverProps) {
  return (
    <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
      <p className="font-medium">{block.message}</p>
      <p className="mt-1 text-xs">Resolva em outra tela e volte aqui para continuar.</p>
    </div>
  )
}
