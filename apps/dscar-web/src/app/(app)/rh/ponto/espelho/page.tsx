"use client";

/**
 * Espelho de Ponto — Visão consolidada do gestor por colaborador/mês.
 * Permissão: MANAGER+
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";
import type { HRDepartment } from "@paddock/types";
import { DEPARTMENT_LABELS } from "@paddock/types";
import { useEmployees, useDailySummary } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui";

export default function EspelhoPontoPage(): React.ReactElement {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [department, setDepartment] = React.useState<HRDepartment | "">("");

  const filters: Record<string, string> = { status: "active" };
  if (department) filters.department = department;

  const { data: employeesData, isLoading } = useEmployees(filters);
  const employees = employeesData?.results ?? [];

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Link
            href={"/rh/ponto" as Route}
            className="flex items-center gap-1 hover:text-primary-600"
          >
            <ChevronLeft className="h-4 w-4" />
            Ponto
          </Link>
          <span>/</span>
          <span className="text-white">Espelho de ponto</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">
            Espelho de Ponto
          </h1>
          <p className="text-sm text-white/50 mt-0.5">
            Visão consolidada do dia para gestores
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-white/10 px-3 py-2 text-sm"
          />
          <select
            value={department}
            onChange={(e) =>
              setDepartment(e.target.value as HRDepartment | "")
            }
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            <option value="">Todos os setores</option>
            {(Object.entries(DEPARTMENT_LABELS) as [HRDepartment, string][]).map(
              ([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              )
            )}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-md bg-white/5 shadow-card overflow-hidden">
          <div className="px-card-padding py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {employees.length} colaboradores ativos
            </h3>
            <span className="text-xs text-white/40">
              {new Date(selectedDate + "T12:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/50">
              Nenhum colaborador encontrado.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {employees.map((emp) => (
                <EspelhoRow
                  key={emp.id}
                  employeeId={emp.id}
                  name={emp.user.name}
                  positionDisplay={emp.position_display}
                  date={selectedDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

interface EspelhoRowProps {
  employeeId: string;
  name: string;
  positionDisplay: string;
  date: string;
}

function EspelhoRow({
  employeeId,
  name,
  positionDisplay,
  date,
}: EspelhoRowProps): React.ReactElement {
  const { data: summary, isLoading } = useDailySummary(date);

  const clockIn = summary?.entries.find((e) => e.type === "clock_in");
  const clockOut = summary?.entries.find((e) => e.type === "clock_out");
  const totalMin = summary?.total_minutes ?? 0;
  const hasEntries = (summary?.entries.length ?? 0) > 0;

  return (
    <div className="flex items-center gap-4 px-card-padding py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{name}</p>
        <p className="text-xs text-white/50">{positionDisplay}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-4 w-48" />
      ) : !hasEntries ? (
        <span className="text-xs text-error-400 font-medium">Sem registros</span>
      ) : (
        <div className="flex items-center gap-4 text-xs text-white/60">
          <span>
            Entrada:{" "}
            <span className="font-medium text-white">
              {clockIn
                ? new Date(clockIn.timestamp).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          </span>
          <span>
            Saída:{" "}
            <span className="font-medium text-white">
              {clockOut
                ? new Date(clockOut.timestamp).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          </span>
          <span
            className={`font-semibold ${
              totalMin >= 480
                ? "text-success-400"
                : totalMin > 0
                ? "text-warning-400"
                : "text-white/40"
            }`}
          >
            {Math.floor(totalMin / 60)}h{totalMin % 60}min
          </span>
        </div>
      )}
    </div>
  );
}
