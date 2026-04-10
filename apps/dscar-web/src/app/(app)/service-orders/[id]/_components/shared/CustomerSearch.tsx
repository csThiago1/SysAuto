"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2, Search, UserPlus, X } from "lucide-react"
import { useCustomerSearch, useCustomerCreate } from "../../_hooks/useCustomerSearch"
import { useDebounce } from "@/hooks/useDebounce"

interface CustomerSearchProps {
  value: { id: string; name: string } | null
  onChange: (customer: { id: string; name: string } | null) => void
  disabled?: boolean
}

const INPUT_BASE =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

export function CustomerSearch({ value, onChange, disabled }: CustomerSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"search" | "create">("search")
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newCpf, setNewCpf] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedQuery = useDebounce(query, 350)
  const { data, isFetching, isError } = useCustomerSearch(debouncedQuery)
  const createMutation = useCustomerCreate()
  const results = data?.results ?? []

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  function openCreateForm(prefill = "") {
    setMode("create")
    setNewName(prefill)
    setNewPhone("")
    setNewCpf("")
    setCreateError(null)
    setOpen(false)
  }

  function handleSelect(c: { id: string; name: string }) {
    onChange(c)
    setQuery("")
    setOpen(false)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreateError(null)
    try {
      const customer = await createMutation.mutateAsync({
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        cpf: newCpf.trim().replace(/\D/g, "") || undefined,
      })
      onChange({ id: customer.id, name: customer.name })
      setMode("search")
      setNewName("")
      setNewPhone("")
      setNewCpf("")
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao cadastrar cliente.")
    }
  }

  // ── Cliente já selecionado ──────────────────────────────────────
  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
        <Check className="h-4 w-4 text-green-600 shrink-0" />
        <span className="flex-1 text-sm font-medium text-green-900 truncate">{value.name}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => { onChange(null); setTimeout(() => inputRef.current?.focus(), 50) }}
            className="shrink-0 rounded p-0.5 text-green-700 hover:bg-green-100 hover:text-red-600"
            title="Trocar cliente"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  // ── Modo: cadastrar novo cliente ────────────────────────────────
  if (mode === "create") {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
            <UserPlus className="h-3.5 w-3.5" />
            Novo cliente
          </span>
          <button
            type="button"
            onClick={() => setMode("search")}
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            ← Voltar à busca
          </button>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            placeholder="Nome completo *"
            autoFocus
            className={INPUT_BASE}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate() } }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="CPF (só números)"
              className={INPUT_BASE}
              value={newCpf}
              onChange={(e) => setNewCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
              maxLength={14}
            />
            <input
              type="tel"
              placeholder="Telefone"
              className={INPUT_BASE}
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
        </div>

        {createError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
            {createError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode("search")}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || createMutation.isPending}
            className="flex items-center gap-1.5 rounded-md bg-[#ea0e03] px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            {createMutation.isPending ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </div>
    )
  }

  // ── Modo: busca ─────────────────────────────────────────────────
  const showDropdown = open && debouncedQuery.length >= 3
  const showEmpty = showDropdown && !isFetching && !isError && results.length === 0
  const showResults = showDropdown && results.length > 0

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar por nome, CPF ou telefone..."
          className={`${INPUT_BASE} pl-8`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { if (query.length >= 3) setOpen(true) }}
          disabled={disabled}
          autoComplete="off"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-neutral-400" />
        )}
      </div>

      {/* Dropdown de resultados */}
      {showResults && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg overflow-hidden">
          <ul>
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-neutral-50 transition-colors"
                  onClick={() => handleSelect({ id: c.id, name: c.name })}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{c.name}</p>
                    {(c.cpf_masked || c.phone_masked) && (
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {[c.cpf_masked, c.phone_masked].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => openCreateForm(query)}
            className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-xs font-medium text-[#ea0e03] hover:bg-red-50 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Cadastrar novo cliente
          </button>
        </div>
      )}

      {/* Sem resultados */}
      {showEmpty && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="px-3 py-3 text-center">
            <p className="text-sm text-neutral-500">Nenhum cliente encontrado.</p>
          </div>
          <button
            type="button"
            onClick={() => openCreateForm(query)}
            className="flex w-full items-center justify-center gap-2 border-t border-neutral-100 px-3 py-2.5 text-sm font-medium text-[#ea0e03] hover:bg-red-50 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Cadastrar &quot;{query}&quot;
          </button>
        </div>
      )}

      {/* Erro de API */}
      {showDropdown && isError && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 shadow-lg">
          <p className="text-xs text-red-600">Erro ao buscar clientes. Tente novamente.</p>
        </div>
      )}

      <p className="mt-1 text-xs text-neutral-400">
        Ou{" "}
        <button
          type="button"
          onClick={() => openCreateForm("")}
          className="font-medium text-[#ea0e03] hover:underline"
        >
          cadastrar novo cliente
        </button>
      </p>
    </div>
  )
}
