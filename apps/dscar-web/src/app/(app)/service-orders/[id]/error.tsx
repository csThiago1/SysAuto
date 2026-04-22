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
        <p className="mt-2 text-lg font-medium text-white/70">Não foi possível carregar a OS</p>
        <p className="mt-1 text-sm text-white/50">{error.message}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.03]"
        >
          Voltar
        </button>
        <button
          onClick={reset}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
