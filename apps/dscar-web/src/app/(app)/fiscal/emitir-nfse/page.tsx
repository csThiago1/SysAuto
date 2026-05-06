"use client"

/**
 * Emissão Manual de NFS-e — ADMIN+
 * Ciclo 06C
 *
 * Permite emitir NFS-e ad-hoc sem OS vinculada.
 * Envia campos em português conforme ManualNfseInputSerializer.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { FileText, Plus, Trash2, Loader2, CheckCircle2, Search, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEmitManualNfse } from "@/hooks/useFiscal"
import { usePersons } from "@/hooks/usePersons"
import { withRoleGuard } from "@/lib/withRoleGuard"
import type { FiscalDocument } from "@paddock/types"
import { cn } from "@/lib/utils"

// ─── Person Search ───────────────────────────────────────────────────────────

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

// ─── Schema (espelha ManualNfseInputSerializer) ───────────────────────────────

const itemSchema = z.object({
  descricao: z.string().min(5, "Mínimo 5 caracteres"),
  quantidade: z.string().regex(/^\d+(\.\d{1,4})?$/, "Quantidade inválida"),
  valor_unitario: z.string().regex(/^\d+(\.\d{1,2})?$/, "Preço inválido"),
  valor_desconto: z.string().default("0"),
})

const schema = z.object({
  destinatario_id: z.string().min(1, "Selecione um destinatário"),
  data_emissao: z.string().min(10, "Data obrigatória"),
  manual_reason: z.string().min(5, "Justificativa mínima de 5 caracteres"),
  discriminacao: z.string().min(5, "Mínimo 5 caracteres").max(2000, "Máximo 2000 caracteres"),
  codigo_servico_lc116: z.string().default("14.12"),
  iss_retido: z.boolean().default(false),
  itens: z.array(itemSchema).min(1, "Ao menos um item obrigatório"),
})

type FormValues = z.infer<typeof schema>

// ─── Page ─────────────────────────────────────────────────────────────────────

function EmitirNfseManualPageInner() {
  const router = useRouter()
  const emitMutation = useEmitManualNfse()
  const [emitted, setEmitted] = useState<FiscalDocument | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; full_name: string; person_kind: string } | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      destinatario_id: "",
      data_emissao: new Date().toISOString().split("T")[0],
      manual_reason: "",
      discriminacao: "",
      codigo_servico_lc116: "14.12",
      iss_retido: false,
      itens: [{ descricao: "", quantidade: "1.0000", valor_unitario: "", valor_desconto: "0" }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "itens",
  })

  async function onSubmit(values: FormValues) {
    try {
      const doc = await emitMutation.mutateAsync(values)
      setEmitted(doc)
      toast.success("NFS-e enviada para processamento.")
    } catch {
      toast.error("Erro ao emitir NFS-e. Verifique os dados e tente novamente.")
    }
  }

  if (emitted) {
    return (
      <div className="p-6 max-w-xl space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-success-950/40 border border-success-700/30 p-5">
          <CheckCircle2 className="h-6 w-6 text-success-400 shrink-0" />
          <div>
            <p className="font-semibold text-success-300">NFS-e em processamento</p>
            <p className="text-xs text-success-500 mt-0.5">
              O documento foi enviado para a Prefeitura de Manaus.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2 text-sm">
          {emitted.ref && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Referência</span>
              <span className="font-mono text-foreground/80 text-xs">{emitted.ref}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="text-warning-400 text-xs">Aguardando autorização</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.back()} className="text-foreground/60">
            Voltar
          </Button>
          <Button
            onClick={() => setEmitted(null)}
            variant="outline"
            className="border-border text-foreground/70"
          >
            Emitir outra
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Emissão Manual de NFS-e</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nota fiscal de serviço ad-hoc sem OS vinculada — requer ADMIN
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit, () => toast.error("Preencha todos os campos obrigatórios."))} className="space-y-6">
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
            O destinatário precisa ter CPF/CNPJ e endereço com município IBGE cadastrado.
          </p>
        </div>

        {/* Dados da nota */}
        <div className="rounded-xl bg-muted/30 border border-border p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dados da Nota
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-foreground/60">
                Data de Emissão <span className="text-error-400">*</span>
              </Label>
              <Input
                type="date"
                className="mt-1"
                {...form.register("data_emissao")}
              />
              {form.formState.errors.data_emissao && (
                <p className="mt-0.5 text-xs text-error-400">
                  {form.formState.errors.data_emissao.message}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-foreground/60">Código LC 116</Label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
                {...form.register("codigo_servico_lc116")}
              >
                <option value="14.12">14.12 — Funilaria, lanternagem, manutenção veicular</option>
                <option value="14.01">14.01 — Lubrificação, revisão, conserto geral</option>
                <option value="14.05">14.05 — Restauração, acabamento</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-foreground/60">
              Discriminação dos Serviços <span className="text-error-400">*</span>
            </Label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Descreva detalhadamente os serviços prestados..."
              maxLength={2000}
              {...form.register("discriminacao")}
            />
            {form.formState.errors.discriminacao && (
              <p className="mt-0.5 text-xs text-error-400">
                {form.formState.errors.discriminacao.message}
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs text-foreground/60">
              Justificativa de Emissão Manual <span className="text-error-400">*</span>
            </Label>
            <Input
              className="mt-1"
              placeholder="Ex: Emissão manual para cliente PJ sem OS"
              {...form.register("manual_reason")}
            />
            {form.formState.errors.manual_reason && (
              <p className="mt-0.5 text-xs text-error-400">
                {form.formState.errors.manual_reason.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="iss_retido"
              className="rounded"
              {...form.register("iss_retido")}
            />
            <Label htmlFor="iss_retido" className="text-xs text-foreground/60 cursor-pointer">
              ISS retido na fonte
            </Label>
          </div>
        </div>

        {/* Itens */}
        <div className="rounded-xl bg-muted/30 border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Itens
            </h2>
            <button
              type="button"
              onClick={() => append({ descricao: "", quantidade: "1.0000", valor_unitario: "", valor_desconto: "0" })}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar item
            </button>
          </div>

          {form.formState.errors.itens?.message && (
            <p className="text-xs text-error-400">{form.formState.errors.itens.message}</p>
          )}

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                {/* Descrição */}
                <div className="col-span-6">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground mb-1 block">Descrição</Label>
                  )}
                  <Input
                    placeholder="Ex: Serviço de pintura automotiva"
                    className="text-xs"
                    {...form.register(`itens.${index}.descricao`)}
                  />
                  {form.formState.errors.itens?.[index]?.descricao && (
                    <p className="mt-0.5 text-xs text-error-400">
                      {form.formState.errors.itens[index]?.descricao?.message}
                    </p>
                  )}
                </div>

                {/* Quantidade */}
                <div className="col-span-2">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground mb-1 block">Qtd</Label>
                  )}
                  <Input
                    placeholder="1.0000"
                    className="text-xs"
                    {...form.register(`itens.${index}.quantidade`)}
                  />
                </div>

                {/* Valor unitário */}
                <div className="col-span-3">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground mb-1 block">Preço unit. (R$)</Label>
                  )}
                  <Input
                    placeholder="0.00"
                    className="text-xs"
                    {...form.register(`itens.${index}.valor_unitario`)}
                  />
                  {form.formState.errors.itens?.[index]?.valor_unitario && (
                    <p className="mt-0.5 text-xs text-error-400">
                      {form.formState.errors.itens[index]?.valor_unitario?.message}
                    </p>
                  )}
                </div>

                {/* Remove */}
                <div className={cn("col-span-1 flex", index === 0 && "mt-5")}>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    className="p-1.5 rounded text-muted-foreground hover:text-error-400 disabled:opacity-20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            className="text-foreground/60"
          >
            Cancelar
          </Button>
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
                <FileText className="h-4 w-4 mr-1.5" />
                Emitir NFS-e Manual
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default withRoleGuard(EmitirNfseManualPageInner, "ADMIN", "/dashboard")
