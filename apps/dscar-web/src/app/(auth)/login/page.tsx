"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { DsCarLogo } from "@/components/DsCarLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function LoginPage(): React.ReactElement {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleKeycloak(): Promise<void> {
    setLoading(true);
    await signIn("keycloak", { callbackUrl: "/os" });
  }

  async function handleDevLogin(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("dev-credentials", {
      email,
      password,
      callbackUrl: "/os",
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou senha inválidos.");
      setLoading(false);
    } else if (result?.url) {
      window.location.href = result.url;
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

        <div className="rounded-lg border border-secondary-800 bg-secondary-900 p-8 shadow-dropdown">
          <h2 className="text-xl font-semibold text-white mb-2">Bem-vindo</h2>
          <p className="text-sm text-secondary-400 mb-6">
            Acesse o sistema de gestão DS Car
          </p>

          {/* Keycloak SSO */}
          <Button
            className="w-full"
            onClick={() => void handleKeycloak()}
            disabled={loading}
          >
            Entrar com conta corporativa
          </Button>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1 bg-secondary-700" />
            <span className="text-xs text-secondary-500">ou acesso dev</span>
            <Separator className="flex-1 bg-secondary-700" />
          </div>

          {/* Dev credentials form */}
          <form onSubmit={(e) => void handleDevLogin(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-secondary-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="dev@dscar.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary-950 border-secondary-700 text-white placeholder:text-secondary-600 focus-visible:ring-primary-500"
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
                placeholder="paddock123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary-950 border-secondary-700 text-white placeholder:text-secondary-600 focus-visible:ring-primary-500"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-error-400 mt-1">{error}</p>
            )}

            <Button
              type="submit"
              variant="outline"
              className="w-full border-secondary-700 bg-transparent text-secondary-200 hover:bg-secondary-800 hover:text-white"
              disabled={loading}
            >
              Entrar (Dev)
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-secondary-600">
          Paddock Solutions · Sistema Interno DS Car
        </p>
      </div>
    </div>
  );
}
