"use client"

import { useRouter } from "next/navigation"
import { FileText, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FiscalDocument } from "@paddock/types"

export function SuccessCard({
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

      <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2 text-sm">
        {doc.ref && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Referência</span>
            <span className="font-mono text-foreground/80 text-xs">{doc.ref}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className={doc.status === "authorized" ? "text-success-400 text-xs" : "text-warning-400 text-xs"}>
            {doc.status === "authorized" ? "Autorizada" : "Aguardando autorização"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipo</span>
          <span className="text-foreground/80 text-xs uppercase">{doc.document_type}</span>
        </div>
        {doc.key && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Chave</span>
            <span className="font-mono text-foreground/60 text-[10px]">{doc.key}</span>
          </div>
        )}
      </div>

      {/* PDF / XML links — passa pelo proxy Next.js que adiciona auth */}
      {(doc.pdf_url || doc.xml_url) && (
        <div className="flex gap-2">
          {doc.pdf_url && (
            <a
              href={`/api/proxy${doc.pdf_url.replace("/api/v1/", "/")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 border border-border text-xs text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Ver DANFE (PDF)
            </a>
          )}
          {doc.xml_url && (
            <a
              href={`/api/proxy${doc.xml_url.replace("/api/v1/", "/")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 border border-border text-xs text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              XML
            </a>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => router.back()} className="text-foreground/60">
          Voltar
        </Button>
        <Button
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={() => router.push("/fiscal/documentos" as any)}
          className="bg-primary hover:bg-primary/90 text-foreground"
        >
          Ver documentos emitidos
        </Button>
        <Button
          onClick={onReset}
          variant="outline"
          className="border-border text-foreground/70"
        >
          Emitir outra
        </Button>
      </div>
    </div>
  )
}
