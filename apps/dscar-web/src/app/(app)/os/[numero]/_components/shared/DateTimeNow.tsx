"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"

interface DateTimeNowProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  onSetNow?: (isoString: string) => void
  error?: string
}

/**
 * Input datetime-local com botão "Agora" que preenche com a hora atual.
 * Emite ISO string via onSetNow e chama onChange normal.
 */
export const DateTimeNow = forwardRef<HTMLInputElement, DateTimeNowProps>(
  function DateTimeNow({ label, onSetNow, className, onChange, error, ...props }, ref) {
    function handleSetNow() {
      const now = new Date()
      // datetime-local espera formato YYYY-MM-DDTHH:mm (hora local do browser)
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      // Disparar evento sintético para React Hook Form
      const nativeInput = document.createElement("input")
      nativeInput.value = local
      const event = { target: nativeInput } as React.ChangeEvent<HTMLInputElement>
      onChange?.(event)
      // Emitir formato local (sem Z) — o backend interpreta como TIME_ZONE (America/Manaus)
      onSetNow?.(local)
    }

    return (
      <div>
        <div className="flex gap-1.5">
          <input
            ref={ref}
            type="datetime-local"
            className={cn(
              "flex h-9 w-full min-w-0 rounded-lg border bg-muted/30 px-3 py-1 text-sm",
              "transition-colors placeholder:text-muted-foreground/50",
              "hover:border-muted-foreground/30",
              "focus-visible:outline-none focus-visible:ring-2",
              error
                ? "border-error-500 focus-visible:ring-error-500/40"
                : "border-input focus-visible:ring-ring/40 focus-visible:border-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            onChange={onChange}
            {...props}
          />
          <button
            type="button"
            onClick={handleSetNow}
            className="shrink-0 h-9 rounded-lg border border-border bg-muted/40 px-2.5 text-xs font-medium text-foreground/60 hover:bg-muted/70 hover:text-foreground transition-colors"
            title="Preencher com agora"
          >
            Agora
          </button>
        </div>
        {error && <p className="mt-0.5 text-xs text-error-400">{error}</p>}
      </div>
    )
  }
)
