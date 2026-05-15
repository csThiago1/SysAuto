"use client"

import { useState, useRef, useEffect } from "react"
import { usePartsCatalog } from "@/hooks/usePartsCatalog"
import type { PartCatalogReference } from "@paddock/types"

interface CatalogSearchComboboxProps {
  vehicleMakeName?: string
  vehicleModelName?: string
  onSelect: (ref: PartCatalogReference) => void
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function CatalogSearchCombobox({
  vehicleMakeName,
  vehicleModelName,
  onSelect,
  value,
  onChange,
  placeholder = "Buscar no catalogo (descricao ou codigo)...",
}: CatalogSearchComboboxProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const [debouncedSearch, setDebouncedSearch] = useState("")

  const { data: results, isLoading } = usePartsCatalog({
    search: debouncedSearch,
    vehicle_make_name: vehicleMakeName,
    vehicle_model_name: vehicleModelName,
  })

  function handleChange(text: string) {
    onChange(text)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(text)
      if (text.length >= 2) setOpen(true)
    }, 300)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(ref: PartCatalogReference) {
    onSelect(ref)
    setOpen(false)
  }

  const hasResults = results && results.length > 0

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (debouncedSearch.length >= 2 && hasResults) setOpen(true)
        }}
        placeholder={placeholder}
        className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border"
      />

      {open && debouncedSearch.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {isLoading && (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              Buscando no catalogo...
            </p>
          )}

          {!isLoading && (!results || results.length === 0) && (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              Nenhum resultado no catalogo.
            </p>
          )}

          {!isLoading &&
            results?.map((ref) => (
              <button
                key={ref.id}
                type="button"
                onClick={() => handleSelect(ref)}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">
                      {ref.description}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {ref.manufacturer_code}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {ref.category_name}
                    </span>
                    {ref.is_compatible && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-success-500/10 text-success-500 border border-success-500/20">
                        Compativel
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
