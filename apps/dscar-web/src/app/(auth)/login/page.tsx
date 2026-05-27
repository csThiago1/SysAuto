"use client";

import React, { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ------------------------------------------------------------------ */
/*  Carousel slides                                                    */
/* ------------------------------------------------------------------ */

interface Slide {
  icon: string;
  tag: string;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    icon: "\u{1F3E2}",
    tag: "Nossa Estrutura",
    title: "Infraestrutura completa para o seu ve\u00edculo",
    description:
      "Ambiente moderno e equipado com tecnologia de ponta para garantir os melhores resultados em cada servi\u00e7o.",
  },
  {
    icon: "\u{1F468}\u200D\u{1F527}",
    tag: "Nossa Equipe",
    title: "Profissionais dedicados ao seu ve\u00edculo",
    description:
      "Time de especialistas com anos de experi\u00eancia em funilaria, pintura e est\u00e9tica automotiva.",
  },
  {
    icon: "\u{1F527}",
    tag: "Funilaria & Pintura",
    title: "Excel\u00eancia em cada detalhe",
    description:
      "Processos certificados e materiais premium para restaura\u00e7\u00e3o perfeita do seu ve\u00edculo.",
  },
  {
    icon: "\u2728",
    tag: "Est\u00e9tica Automotiva",
    title: "Seu carro brilhando como novo",
    description:
      "Polimento, cristaliza\u00e7\u00e3o e tratamentos especiais que devolvem o brilho original.",
  },
];

/* ------------------------------------------------------------------ */
/*  Neon line definitions                                              */
/* ------------------------------------------------------------------ */

interface NeonLine {
  orientation: "h" | "v";
  position: string;
  duration: string;
  delay: string;
}

