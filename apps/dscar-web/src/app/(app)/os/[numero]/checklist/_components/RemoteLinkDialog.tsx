"use client"

import { useEffect, type ReactElement } from "react"
import { Copy, MessageCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

import { useSendRemoteLink } from "../_hooks/useEntryChecklist"

/** Link de aceite remoto (cliente ausente). Montado ao abrir: cada abertura gera um link novo
 *  e invalida o anterior (o backend guarda só o hash do último token). */
export function RemoteLinkDialog({ osId, onClose }: { osId: string; onClose: () => void }): ReactElement {
  const send = useSendRemoteLink(osId)
  const { mutate } = send

  useEffect(() => mutate(), [mutate])

  async function copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copiado.")
    } catch {
      toast.error("Não deu para copiar. Selecione o link e copie.")
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link para o cliente confirmar</DialogTitle>
          <DialogDescription>Vale por 7 dias. O cliente abre, vê o PDF e confirma a entrada do veículo.</DialogDescription>
        </DialogHeader>
        {send.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-error-400">Não deu para gerar o link.</p>
            <Button variant="outline" size="sm" onClick={() => mutate()}>
              Tentar de novo
            </Button>
          </div>
        ) : !send.data ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={send.data.url} aria-label="Link de confirmação" onFocus={(e) => e.target.select()} />
              <Button variant="outline" onClick={() => void copy(send.data.url)}>
                <Copy className="mr-1.5 h-4 w-4" />
                Copiar
              </Button>
            </div>
            <Button asChild className="w-full">
              <a href={send.data.whatsapp_url} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Abrir no WhatsApp
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
