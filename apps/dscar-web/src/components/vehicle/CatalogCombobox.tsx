"use client"

import { useId, useState, type ReactNode } from "react"
import { Command } from "cmdk"
import { ChevronsUpDown } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { useCatalogOptions, type CatalogLevel, type CatalogParams } from "@/hooks/useCatalog"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"
import type { CatalogOption } from "./catalog.schema"

interface CatalogComboboxProps {
  label: string
  level: CatalogLevel
  params: CatalogParams
  value: CatalogOption | null
  onChange: (option: CatalogOption) => void
  disabled?: boolean
  icon?: (option: CatalogOption) => ReactNode
}

const ITEM =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-primary/10 aria-selected:text-primary data-[disabled=true]:opacity-50"

/** Combobox de um nível do catálogo: busca no servidor, sem texto livre. */
export function CatalogCombobox({
  label,
  level,
  params,
  value,
  onChange,
  disabled,
  icon,
}: CatalogComboboxProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setSearch("")
        }}
      >
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-background px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {value && icon?.(value)}
            <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>
              {value?.label ?? "Selecione..."}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
          <Command shouldFilter={false} label={label}>
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={`Buscar ${label.toLowerCase()}...`}
              className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Options
              level={level}
              params={params}
              search={search}
              icon={icon}
              onSelect={(option) => {
                // a mesma opção de novo não muda nada (nem limpa os níveis de baixo)
                if (option.id !== value?.id) onChange(option)
                setOpen(false)
                setSearch("")
              }}
            />
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ponytail: só monta com o popover aberto, então nenhum nível busca antes de abrir
function Options({
  level,
  params,
  search,
  icon,
  onSelect,
}: {
  level: CatalogLevel
  params: CatalogParams
  search: string
  icon?: (option: CatalogOption) => ReactNode
  onSelect: (option: CatalogOption) => void
}) {
  const debounced = useDebounce(search.trim(), 300)
  const query = useCatalogOptions(level, params, debounced)
  const options = query.data?.pages.flatMap((p) => p.results) ?? []

  return (
    <Command.List className="max-h-72 overflow-y-auto p-1">
      {query.isLoading ? (
        <div className="space-y-1 p-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          Não foi possível carregar a lista. Tente de novo.
        </p>
      ) : options.length === 0 ? (
        <p className="px-2 py-3 text-center text-sm text-muted-foreground">Nenhum resultado</p>
      ) : (
        options.map((option) => (
          <Command.Item
            key={option.id}
            value={String(option.id)}
            onSelect={() => onSelect(option)}
            className={ITEM}
          >
            {icon?.(option)}
            {option.label}
          </Command.Item>
        ))
      )}
      {query.hasNextPage && (
        <Command.Item
          value="__carregar_mais"
          disabled={query.isFetchingNextPage}
          onSelect={() => void query.fetchNextPage()}
          className={cn(ITEM, "justify-center text-xs text-muted-foreground")}
        >
          Carregar mais
        </Command.Item>
      )}
    </Command.List>
  )
}
