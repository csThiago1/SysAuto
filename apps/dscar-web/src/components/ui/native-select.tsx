"use client"

/**
 * NativeSelect — <select> nativo com visual do design system.
 *
 * Drop-in pros forms RHF: aceita {...register("campo")} via forwardRef.
 * appearance-none + chevron próprio tira a cara de controle do SO;
 * a lista aberta continua nativa (acessível e sem JS extra).
 */

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { FORM_SELECT } from "@paddock/utils"
import { cn } from "@/lib/utils"

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <div className="relative w-full">
      <select ref={ref} className={cn(FORM_SELECT, className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
})
