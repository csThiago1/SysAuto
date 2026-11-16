"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Context ──────────────────────────────────────────────────────────────────

/** segmented: botões num trilho (padrão). underline: texto com faixa vermelha embaixo. */
export type TabsVariant = "segmented" | "underline"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  variant: TabsVariant
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext(): TabsContextValue {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("Tabs subcomponent used outside <Tabs>")
  return ctx
}

// ─── Tabs (root) ──────────────────────────────────────────────────────────────

interface TabsProps {
  variant?: TabsVariant
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}

function Tabs({
  variant = "segmented",
  defaultValue = "",
  value: controlled,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue)
  const value = controlled ?? internal

  const handleChange = React.useCallback(
    (v: string) => {
      setInternal(v)
      onValueChange?.(v)
    },
    [onValueChange]
  )

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleChange, variant }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

// ─── TabsList ─────────────────────────────────────────────────────────────────

interface TabsListProps {
  className?: string
  children: React.ReactNode
}

function TabsList({ className, children }: TabsListProps) {
  const { variant } = useTabsContext()
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const list = e.currentTarget
      const tabs = Array.from(
        list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
      )
      if (tabs.length === 0) return

      const current = document.activeElement as HTMLElement
      const idx = tabs.indexOf(current as HTMLButtonElement)
      if (idx === -1) return

      let next: HTMLButtonElement | undefined
      switch (e.key) {
        case "ArrowRight":
          next = tabs[(idx + 1) % tabs.length]
          break
        case "ArrowLeft":
          next = tabs[(idx - 1 + tabs.length) % tabs.length]
          break
        case "Home":
          next = tabs[0]
          break
        case "End":
          next = tabs[tabs.length - 1]
          break
        default:
          return
      }
      if (next) {
        e.preventDefault()
        next.focus()
        next.click()
      }
    },
    []
  )

  return (
    <div
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn(
        variant === "underline"
          ? "flex items-center gap-4 overflow-x-auto border-b border-border"
          : "inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1",
        className
      )}
    >
      {children}
    </div>
  )
}

// ─── TabsTrigger ──────────────────────────────────────────────────────────────

interface TabsTriggerProps {
  value: string
  className?: string
  children: React.ReactNode
  disabled?: boolean
}

function TabsTrigger({ value, className, children, disabled }: TabsTriggerProps) {
  const ctx = useTabsContext()
  const isActive = ctx.value === value

  return (
    <button
      role="tab"
      type="button"
      tabIndex={isActive ? 0 : -1}
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => ctx.onValueChange(value)}
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ctx.variant === "underline"
          ? cn(
              "-mb-px border-b-2 px-0.5 py-2",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )
          : cn(
              "min-h-[32px] rounded-sm px-3",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            ),
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  )
}

// ─── TabsContent ──────────────────────────────────────────────────────────────

interface TabsContentProps {
  value: string
  className?: string
  children: React.ReactNode
}

function TabsContent({ value, className, children }: TabsContentProps) {
  const ctx = useTabsContext()
  if (ctx.value !== value) return null
  return (
    <div
      role="tabpanel"
      data-state="active"
      className={cn("mt-2", className)}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
