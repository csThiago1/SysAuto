"use client"

import { useEffect, useRef, useState } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { Search, ArrowLeftRight, Loader2, Phone, Mail, Calendar } from "lucide-react"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import {
  useCustomerDetail,
  usePersonSearch,
  usePersonDetail,
  type CustomerDetail,
  type CustomerUpdateInput,
  type PersonDetail,
  type PersonPatch,
} from "../../_hooks/useCustomerSearch"
import { useDebounce } from "@/hooks/useDebounce"
import { useCepLookup } from "@/hooks"

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-white/50"
const LABEL = "block text-xs font-bold uppercase tracking-wide text-white/40 mb-0.5"
const INPUT_EDIT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
const INPUT_READONLY =
  "flex h-8 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-sm text-white/50 cursor-default select-all"

interface CustomerSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  onCustomerDataChange?: (data: CustomerUpdateInput | null) => void
  onPersonDataChange?: (data: PersonPatch | null) => void
}

// ── Person inline search ───────────────────────────────────────────────────────
interface PersonInlineSearchProps {
  onSelect: (id: number, name: string) => void
  onCancel: () => void
}

function PersonInlineSearch({ onSelect, onCancel }: PersonInlineSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 350)
  const { data, isFetching } = usePersonSearch(debouncedQuery)
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
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
          <input
            type="text"
            autoFocus
            placeholder="Buscar por nome..."
            className={`${INPUT_EDIT} pl-8`}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => { if (query.length >= 2) setOpen(true) }}
            autoComplete="off"
          />
          {isFetching && (
            <Loader2 className="absolute right-2.5 top-2 h-3.5 w-3.5 animate-spin text-white/40" />
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded border border-white/15 px-2.5 py-1 text-xs font-medium text-white/50 hover:bg-white/5 h-8"
        >
          Cancelar
        </button>
      </div>

      {open && debouncedQuery.length >= 2 && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-white/5 shadow-lg overflow-hidden">
          <ul>
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
                  onClick={() => onSelect(p.id, p.name)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.name}</p>
                    {p.phone_masked && (
                      <p className="text-xs text-white/50 mt-0.5">{p.phone_masked}</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && debouncedQuery.length >= 2 && !isFetching && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-white/5 shadow-lg px-3 py-2">
          <p className="text-xs text-white/40">Nenhum cliente encontrado.</p>
        </div>
      )}
    </div>
  )
}

// ── Person info panel (editable) ──────────────────────────────────────────────
interface PersonInfoPanelProps {
  personId: number
  customerName: string
  onPersonDataChange?: (data: PersonPatch | null) => void
}

function PersonInfoPanel({ personId, customerName, onPersonDataChange }: PersonInfoPanelProps) {
  const { data: person, isLoading } = usePersonDetail(personId)
  const cepLookup = useCepLookup()

  const [email, setEmail] = useState("")
  const [addr, setAddr] = useState({
    zip_code: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  })

  // Initialize editable fields when person data loads
  useEffect(() => {
    if (!person) return
    const existingEmail = person.contacts.find((c) => c.contact_type === "EMAIL")?.value ?? ""
    setEmail(existingEmail)
    const primary = person.addresses.find((a) => a.is_primary) ?? person.addresses[0]
    if (primary) {
      setAddr({
        zip_code: primary.zip_code ?? "",
        street: primary.street ?? "",
        number: primary.number ?? "",
        complement: primary.complement ?? "",
        neighborhood: primary.neighborhood ?? "",
        city: primary.city ?? "",
        state: primary.state ?? "",
      })
    }
  }, [person?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function buildPatch(newEmail: string, newAddr: typeof addr): PersonPatch | null {
    if (!person) return null

    const origEmail = person.contacts.find((c) => c.contact_type === "EMAIL")?.value ?? ""
    const primary = person.addresses.find((a) => a.is_primary) ?? person.addresses[0]
    const origAddr = {
      zip_code: primary?.zip_code ?? "",
      street: primary?.street ?? "",
      number: primary?.number ?? "",
      complement: primary?.complement ?? "",
      neighborhood: primary?.neighborhood ?? "",
      city: primary?.city ?? "",
      state: primary?.state ?? "",
    }

    const emailChanged = newEmail !== origEmail
    const addrChanged = (Object.keys(newAddr) as Array<keyof typeof newAddr>).some(
      (k) => newAddr[k] !== origAddr[k]
    )

    if (!emailChanged && !addrChanged) return null

    const contacts = person.contacts
      .filter((c) => c.contact_type !== "EMAIL")
      .map((c) => ({ contact_type: c.contact_type, value: c.value, is_primary: c.is_primary }))
    if (newEmail) {
      contacts.push({ contact_type: "EMAIL", value: newEmail, is_primary: false })
    }

    const addresses = [{ address_type: "RESIDENTIAL", ...newAddr, is_primary: true }]

    return { contacts, addresses }
  }

  function handleEmailChange(value: string) {
    setEmail(value)
    onPersonDataChange?.(buildPatch(value, addr))
  }

  function handleAddrChange(field: keyof typeof addr, value: string) {
    const newAddr = { ...addr, [field]: field === "state" ? value.toUpperCase() : value }
    setAddr(newAddr)
    onPersonDataChange?.(buildPatch(email, newAddr))
  }

  async function handleCepBlur(value: string) {
    const clean = value.replace(/\D/g, "")
    if (clean.length !== 8) return
    try {
      const d = await cepLookup.mutateAsync(clean)
      const newAddr = {
        ...addr,
        zip_code: value,
        street: d.street || addr.street,
        neighborhood: d.neighborhood || addr.neighborhood,
        city: d.city || addr.city,
        state: d.state || addr.state,
        complement: d.complement || addr.complement,
      }
      setAddr(newAddr)
      onPersonDataChange?.(buildPatch(email, newAddr))
    } catch { /* usuário preenche manualmente */ }
  }

  const phone = person?.contacts.find(
    (c) => c.contact_type === "PHONE" || c.contact_type === "CELULAR"
  )?.value

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-white/40">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando dados do cliente...
      </div>
    )
  }

  return (
    <div className="space-y-2 mt-1">
      {/* Nome e telefone — read-only */}
      <div>
        <label className={LABEL}>Nome</label>
        <div className={INPUT_READONLY}>{person?.full_name ?? customerName}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {phone && (
          <div>
            <label className={LABEL}>
              <span className="flex items-center gap-1">
                <Phone className="h-2.5 w-2.5" /> Telefone
              </span>
            </label>
            <div className={INPUT_READONLY}>{phone}</div>
          </div>
        )}
        <div>
          <label className={LABEL}>
            <span className="flex items-center gap-1">
              <Mail className="h-2.5 w-2.5" /> E-mail
            </span>
          </label>
          <input
            type="email"
            className={INPUT_EDIT}
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="email@exemplo.com"
            autoComplete="off"
          />
        </div>
      </div>

      {person?.birth_date && (
        <div className="w-1/2 pr-1">
          <label className={LABEL}>
            <span className="flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" /> Nascimento
            </span>
          </label>
          <div className={INPUT_READONLY}>
            {new Date(person.birth_date).toLocaleDateString("pt-BR")}
          </div>
        </div>
      )}

      {/* Endereço — editável */}
      <div className="space-y-1.5 pt-1 border-t border-white/10">
        <p className={`${SECTION_TITLE} pt-1`}>Endereço</p>
        <div className="grid grid-cols-[112px_1fr_56px] gap-2">
          <div>
            <label className={LABEL}>CEP</label>
            <div className="relative">
              <input
                type="text"
                className={INPUT_EDIT}
                value={addr.zip_code}
                onChange={(e) => handleAddrChange("zip_code", e.target.value)}
                onBlur={(e) => void handleCepBlur(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
              />
              {cepLookup.isPending && (
                <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-white/40" />
              )}
            </div>
          </div>
          <div>
            <label className={LABEL}>Rua / Av.</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={addr.street}
              onChange={(e) => handleAddrChange("street", e.target.value)}
              placeholder="Av. Eduardo Ribeiro"
            />
          </div>
          <div>
            <label className={LABEL}>Nº</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={addr.number}
              onChange={(e) => handleAddrChange("number", e.target.value)}
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
              value={addr.complement}
              onChange={(e) => handleAddrChange("complement", e.target.value)}
              placeholder="Sala 1"
            />
          </div>
          <div>
            <label className={LABEL}>Bairro</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={addr.neighborhood}
              onChange={(e) => handleAddrChange("neighborhood", e.target.value)}
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
              value={addr.city}
              onChange={(e) => handleAddrChange("city", e.target.value)}
              placeholder="Manaus"
            />
          </div>
          <div>
            <label className={LABEL}>UF</label>
            <input
              type="text"
              className={INPUT_EDIT}
              value={addr.state}
              onChange={(e) => handleAddrChange("state", e.target.value.toUpperCase())}
              placeholder="AM"
              maxLength={2}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Editable customer fields (UnifiedCustomer — legado) ───────────────────────
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
    onCustomerDataChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.id])

  function handleChange(field: keyof CustomerUpdateInput, value: string) {
    const next = { ...fields, [field]: value }
    setFields(next)
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
      <div>
        <label className={LABEL}>Nome</label>
        <input type="text" className={INPUT_EDIT} value={fields.name ?? ""} onChange={(e) => handleChange("name", e.target.value)} placeholder="Nome completo" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className={LABEL}>Telefone</label>
          <input type="tel" className={INPUT_EDIT} value={fields.phone ?? ""} onChange={(e) => handleChange("phone", e.target.value)} placeholder="(92) 99999-1234" />
        </div>
        <div className="col-span-2">
          <label className={LABEL}>E-mail</label>
          <input type="email" className={INPUT_EDIT} value={fields.email ?? ""} onChange={(e) => handleChange("email", e.target.value)} placeholder="email@exemplo.com" />
        </div>
        <div>
          <label className={LABEL}>Nascimento</label>
          <input type="date" className={INPUT_EDIT} value={fields.birth_date ?? ""} onChange={(e) => handleChange("birth_date", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className={LABEL}>CPF</label>
          <div className={INPUT_READONLY}>{detail.cpf_masked ?? "—"}</div>
        </div>
      </div>
      <div className="space-y-1.5 pt-1 border-t border-white/10">
        <p className={`${SECTION_TITLE} pt-1`}>Endereço</p>
        <div className="grid grid-cols-[72px_1fr_52px] gap-2">
          <div>
            <label className={LABEL}>CEP</label>
            <input type="text" className={INPUT_EDIT} value={fields.zip_code ?? ""} onChange={(e) => handleChange("zip_code", e.target.value)} placeholder="69000-000" maxLength={9} />
          </div>
          <div>
            <label className={LABEL}>Rua / Av.</label>
            <input type="text" className={INPUT_EDIT} value={fields.street ?? ""} onChange={(e) => handleChange("street", e.target.value)} placeholder="Av. Eduardo Ribeiro" />
          </div>
          <div>
            <label className={LABEL}>Nº</label>
            <input type="text" className={INPUT_EDIT} value={fields.street_number ?? ""} onChange={(e) => handleChange("street_number", e.target.value)} placeholder="123" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL}>Complemento</label>
            <input type="text" className={INPUT_EDIT} value={fields.complement ?? ""} onChange={(e) => handleChange("complement", e.target.value)} placeholder="Sala 1" />
          </div>
          <div>
            <label className={LABEL}>Bairro</label>
            <input type="text" className={INPUT_EDIT} value={fields.neighborhood ?? ""} onChange={(e) => handleChange("neighborhood", e.target.value)} placeholder="Centro" />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_44px] gap-2">
          <div>
            <label className={LABEL}>Cidade</label>
            <input type="text" className={INPUT_EDIT} value={fields.city ?? ""} onChange={(e) => handleChange("city", e.target.value)} placeholder="Manaus" />
          </div>
          <div>
            <label className={LABEL}>UF</label>
            <input type="text" className={INPUT_EDIT} value={fields.state ?? ""} onChange={(e) => handleChange("state", e.target.value.toUpperCase())} placeholder="AM" maxLength={2} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main CustomerSection ──────────────────────────────────────────────────────
export function CustomerSection({ form, onCustomerDataChange, onPersonDataChange }: CustomerSectionProps) {
  const { control, setValue, watch } = form
  const [swapping, setSwapping] = useState(false)

  const customerId = watch("customer") || null
  const customerPersonId = watch("customer_person_id") ?? null
  const customerName = watch("customer_name")

  const { data: legacyDetail, isLoading: legacyLoading } = useCustomerDetail(customerId)

  function handleCustomerDataChange(data: CustomerUpdateInput | null) {
    onCustomerDataChange?.(data)
  }

  function handlePersonSelect(newId: number, newName: string) {
    setValue("customer_person_id", newId)
    setValue("customer_name", newName)
    setValue("customer", null as unknown as string)
    handleCustomerDataChange(null)
    onPersonDataChange?.(null)
    setSwapping(false)
  }

  const hasCustomer = !!customerId || customerPersonId != null

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between border-b pb-1.5">
        <span className={SECTION_TITLE}>Dados do Cliente</span>
        {hasCustomer && !swapping && (
          <button
            type="button"
            onClick={() => setSwapping(true)}
            className="flex items-center gap-1 text-xs font-medium text-white/40 hover:text-white/60"
          >
            <ArrowLeftRight className="h-3 w-3" />
            Trocar cliente
          </button>
        )}
      </div>

      {/* Swapping mode */}
      {swapping && (
        <PersonInlineSearch
          onSelect={handlePersonSelect}
          onCancel={() => setSwapping(false)}
        />
      )}

      {/* No customer yet */}
      {!swapping && !hasCustomer && (
        <Controller
          name="customer_person_id"
          control={control}
          render={() => (
            <PersonInlineSearch
              onSelect={handlePersonSelect}
              onCancel={() => {/* no-op */}}
            />
          )}
        />
      )}

      {/* Person FK — novo fluxo */}
      {!swapping && customerPersonId != null && (
        <PersonInfoPanel
          personId={customerPersonId}
          customerName={customerName ?? ""}
          onPersonDataChange={onPersonDataChange}
        />
      )}

      {/* UUID legado — UnifiedCustomer */}
      {!swapping && customerId && !customerPersonId && (
        <>
          {legacyLoading && (
            <div className="flex items-center gap-2 py-2 text-xs text-white/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando dados do cliente...
            </div>
          )}
          {legacyDetail && (
            <EditableFields
              detail={legacyDetail}
              onCustomerDataChange={handleCustomerDataChange}
            />
          )}
          {!legacyLoading && !legacyDetail && customerName && (
            <div>
              <label className={LABEL}>Nome</label>
              <div className={INPUT_READONLY}>{customerName}</div>
            </div>
          )}
        </>
      )}

      {/* Sem vínculo nenhum mas tem nome */}
      {!swapping && !hasCustomer && customerName && (
        <p className="text-xs text-white/40 mt-1">
          Cliente &quot;{customerName}&quot; sem vínculo — busque acima para vincular.
        </p>
      )}
    </div>
  )
}
