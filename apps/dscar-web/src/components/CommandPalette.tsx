"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { useSession } from "next-auth/react"
import { ROLE_HIERARCHY, type PaddockRole } from "@paddock/types"
import { NAV_SECTIONS, type NavSection } from "./Sidebar"

export function CommandPalette(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()

  const userRoleLevel = ROLE_HIERARCHY[(session?.role ?? "STOREKEEPER") as PaddockRole] ?? 0

  const visibleSections = NAV_SECTIONS.filter((s: NavSection) =>
    !s.minRole || userRoleLevel >= (ROLE_HIERARCHY[s.minRole] ?? 0)
  )

  // Flatten all navigable items
  const allItems = visibleSections.flatMap((section) =>
    section.items.flatMap((item) => {
      const results: { id: string; label: string; section: string; href: string }[] = []
      if (item.href && !item.children) {
        results.push({ id: item.id, label: item.label, section: section.label, href: item.href })
      }
      if (item.children) {
        for (const child of item.children) {
          results.push({
            id: child.id,
            label: `${item.label} > ${child.label}`,
            section: section.label,
            href: child.href,
          })
        }
      }
      return results
    })
  )

  // ⌘K / Ctrl+K toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href as Parameters<typeof router.push>[0])
    },
    [router]
  )

  if (!open) return <></>

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={() => setOpen(false)}
      />

      {/* Command */}
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 w-full max-w-lg">
        <Command
          className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-fade-in"
          label="Paleta de comandos"
        >
          <Command.Input
            placeholder="Navegar para..."
            className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </Command.Empty>

            {visibleSections.map((section) => {
              const sectionItems = allItems.filter((i) => i.section === section.label)
              if (sectionItems.length === 0) return null

              return (
                <Command.Group
                  key={section.label}
                  heading={section.label}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {sectionItems.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={() => handleSelect(item.href)}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground/80 cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors"
                    >
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )
            })}
          </Command.List>

          <div className="border-t border-border px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Navegar com as setas</span>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Esc</kbd>
              <span>fechar</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  )
}
