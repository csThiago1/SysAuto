"use client"

import { useEffect, useRef, useState } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { Search, ArrowLeftRight, Loader2, Phone, Mail, Calendar } from "lucide-react"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import {
  usePersonSearch,
  usePersonDetail,
  type PersonPatch,
} from "../../_hooks/useCustomerSearch"
import { FORM_INPUT, FORM_LABEL, formatPhone, formatCEP, onlyDigits } from "@paddock/utils"
import { useDebounce } from "@/hooks/useDebounce"
import { useCepLookup } from "@/hooks"

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-muted-foreground"
// Um unico sistema de campo na tela de OS — antes cada secao tinha o seu.
const LABEL = FORM_LABEL
const INPUT_EDIT = FORM_INPUT
const INPUT_READONLY = `${FORM_INPUT} text-muted-foreground cursor-default select-all`

interface CustomerSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  onPersonDataChange?: (data: PersonPatch | null) => void
  /** O container ja rotula a secao (Panel "Cliente") — nao repetir o heading. */
  hideHeading?: boolean
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
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
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
            <Loader2 className="absolute right-2.5 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 h-8"
        >
          Cancelar
        </button>
      </div>

      {open && debouncedQuery.length >= 2 && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-muted/50 shadow-lg overflow-hidden">
          <ul>
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => onSelect(p.id, p.name)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    {p.phone_masked && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.phone_masked}</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && debouncedQuery.length >= 2 && !isFetching && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-muted/50 shadow-lg px-3 py-2">
          <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
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
  /** Ação exibida junto do rótulo "Nome" — é o campo que ela troca. */
  action?: React.ReactNode
}

const PHONE_TYPES = ["WHATSAPP", "CELULAR", "COMERCIAL", "PHONE"] as const

/**
 * Valor mascarado pelo backend (`_mask_value`: tudo asterisco menos os 4
 * ultimos). Nunca pode voltar num PATCH — gravaria os asteriscos por cima
 * do dado real. Tambem nao deve ser tratado como texto editavel na UI.
 */
function isMasked(value: string | null | undefined): boolean {
  return !!value && value.includes("*")
}

/** Ação de trocar o cliente da OS. */
function SwapCustomerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground/60"
    >
      <ArrowLeftRight className="h-3 w-3" />
      Trocar cliente
    </button>
  )
}

/**
 * Exibe um contato mascarado como LEITURA, com acao explicita pra substituir.
 * Renderizar asteriscos dentro de um input editavel convidava o usuario a
 * "salvar" o que nao era dado — e era assim que o valor real se perdia.
 */
function MaskedField({
  masked,
  onReplace,
  label,
}: {
  masked: string
  onReplace: () => void
  label: string
}) {
  return (
    <div className={`${INPUT_READONLY} items-center justify-between gap-2`}>
      <span className="truncate font-mono tabular-nums" title={`${label} protegido`}>
        {masked}
      </span>
      <button
        type="button"
        onClick={onReplace}
        className="shrink-0 text-xs font-medium text-primary hover:underline"
      >
        Alterar
      </button>
    </div>
  )
}

function findPhoneContact(contacts: { contact_type: string; value: string; is_primary: boolean }[]) {
  for (const type of PHONE_TYPES) {
    const found = contacts.find((c) => c.contact_type === type)
    if (found?.value) return found
  }
  return null
}

