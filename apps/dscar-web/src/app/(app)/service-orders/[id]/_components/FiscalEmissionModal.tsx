"use client"

/**
 * FiscalEmissionModal — emissão de NFS-e ou NF-e a partir de uma OS
 * Ciclo 06C/07A
 *
 * Uso:
 *   <FiscalEmissionModal
 *     serviceOrderId={order.id}
 *     orderNumber={order.number}
 *     hasParts={partsCount > 0}
 *     onClose={() => setShowModal(false)}
 *     onSuccess={() => { setShowModal(false); qc.invalidateQueries(...) }}
 *   />
 *
 * - Se hasParts=true: exibe seleção de tipo (NFS-e / NF-e)
 * - NF-e requer seleção de forma de pagamento
 */

import { useState } from "react"
import {
  CheckCircle2,
  FileText,
  Loader2,
  AlertTriangle,
  Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"
import { useEmitNfse, useEmitNfe } from "@/hooks/useFiscal"
import type { FiscalDocument } from "@paddock/types"
import { cn } from "@/lib/utils"

type DocType = "nfse" | "nfe"

const FORMA_PAGAMENTO_OPTIONS = [
  { value: "01", label: "Dinheiro" },
  { value: "03", label: "Cartão de Crédito" },
  { value: "04", label: "Cartão de Débito" },
  { value: "99", label: "Outros" },
]

interface FiscalEmissionModalProps {
  serviceOrderId: string
  orderNumber: number | string
  /** true quando a OS tem peças ativas — exibe opção NF-e */
  hasParts?: boolean
  onClose: () => void
  onSuccess: (doc: FiscalDocument) => void
}

export function FiscalEmissionModal({
  serviceOrderId,
  orderNumber,
  hasParts = false,
  onClose,
  onSuccess,
}: FiscalEmissionModalProps) {
  const emitNfseMutation = useEmitNfse()
  const emitNfeMutation = useEmitNfe()

  const [docType, setDocType] = useState<DocType>("nfse")
  const [formaPagamento, setFormaPagamento] = useState("01")
  const [emitted, setEmitted] = useState<FiscalDocument | null>(null)

  const mutation = docType === "nfe" ? emitNfeMutation : emitNfseMutation

  function handleEmit() {
    if (docType === "nfe") {
      emitNfeMutation.mutate(
        { service_order_id: serviceOrderId, forma_pagamento: formaPagamento as "01" | "03" | "04" | "99" },
        {
          onSuccess: (doc) => {
            setEmitted(doc)
            onSuccess(doc)
          },
        }
      )
    } else {
      emitNfseMutation.mutate(serviceOrderId, {
        onSuccess: (doc) => {
          setEmitted(doc)
          onSuccess(doc)
        },
      })
    }
  }

  const errorMessage = (() => {
    if (!mutation.error) return null
    const err = mutation.error as { status?: number; message?: string }
    if (err?.status === 409) {
      return docType === "nfe"
        ? "Já existe uma NF-e autorizada para esta OS."
        : "Já existe uma NFS-e autorizada para esta OS."
    }
    if (err?.status === 400) {
      return docType === "nfe"
        ? "Não foi possível emitir NF-e. Verifique se as peças têm NCM preenchido e se o cliente tem endereço primário."
        : "OS inválida para emissão de NFS-e. Verifique se é cliente particular."
    }
    return `Erro ao emitir ${docType === "nfe" ? "NF-e" : "NFS-e"}. Tente novamente.`
  })()

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-foreground text-sm">Emitir Nota Fiscal</p>
              <p className="text-xs text-muted-foreground">OS #{orderNumber}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {!emitted ? (
            <>
              {/* Seleção de tipo — só exibe quando a OS tem peças */}
              {hasParts && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Tipo de Nota
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDocType("nfse")}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-lg border text-xs font-medium transition-colors",
                        docType === "nfse"
                          ? "border-primary bg-primary/10 text-primary/80"
                          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground/70"
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      <span>NFS-e</span>
                      <span className="text-muted-foreground font-normal">Serviços</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocType("nfe")}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-lg border text-xs font-medium transition-colors",
                        docType === "nfe"
                          ? "border-primary bg-primary/10 text-primary/80"
                          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground/70"
                      )}
                    >
                      <Package className="h-4 w-4" />
                      <span>NF-e</span>
                      <span className="text-muted-foreground font-normal">Peças/Mercadorias</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Conteúdo por tipo */}
              {docType === "nfse" ? (
                <>
                  <p className="text-sm text-foreground/70">
                    Será emitida uma Nota Fiscal de Serviços Eletrônica (NFS-e) para esta OS junto à
                    Prefeitura de Manaus via Focus NF-e.
                  </p>
                  <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1.5 text-xs text-foreground/60">
                    <p>• O documento será processado de forma assíncrona.</p>
                    <p>• O status aparecerá atualizado em alguns segundos.</p>
                    <p>• A NFS-e ficará disponível na aba Fiscal após autorização.</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground/70">
                    Será emitida uma NF-e de produto para as peças desta OS via Focus NF-e.
                    Todas as peças devem ter NCM de 8 dígitos preenchido no catálogo.
                  </p>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Forma de Pagamento</p>
                    <div className="flex flex-wrap gap-2">
                      {FORMA_PAGAMENTO_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setFormaPagamento(o.value)}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs border transition-colors",
                            formaPagamento === o.value
                              ? "border-primary bg-primary/10 text-primary/80"
                              : "border-border bg-muted/30 text-muted-foreground hover:text-foreground/70"
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg bg-amber-950/30 border border-amber-700/20 p-3 space-y-1 text-xs text-amber-300/70">
                    <p className="font-medium text-amber-300">Requisitos NF-e</p>
                    <p>• Todas as peças devem ter NCM de 8 dígitos preenchido</p>
                    <p>• O cliente deve ter CPF/CNPJ e endereço primário cadastrado</p>
                    <p>• Válido para qualquer estado destino (CFOP automático)</p>
                  </div>
                </>
              )}

              {errorMessage && (
                <div className="flex items-start gap-2 rounded-lg bg-red-950/50 border border-red-700/40 px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-error-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-error-400">{errorMessage}</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-success-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">
                  {docType === "nfe" ? "NF-e" : "NFS-e"} enviada para processamento
                </p>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1.5 text-xs text-foreground/60">
                {emitted.ref && (
                  <p>
                    <span className="text-muted-foreground">Ref:</span>{" "}
                    <span className="font-mono text-foreground/80">{emitted.ref}</span>
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="text-amber-400">Aguardando autorização SEFAZ...</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Você pode fechar esta janela. O status será atualizado automaticamente.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 pb-5">
          <Button variant="ghost" onClick={onClose} className="text-foreground/60">
            {emitted ? "Fechar" : "Cancelar"}
          </Button>
          {!emitted && (
            <Button
              onClick={handleEmit}
              disabled={mutation.isPending}
              className="bg-primary hover:bg-primary/90 text-foreground"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Emitindo...
                </>
              ) : (
                <>
                  {docType === "nfe" ? (
                    <Package className="h-4 w-4 mr-1.5" />
                  ) : (
                    <FileText className="h-4 w-4 mr-1.5" />
                  )}
                  Emitir {docType === "nfe" ? "NF-e" : "NFS-e"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
