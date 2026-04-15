"use client"

import { useEffect, useRef, useState } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { Search, ArrowLeftRight, Loader2 } from "lucide-react"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import {
  useCustomerDetail,
  useCustomerSearch,
  type CustomerDetail,
  type CustomerUpdateInput,
} from "../../_hooks/useCustomerSearch"
import { useDebounce } from "@/hooks/useDebounce"

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-xs font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT_EDIT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
const INPUT_READONLY =
  "flex h-8 w-full rounded-md border border-neutral-100 bg-neutral-50 px-2.5 py-1 text-sm text-neutral-500 cursor-default select-all"

interface CustomerSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  onCustomerDataChange?: (data: CustomerUpdateInput | null) => void
}

// ── Inline search dropdown (used in "Trocar cliente" mode) ────────────────────
interface InlineSearchProps {
  onSelect: (id: string, name: string) => void
  onCancel: () => void
}

function InlineSearch({ onSelect, onCancel }: InlineSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 350)
  const { data, isFetching } = useCustomerSearch(debouncedQuery)
  const results = data?.results ?? []
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [onCancel])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            autoFocus
            placeholder="Buscar por nome, CPF ou telefone..."
            className={`${INPUT_EDIT} pl-8`}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => { if (query.length >= 3) setOpen(true) }}
            autoComplete="off"
          />
          {isFetching && (
            <Loader2 className="absolute right-2.5 top-2 h-3.5 w-3.5 animate-spin text-neutral-400" />
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 h-8"
        >
          Cancelar
        </button>
      </div>

      {open && debouncedQuery.length >= 3 && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg overflow-hidden">
          <ul>
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-neutral-50 transition-colors"
                  onClick={() => onSelect(c.id, c.name)}
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
        </div>
      )}
    </div>
  )
}

// ── Editable customer fields ──────────────────────────────────────────────────
interface EditableFieldsProps {
  detail: CustomerDetail
  onCustomerDataChange: (data: CustomerUpdateInput | null) => void
}

