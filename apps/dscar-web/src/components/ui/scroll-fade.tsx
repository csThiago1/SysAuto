"use client"

import { cn } from "@/lib/utils"

/**
 * Wrapper de rolagem horizontal com fade indicando conteúdo além da borda.
 * Piso responsivo de tabelas/tab bars — NUNCA usar overflow-hidden nelas.
 */
export function ScrollFade({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="overflow-x-auto">{children}</div>
      {/* fade só decorativo; some em md+ onde raramente há corte */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background/90 to-transparent md:hidden"
      />
    </div>
  )
}
