"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { useIsDesktop } from "@/hooks/useIsDesktop";

/** Toasts no tema do app; no celular no topo (embaixo ficava atrás da barra de abas). */
function ToasterDaMarca(): React.ReactElement {
  const { theme } = useTheme();
  const desktop = useIsDesktop();
  return (
    <Toaster
      theme={theme}
      position={desktop ? "bottom-right" : "top-center"}
      toastOptions={{
        classNames: {
          toast: "!rounded-md !border !border-border !bg-card !text-foreground !shadow-card",
          description: "!text-muted-foreground",
          success: "!border-l-4 !border-l-success-500",
          error: "!border-l-4 !border-l-error-500",
          warning: "!border-l-4 !border-l-warning-500",
          info: "!border-l-4 !border-l-info-500",
        },
      }}
    />
  );
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps): React.ReactElement {
  const queryClient = getQueryClient();

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {children}
          <ToasterDaMarca />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
