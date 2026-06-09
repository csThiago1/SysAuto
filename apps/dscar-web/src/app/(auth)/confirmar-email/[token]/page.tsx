"use client";

import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { DsCarLogo } from "@/components/DsCarLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VerificationStatus = "loading" | "success" | "error";

export default function ConfirmEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): React.ReactElement {
  const { token } = React.use(params);

  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function verify(): Promise<void> {
      try {
        const res = await fetch("/api/proxy/auth/verify-email/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (cancelled) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const detail = (data as Record<string, unknown>).detail;
          setErrorMessage(
            typeof detail === "string"
              ? detail
              : "Link expirado ou invalido."
          );
          setStatus("error");
          return;
        }

        setStatus("success");
      } catch {
        if (!cancelled) {
          setErrorMessage("Erro de conexao. Tente novamente mais tarde.");
          setStatus("error");
        }
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(192,18,18,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="flex justify-center mb-8">
          <DsCarLogo variant="light" size={28} />
        </div>

        <Card className="w-full max-w-md border-secondary-800 bg-secondary-900 shadow-dropdown">
          <CardHeader>
            <CardTitle className="text-foreground">Confirmar e-mail</CardTitle>
          </CardHeader>
          <CardContent>
            {status === "loading" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-secondary-300">Verificando seu e-mail...</p>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle className="h-10 w-10 text-success-500" />
                  <p className="text-sm text-secondary-300 text-center">
                    Seu e-mail foi confirmado com sucesso! Agora voce pode acessar o sistema.
                  </p>
                </div>

                <a href="/login">
                  <Button className="w-full">
                    Ir para o login
                  </Button>
                </a>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <XCircle className="h-10 w-10 text-error-500" />
                  <p className="text-sm text-secondary-300 text-center">
                    {errorMessage}
                  </p>
                </div>

                <a href="/login">
                  <Button variant="outline" className="w-full border-secondary-700 bg-transparent text-secondary-200 hover:bg-secondary-800 hover:text-foreground">
                    Voltar ao login
                  </Button>
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-secondary-600">
          Paddock Solutions · Sistema Interno DS Car
        </p>
      </div>
    </div>
  );
}