function EditableFields({ detail, onCustomerDataChange }: EditableFieldsProps) {
  const [fields, setFields] = useState<CustomerUpdateInput>({
    name: detail.name ?? "",
    phone: detail.phone ?? "",
    email: detail.email ?? "",
    birth_date: detail.birth_date ?? "",
    zip_code: detail.zip_code ?? "",
    street: detail.street ?? "",
    street_number: detail.street_number ?? "",
    complement: detail.complement ?? "",
    neighborhood: detail.neighborhood ?? "",
    city: detail.city ?? "",
    state: detail.state ?? "",
  })

  // Reset when the detail object changes (different customer loaded)
  useEffect(() => {
    const next: CustomerUpdateInput = {
      name: detail.name ?? "",
      phone: detail.phone ?? "",
      email: detail.email ?? "",
      birth_date: detail.birth_date ?? "",
      zip_code: detail.zip_code ?? "",
      street: detail.street ?? "",
      street_number: detail.street_number ?? "",
      complement: detail.complement ?? "",
      neighborhood: detail.neighborhood ?? "",
      city: detail.city ?? "",
      state: detail.state ?? "",
    }
    setFields(next)
    onCustomerDataChange(null) // reset dirty state on customer change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.id])

  function handleChange(field: keyof CustomerUpdateInput, value: string) {
    const next = { ...fields, [field]: value }
    setFields(next)

    // Compute dirty — compare against loaded detail
    const original: CustomerUpdateInput = {
      name: detail.name ?? "",
      phone: detail.phone ?? "",
      email: detail.email ?? "",
      birth_date: detail.birth_date ?? "",
      zip_code: detail.zip_code ?? "",
      street: detail.street ?? "",
      street_number: detail.street_number ?? "",
      complement: detail.complement ?? "",
      neighborhood: detail.neighborhood ?? "",
      city: detail.city ?? "",
      state: detail.state ?? "",
    }

    const dirty = (Object.keys(next) as Array<keyof CustomerUpdateInput>).some(
      (k) => (next[k] ?? "") !== (original[k] ?? "")
    )

    if (dirty) {
      // Only send changed fields to keep PATCH minimal
      const patch: CustomerUpdateInput = {}
      for (const k of Object.keys(next) as Array<keyof CustomerUpdateInput>) {
        if ((next[k] ?? "") !== (original[k] ?? "")) {
          ;(patch as Record<string, string | undefined>)[k] = next[k]
        }
      }
      onCustomerDataChange(patch)
    } else {
      onCustomerDataChange(null)
    }
  }

  return (
    <div className="space-y-2 mt-2">
      {/* Nome */}
      <div>
        <label className={LABEL}>Nome</label>
        <input
          type="text"
          className={INPUT_EDIT}
          value={fields.name ?? ""}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Nome completo"
        />
      </div>

      {/* Linha: Tel | Email | Nascimento | CPF */}
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className={LABEL}>Telefone</label>
          <input
            type="tel"
            className={INPUT_EDIT}
            value={fields.phone ?? ""}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="(92) 99999-1234"
          />
        </div>
        <div className="col-span-2">
          <label className={LABEL}>E-mail</label>
          <input
            type="email"
            className={INPUT_EDIT}
            value={fields.email ?? ""}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>
        <div>
          <label className={LABEL}>Nascimento</label>
          <input
            type="date"
            className={INPUT_EDIT}
            value={fields.birth_date ?? ""}
            onChange={(e) => handleChange("birth_date", e.target.value)}
          />
        </div>
      </div>

      {/* CPF — somente leitura */}
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className={LABEL}>CPF</label>
          <div className={INPUT_READONLY}>{detail.cpf_masked ?? "—"}</div>
        </div>
      </div>

      {/* Endereço */}
      <div className="space-y-1.5 pt-1 border-t border-neutral-100">
        <p className={`${SECTION_TITLE} pt-1`}>Endereço</p>

        <div className="grid grid-cols-[72px_1fr_52px] gap-2">
          <div>
            <label className={LABEL}>CEP</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={fields.zip_code ?? ""}
              onChange={(e) => handleChange("zip_code", e.target.value)}
              placeholder="69000-000"
              maxLength={9}
            />
          </div>
          <div>
            <label className={LABEL}>Rua / Av.</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={fields.street ?? ""}
              onChange={(e) => handleChange("street", e.target.value)}
              placeholder="Av. Eduardo Ribeiro"
            />
          </div>
          <div>
            <label className={LABEL}>Nº</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={fields.street_number ?? ""}
              onChange={(e) => handleChange("street_number", e.target.value)}
              placeholder="123"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL}>Complemento</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={fields.complement ?? ""}
              onChange={(e) => handleChange("complement", e.target.value)}
              placeholder="Sala 1"
            />
          </div>
          <div>
            <label className={LABEL}>Bairro</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={fields.neighborhood ?? ""}
              onChange={(e) => handleChange("neighborhood", e.target.value)}
              placeholder="Centro"
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_44px] gap-2">
          <div>
            <label className={LABEL}>Cidade</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={fields.city ?? ""}
              onChange={(e) => handleChange("city", e.target.value)}
              placeholder="Manaus"
            />
          </div>
          <div>
            <label className={LABEL}>UF</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={fields.state ?? ""}
              onChange={(e) => handleChange("state", e.target.value.toUpperCase())}
              placeholder="AM"
              maxLength={2}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main CustomerSection ──────────────────────────────────────────────────────
export function CustomerSection({ form, onCustomerDataChange }: CustomerSectionProps) {
  const { control, setValue, watch } = form
  const [swapping, setSwapping] = useState(false)

  const customerId = watch("customer") || null
  const customerName = watch("customer_name")

  const { data: detail, isLoading } = useCustomerDetail(customerId)

  function handleCustomerDataChange(data: CustomerUpdateInput | null) {
    onCustomerDataChange?.(data)
  }

  function handleSwapSelect(newId: string, newName: string) {
    setValue("customer", newId)
    setValue("customer_name", newName)
    handleCustomerDataChange(null)
    setSwapping(false)
  }

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between border-b pb-1.5">
        <span className={SECTION_TITLE}>Dados do Cliente</span>
        {customerId && !swapping && (
          <button
            type="button"
            onClick={() => setSwapping(true)}
            className="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-neutral-600"
          >
            <ArrowLeftRight className="h-3 w-3" />
            Trocar cliente
          </button>
        )}
      </div>

      {/* Swapping mode — inline search */}
      {swapping && (
        <InlineSearch
          onSelect={handleSwapSelect}
          onCancel={() => setSwapping(false)}
        />
      )}

      {/* No customer linked — show search */}
      {!swapping && !customerId && (
        <Controller
          name="customer"
          control={control}
          render={({ field }) => (
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
              <InlineSearch
                onSelect={(id, name) => {
                  field.onChange(id)
                  setValue("customer_name", name)
                  handleCustomerDataChange(null)
                }}
                onCancel={() => {/* no-op when there's no customer to revert to */}}
              />
            </div>
          )}
        />
      )}

      {/* Customer with UUID — editable form */}
      {!swapping && customerId && (
        <>
          {isLoading && (
            <div className="flex items-center gap-2 py-2 text-xs text-neutral-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando dados do cliente...
            </div>
          )}
          {detail && (
            <EditableFields
              detail={detail}
              onCustomerDataChange={handleCustomerDataChange}
            />
          )}
          {/* Fallback: UUID exists but detail failed — show name-only */}
          {!isLoading && !detail && customerName && (
            <div>
              <label className={LABEL}>Nome</label>
              <div className={INPUT_READONLY}>{customerName}</div>
            </div>
          )}
        </>
      )}

      {/* Old OS: customer_name but no UUID — show search pre-filled */}
      {!swapping && !customerId && customerName && (
        <p className="text-xs text-neutral-400 mt-1">
          Cliente &quot;{customerName}&quot; sem vínculo — busque acima para vincular.
        </p>
      )}
    </div>
  )
}
