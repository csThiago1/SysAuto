"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ reset }: ErrorProps): React.ReactElement {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-foreground">
        Algo deu errado
      </h1>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
        Ocorreu um erro inesperado. Tente novamente ou volte à página anterior.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
