"use client";

import React from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}): React.ReactElement {
  React.useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertTriangle className="h-10 w-10 text-error-500 mb-3" />
      <p className="text-lg font-semibold text-neutral-900">Algo deu errado</p>
      <p className="text-sm text-neutral-500 mt-1 max-w-sm">
        {error.message !== "network_error" && error.message !== "unauthorized"
          ? error.message
          : "Ocorreu um erro inesperado."}
      </p>
      <Button className="mt-6" onClick={resetErrorBoundary}>
        Tentar novamente
      </Button>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export function ErrorBoundary({ children }: ErrorBoundaryProps): React.ReactElement {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}
