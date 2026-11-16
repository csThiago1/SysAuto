"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ServiceOrderError({ error, reset }: ErrorProps) {
  const router = useRouter()

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center gap-4">
      <div className="text-center">
        <p className="text-4xl font-bold text-muted-foreground">Erro</p>
        <p className="mt-2 text-lg font-medium text-foreground/70">Não foi possível carregar a OS</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          Voltar
        </Button>
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    </div>
  )
}
