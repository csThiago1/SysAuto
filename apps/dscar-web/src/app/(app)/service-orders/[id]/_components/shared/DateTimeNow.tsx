"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"

interface DateTimeNowProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  onSetNow?: (isoString: string) => void
}

/**
 * Input datetime-local com botão "Agora" que preenche com a hora atual.
 * Emite ISO string via onSetNow e chama onChange normal.
 */
export const DateTimeNow = forwardRef<HTMLInputElement, DateTimeNowProps>(
  function DateTimeNow({ label, onSetNow, className, onChange, ...props }, ref) {
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
      <div className="flex gap-1">
        <input
          ref={ref}
          type="datetime-local"
          className={cn(
            "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm",
            "shadow-sm transition-colors placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          onChange={onChange}
          {...props}
        />
        <button
          type="button"
          onClick={handleSetNow}
          className="shrink-0 h-8 rounded-md border border-neutral-300 bg-white px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          title="Preencher com agora"
        >
          Agora
        </button>
      </div>
    )
  }
)
