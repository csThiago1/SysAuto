"use client"

import { useEffect, useState } from "react"
import { Loader2, Printer, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface PdfShareActionsProps {
  docId: string
  filename: string
  /** Texto do botão no computador (abre o PDF em outra aba). */
  openLabel?: string
  size?: "sm" | "default"
}

/** Celular ou app instalado: lá um link do próprio domínio abre o PDF dentro do app, sem voltar. */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  )
}

/**
 * Abre ou compartilha um PDF já gerado.
 *
 * No iPhone com o app instalado (tela cheia), abrir o PDF prendia o usuário: sem voltar,
 * compartilhar ou fechar. No celular o botão chama o menu de compartilhar do aparelho
 * (Imprimir, Salvar em Arquivos, WhatsApp). O arquivo é baixado antes porque o iOS só
 * abre o menu se o toque chamar o compartilhamento direto, sem esperar a rede.
 */
export function PdfShareActions({
  docId,
  filename,
  openLabel = "Abrir PDF",
  size = "default",
}: PdfShareActionsProps) {
  const url = `/api/proxy/documents/${docId}/download/`
  const [touch] = useState(isTouchDevice)
  const [file, setFile] = useState<File | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!touch || typeof navigator.canShare !== "function") {
      setFailed(true)
      return
    }
    let alive = true
    fetch(url)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        const pdf = new File([blob], filename, { type: "application/pdf" })
        if (!alive) return
        if (navigator.canShare({ files: [pdf] })) setFile(pdf)
        else setFailed(true)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [touch, url, filename])

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: filename })
    } catch (err) {
      // Fechar o menu sem escolher nada não é erro
      if (err instanceof DOMException && err.name === "AbortError") return
      toast.error("Não foi possível compartilhar o PDF.")
    }
  }

  if (touch && !failed) {
    return (
      <Button size={size} onClick={share} disabled={!file}>
        {file ? (
          <><Share2 className="h-4 w-4 mr-1.5" /> Compartilhar / Imprimir</>
        ) : (
          <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Preparando PDF...</>
        )}
      </Button>
    )
  }

  return (
    <Button asChild size={size}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Printer className="h-4 w-4 mr-1.5" /> {openLabel}
      </a>
    </Button>
  )
}
