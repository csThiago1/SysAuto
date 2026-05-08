"use client";

/**
 * EmployeeHeader — Avatar, nome, cargo e ações rápidas da ficha do colaborador.
 */

import React from "react";
import { User, Calendar, Hash, Palmtree, AlertTriangle } from "lucide-react";
import type { Employee } from "@paddock/types";
import { EmployeeStatusBadge } from "../../_components/EmployeeStatusBadge";
import { useVacationBalance } from "@/hooks";

interface EmployeeHeaderProps {
  employee: Employee;
  onTerminate?: () => void;
}

export function EmployeeHeader({
  employee,
  onTerminate,
}: EmployeeHeaderProps): React.ReactElement {
  const tenureYears = Math.floor(employee.tenure_days / 365);
  const tenureMonths = Math.floor((employee.tenure_days % 365) / 30);
  const { data: vacBalance } = useVacationBalance(employee.id);

  // Calcular saldo total e se tem férias vencidas
  const totalRemaining = vacBalance?.periods?.reduce((acc, p) => acc + p.days_remaining, 0) ?? 0;
  const hasOverdue = vacBalance?.periods?.some((p) => p.is_overdue) ?? false;

  return (
    <div className="rounded-md bg-muted/50 shadow-card p-card-padding">
      <div className="flex items-start justify-between gap-4">
        {/* Avatar + info */}
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 shrink-0">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">
                {employee.user.name}
              </h2>
              <EmployeeStatusBadge status={employee.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {employee.position_display} · {employee.department_display}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                Matrícula {employee.registration_number}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Admissão{" "}
                {new Date(employee.hire_date).toLocaleDateString("pt-BR")}
              </span>
              <span>
                Tempo de casa:{" "}
                {tenureYears > 0 ? `${tenureYears}a ` : ""}
                {tenureMonths > 0 ? `${tenureMonths}m` : ""}
                {tenureYears === 0 && tenureMonths === 0
                  ? `${employee.tenure_days}d`
                  : ""}
              </span>
              <span>{employee.contract_type_display}</span>
              {employee.contract_type === "pj" && (
                <span className="inline-flex items-center rounded-full bg-info-500/10 px-2 py-0.5 text-xs font-medium text-info-400">
                  PJ
                </span>
              )}
              {totalRemaining > 0 && (
                <span className={`flex items-center gap-1 ${hasOverdue ? "text-error-400" : "text-muted-foreground"}`}>
                  {hasOverdue ? <AlertTriangle className="h-3 w-3" /> : <Palmtree className="h-3 w-3" />}
                  {totalRemaining}d férias
                  {hasOverdue && " (vencidas!)"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {employee.status !== "terminated" && onTerminate && (
          <button
            onClick={onTerminate}
            className="shrink-0 rounded-md border border-error-500/20 bg-error-500/10 px-3 py-1.5 text-xs font-medium text-error-400 hover:bg-error-500/20 transition-colors"
          >
            Desligar
          </button>
        )}
      </div>
    </div>
  );
}
