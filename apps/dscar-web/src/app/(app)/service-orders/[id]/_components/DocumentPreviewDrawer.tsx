"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { ServiceOrder, PDFDocumentType, DocumentPreviewData } from "@paddock/types"
import { DOCUMENT_TYPE_CONFIG } from "@paddock/types"
import { useDocumentPreview, useGenerateDocument } from "@/hooks/useDocuments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface Props {
  order: ServiceOrder
  documentType: PDFDocumentType
  onClose: () => void
}

export function DocumentPreviewDrawer({ order, documentType, onClose }: Props) {
  const config = DOCUMENT_TYPE_CONFIG[documentType]
  const { data: previewData, isLoading } = useDocumentPreview(order.id, documentType)
  const generateMutation = useGenerateDocument(order.id)

  const [formData, setFormData] = useState<DocumentPreviewData | null>(null)

  useEffect(() => {
    if (previewData) {
      setFormData(structuredClone(previewData))
    }
  }, [previewData])

  function updateField(path: string, value: string) {
    if (!formData) return
    const clone = structuredClone(formData)
    const keys = path.split(".")
    let obj: Record<string, unknown> = clone as unknown as Record<string, unknown>
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]] as Record<string, unknown>
    }
    obj[keys[keys.length - 1]] = value
    setFormData(clone as DocumentPreviewData)
  }

  function updateServiceField(index: number, field: string, value: string | number) {
    if (!formData) return
    const clone = structuredClone(formData)
    ;(clone.services[index] as unknown as Record<string, unknown>)[field] = value
    setFormData(clone)
  }

  function updateListItem(listKey: "warranty_coverage" | "warranty_exclusions", index: number, value: string) {
    if (!formData) return
    const clone = structuredClone(formData)
    const list = clone[listKey]
    if (list) list[index] = value
    setFormData(clone)
  }

  function addListItem(listKey: "warranty_coverage" | "warranty_exclusions") {
    if (!formData) return
    const clone = structuredClone(formData)
    const list = clone[listKey] ?? []
    list.push("")
    clone[listKey] = list
    setFormData(clone)
  }

  function removeListItem(listKey: "warranty_coverage" | "warranty_exclusions", index: number) {
    if (!formData) return
    const clone = structuredClone(formData)
    clone[listKey]?.splice(index, 1)
    setFormData(clone)
  }

  async function openDocument(docId: string) {
    const res = await fetch(`/api/proxy/documents/${docId}/download/`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank")
    // Libera memória após um tempo
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function handleGenerate() {
    if (!formData) return
    try {
      const result = await generateMutation.mutateAsync({
        document_type: documentType,
        data: formData,
      })
      await openDocument(result.id)
      toast.success(`${config.label} v${result.version} gerado com sucesso!`)
      onClose()
    } catch {
      toast.error("Erro ao gerar documento. Tente novamente.")
    }
  }

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-500" />
            {config.label} — OS #{order.number}
          </SheetTitle>
        </SheetHeader>

        {isLoading || !formData ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Cliente (não aparece na OS Report — só em garantia/quitação/recibo) */}
            {formData.customer && (
            <section>
              <h3 className="label-mono text-white/50 mb-3">Dados do Cliente</h3>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-white/40">Nome</Label>
                  <Input
                    value={formData.customer.name}
                    onChange={(e) => updateField("customer.name", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-white/40">CPF</Label>
                    <Input
                      value={formData.customer.cpf}
                      onChange={(e) => updateField("customer.cpf", e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-white/40">Telefone</Label>
                    <Input
                      value={formData.customer.phone}
                      onChange={(e) => updateField("customer.phone", e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-white/40">Endereço</Label>
                  <Input
                    value={formData.customer.address}
                    onChange={(e) => updateField("customer.address", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>
            </section>
            )}

            {/* Veículo */}
            <section>
              <h3 className="label-mono text-white/50 mb-3">Dados do Veículo</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-white/40">Placa</Label>
                  <Input
                    value={formData.vehicle.plate}
                    onChange={(e) => updateField("vehicle.plate", e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40">Modelo</Label>
                  <Input
                    value={`${formData.vehicle.make} ${formData.vehicle.model}`}
                    onChange={(e) => updateField("vehicle.model", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40">Ano</Label>
                  <Input
                    value={formData.vehicle.year}
                    onChange={(e) => updateField("vehicle.year", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40">Cor</Label>
                  <Input
                    value={formData.vehicle.color}
                    onChange={(e) => updateField("vehicle.color", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>
            </section>

            {/* Serviços */}
            <section>
              <h3 className="label-mono text-white/50 mb-3">Serviços</h3>
              <div className="space-y-2">
                {formData.services.map((svc, i) => (
                  <div key={i} className="bg-white/[0.03] rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/30 w-6">{String(i + 1).padStart(2, "0")}</span>
                      <Input
                        value={svc.description}
                        onChange={(e) => updateServiceField(i, "description", e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <Input
                        value={svc.total}
                        onChange={(e) => updateServiceField(i, "total", e.target.value)}
                        className="h-7 text-xs w-24 text-right font-mono"
                        placeholder="R$"
                      />
                    </div>
                    {documentType === "warranty" && svc.warranty_months !== undefined && (
                      <div className="flex items-center gap-2 ml-8">
                        <Label className="text-xs text-white/40 shrink-0">Garantia:</Label>
                        <select
                          value={svc.warranty_months}
                          onChange={(e) => updateServiceField(i, "warranty_months", parseInt(e.target.value))}
                          className="h-7 text-xs bg-white/5 border border-white/10 rounded px-2 text-white"
                        >
                          <option value={0}>Sem garantia</option>
                          <option value={3}>3 meses</option>
                          <option value={6}>6 meses</option>
                          <option value={12}>12 meses</option>
                        </select>
                        {svc.warranty_until && (
                          <span className="text-xs text-white/40">até {svc.warranty_until}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Cobertura (só garantia) */}
            {documentType === "warranty" && formData.warranty_coverage && (
              <section>
                <h3 className="label-mono text-white/50 mb-3">Cobertura da Garantia</h3>
                <div className="space-y-2">
                  {formData.warranty_coverage.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-success-400 mt-1.5 text-xs shrink-0">✔</span>
                      <Input
                        value={item}
                        onChange={(e) => updateListItem("warranty_coverage", i, e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeListItem("warranty_coverage", i)}
                        className="text-white/30 hover:text-error-400 mt-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addListItem("warranty_coverage")}
                    className="text-xs text-white/40"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
              </section>
            )}

            {documentType === "warranty" && formData.warranty_exclusions && (
              <section>
                <h3 className="label-mono text-white/50 mb-3">Exclusões da Garantia</h3>
                <div className="space-y-2">
                  {formData.warranty_exclusions.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-error-400 mt-1.5 text-xs shrink-0">✘</span>
                      <Input
                        value={item}
                        onChange={(e) => updateListItem("warranty_exclusions", i, e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeListItem("warranty_exclusions", i)}
                        className="text-white/30 hover:text-error-400 mt-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addListItem("warranty_exclusions")}
                    className="text-xs text-white/40"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
              </section>
            )}

            {/* Observações */}
            <section>
              <h3 className="label-mono text-white/50 mb-3">Observações</h3>
              <textarea
                value={formData.observations}
                onChange={(e) => updateField("observations", e.target.value)}
                rows={3}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Observações adicionais (opcional)"
              />
            </section>

            {/* Footer */}
            <div className="flex gap-2 justify-end border-t border-white/10 pt-4">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="bg-primary-600 hover:bg-primary-700 text-white"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Gerando...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-1.5" /> Gerar PDF</>
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
