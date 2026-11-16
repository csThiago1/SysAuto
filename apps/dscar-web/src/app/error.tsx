"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button"

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
        <Button
          onClick={() => router.back()}
          variant="outline"
        >
          Voltar
        </Button>
        <Button
          onClick={reset}
        >
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
