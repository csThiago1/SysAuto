"use client";

/**
 * EmployeeHeader — Avatar, nome, cargo e ações rápidas da ficha do colaborador.
 */

import React from "react";
import { User, Calendar, Hash } from "lucide-react";
import type { Employee } from "@paddock/types";
import { EmployeeStatusBadge } from "../../_components/EmployeeStatusBadge";

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

  return (
    <div className="rounded-md bg-white/5 shadow-card p-card-padding">
      <div className="flex items-start justify-between gap-4">
        {/* Avatar + info */}
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 shrink-0">
            <User className="h-7 w-7 text-primary-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white">
                {employee.user.name}
              </h2>
              <EmployeeStatusBadge status={employee.status} />
            </div>
            <p className="text-sm text-white/50 mt-0.5">
              {employee.position_display} · {employee.department_display}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-white/50">
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
            </div>
          </div>
        </div>

        {/* Actions */}
        {employee.status !== "terminated" && onTerminate && (
          <button
            onClick={onTerminate}
            className="shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            Desligar
          </button>
        )}
      </div>
    </div>
  );
}
