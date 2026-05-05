"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Upload, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import type { ImportBudgetResponse, ServiceOrder } from "@paddock/types"
import { ImportDiffView } from "./ImportDiffView"

const SOURCES = [
  { id: "cilia", label: "Cilia", sub: "Webservice" },
  { id: "soma", label: "Soma", sub: "Upload XML" },
  { id: "audatex", label: "Audatex", sub: "Upload HTML" },
] as const

type SourceId = (typeof SOURCES)[number]["id"]

interface Props {
  order: ServiceOrder
  defaultSource?: SourceId
  open: boolean
  onClose: () => void
}

export function ImportBudgetModal({ order, defaultSource = "cilia", open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [source, setSource] = useState<SourceId>(defaultSource)
  const [casualtyNumber, setCasualtyNumber] = useState(order.casualty_number ?? "")
  const [budgetNumber, setBudgetNumber] = useState("")
  const [versionNumber, setVersionNumber] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [diffResult, setDiffResult] = useState<ImportBudgetResponse | null>(null)

  const importMutation = useMutation({
    mutationFn: async () => {
      if (source === "cilia") {
        return apiFetch<ImportBudgetResponse>(
          `/api/proxy/service-orders/${order.id}/import-budget/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "cilia",
              casualty_number: casualtyNumber,
              budget_number: budgetNumber,
              version_number: versionNumber || undefined,
            }),
          },
        )
      }
      const formData = new FormData()
      formData.append("source", source)
      if (file) formData.append("file", file)
      return apiFetch<ImportBudgetResponse>(
        `/api/proxy/service-orders/${order.id}/import-budget/`,
        { method: "POST", body: formData },
      )
    },
    onSuccess: (data) => {
      if (data.action === "diff") {
        setDiffResult(data)
      } else {
        toast.success("Orçamento importado com sucesso!")
        queryClient.invalidateQueries({ queryKey: ["service-order", order.id] })
        onClose()
      }
    },
    onError: () => toast.error("Erro ao importar orçamento. Tente novamente."),
  })

  const applyMutation = useMutation({
    mutationFn: async (versionId: string) =>
      apiFetch(`/api/proxy/service-orders/${order.id}/versions/${versionId}/apply/`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Nova versão aplicada com sucesso!")
      queryClient.invalidateQueries({ queryKey: ["service-order", order.id] })
      onClose()
    },
    onError: () => toast.error("Erro ao aplicar versão. Tente novamente."),
  })

  if (!open) return null

  if (diffResult?.action === "diff") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-white/10 bg-surface-900 shadow-2xl">
          <ImportDiffView
            diffResult={diffResult}
            onApply={() => diffResult.new_version && applyMutation.mutate(diffResult.new_version.id)}
            onCancel={() => { setDiffResult(null); onClose() }}
            isApplying={applyMutation.isPending}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-surface-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-white">Importar Orçamento</h2>

        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/50">
            Fonte de Importação
          </label>
          <div className="flex gap-2">
            {SOURCES.map((s) => (
              <button key={s.id} type="button" onClick={() => setSource(s.id)}
                className={cn("flex-1 rounded-lg border p-3 text-center transition",
                  source === s.id ? "border-info-500 bg-info-500/10" : "border-white/10 bg-white/5 hover:bg-white/10",
                )}>
                <div className={cn("text-sm font-semibold", source === s.id ? "text-info-500" : "text-white/60")}>{s.label}</div>
                <div className="text-[11px] text-white/40">{s.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {source === "cilia" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-white/50">Nº Sinistro</label>
              <input type="text" value={casualtyNumber} onChange={(e) => setCasualtyNumber(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">Nº Orçamento</label>
              <input type="text" value={budgetNumber} onChange={(e) => setBudgetNumber(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Versão <span className="text-white/30">(vazio = mais recente)</span>
              </label>
              <input type="text" value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)}
                placeholder="Ex: 3" className="w-full rounded-md border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white" />
            </div>
          </div>
        )}

        {source !== "cilia" && (
          <div>
            <label className="mb-1 block text-xs text-white/50">Arquivo {source === "soma" ? "XML" : "HTML"}</label>
            <input type="file" accept={source === "soma" ? ".xml" : ".html,.htm"}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-white" />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5">Cancelar</button>
          <button type="button" disabled={importMutation.isPending} onClick={() => importMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-md bg-info-600 px-4 py-2 text-sm font-semibold text-white hover:bg-info-700 disabled:opacity-50">
            {importMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Consultando...</>
              : source === "cilia" ? <><Search className="h-4 w-4" /> Consultar</>
              : <><Upload className="h-4 w-4" /> Importar</>}
          </button>
        </div>
      </div>
    </div>
  )
}
