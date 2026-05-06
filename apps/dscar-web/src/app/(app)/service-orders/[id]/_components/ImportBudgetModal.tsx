"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Upload, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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
        <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-surface-900 shadow-2xl">
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
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Importar Orçamento</h2>

        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fonte de Importação
          </label>
          <div className="flex gap-2">
            {SOURCES.map((s) => (
              <button key={s.id} type="button" onClick={() => setSource(s.id)}
                className={cn("flex-1 rounded-lg border p-3 text-center transition",
                  source === s.id ? "border-info-500 bg-info-500/10" : "border-border bg-muted/50 hover:bg-muted",
                )}>
                <div className={cn("text-sm font-semibold", source === s.id ? "text-info-500" : "text-foreground/60")}>{s.label}</div>
                <div className="text-[11px] text-muted-foreground">{s.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {source === "cilia" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="casualty">Nº Sinistro</Label>
              <Input id="casualty" value={casualtyNumber} onChange={(e) => setCasualtyNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget">Nº Orçamento</Label>
              <Input id="budget" value={budgetNumber} onChange={(e) => setBudgetNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="version">
                Versão <span className="text-muted-foreground">(vazio = mais recente)</span>
              </Label>
              <Input id="version" value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} placeholder="Ex: 3" />
            </div>
          </div>
        )}

        {source !== "cilia" && (
          <div className="space-y-1.5">
            <Label>Arquivo {source === "soma" ? "XML" : "HTML"}</Label>
            <Input type="file" accept={source === "soma" ? ".xml" : ".html,.htm"}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={importMutation.isPending} onClick={() => importMutation.mutate()}>
            {importMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Consultando...</>
              : source === "cilia" ? <><Search className="h-4 w-4" /> Consultar</>
              : <><Upload className="h-4 w-4" /> Importar</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