const NEON_LINES: NeonLine[] = [
  // Horizontal lines
  { orientation: "h", position: "8%", duration: "4.2s", delay: "0s" },
  { orientation: "h", position: "18%", duration: "3.5s", delay: "0.8s" },
  { orientation: "h", position: "28%", duration: "5.1s", delay: "0.3s" },
  { orientation: "h", position: "38%", duration: "3.8s", delay: "1.2s" },
  { orientation: "h", position: "48%", duration: "4.6s", delay: "0.5s" },
  { orientation: "h", position: "58%", duration: "3.3s", delay: "1.8s" },
  { orientation: "h", position: "68%", duration: "5.5s", delay: "0.1s" },
  { orientation: "h", position: "76%", duration: "4.0s", delay: "1.5s" },
  { orientation: "h", position: "84%", duration: "3.7s", delay: "0.7s" },
  { orientation: "h", position: "92%", duration: "5.8s", delay: "0.4s" },
  // Vertical lines
  { orientation: "v", position: "12%", duration: "4.8s", delay: "0.2s" },
  { orientation: "v", position: "28%", duration: "3.6s", delay: "1.0s" },
  { orientation: "v", position: "44%", duration: "5.3s", delay: "0.6s" },
  { orientation: "v", position: "60%", duration: "4.1s", delay: "1.4s" },
  { orientation: "v", position: "76%", duration: "3.9s", delay: "0.9s" },
  { orientation: "v", position: "90%", duration: "5.0s", delay: "0.3s" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  // Auto-rotate carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
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
      router.push("/dashboard");
    }
  }

  return (
    <>
      {/* Keyframe animations for neon lines */}
      <style>{`
        @keyframes neon-h {
          0% { transform: translateX(-100%); opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { transform: translateX(100vw); opacity: 0; }
        }
        @keyframes neon-v {
          0% { transform: translateY(-100%); opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes fade-slide {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="relative flex h-screen w-screen overflow-hidden">
        {/* Neon animated background */}
        <div
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          style={{ backgroundColor: "#0a0a0a" }}
        >
          {NEON_LINES.map((line, i) => {
            const isH = line.orientation === "h";
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  ...(isH
                    ? {
                        top: line.position,
                        left: 0,
                        width: "100%",
                        height: "0.5px",
                      }
                    : {
                        left: line.position,
                        top: 0,
                        height: "100%",
                        width: "0.5px",
                      }),
                  background: isH
                    ? "linear-gradient(90deg, #cc4444, #ff4444)"
                    : "linear-gradient(180deg, #cc4444, #ff4444)",
                  boxShadow: isH
                    ? "0 0 6px 1px rgba(204, 68, 68, 0.4), 0 0 12px 2px rgba(255, 68, 68, 0.15)"
                    : "0 0 6px 1px rgba(204, 68, 68, 0.4), 0 0 12px 2px rgba(255, 68, 68, 0.15)",
                  animation: `${isH ? "neon-h" : "neon-v"} ${line.duration} ${line.delay} linear infinite`,
                  opacity: 0,
                }}
              />
            );
          })}
        </div>

        {/* -------------------------------------------------------- */}
        {/*  Left panel — Login form                                  */}
        {/* -------------------------------------------------------- */}
        <div
          className="relative z-10 flex w-full flex-col justify-between md:w-1/2"
          style={{
            background: "rgba(10, 10, 10, 0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            borderRight: "1px solid rgba(234, 14, 3, 0.12)",
          }}
        >
          {/* Top-left radial glow */}
          <div
            className="pointer-events-none absolute left-0 top-0 h-72 w-72"
            style={{
              background:
                "radial-gradient(circle at 0% 0%, rgba(192, 18, 18, 0.10) 0%, transparent 70%)",
            }}
          />

          {/* Form content */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 sm:px-12 lg:px-16">
            <div className="w-full max-w-sm">
              {/* Logo */}
              <div className="mb-6 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-dscar.png"
                  alt="DS Car Centro Automotivo"
                  width={280}
                  height={70}
                  className="h-32 w-auto brightness-0 invert"
                  style={{ maxWidth: "90%" }}
                />
              </div>

              {/* Red gradient divider */}
              <div
                className="mb-8 h-px w-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(192, 18, 18, 0.6) 0%, rgba(192, 18, 18, 0) 100%)",
                }}
              />

              {/* Heading */}
              <h1
                className="mb-1 font-bold text-white"
                style={{ fontSize: "20px" }}
              >
                Bem-vindo de volta
              </h1>
              <p
                className="mb-8 text-secondary-400"
                style={{ fontSize: "13px" }}
              >
                Acesse sua conta para continuar
              </p>

              {/* Form */}
              <form
                onSubmit={(e) => void handleSubmit(e)}
                className="space-y-5"
              >
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
                    className="border-secondary-700/50 bg-secondary-950/80 text-foreground placeholder:text-secondary-600 focus-visible:ring-primary"
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
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-secondary-700/50 bg-secondary-950/80 text-foreground placeholder:text-secondary-600 focus-visible:ring-primary"
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-error-600">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #cc1212, #aa0e0e)",
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
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
            </div>
          </div>

          {/* Left panel footer — Powered by Paddock */}
          <div className="relative z-10 px-8 pb-6 flex items-center justify-center gap-2">
            <span className="text-xs text-secondary-600">Powered by</span>
            <div className="flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-paddock.png" alt="Paddock" width={20} height={20} className="shrink-0 rounded-full" />
              <span className="text-xs font-semibold text-secondary-500 tracking-wide">Paddock Solutions</span>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------- */}
        {/*  Right panel — Carousel                                    */}
        {/* -------------------------------------------------------- */}
        <div
          className="relative z-10 hidden w-1/2 flex-col items-center justify-center md:flex"
          style={{
            background: "rgba(10, 10, 10, 0.35)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        >
          {/* Slide content */}
          <div className="relative flex w-full max-w-md flex-col items-center px-12">
            {SLIDES.map((slide, idx) => (
              <div
                key={idx}
                className="absolute inset-0 flex flex-col items-center justify-center px-12 text-center transition-opacity duration-700"
                style={{
                  opacity: idx === activeSlide ? 1 : 0,
                  pointerEvents: idx === activeSlide ? "auto" : "none",
                  ...(idx === activeSlide
                    ? { animation: "fade-slide 0.7s ease-out" }
                    : {}),
                }}
              >
                <span className="mb-4" style={{ fontSize: "32px" }}>
                  {slide.icon}
                </span>
                <span
                  className="mb-3 font-semibold uppercase tracking-widest text-primary"
                  style={{ fontSize: "11px" }}
                >
                  {slide.tag}
                </span>
                <h2
                  className="mb-3 font-bold leading-tight text-white"
                  style={{ fontSize: "24px" }}
                >
                  {slide.title}
                </h2>
                <p
                  className="leading-relaxed text-secondary-400"
                  style={{ fontSize: "14px" }}
                >
                  {slide.description}
                </p>
              </div>
            ))}
            {/* Spacer so the parent has height for absolute children */}
            <div className="invisible" aria-hidden>
              <span className="mb-4 block" style={{ fontSize: "32px" }}>
                {SLIDES[0].icon}
              </span>
              <span
                className="mb-3 block font-semibold uppercase tracking-widest"
                style={{ fontSize: "11px" }}
              >
                {SLIDES[0].tag}
              </span>
              <h2
                className="mb-3 font-bold leading-tight"
                style={{ fontSize: "24px" }}
              >
                {SLIDES[0].title}
              </h2>
              <p className="leading-relaxed" style={{ fontSize: "14px" }}>
                {SLIDES[0].description}
              </p>
            </div>
          </div>

          {/* Dot indicators */}
          <div className="absolute bottom-12 flex gap-2">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Slide ${idx + 1}`}
                onClick={() => setActiveSlide(idx)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: idx === activeSlide ? "24px" : "8px",
                  height: "8px",
                  backgroundColor:
                    idx === activeSlide
                      ? "rgb(192, 18, 18)"
                      : "rgba(255, 255, 255, 0.2)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Global footer */}
        <div className="absolute bottom-2 left-0 right-0 z-20 text-center md:hidden">
          <p className="text-2xs text-secondary-700">
            Powered by Paddock Solutions
          </p>
        </div>
      </div>
    </>
  );
}
