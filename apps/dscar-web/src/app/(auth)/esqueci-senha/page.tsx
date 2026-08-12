"use client";

import React, { useState } from "react";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { DsCarLogo } from "@/components/DsCarLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/proxy/auth/forgot-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        // Even on error, show success message to avoid email enumeration
        setSent(true);
        return;
      }

      setSent(true);
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

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
            <CardTitle className="text-foreground">Recuperar senha</CardTitle>
            <p className="text-sm text-secondary-400">
              {sent
                ? "Verifique sua caixa de entrada"
                : "Informe seu e-mail para receber o link de recuperacao"}
            </p>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <MailCheck className="h-10 w-10 text-success-400" />
                  <p className="text-sm text-secondary-300 text-center">
                    Se o e-mail informado estiver cadastrado, um link de recuperacao foi enviado.
                    Verifique sua caixa de entrada e spam.
                  </p>
                </div>

                <a href="/login">
                  <Button variant="outline" className="w-full border-secondary-700 bg-transparent text-secondary-200 hover:bg-secondary-800 hover:text-foreground">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar ao login
                  </Button>
                </a>
              </div>
            ) : (
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-secondary-300">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-secondary-950 border-secondary-700 text-foreground placeholder:text-secondary-600 focus-visible:ring-ring"
                    autoComplete="email"
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-error-600">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Enviar link de recuperacao
                </Button>

                <div className="text-center">
                  <a
                    href="/login"
                    className="text-sm text-primary hover:underline"
                  >
                    Voltar ao login
                  </a>
                </div>
              </form>
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
