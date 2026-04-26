"use client"

/**
 * Emissão de NF-e de Produto — ADMIN+
 * Ciclo 07A
 *
 * Duas abas:
 *  - A partir de uma OS: service_order_id + forma_pagamento
 *  - Manual: destinatário + itens (com NCM obrigatório) + forma_pagamento + manual_reason
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Package,
  ClipboardList,
  Search,
  Check,
  X,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEmitNfe, useEmitManualNfe } from "@/hooks/useFiscal"
import { useServiceOrders } from "@/hooks/useServiceOrders"
import { withRoleGuard } from "@/lib/withRoleGuard"
import { ApiError } from "@/lib/api"
import type { FiscalDocument, ServiceOrder } from "@paddock/types"
import { cn } from "@/lib/utils"

// Extrai mensagem legível de um ApiError de validação DRF
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

// ─── Constantes ───────────────────────────────────────────────────────────────

const FORMA_PAGAMENTO_OPTIONS = [
  { value: "01", label: "01 — Dinheiro" },
  { value: "03", label: "03 — Cartão de Crédito" },
  { value: "04", label: "04 — Cartão de Débito" },
  { value: "99", label: "99 — Outros" },
]

// ─── OS Search helper ─────────────────────────────────────────────────────────

function OsSearch({
  onSelect,
}: {
  onSelect: (os: ServiceOrder) => void
}) {
  const [query, setQuery] = useState("")
  const { data, isFetching } = useServiceOrders(
    query.trim().length >= 2 ? { search: query.trim() } : {},
    1,
    10
  )
  const results = data?.results ?? []

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Número da OS, placa ou cliente..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-white/30" />
        )}
      </div>

      {query.trim().length >= 2 && results.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-[#1c1c1e] divide-y divide-white/[0.06] max-h-52 overflow-y-auto">
          {results.map((os) => (
            <button
              key={os.id}
              type="button"
              onClick={() => { onSelect(os); setQuery("") }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
            >
              <div>
                <span className="text-sm font-medium text-white">OS #{os.number}</span>
                <span className="ml-2 text-xs text-white/50">
                  {os.plate} · {os.customer_name}
                </span>
              </div>
              <span className="text-xs text-white/30">{os.status}</span>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !isFetching && results.length === 0 && (
        <p className="text-xs text-white/40 px-1">Nenhuma OS encontrada.</p>
      )}
    </div>
  )
}

// ─── Schema: emissão manual ───────────────────────────────────────────────────

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
  destinatario_id: z.coerce.number().int().positive("ID do destinatário inválido"),
  itens: z.array(nfeItemSchema).min(1, "Ao menos um item obrigatório"),
  forma_pagamento: z.enum(["01", "03", "04", "99"]).default("01"),
  observacoes: z.string().max(2000).default(""),
  manual_reason: z.string().min(5, "Mínimo 5 caracteres").max(255, "Máximo 255 caracteres"),
})

type ManualFormValues = z.infer<typeof manualSchema>

// ─── Success card ─────────────────────────────────────────────────────────────

function SuccessCard({
  doc,
  onReset,
}: {
  doc: FiscalDocument
  onReset: () => void
}) {
  const router = useRouter()

  return (
    <div className="p-6 max-w-xl space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-success-950/40 border border-success-700/30 p-5">
        <CheckCircle2 className="h-6 w-6 text-success-400 shrink-0" />
        <div>
          <p className="font-semibold text-success-300">NF-e enviada para processamento</p>
          <p className="text-xs text-success-500 mt-0.5">
            O documento foi enviado à SEFAZ via Focus NF-e.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-2 text-sm">
        {doc.ref && (
          <div className="flex justify-between">
            <span className="text-white/50">Referência</span>
            <span className="font-mono text-white/80 text-xs">{doc.ref}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-white/50">Status</span>
          <span className="text-warning-400 text-xs">Aguardando autorização</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Tipo</span>
          <span className="text-white/80 text-xs uppercase">{doc.document_type}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => router.back()} className="text-white/60">
          Voltar
        </Button>
        <Button
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick={() => router.push("/fiscal/documentos" as any)}
          className="bg-primary-600 hover:bg-primary-700 text-white"
        >
          Ver documentos emitidos
        </Button>
        <Button
          onClick={onReset}
          variant="outline"
          className="border-white/15 text-white/70"
        >
          Emitir outra
        </Button>
      </div>
    </div>
  )
}

// ─── Aba: A partir de OS ──────────────────────────────────────────────────────

function TabFromOs({ onSuccess }: { onSuccess: (doc: FiscalDocument) => void }) {
  const emitMutation = useEmitNfe()
  const [selectedOs, setSelectedOs] = useState<ServiceOrder | null>(null)
  const [formaPagamento, setFormaPagamento] = useState("01")

  async function handleEmit() {
    if (!selectedOs) return
    try {
      const doc = await emitMutation.mutateAsync({
        service_order_id: selectedOs.id,
        forma_pagamento: formaPagamento as "01" | "03" | "04" | "99",
      })
      onSuccess(doc)
      toast.success("NF-e enviada para processamento.")
    } catch (err) {
      toast.error(extractApiError(err))
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
          Buscar Ordem de Serviço
        </h2>

        {selectedOs ? (
          <div className="flex items-center justify-between rounded-lg bg-primary-600/10 border border-primary-600/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">OS #{selectedOs.number}</p>
              <p className="text-xs text-white/50 mt-0.5">
                {selectedOs.plate} · {selectedOs.customer_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success-400" />
              <button
                type="button"
                onClick={() => setSelectedOs(null)}
                className="p-1 rounded text-white/30 hover:text-white/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <OsSearch onSelect={setSelectedOs} />
        )}

        {selectedOs && (
          <div>
            <Label className="text-xs text-white/60">Forma de Pagamento</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {FORMA_PAGAMENTO_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setFormaPagamento(o.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs border transition-colors",
                    formaPagamento === o.value
                      ? "border-primary-600 bg-primary-600/10 text-primary-400"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white/70"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-warning-950/30 border border-warning-700/20 p-4 text-xs text-warning-300/70 space-y-1">
        <p className="font-semibold text-warning-300">Requisitos</p>
        <ul className="list-disc list-inside space-y-0.5 text-warning-300/60">
          <li>A OS precisa ter ao menos uma peça ativa</li>
          <li>Todas as peças devem ter NCM de 8 dígitos preenchido no catálogo</li>
          <li>O cliente precisa ter CPF/CNPJ e endereço primário cadastrado</li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleEmit}
          disabled={!selectedOs || emitMutation.isPending}
          className="bg-primary-600 hover:bg-primary-700 text-white"
        >
          {emitMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Emitindo...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-1.5" />
              Emitir NF-e da OS
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Aba: Manual ──────────────────────────────────────────────────────────────

function TabManual({ onSuccess }: { onSuccess: (doc: FiscalDocument) => void }) {
  const emitMutation = useEmitManualNfe()
  const [apiError, setApiError] = useState<string | null>(null)

  const form = useForm<ManualFormValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      destinatario_id: undefined,
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {/* Destinatário */}
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
          Destinatário
        </h2>

        <div>
          <Label className="text-xs text-white/60">
            ID do Destinatário (Person — número inteiro){" "}
            <span className="text-red-400">*</span>
          </Label>
          <Input
            className="mt-1"
            type="number"
            placeholder="Ex: 42"
            {...form.register("destinatario_id", { valueAsNumber: true })}
          />
          {form.formState.errors.destinatario_id && (
            <p className="mt-0.5 text-xs text-red-400">
              {form.formState.errors.destinatario_id.message}
            </p>
          )}
          <p className="mt-1 text-xs text-white/30">
            O Person deve ter documento primário (CPF/CNPJ) e endereço primário cadastrado.
          </p>
        </div>
      </div>

      {/* Itens */}
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
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
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar item
          </button>
        </div>

        {form.formState.errors.itens?.message && (
          <p className="text-xs text-red-400">{form.formState.errors.itens.message}</p>
        )}

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/40">Item {index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="p-1 rounded text-white/30 hover:text-red-400 disabled:opacity-20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Linha 1: descrição + código produto */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs text-white/40">
                    Descrição <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    className="mt-0.5 text-xs"
                    placeholder="Ex: Amortecedor dianteiro direito"
                    {...form.register(`itens.${index}.descricao`)}
                  />
                  {form.formState.errors.itens?.[index]?.descricao && (
                    <p className="mt-0.5 text-xs text-red-400">
                      {form.formState.errors.itens[index]?.descricao?.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-white/40">Código Produto</Label>
                  <Input
                    className="mt-0.5 text-xs font-mono"
                    placeholder="Ex: ATS-001"
                    {...form.register(`itens.${index}.codigo_produto`)}
                  />
                </div>
              </div>

              {/* Linha 2: NCM + unidade + qtd + valor unit + desconto */}
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs text-white/40">
                    NCM <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    className="mt-0.5 text-xs font-mono"
                    placeholder="87089990"
                    maxLength={10}
                    {...form.register(`itens.${index}.ncm`)}
                  />
                  {form.formState.errors.itens?.[index]?.ncm && (
                    <p className="mt-0.5 text-xs text-red-400">
                      {form.formState.errors.itens[index]?.ncm?.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-white/40">Unid.</Label>
                  <Input
                    className="mt-0.5 text-xs"
                    placeholder="UN"
                    maxLength={6}
                    {...form.register(`itens.${index}.unidade`)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40">Qtd</Label>
                  <Input
                    className="mt-0.5 text-xs"
                    placeholder="1.0000"
                    {...form.register(`itens.${index}.quantidade`)}
                  />
                  {form.formState.errors.itens?.[index]?.quantidade && (
                    <p className="mt-0.5 text-xs text-red-400">!</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-white/40">Preço Unit.</Label>
                  <Input
                    className="mt-0.5 text-xs"
                    placeholder="0.00"
                    {...form.register(`itens.${index}.valor_unitario`)}
                  />
                  {form.formState.errors.itens?.[index]?.valor_unitario && (
                    <p className="mt-0.5 text-xs text-red-400">!</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dados complementares */}
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
          Dados Complementares
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-white/60">Forma de Pagamento</Label>
            <select
              className="mt-1 w-full rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white"
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
          <Label className="text-xs text-white/60">Observações</Label>
          <textarea
            rows={2}
            className="mt-1 w-full rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-primary-600"
            placeholder="Informações complementares ao fisco..."
            maxLength={2000}
            {...form.register("observacoes")}
          />
        </div>

        <div>
          <Label className="text-xs text-white/60">
            Justificativa de Emissão Manual <span className="text-red-400">*</span>
          </Label>
          <Input
            className="mt-1"
            placeholder="Ex: Venda de peças avulsas sem OS vinculada"
            {...form.register("manual_reason")}
          />
          {form.formState.errors.manual_reason && (
            <p className="mt-0.5 text-xs text-red-400">
              {form.formState.errors.manual_reason.message}
            </p>
          )}
        </div>
      </div>

      {/* Inline error */}
      {apiError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-950/50 border border-red-700/40 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{apiError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={emitMutation.isPending}
          className="bg-primary-600 hover:bg-primary-700 text-white"
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "os" | "manual"

function EmitirNfePageInner() {
  const [tab, setTab] = useState<Tab>("os")
  const [emitted, setEmitted] = useState<FiscalDocument | null>(null)

  if (emitted) {
    return <SuccessCard doc={emitted} onReset={() => setEmitted(null)} />
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-primary-600" />
        <div>
          <h1 className="text-xl font-bold text-white">Emissão de NF-e de Produto</h1>
          <p className="text-xs text-white/50 mt-0.5">
            Nota fiscal de mercadoria — válida para qualquer estado — requer ADMIN
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-white/[0.04] border border-white/10 p-1">
        <button
          type="button"
          onClick={() => setTab("os")}
          className={cn(
            "flex items-center gap-2 flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            tab === "os"
              ? "bg-white/[0.08] text-white"
              : "text-white/40 hover:text-white/70"
          )}
        >
          <ClipboardList className="h-4 w-4" />
          A partir de uma OS
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={cn(
            "flex items-center gap-2 flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            tab === "manual"
              ? "bg-white/[0.08] text-white"
              : "text-white/40 hover:text-white/70"
          )}
        >
          <Package className="h-4 w-4" />
          Manual (sem OS)
        </button>
      </div>

      {/* Tab content */}
      {tab === "os" ? (
        <TabFromOs onSuccess={setEmitted} />
      ) : (
        <TabManual onSuccess={setEmitted} />
      )}
    </div>
  )
}

export default withRoleGuard(EmitirNfePageInner, "ADMIN", "/dashboard")
