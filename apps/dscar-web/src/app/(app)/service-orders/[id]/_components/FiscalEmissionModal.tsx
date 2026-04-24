"use client"

/**
 * FiscalEmissionModal — dispara emissão de NFS-e a partir de uma OS
 * Ciclo 06C
 *
 * Uso:
 *   <FiscalEmissionModal
 *     serviceOrderId={order.id}
 *     orderNumber={order.number}
 *     onClose={() => setShowModal(false)}
 *     onSuccess={() => { setShowModal(false); qc.invalidateQueries(...) }}
 *   />
 */

import { useState } from "react"
import { CheckCircle2, FileText, Loader2, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEmitNfse } from "@/hooks/useFiscal"
import type { FiscalDocument } from "@paddock/types"

interface FiscalEmissionModalProps {
  serviceOrderId: string
  orderNumber: number | string
  onClose: () => void
  onSuccess: (doc: FiscalDocument) => void
}

export function FiscalEmissionModal({
  serviceOrderId,
  orderNumber,
  onClose,
  onSuccess,
}: FiscalEmissionModalProps) {
  const emitMutation = useEmitNfse()
  const [emitted, setEmitted] = useState<FiscalDocument | null>(null)

  function handleEmit() {
    emitMutation.mutate(serviceOrderId, {
      onSuccess: (doc) => {
        setEmitted(doc)
        onSuccess(doc)
      },
    })
  }

  const errorMessage = (() => {
    if (!emitMutation.error) return null
    const err = emitMutation.error as { status?: number; message?: string }
    if (err?.status === 409) return "Já existe uma NFS-e autorizada para esta OS."
    if (err?.status === 400) return "OS inválida para emissão de NFS-e. Verifique se é cliente particular."
    return "Erro ao emitir NFS-e. Tente novamente."
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-primary-600 shrink-0" />
            <div>
              <p className="font-semibold text-white text-sm">Emitir NFS-e</p>
              <p className="text-xs text-white/50">OS #{orderNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {!emitted ? (
            <>
              <p className="text-sm text-white/70">
                Será emitida uma Nota Fiscal de Serviços Eletrônica (NFS-e) para esta OS junto à
                Prefeitura de Manaus via Focus NF-e.
              </p>

              <div className="rounded-lg bg-white/[0.04] border border-white/10 p-3 space-y-1.5 text-xs text-white/60">
                <p>• O documento será processado de forma assíncrona.</p>
                <p>• O status aparecerá atualizado em alguns segundos.</p>
                <p>• A NFS-e ficará disponível na aba Fiscal após autorização.</p>
              </div>

              {errorMessage && (
                <div className="flex items-start gap-2 rounded-lg bg-red-950/50 border border-red-700/40 px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-300">{errorMessage}</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">NFS-e enviada para processamento</p>
              </div>
              <div className="rounded-lg bg-white/[0.04] border border-white/10 p-3 space-y-1.5 text-xs text-white/60">
                {emitted.ref && (
                  <p>
                    <span className="text-white/40">Ref:</span>{" "}
                    <span className="font-mono text-white/80">{emitted.ref}</span>
                  </p>
                )}
                <p>
                  <span className="text-white/40">Status:</span>{" "}
                  <span className="text-amber-400">Aguardando autorização da prefeitura...</span>
                </p>
              </div>
              <p className="text-xs text-white/40">
                Você pode fechar esta janela. O status será atualizado automaticamente.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 pb-5">
          <Button variant="ghost" onClick={onClose} className="text-white/60">
            {emitted ? "Fechar" : "Cancelar"}
          </Button>
          {!emitted && (
            <Button
              onClick={handleEmit}
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
                  Emitir NFS-e
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
