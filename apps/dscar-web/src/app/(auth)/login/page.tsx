"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DsCarLogo } from "@/components/DsCarLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!result?.ok) {
      setError("E-mail ou senha incorretos.");
      setIsLoading(false);
    } else {
      router.push("/os");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary-950">
      {/* Gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(192,18,18,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <DsCarLogo variant="light" size={28} />
        </div>

        <Card className="w-full max-w-md border-secondary-800 bg-secondary-900 shadow-dropdown">
          <CardHeader>
            <CardTitle className="text-foreground">DS Car ERP</CardTitle>
            <p className="text-sm text-secondary-400">Acesse sua conta</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-secondary-300">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="dev@dscar.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary-950 border-secondary-700 text-foreground placeholder:text-secondary-600 focus-visible:ring-ring"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-secondary-300">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-secondary-950 border-secondary-700 text-foreground placeholder:text-secondary-600 focus-visible:ring-ring"
                  autoComplete="current-password"
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
                Entrar
              </Button>
            </form>

            <div className="mt-4 text-center">
              <a
                href="/esqueci-senha"
                className="text-sm text-primary hover:underline"
              >
                Esqueceu sua senha?
              </a>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-secondary-600">
          Paddock Solutions · Sistema Interno DS Car
        </p>
      </div>
    </div>
  );
}
