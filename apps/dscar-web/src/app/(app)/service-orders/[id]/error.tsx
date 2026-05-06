"use client"

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
        <p className="text-4xl font-bold text-gray-300">Erro</p>
        <p className="mt-2 text-lg font-medium text-foreground/70">Não foi possível carregar a OS</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-muted/30"
        >
          Voltar
        </button>
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
