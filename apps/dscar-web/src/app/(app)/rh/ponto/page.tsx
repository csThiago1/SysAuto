"use client";

/**
 * Relógio de Ponto — Registro de entrada/saída para o colaborador autenticado.
 * Botão único contextual: determina a próxima batida válida.
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import type { TimeClockEntryType } from "@paddock/types";
import { CLOCK_ENTRY_LABELS } from "@paddock/types";
import { useMyEmployee, useDailySummary, useRegisterClock } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui";

// Próxima batida válida dado o último tipo registrado
const NEXT_VALID: Record<string | "none", TimeClockEntryType | null> = {
  none: "clock_in",
  clock_in: "break_start",
  break_start: "break_end",
  break_end: "break_start", // pode iniciar outro intervalo ou sair
  clock_out: "clock_in",
};

// Cor do botão por tipo de batida
const BUTTON_COLORS: Record<TimeClockEntryType, string> = {
  clock_in: "bg-success-600 hover:bg-success-700",
  break_start: "bg-warning-500 hover:bg-warning-600",
  break_end: "bg-blue-600 hover:bg-blue-700",
  clock_out: "bg-red-600 hover:bg-red-700",
};

function LiveClock(): React.ReactElement {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-center">
      <p className="text-5xl font-bold font-plate text-foreground tabular-nums">
        {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {time.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

export default function PontoPage(): React.ReactElement {
  const today = new Date().toISOString().split("T")[0];
  const { data: myEmployee, isLoading: loadingEmployee, error: employeeError } = useMyEmployee();
  const { data: summary, isLoading: loadingSummary } = useDailySummary(today);
  const register = useRegisterClock();

  // Determinar próxima batida válida
  const lastEntry = summary?.entries.at(-1);
  const lastType = lastEntry?.type ?? "none";

  // Após clock_out: next is clock_in. Após break_start: show both break_end and clock_out options
  const nextType = NEXT_VALID[lastType] ?? "clock_in";

  const handleRegister = (entryType: TimeClockEntryType): void => {
    if (!myEmployee) return;
    register.mutate({
      employee: myEmployee.id,
      entry_type: entryType,
      source: "app",
    });
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ponto</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Registro de ponto do colaborador
            </p>
          </div>
          <Link
            href={"/rh/ponto/espelho" as Route}
            className="text-xs text-primary hover:underline"
          >
            Espelho (gestor) →
          </Link>
        </div>

        {/* Clock */}
        <div className="rounded-md bg-muted/50 shadow-card p-8 space-y-6">
          <LiveClock />

          {/* Employee info */}
          {loadingEmployee ? (
            <div className="flex justify-center">
              <Skeleton className="h-5 w-48" />
            </div>
          ) : employeeError ? (
            <p className="text-center text-sm text-error-400">
              Seu usuário não possui perfil de colaborador. Peça ao administrador
              para criar.
            </p>
          ) : myEmployee ? (
            <p className="text-center text-sm text-foreground/60">
              {myEmployee.user.name} · {myEmployee.position_display}
            </p>
          ) : null}

          {/* Clock button(s) */}
          {!employeeError && (
            <div className="flex flex-col items-center gap-3">
              {lastType === "break_start" ? (
                // After break_start: two options
                <div className="flex gap-3">
                  <button
                    onClick={() => handleRegister("break_end")}
                    disabled={register.isPending || !myEmployee}
                    className="rounded-md bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-semibold text-foreground transition-colors disabled:opacity-50"
                  >
                    {CLOCK_ENTRY_LABELS["break_end"]}
                  </button>
                  <button
                    onClick={() => handleRegister("clock_out")}
                    disabled={register.isPending || !myEmployee}
                    className="rounded-md bg-red-600 hover:bg-red-700 px-6 py-3 text-sm font-semibold text-foreground transition-colors disabled:opacity-50"
                  >
                    {CLOCK_ENTRY_LABELS["clock_out"]}
                  </button>
                </div>
              ) : lastType !== "clock_out" ? (
                <button
                  onClick={() => handleRegister(nextType)}
                  disabled={register.isPending || !myEmployee}
                  className={`rounded-md ${BUTTON_COLORS[nextType]} px-8 py-3 text-base font-semibold text-foreground transition-colors disabled:opacity-50`}
                >
                  {register.isPending ? "Registrando..." : CLOCK_ENTRY_LABELS[nextType]}
                </button>
              ) : (
                <p className="text-sm text-muted-foreground font-medium">
                  Expediente encerrado. Até amanhã!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Today's entries */}
        <div className="rounded-md bg-muted/50 shadow-card overflow-hidden">
          <div className="px-card-padding py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Registros de hoje
            </h3>
          </div>
          {loadingSummary ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !summary || summary.entries.length === 0 ? (
            <div className="px-card-padding py-6 text-center text-sm text-muted-foreground">
              Nenhum registro hoje.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {summary.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-card-padding py-2.5"
                >
                  <span className="text-sm text-foreground/70">
                    {CLOCK_ENTRY_LABELS[entry.type]}
                  </span>
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {new Date(entry.timestamp).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between px-card-padding py-2.5 bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">
                  Total trabalhado
                </span>
                <span className="text-sm font-bold text-foreground">
                  {Math.floor(summary.total_minutes / 60)}h{" "}
                  {summary.total_minutes % 60}min
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
