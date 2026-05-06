"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Context ──────────────────────────────────────────────────────────────────

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext(): TabsContextValue {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("Tabs subcomponent used outside <Tabs>")
  return ctx
}

// ─── Tabs (root) ──────────────────────────────────────────────────────────────

interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}

function Tabs({
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
    <TabsContext.Provider value={{ value, onValueChange: handleChange }}>
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
        "inline-flex items-center rounded-lg p-1 gap-1",
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
        "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium ring-offset-transparent transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
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
