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
import { FileText, Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEmitManualNfse } from "@/hooks/useFiscal"
import { withRoleGuard } from "@/lib/withRoleGuard"
import type { FiscalDocument } from "@paddock/types"
import { cn } from "@/lib/utils"

// ─── Schema (espelha ManualNfseInputSerializer) ───────────────────────────────

const itemSchema = z.object({
  descricao: z.string().min(5, "Mínimo 5 caracteres"),
  quantidade: z.string().regex(/^\d+(\.\d{1,4})?$/, "Quantidade inválida"),
  valor_unitario: z.string().regex(/^\d+(\.\d{1,2})?$/, "Preço inválido"),
  valor_desconto: z.string().default("0"),
})

const schema = z.object({
  /** PK inteiro do Person (busca via autocomplete ou input manual) */
  destinatario_id: z.coerce.number().int().positive("ID do destinatário inválido"),
  data_emissao: z.string().min(10, "Data obrigatória"),
  manual_reason: z.string().min(5, "Justificativa mínima de 5 caracteres"),
  discriminacao: z.string().min(5, "Mínimo 5 caracteres").max(2000, "Máximo 2000 caracteres"),
  codigo_servico_lc116: z.string().default("14.01"),
  iss_retido: z.boolean().default(false),
  itens: z.array(itemSchema).min(1, "Ao menos um item obrigatório"),
})

type FormValues = z.infer<typeof schema>

// ─── Page ─────────────────────────────────────────────────────────────────────

function EmitirNfseManualPageInner() {
  const router = useRouter()
  const emitMutation = useEmitManualNfse()
  const [emitted, setEmitted] = useState<FiscalDocument | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      destinatario_id: undefined,
      data_emissao: new Date().toISOString().split("T")[0],
      manual_reason: "",
      discriminacao: "",
      codigo_servico_lc116: "14.01",
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
        <div className="flex items-center gap-3 rounded-xl bg-green-950/40 border border-green-700/30 p-5">
          <CheckCircle2 className="h-6 w-6 text-green-400 shrink-0" />
          <div>
            <p className="font-semibold text-green-300">NFS-e em processamento</p>
            <p className="text-xs text-green-500 mt-0.5">
              O documento foi enviado para a Prefeitura de Manaus.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-2 text-sm">
          {emitted.ref && (
            <div className="flex justify-between">
              <span className="text-white/50">Referência</span>
              <span className="font-mono text-white/80 text-xs">{emitted.ref}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-white/50">Status</span>
            <span className="text-amber-400 text-xs">Aguardando autorização</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.back()} className="text-white/60">
            Voltar
          </Button>
          <Button
            onClick={() => setEmitted(null)}
            variant="outline"
            className="border-white/15 text-white/70"
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
        <FileText className="h-6 w-6 text-primary-600" />
        <div>
          <h1 className="text-xl font-bold text-white">Emissão Manual de NFS-e</h1>
          <p className="text-xs text-white/50 mt-0.5">
            Nota fiscal de serviço ad-hoc sem OS vinculada — requer ADMIN
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Destinatário */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Destinatário
          </h2>

          <div>
            <Label className="text-xs text-white/60">
              ID do Destinatário (Person — número inteiro)
              <span className="text-red-400 ml-0.5">*</span>
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
              O Person deve ter CPF/CNPJ e endereço com município IBGE cadastrado.
            </p>
          </div>
        </div>

        {/* Dados da nota */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Dados da Nota
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-white/60">
                Data de Emissão <span className="text-red-400">*</span>
              </Label>
              <Input
                type="date"
                className="mt-1"
                {...form.register("data_emissao")}
              />
              {form.formState.errors.data_emissao && (
                <p className="mt-0.5 text-xs text-red-400">
                  {form.formState.errors.data_emissao.message}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-white/60">Código LC 116</Label>
              <select
                className="mt-1 w-full rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white"
                {...form.register("codigo_servico_lc116")}
              >
                <option value="14.01">14.01 — Manutenção/conservação de veículos</option>
                <option value="14.05">14.05 — Vidraçaria / Restauração de vidros</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-white/60">
              Discriminação dos Serviços <span className="text-red-400">*</span>
            </Label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-primary-600"
              placeholder="Descreva detalhadamente os serviços prestados..."
              maxLength={2000}
              {...form.register("discriminacao")}
            />
            {form.formState.errors.discriminacao && (
              <p className="mt-0.5 text-xs text-red-400">
                {form.formState.errors.discriminacao.message}
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs text-white/60">
              Justificativa de Emissão Manual <span className="text-red-400">*</span>
            </Label>
            <Input
              className="mt-1"
              placeholder="Ex: Emissão manual para cliente PJ sem OS"
              {...form.register("manual_reason")}
            />
            {form.formState.errors.manual_reason && (
              <p className="mt-0.5 text-xs text-red-400">
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
            <Label htmlFor="iss_retido" className="text-xs text-white/60 cursor-pointer">
              ISS retido na fonte
            </Label>
          </div>
        </div>

        {/* Itens */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Itens
            </h2>
            <button
              type="button"
              onClick={() => append({ descricao: "", quantidade: "1.0000", valor_unitario: "", valor_desconto: "0" })}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-500"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar item
            </button>
          </div>

          {form.formState.errors.itens?.message && (
            <p className="text-xs text-red-400">{form.formState.errors.itens.message}</p>
          )}

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                {/* Descrição */}
                <div className="col-span-6">
                  {index === 0 && (
                    <Label className="text-xs text-white/40 mb-1 block">Descrição</Label>
                  )}
                  <Input
                    placeholder="Ex: Serviço de pintura automotiva"
                    className="text-xs"
                    {...form.register(`itens.${index}.descricao`)}
                  />
                  {form.formState.errors.itens?.[index]?.descricao && (
                    <p className="mt-0.5 text-xs text-red-400">
                      {form.formState.errors.itens[index]?.descricao?.message}
                    </p>
                  )}
                </div>

                {/* Quantidade */}
                <div className="col-span-2">
                  {index === 0 && (
                    <Label className="text-xs text-white/40 mb-1 block">Qtd</Label>
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
                    <Label className="text-xs text-white/40 mb-1 block">Preço unit. (R$)</Label>
                  )}
                  <Input
                    placeholder="0.00"
                    className="text-xs"
                    {...form.register(`itens.${index}.valor_unitario`)}
                  />
                  {form.formState.errors.itens?.[index]?.valor_unitario && (
                    <p className="mt-0.5 text-xs text-red-400">
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
                    className="p-1.5 rounded text-white/30 hover:text-red-400 disabled:opacity-20 transition-colors"
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
            className="text-white/60"
          >
            Cancelar
          </Button>
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
