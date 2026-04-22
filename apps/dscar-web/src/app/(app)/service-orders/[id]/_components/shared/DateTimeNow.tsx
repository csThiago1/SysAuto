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
      // datetime-local espera formato YYYY-MM-DDTHH:mm
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      // Disparar evento sintético para React Hook Form
      const nativeInput = document.createElement("input")
      nativeInput.value = local
      const event = { target: nativeInput } as React.ChangeEvent<HTMLInputElement>
      onChange?.(event)
      onSetNow?.(now.toISOString())
    }

    return (
      <div>
        <div className="flex gap-1">
          <input
            ref={ref}
            type="datetime-local"
            className={cn(
              "flex h-8 w-full rounded-md border bg-background px-2.5 py-1 text-sm",
              "shadow-sm transition-colors placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1",
              error
                ? "border-red-500 focus-visible:ring-red-500"
                : "border-input focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            onChange={onChange}
            {...props}
          />
          <button
            type="button"
            onClick={handleSetNow}
            className="shrink-0 h-8 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-medium text-white/60 hover:bg-white/[0.03] transition-colors"
            title="Preencher com agora"
          >
            Agora
          </button>
        </div>
        {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)
