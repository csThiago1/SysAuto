"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Upload, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch, ApiError } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { ImportBudgetResponse, ServiceOrder } from "@paddock/types"
import { ImportDiffView } from "./ImportDiffView"
import { ImportReconcileModal, type ReconcilePayload } from "./ImportReconcileModal"
import { parseCiliaSubject } from "../_utils/parse-cilia-subject"

const SOURCES = [
  { id: "cilia", label: "Cilia", sub: "Webservice" },
  { id: "xml_ifx", label: "Soma / XML", sub: "Upload XML" },
  { id: "hdi", label: "HDI", sub: "Upload HTML" },
] as const

type SourceId = (typeof SOURCES)[number]["id"]

// Seguradoras suportadas pelo formato XML IFX (Soma)
const XML_INSURERS = [
  { code: "porto", label: "Porto Seguro" },
  { code: "azul", label: "Azul Seguros" },
  { code: "itau", label: "Itaú Seguros" },
  { code: "soma", label: "Soma (genérico)" },
] as const

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
  const [xmlInsurer, setXmlInsurer] = useState<typeof XML_INSURERS[number]["code"]>("porto")
  const [diffResult, setDiffResult] = useState<ImportBudgetResponse | null>(null)
  const [reconcilePayload, setReconcilePayload] = useState<ReconcilePayload | null>(null)
  const [pastedSubject, setPastedSubject] = useState("")
  const [pasteFeedback, setPasteFeedback] = useState<
    { ok: true; conclusion?: string } | { ok: false } | null
  >(null)

  /** Preenche sinistro/orçamento/versão a partir do e-mail do Cilia colado. */
  const handlePasteSubject = (value: string) => {
    setPastedSubject(value)
    if (!value.trim()) {
      setPasteFeedback(null)
      return
    }
    const parsed = parseCiliaSubject(value)
    if (!parsed) {
      setPasteFeedback({ ok: false })
      return
    }
    setCasualtyNumber(parsed.casualtyNumber)
    setBudgetNumber(parsed.budgetNumber)
    setVersionNumber(parsed.versionNumber ?? "")
    setPasteFeedback({ ok: true, conclusion: parsed.conclusion })
  }

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
      // Upload de arquivo (XML IFX/Soma ou HDI HTML)
      const formData = new FormData()
      if (source === "xml_ifx") {
        // Backend espera source=xml_porto/xml_azul/xml_itau/soma + insurer_code
        formData.append("source", xmlInsurer === "soma" ? "soma" : `xml_${xmlInsurer}`)
        formData.append("insurer_code", xmlInsurer)
      } else {
        // HDI
        formData.append("source", "hdi")
      }
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
    onError: (error) => {
      // 409 com action=reconcile → abre modal de conciliação
      if (error instanceof ApiError && error.status === 409 && error.body?.action === "reconcile") {
        setReconcilePayload(error.body as unknown as ReconcilePayload)
        return
      }
      const message = error instanceof ApiError
        ? error.message
        : "Erro ao importar orçamento. Tente novamente."
      toast.error(message)
    },
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

  return (
    <>
      {reconcilePayload && (
        <ImportReconcileModal
          orderId={order.id}
          payload={reconcilePayload}
          open={!!reconcilePayload}
          onClose={() => { setReconcilePayload(null); onClose() }}
          onApplied={() => { setReconcilePayload(null); onClose() }}
        />
      )}
      <Dialog open={!!diffResult && diffResult.action === "diff"} onOpenChange={(v) => { if (!v) setDiffResult(null) }}>
        <DialogContent className="max-w-4xl max-h-[85dvh] overflow-y-auto p-0">
          {diffResult?.action === "diff" && (
            <ImportDiffView
              diffResult={diffResult}
              onApply={() => diffResult.new_version && applyMutation.mutate(diffResult.new_version.id)}
              onCancel={() => { setDiffResult(null); onClose() }}
              isApplying={applyMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open && !diffResult && !reconcilePayload} onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Orçamento</DialogTitle>
          </DialogHeader>

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
                <Label htmlFor="cilia-subject">
                  Colar e-mail do Cilia{" "}
                  <span className="text-muted-foreground">(preenche os campos abaixo)</span>
                </Label>
                <Input
                  id="cilia-subject"
                  value={pastedSubject}
                  onChange={(e) => handlePasteSubject(e.target.value)}
                  placeholder="Bradesco Seguros - Sin. 104202608041229 - Orç. 1941275.2 - Conclusão: Autorizado"
                />
                {pasteFeedback?.ok === true && (
                  <p className="text-xs text-success-600">
                    Reconhecido
                    {pasteFeedback.conclusion ? ` · ${pasteFeedback.conclusion}` : ""} — confira
                    abaixo e clique em Consultar.
                  </p>
                )}
                {pasteFeedback?.ok === false && (
                  <p className="text-xs text-muted-foreground">
                    Não reconheci sinistro e orçamento nesse texto — preencha à mão.
                  </p>
                )}
              </div>

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

          {source === "xml_ifx" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="xml-insurer">Seguradora</Label>
                <select
                  id="xml-insurer"
                  value={xmlInsurer}
                  onChange={(e) => setXmlInsurer(e.target.value as typeof xmlInsurer)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                >
                  {XML_INSURERS.map((ins) => (
                    <option key={ins.code} value={ins.code}>{ins.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xml-file">Arquivo XML</Label>
                <Input id="xml-file" type="file" accept=".xml"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          )}

          {source === "hdi" && (
            <div className="space-y-1.5">
              <Label htmlFor="hdi-file">
                Arquivo HTML <span className="text-muted-foreground">(exportar do portal HDI)</span>
              </Label>
              <Input id="hdi-file" type="file" accept=".html,.htm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={importMutation.isPending} onClick={() => importMutation.mutate()}>
              {importMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Consultando...</>
                : source === "cilia" ? <><Search className="h-4 w-4" /> Consultar</>
                : <><Upload className="h-4 w-4" /> Importar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