function PersonInfoPanel({ personId, customerName, onPersonDataChange, action }: PersonInfoPanelProps) {
  const { data: person, isLoading } = usePersonDetail(personId)
  const cepLookup = useCepLookup()

  const [email, setEmail] = useState("")
  const [phoneValue, setPhoneValue] = useState("")
  const [addr, setAddr] = useState({
    zip_code: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  })
  // Endereco preenchido colapsa numa linha: 7 caixas permanentes eram o maior
  // bloco da aba. Vazio abre sozinho — nada que precise ser preenchido some.
  const [addrOpen, setAddrOpen] = useState(false)

  /** "Av. Joaquim Nabuco, 620 · Centro · Manaus/AM" — vazio quando nao ha nada. */
  const addressSummary = [
    [addr.street, addr.number].filter(Boolean).join(", "),
    addr.neighborhood,
    [addr.city, addr.state].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" · ")

  // Initialize editable fields when person data loads
  useEffect(() => {
    if (!person) return
    const existingEmail = person.contacts.find((c) => c.contact_type === "EMAIL")?.value ?? ""
    setEmail(existingEmail)
    setPhoneValue(findPhoneContact(person.contacts)?.value ?? "")
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

  function buildPatch(newEmail: string, newAddr: typeof addr, newPhone: string): PersonPatch | null {
    if (!person) return null

    const origEmail = person.contacts.find((c) => c.contact_type === "EMAIL")?.value ?? ""
    const origPhoneContact = findPhoneContact(person.contacts)
    const origPhone = origPhoneContact?.value ?? ""
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
    const phoneChanged = newPhone !== origPhone
    const addrChanged = (Object.keys(newAddr) as Array<keyof typeof newAddr>).some(
      (k) => newAddr[k] !== origAddr[k]
    )

    if (!emailChanged && !addrChanged && !phoneChanged) return null

    const phoneType = origPhoneContact?.contact_type ?? "CELULAR"
    // NUNCA reenviar um valor mascarado. Salvar so o endereco montava o patch
    // com TODOS os contatos, e os que vinham mascarados eram gravados como
    // asteriscos por cima do telefone/e-mail reais — perda permanente de PII.
    const contacts = person.contacts
      .filter((c) => c.contact_type !== "EMAIL" && c.contact_type !== phoneType)
      .filter((c) => !isMasked(c.value))
      .map((c) => ({ contact_type: c.contact_type, value: c.value, is_primary: c.is_primary }))
    if (newEmail && !isMasked(newEmail)) {
      contacts.push({ contact_type: "EMAIL", value: newEmail, is_primary: false })
    }
    if (newPhone && !isMasked(newPhone)) {
      contacts.push({
        contact_type: phoneType,
        value: newPhone,
        is_primary: origPhoneContact?.is_primary ?? true,
      })
    }

    // Choices do backend: PRINCIPAL | COBRANCA | ENTREGA — preserva o tipo existente.
    const addresses = [{ address_type: primary?.address_type ?? "PRINCIPAL", ...newAddr, is_primary: true }]

    return { contacts, addresses }
  }

  function handleEmailChange(value: string) {
    setEmail(value)
    onPersonDataChange?.(buildPatch(value, addr, phoneValue))
  }

  function handlePhoneChange(value: string) {
    setPhoneValue(value)
    onPersonDataChange?.(buildPatch(email, addr, value))
  }

  function handleAddrChange(field: keyof typeof addr, value: string) {
    const newAddr = { ...addr, [field]: field === "state" ? value.toUpperCase() : value }
    setAddr(newAddr)
    onPersonDataChange?.(buildPatch(email, newAddr, phoneValue))
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
      onPersonDataChange?.(buildPatch(email, newAddr, phoneValue))
    } catch { /* usuário preenche manualmente */ }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando dados do cliente...
      </div>
    )
  }

  return (
    <div className="space-y-2 mt-1">
      {/* Nome e telefone — read-only */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label className={LABEL}>Nome</label>
          {action}
        </div>
        <div className={INPUT_READONLY}>{person?.full_name ?? customerName}</div>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-5">
        <div>
          <label className={LABEL}>
            <span className="flex items-center gap-1">
              <Phone className="h-2.5 w-2.5" /> Telefone / WhatsApp
            </span>
          </label>
          {isMasked(phoneValue) ? (
            <MaskedField
              masked={phoneValue}
              onReplace={() => handlePhoneChange("")}
              label="telefone"
            />
          ) : (
            <input
              type="tel"
              inputMode="numeric"
              className={INPUT_EDIT}
              // Mascara e aparencia: o estado guarda so os digitos, que e o que
              // o backend indexa e o que o WhatsApp precisa.
              value={formatPhone(phoneValue)}
              onChange={(e) => handlePhoneChange(onlyDigits(e.target.value))}
              placeholder="(92) 99999-9999"
              autoComplete="off"
            />
          )}
        </div>
        <div>
          <label className={LABEL}>
            <span className="flex items-center gap-1">
              <Mail className="h-2.5 w-2.5" /> E-mail
            </span>
          </label>
          {isMasked(email) ? (
            <MaskedField
              masked={email}
              onReplace={() => handleEmailChange("")}
              label="e-mail"
            />
          ) : (
            <input
              // type="text" (não "email"): o valor inicial vem do contato salvo e, em
              // dados legados/corrompidos, pode não ter "@" — a validação nativa do
              // browser bloqueia o submit do form inteiro em silêncio nesse caso.
              type="text"
              inputMode="email"
              className={INPUT_EDIT}
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="email@exemplo.com"
              autoComplete="off"
            />
          )}
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
      <div className="space-y-1.5 pt-1 border-t border-border">
        <div className="flex items-baseline justify-between gap-2 pt-1">
          <p className={SECTION_TITLE}>Endereço</p>
          {addressSummary && (
            <button
              type="button"
              onClick={() => setAddrOpen((v) => !v)}
              className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground/70"
            >
              {addrOpen ? "Recolher" : "Editar"}
            </button>
          )}
        </div>

        {!addrOpen && addressSummary && (
          <p className="truncate text-sm text-foreground/80">{addressSummary}</p>
        )}

        {(addrOpen || !addressSummary) && (
        <div className="space-y-1.5">
        <div className="grid grid-cols-[112px_1fr_56px] gap-x-2 gap-y-5">
          <div>
            <label className={LABEL}>CEP</label>
            <div className="relative">
              <input
                type="text"
                className={INPUT_EDIT}
                inputMode="numeric"
                value={formatCEP(addr.zip_code)}
                onChange={(e) => handleAddrChange("zip_code", onlyDigits(e.target.value))}
                onBlur={(e) => void handleCepBlur(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
              />
              {cepLookup.isPending && (
                <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
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
        <div className="grid grid-cols-2 gap-x-2 gap-y-5">
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
        <div className="grid grid-cols-[1fr_44px] gap-x-2 gap-y-5">
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
        )}
      </div>
    </div>
  )
}

// ── Main CustomerSection ──────────────────────────────────────────────────────
export function CustomerSection({ form, onPersonDataChange, hideHeading }: CustomerSectionProps) {
  const { control, setValue, watch } = form
  const [swapping, setSwapping] = useState(false)

  const customerId = watch("customer") || null
  const customerPersonId = watch("customer_person_id") ?? null
  const customerName = watch("customer_name")

  function handlePersonSelect(newId: number, newName: string) {
    setValue("customer_person_id", newId)
    setValue("customer_name", newName)
    setValue("customer", null as unknown as string)
    onPersonDataChange?.(null)
    setSwapping(false)
  }

  const hasCustomer = !!customerId || customerPersonId != null

  return (
    <div className="space-y-2">
      {/* Cabeçalho: só existe quando o container NÃO rotula a seção. No
          workspace v2 essa linha inteira — título repetido + divisor + ação
          solta — custava ~34px para não dizer nada; a ação migrou para junto
          do campo Nome, que é exatamente o que ela troca. */}
      {!hideHeading && (
        <div className="flex items-center justify-between border-b pb-1.5">
          <span className={SECTION_TITLE}>Dados do Cliente</span>
          {hasCustomer && !swapping && <SwapCustomerButton onClick={() => setSwapping(true)} />}
        </div>
      )}

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
          action={
            hideHeading && hasCustomer && !swapping ? (
              <SwapCustomerButton onClick={() => setSwapping(true)} />
            ) : undefined
          }
        />
      )}

      {/* UUID legado — OS antigas com customer_uuid (sem person_id) */}
      {!swapping && customerId && !customerPersonId && (
        <div className="space-y-2 mt-1">
          <div>
            <label className={LABEL}>Nome</label>
            <div className={INPUT_READONLY}>{customerName || "Cliente legado"}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            Cliente vinculado via cadastro legado. Use &quot;Trocar cliente&quot; para vincular a um cadastro Person.
          </p>
        </div>
      )}

      {/* Sem vínculo nenhum mas tem nome */}
      {!swapping && !hasCustomer && customerName && (
        <p className="text-xs text-muted-foreground mt-1">
          Cliente &quot;{customerName}&quot; sem vínculo — busque acima para vincular.
        </p>
      )}
    </div>
  )
}
