"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Loader2, Package, AlertTriangle, Search, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEmitManualNfe } from "@/hooks/useFiscal"
import { usePersons } from "@/hooks/usePersons"
import { ApiError } from "@/lib/api"
import type { FiscalDocument } from "@paddock/types"
import { ItemRow } from "./ItemRow"

// ─── Error helper ─────────────────────────────────────────────────────────────

function extractApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.fieldErrors) {
      const msgs = Object.entries(err.fieldErrors)
        .map(([field, errors]) => `${field}: ${errors.join(", ")}`)
        .join(" | ")
      return msgs
    }
    return err.message
  }
  return "Erro ao emitir NF-e. Tente novamente."
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const nfeItemSchema = z.object({
  codigo_produto: z.string().max(60).optional().default(""),
  descricao: z.string().min(2, "Mínimo 2 caracteres").max(120, "Máximo 120 caracteres"),
  ncm: z
    .string()
    .min(8, "NCM deve ter 8 dígitos")
    .max(10)
    .regex(/^[\d.]+$/, "Apenas dígitos e pontos")
    .transform((v) => v.replace(".", "")),
  unidade: z.string().max(6).default("UN"),
  quantidade: z.string().regex(/^\d+(\.\d{1,4})?$/, "Quantidade inválida"),
  valor_unitario: z.string().regex(/^\d+(\.\d{1,4})?$/, "Preço inválido"),
  valor_desconto: z.string().default("0"),
})

const manualSchema = z.object({
  destinatario_id: z.string().min(1, "Selecione um destinatário"),
  itens: z.array(nfeItemSchema).min(1, "Ao menos um item obrigatório"),
  forma_pagamento: z.enum(["01", "03", "04", "99"]).default("01"),
  observacoes: z.string().max(2000).default(""),
  manual_reason: z.string().min(5, "Mínimo 5 caracteres").max(255, "Máximo 255 caracteres"),
})

export type ManualFormValues = z.infer<typeof manualSchema>

// ─── Constantes ───────────────────────────────────────────────────────────────

const FORMA_PAGAMENTO_OPTIONS = [
  { value: "01", label: "01 — Dinheiro" },
  { value: "03", label: "03 — Cartão de Crédito" },
  { value: "04", label: "04 — Cartão de Débito" },
  { value: "99", label: "99 — Outros" },
]

// ─── Person Search helper ─────────────────────────────────────────────────────

function PersonSearchField({
  selectedPerson,
  onSelect,
  onClear,
}: {
  selectedPerson: { id: string; full_name: string; person_kind: string } | null
  onSelect: (person: { id: string; full_name: string; person_kind: string }) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState("")
  const { data, isFetching } = usePersons(
    query.trim().length >= 2 ? { search: query.trim() } : undefined
  )
  const results = data?.results ?? []

  if (selectedPerson) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/30 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{selectedPerson.full_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedPerson.person_kind === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-success-400" />
          <button type="button" onClick={onClear} className="p-1 rounded text-muted-foreground hover:text-foreground/60">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, CPF ou CNPJ..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {query.trim().length >= 2 && results.length > 0 && (
        <div className="rounded-lg border border-border bg-card divide-y divide-white/[0.06] max-h-52 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onSelect({ id: String(p.id), full_name: p.full_name, person_kind: p.person_kind }); setQuery("") }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <div>
                <span className="text-sm font-medium text-foreground">{p.full_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{p.person_kind}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !isFetching && results.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">Nenhuma pessoa encontrada.</p>
      )}
    </div>
  )
}

// ─── TabManual ────────────────────────────────────────────────────────────────

export function TabManual({ onSuccess }: { onSuccess: (doc: FiscalDocument) => void }) {
  const emitMutation = useEmitManualNfe()
  const [apiError, setApiError] = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; full_name: string; person_kind: string } | null>(null)

  const form = useForm<ManualFormValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      destinatario_id: "",
      itens: [
        {
          codigo_produto: "",
          descricao: "",
          ncm: "",
          unidade: "UN",
          quantidade: "1.0000",
          valor_unitario: "",
          valor_desconto: "0",
        },
      ],
      forma_pagamento: "01",
      observacoes: "",
      manual_reason: "",
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "itens",
  })

  async function onSubmit(values: ManualFormValues) {
    setApiError(null)
    try {
      const doc = await emitMutation.mutateAsync(values)
      onSuccess(doc)
      toast.success("NF-e enviada para processamento.")
    } catch (err) {
      const msg = extractApiError(err)
      setApiError(msg)
      toast.error(msg)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit, () => toast.error("Preencha todos os campos obrigatórios."))} className="space-y-5">
      {/* Destinatário */}
      <div className="rounded-xl bg-muted/30 border border-border p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Destinatário
        </h2>

        <PersonSearchField
          selectedPerson={selectedPerson}
          onSelect={(p) => {
            setSelectedPerson(p)
            form.setValue("destinatario_id", p.id, { shouldValidate: true })
          }}
          onClear={() => {
            setSelectedPerson(null)
            form.setValue("destinatario_id", "", { shouldValidate: true })
          }}
        />
        {form.formState.errors.destinatario_id && !selectedPerson && (
          <p className="mt-0.5 text-xs text-error-400">
            Selecione um destinatário
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          O destinatário precisa ter CPF/CNPJ e endereço cadastrado.
        </p>
      </div>

      {/* Itens */}
      <div className="rounded-xl bg-muted/30 border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Itens / Mercadorias
          </h2>
          <button
            type="button"
            onClick={() =>
              append({
                codigo_produto: "",
                descricao: "",
                ncm: "",
                unidade: "UN",
                quantidade: "1.0000",
                valor_unitario: "",
                valor_desconto: "0",
              })
            }
            className="flex items-center gap-1 text-xs text-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar item
          </button>
        </div>

        {form.formState.errors.itens?.message && (
          <p className="text-xs text-error-400">{form.formState.errors.itens.message}</p>
        )}

        <div className="space-y-4">
          {fields.map((field, index) => (
            <ItemRow
              key={field.id}
              form={form}
              field={field}
              index={index}
              totalFields={fields.length}
              onRemove={remove}
            />
          ))}
        </div>
      </div>

      {/* Dados complementares */}
      <div className="rounded-xl bg-muted/30 border border-border p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dados Complementares
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-foreground/60">Forma de Pagamento</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
              {...form.register("forma_pagamento")}
            >
              {FORMA_PAGAMENTO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-zinc-900">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label className="text-xs text-foreground/60">Observações</Label>
          <textarea
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Informações complementares ao fisco..."
            maxLength={2000}
            {...form.register("observacoes")}
          />
        </div>

        <div>
          <Label className="text-xs text-foreground/60">
            Justificativa de Emissão Manual <span className="text-error-400">*</span>
          </Label>
          <Input
            className="mt-1"
            placeholder="Ex: Venda de peças avulsas sem OS vinculada"
            {...form.register("manual_reason")}
          />
          {form.formState.errors.manual_reason && (
            <p className="mt-0.5 text-xs text-error-400">
              {form.formState.errors.manual_reason.message}
            </p>
          )}
        </div>
      </div>

      {/* Inline error */}
      {apiError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-950/50 border border-red-700/40 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-error-400 mt-0.5 shrink-0" />
          <p className="text-xs text-error-400">{apiError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={emitMutation.isPending}
          className="bg-primary hover:bg-primary/90 text-foreground"
        >
          {emitMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Emitindo...
            </>
          ) : (
            <>
              <Package className="h-4 w-4 mr-1.5" />
              Emitir NF-e Manual
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
