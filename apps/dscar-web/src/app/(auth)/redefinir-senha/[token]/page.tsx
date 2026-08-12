"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { DsCarLogo } from "@/components/DsCarLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): React.ReactElement {
  const { token } = React.use(params);
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/proxy/auth/reset-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail = (data as Record<string, unknown>).detail;
        setError(
          typeof detail === "string"
            ? detail
            : "Link expirado ou invalido. Solicite um novo link de recuperacao."
        );
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => router.push("/login"), 2000);
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
            <CardTitle className="text-foreground">Redefinir senha</CardTitle>
            <p className="text-sm text-secondary-400">
              {success ? "Senha atualizada" : "Digite sua nova senha"}
            </p>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle className="h-10 w-10 text-success-400" />
                  <p className="text-sm text-secondary-300 text-center">
                    Sua senha foi redefinida com sucesso. Redirecionando para o login...
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-secondary-300">
                    Nova senha
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary-950 border-secondary-700 text-foreground placeholder:text-secondary-600 focus-visible:ring-ring"
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-secondary-300">
                    Confirmar nova senha
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-secondary-950 border-secondary-700 text-foreground placeholder:text-secondary-600 focus-visible:ring-ring"
                    autoComplete="new-password"
                    required
                    minLength={8}
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
                  Redefinir senha
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
