"use client";

/**
 * TabVales — Vales e benefícios do colaborador.
 * Mostra status do fluxo: solicitado → aprovado → pago.
 */

import React from "react";
import type { Employee } from "@paddock/types";
import { ALLOWANCE_TYPE_LABELS, ALLOWANCE_STATUS_CONFIG } from "@paddock/types";
import { useAllowances } from "@/hooks";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface TabValesProps {
  employee: Employee;
}

const STATUS_CLASSES: Record<string, string> = {
  success: "bg-success-500/10 text-success-400",
  warning: "bg-warning-500/10 text-warning-400",
  destructive: "bg-error-500/10 text-error-400",
  default: "bg-white/5 text-white/60",
};

export function TabVales({ employee }: TabValesProps): React.ReactElement {
  const { data, isLoading } = useAllowances({ employee_pk: employee.id });
  const allowances = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">
          Vales e Benefícios ({allowances.length})
        </h3>
        <p className="text-xs text-white/40">
          Para solicitar ou aprovar vales, acesse{" "}
          <span className="text-primary-600">/rh/vales</span>
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : allowances.length === 0 ? (
        <div className="rounded-md bg-white/5 shadow-card p-8 text-center text-sm text-white/50">
          Nenhum vale registrado.
        </div>
      ) : (
        <div className="rounded-md bg-white/5 shadow-card divide-y divide-white/5">
          {allowances.map((a) => {
            const statusCfg = ALLOWANCE_STATUS_CONFIG[a.status];
            return (
              <div
                key={a.id}
                className="flex items-center justify-between px-card-padding py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">
                      {ALLOWANCE_TYPE_LABELS[a.allowance_type]}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_CLASSES[statusCfg.variant]
                      )}
                    >
                      {statusCfg.label}
                    </span>
                    {a.is_recurring && (
                      <span className="text-xs text-white/40">recorrente</span>
                    )}
                  </div>
                  <p className="text-xs text-white/50">
                    Ref:{" "}
                    {new Date(a.reference_month).toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                    })}
                    {a.notes && ` · ${a.notes}`}
                  </p>
                </div>
                <span className="text-sm font-semibold text-white/70">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(parseFloat(a.amount))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
