"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button"

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ reset }: ErrorProps): React.ReactElement {
  const router = useRouter();

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center px-4">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="page-title mt-4">
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
