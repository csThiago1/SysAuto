"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Search, UserPlus, X, CheckCircle2 } from "lucide-react"
import { z } from "zod"
import { usePersonSearch, usePersonCreate } from "../../_hooks/useCustomerSearch"
import { useDebounce } from "@/hooks/useDebounce"
import { isValidCPF } from "@paddock/utils"

export interface SelectedCustomer {
  id: number
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

const inlineCustomerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().regex(/^\d{10,11}$/, "Celular inválido (10-11 dígitos)"),
  email: z.string().email("E-mail inválido"),
  cpf: z.string().refine((v) => !v || isValidCPF(v), "CPF inválido").optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
})

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
  const { data, isFetching, isError } = usePersonSearch(debouncedQuery)
  const createMutation = usePersonCreate()
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
    const result = inlineCustomerSchema.safeParse({
      name: newName.trim(),
      phone: newPhone.trim().replace(/\D/g, ""),
      email: newEmail.trim(),
      cpf: newCpf.trim().replace(/\D/g, "") || undefined,
      birth_date: newBirthDate || undefined,
    })
    if (!result.success) {
      setCreateError(result.error.errors[0]?.message ?? "Dados inválidos")
      return
    }
    try {
      const customer = await createMutation.mutateAsync({
        name: result.data.name,
        cpf: result.data.cpf || undefined,
        phone: result.data.phone,
        email: result.data.email,
        birth_date: result.data.birth_date || undefined,
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

  const parsed = inlineCustomerSchema.safeParse({
    name: newName.trim(),
    phone: newPhone.trim().replace(/\D/g, ""),
    email: newEmail.trim(),
    cpf: newCpf.trim().replace(/\D/g, "") || undefined,
    birth_date: newBirthDate || undefined,
  })
  const canCreate = parsed.success

  // ── Modo: chip (selecionado) ─────────────────────────────────────
  if (value) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-full border border-success-500/30 bg-success-500/10 px-2.5 py-1 text-[12px] font-medium text-success-400">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>{value.name}</span>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="ml-1 rounded-full p-0.5 text-success-400 hover:text-success-300 hover:bg-success-500/15"
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
            className="text-xs text-muted-foreground hover:text-foreground/60 underline"
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
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-foreground/60">
            <UserPlus className="h-3 w-3" />
            Novo cliente
          </span>
          <button
            type="button"
            onClick={() => setMode("search")}
            className="text-xs text-muted-foreground hover:text-foreground/60"
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
            placeholder="CPF (opcional)"
            className={INPUT}
            value={newCpf}
            onChange={(e) => setNewCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
          />
          <input
            type="tel"
            placeholder="Celular * (10-11 dígitos)"
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
          <p className="text-xs text-error-400 bg-error-500/10 border border-error-500/20 rounded px-2 py-1">
            {createError}
          </p>
        )}

        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setMode("search")}
            className="rounded border border-border px-2.5 py-1 text-xs font-medium text-foreground/60 hover:bg-muted/50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate || createMutation.isPending}
            className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            {createMutation.isPending ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </div>
    )
  }

  // ── Modo: busca ──────────────────────────────────────────────────
  const showDropdown = open && debouncedQuery.length >= 2
  const showEmpty = showDropdown && !isFetching && !isError && results.length === 0
  const showResults = showDropdown && results.length > 0

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
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
            <Loader2 className="absolute right-2.5 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        <button
          type="button"
          onClick={() => openCreateForm(query)}
          className="shrink-0 flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-white/30 hover:text-foreground/70 h-8"
        >
          <UserPlus className="h-3 w-3" />
          Novo
        </button>
      </div>

      {showResults && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-muted/50 shadow-lg overflow-hidden">
          <ul>
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
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
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    {(c.cpf_masked || c.phone_masked) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
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
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-xs font-medium text-primary hover:bg-muted/30 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Cadastrar novo cliente
          </button>
        </div>
      )}

      {showEmpty && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-muted/50 shadow-lg">
          <div className="px-3 py-2 text-center">
            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          </div>
          <button
            type="button"
            onClick={() => openCreateForm(query)}
            className="flex w-full items-center justify-center gap-2 border-t border-border px-3 py-2 text-sm font-medium text-primary hover:bg-muted/30 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Cadastrar &quot;{query}&quot;
          </button>
        </div>
      )}

      {showDropdown && isError && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-error-500/20 bg-error-500/10 px-3 py-2 shadow-lg">
          <p className="text-xs text-error-400">Erro ao buscar. Tente novamente.</p>
        </div>
      )}
    </div>
  )
}
