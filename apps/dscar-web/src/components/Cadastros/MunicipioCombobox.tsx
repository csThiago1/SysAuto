"use client"

import { useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Command } from "cmdk"
import { ChevronsUpDown } from "lucide-react"
import { z } from "zod"

import { paginatedSchema } from "@/components/vehicle/catalog.schema"
import { NativeSelect } from "@/components/ui/native-select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@/hooks/useDebounce"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const

const municipioSchema = z.object({ codigo_ibge: z.string(), nome: z.string(), uf: z.string() })
const pageSchema = paginatedSchema(municipioSchema)

/** Municípios do IBGE na UF; a busca é no servidor (sem acento). Só roda com UF escolhida. */
function useMunicipios(uf: string, search: string) {
  return useQuery({
    queryKey: ["lookups", "municipios", uf, search],
    queryFn: async () => {
      const qs = new URLSearchParams({ uf, page_size: "50" })
      if (search) qs.set("search", search)
      const url = `/api/proxy/lookups/municipios/?${qs.toString().replace(/\+/g, "%20")}`
      return pageSchema.parse(await apiFetch<unknown>(url)).results
    },
    enabled: uf !== "",
    staleTime: 30 * 60_000,
  })
}

export interface MunicipioValue {
  uf: string
  /** Código IBGE de 7 dígitos; "" quando ainda não escolhido. */
  municipio_ibge: string
  /** Nome do município; "" quando ainda não escolhido. */
  city: string
}

interface MunicipioComboboxProps extends MunicipioValue {
  onChange: (next: MunicipioValue) => void
}

const ITEM =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-primary/10 aria-selected:text-primary"

/** UF (as 27) e, dentro dela, o município do IBGE. Sem texto livre; trocar a UF limpa o município. */
export function MunicipioCombobox({ uf, municipio_ibge, city, onChange }: MunicipioComboboxProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debounced = useDebounce(search.trim(), 300)
  const query = useMunicipios(open ? uf : "", debounced)
  const options = query.data ?? []

  return (
    <div className="flex gap-2">
      <div className="w-24 shrink-0">
        <label htmlFor={`${id}-uf`} className="text-xs">
          UF
        </label>
        <NativeSelect
          id={`${id}-uf`}
          value={uf}
          onChange={(e) => onChange({ uf: e.target.value, municipio_ibge: "", city: "" })}
        >
          <option value="">UF</option>
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor={`${id}-mun`} className="text-xs">
          Município
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
              id={`${id}-mun`}
              type="button"
              disabled={uf === ""}
              title={municipio_ibge ? `Código IBGE ${municipio_ibge}` : undefined}
              className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-background px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={cn("flex-1 truncate", !city && "text-muted-foreground")}>
                {city || (uf ? "Selecione..." : "Escolha a UF")}
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
            <Command shouldFilter={false} label="Município">
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Buscar município..."
                className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
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
                  <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                    Nenhum resultado
                  </p>
                ) : (
                  options.map((m) => (
                    <Command.Item
                      key={m.codigo_ibge}
                      value={m.codigo_ibge}
                      onSelect={() => {
                        onChange({ uf: m.uf, municipio_ibge: m.codigo_ibge, city: m.nome })
                        setOpen(false)
                      }}
                      className={ITEM}
                    >
                      {m.nome}
                    </Command.Item>
                  ))
                )}
              </Command.List>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
