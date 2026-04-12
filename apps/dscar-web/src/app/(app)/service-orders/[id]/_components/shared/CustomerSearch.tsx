"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Search, UserPlus, X, CheckCircle2 } from "lucide-react"
import { useCustomerSearch, useCustomerCreate } from "../../_hooks/useCustomerSearch"
import { useDebounce } from "@/hooks/useDebounce"

export interface SelectedCustomer {
  id: string
  name: string
  phone_masked?: string | null
  cpf_masked?: string | null
}

interface CustomerSearchProps {
  value: SelectedCustomer | null
  onChange: (customer: SelectedCustomer | null) => void
  disabled?: boolean
}

const INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

export function CustomerSearch({ value, onChange, disabled }: CustomerSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"search" | "create">("search")
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newCpf, setNewCpf] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newBirthDate, setNewBirthDate] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedQuery = useDebounce(query, 350)
  const { data, isFetching, isError } = useCustomerSearch(debouncedQuery)
  const createMutation = useCustomerCreate()
  const results = data?.results ?? []

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
    setNewEmail("")
    setNewBirthDate("")
    setCreateError(null)
    setOpen(false)
  }

  function handleSelect(c: SelectedCustomer) {
    onChange(c)
    setQuery("")
    setOpen(false)
    setMode("search")
  }

  function handleClear() {
    onChange(null)
    setQuery("")
    setMode("search")
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleBuscarOutro = handleClear

  async function handleCreate() {
    setCreateError(null)
    try {
      const customer = await createMutation.mutateAsync({
        name: newName.trim(),
        cpf: newCpf.trim().replace(/\D/g, "") || undefined,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        birth_date: newBirthDate || undefined,
      })
      onChange({
        id: customer.id,
        name: customer.name,
        phone_masked: customer.phone_masked,
        cpf_masked: customer.cpf_masked,
      })
      setMode("search")
      setNewName(""); setNewPhone(""); setNewCpf(""); setNewEmail(""); setNewBirthDate("")
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao cadastrar.")
    }
  }

  const canCreate =
    newName.trim().length > 0 &&
    newCpf.replace(/\D/g, "").length === 11 &&
    newPhone.replace(/\D/g, "").length >= 10 &&
    newEmail.trim().includes("@")

  // ── Modo: chip (selecionado) ─────────────────────────────────────
  if (value) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2.5 py-1 text-[12px] font-medium text-green-800">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>{value.name}</span>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="ml-1 rounded-full p-0.5 text-green-600 hover:text-green-900 hover:bg-green-100"
              title="Remover cliente"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleBuscarOutro}
            className="text-[11px] text-neutral-400 hover:text-neutral-600 underline"
          >
            ou buscar outro
          </button>
        )}
      </div>
    )
  }

  // ── Modo: criar novo cliente ─────────────────────────────────────
  if (mode === "create") {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
            <UserPlus className="h-3 w-3" />
            Novo cliente
          </span>
          <button
            type="button"
            onClick={() => setMode("search")}
            className="text-[11px] text-neutral-400 hover:text-neutral-600"
          >
            ← Voltar
          </button>
        </div>

        {/* Nome */}
        <input
          type="text"
          placeholder="Nome completo *"
          autoFocus
          className={INPUT}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        {/* CPF + Telefone */}
        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="text"
            placeholder="CPF * (11 dígitos)"
            className={INPUT}
            value={newCpf}
            onChange={(e) => setNewCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
          />
          <input
            type="tel"
            placeholder="Telefone *"
            className={INPUT}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
        </div>

        {/* Email */}
        <input
          type="email"
          placeholder="E-mail *"
          className={INPUT}
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />

        {/* Nascimento (opcional) */}
        <input
          type="date"
          className={INPUT}
          value={newBirthDate}
          onChange={(e) => setNewBirthDate(e.target.value)}
          title="Data de nascimento (opcional)"
        />

        {createError && (
          <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
            {createError}
          </p>
        )}

        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setMode("search")}
            className="rounded border border-neutral-300 px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate || createMutation.isPending}
            className="flex items-center gap-1 rounded bg-[#ea0e03] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            {createMutation.isPending ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </div>
    )
  }

  // ── Modo: busca ──────────────────────────────────────────────────
  const showDropdown = open && debouncedQuery.length >= 3
  const showEmpty = showDropdown && !isFetching && !isError && results.length === 0
  const showResults = showDropdown && results.length > 0

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar por nome, CPF ou telefone..."
            className={`${INPUT} pl-8`}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => { if (query.length >= 3) setOpen(true) }}
            disabled={disabled}
            autoComplete="off"
          />
          {isFetching && (
            <Loader2 className="absolute right-2.5 top-2 h-3.5 w-3.5 animate-spin text-neutral-400" />
          )}
        </div>
        <button
          type="button"
          onClick={() => openCreateForm(query)}
          className="shrink-0 flex items-center gap-1 rounded border border-dashed border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 h-8"
        >
          <UserPlus className="h-3 w-3" />
          Novo
        </button>
      </div>

      {showResults && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg overflow-hidden">
          <ul>
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-neutral-50 transition-colors"
                  onClick={() =>
                    handleSelect({
                      id: c.id,
                      name: c.name,
                      phone_masked: c.phone_masked,
                      cpf_masked: c.cpf_masked,
                    })
                  }
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

      {showEmpty && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="px-3 py-2 text-center">
            <p className="text-sm text-neutral-500">Nenhum cliente encontrado.</p>
          </div>
          <button
            type="button"
            onClick={() => openCreateForm(query)}
            className="flex w-full items-center justify-center gap-2 border-t border-neutral-100 px-3 py-2 text-sm font-medium text-[#ea0e03] hover:bg-red-50 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Cadastrar &quot;{query}&quot;
          </button>
        </div>
      )}

      {showDropdown && isError && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 shadow-lg">
          <p className="text-xs text-red-600">Erro ao buscar. Tente novamente.</p>
        </div>
      )}
    </div>
  )
}
