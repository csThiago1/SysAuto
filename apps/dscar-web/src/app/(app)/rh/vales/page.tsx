"use client";

/**
 * Gestão de Vales — Fluxo solicitado → aprovado → pago.
 * Tabs por status. Approve (MANAGER+), Pay (ADMIN+).
 */

import React from "react";
import type { AllowanceStatus, AllowanceType } from "@paddock/types";
import { ALLOWANCE_TYPE_LABELS, ALLOWANCE_STATUS_CONFIG } from "@paddock/types";
import {
  useAllowances,
  useApproveAllowance,
  usePayAllowance,
  useEmployees,
  useCreateEmployee,
} from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

const STATUS_TABS: { id: AllowanceStatus; label: string }[] = [
  { id: "requested", label: "Pendentes" },
  { id: "approved", label: "Aprovados" },
  { id: "paid", label: "Pagos" },
];

const STATUS_CLASSES: Record<string, string> = {
  success: "bg-success-500/10 text-success-400",
  warning: "bg-warning-500/10 text-warning-400",
  destructive: "bg-error-500/10 text-error-400",
  default: "bg-white/5 text-white/60",
};

export default function ValesPage(): React.ReactElement {
  const [activeStatus, setActiveStatus] =
    React.useState<AllowanceStatus>("requested");

  const { data, isLoading } = useAllowances({ status: activeStatus });
  const approve = useApproveAllowance();
  const pay = usePayAllowance();
  const allowances = data?.results ?? [];

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            Vales e Benefícios
          </h1>
          <p className="text-sm text-white/50 mt-0.5">
            Gestão de solicitações, aprovações e pagamentos
          </p>
        </div>

        {/* Status tabs */}
        <div className="border-b border-white/10">
          <nav className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveStatus(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeStatus === tab.id
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : allowances.length === 0 ? (
          <div className="rounded-md bg-white/5 shadow-card p-10 text-center text-sm text-white/50">
            Nenhum vale{" "}
            {activeStatus === "requested"
              ? "pendente"
              : activeStatus === "approved"
              ? "aprovado"
              : "pago"}
            .
          </div>
        ) : (
          <div className="space-y-3">
            {allowances.map((allowance) => {
              const statusCfg = ALLOWANCE_STATUS_CONFIG[allowance.status];
              return (
                <div
                  key={allowance.id}
                  className="rounded-md bg-white/5 shadow-card p-card-padding"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">
                          {ALLOWANCE_TYPE_LABELS[allowance.allowance_type]}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            STATUS_CLASSES[statusCfg.variant]
                          )}
                        >
                          {statusCfg.label}
                        </span>
                        {allowance.is_recurring && (
                          <span className="text-xs text-white/40">
                            recorrente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">
                        Ref:{" "}
                        {new Date(allowance.reference_month).toLocaleDateString(
                          "pt-BR",
                          { month: "long", year: "numeric" }
                        )}
                        {allowance.notes && ` · ${allowance.notes}`}
                      </p>
                      {allowance.approved_by_name && (
                        <p className="text-xs text-white/40 mt-0.5">
                          Aprovado por {allowance.approved_by_name}
                          {allowance.approved_at &&
                            ` em ${new Date(allowance.approved_at).toLocaleDateString("pt-BR")}`}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-bold text-white">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(parseFloat(allowance.amount))}
                      </span>

                      {allowance.status === "requested" && (
                        <button
                          onClick={() => approve.mutate(allowance.id)}
                          disabled={approve.isPending}
                          className="rounded-md border border-success-500/20 bg-success-500/10 px-3 py-1.5 text-xs font-medium text-success-400 hover:bg-success-500/20 disabled:opacity-50"
                        >
                          Aprovar
                        </button>
                      )}
                      {allowance.status === "approved" && (
                        <button
                          onClick={() => pay.mutate({ id: allowance.id })}
                          disabled={pay.isPending}
                          className="rounded-md border border-primary-500/20 bg-primary-500/10 px-3 py-1.5 text-xs font-medium text-primary-400 hover:bg-primary-500/20 disabled:opacity-50"
                        >
                          Marcar pago
                        </button>
                      )}
                      {allowance.status === "paid" && allowance.paid_at && (
                        <span className="text-xs text-white/40">
                          Pago em{" "}
                          {new Date(allowance.paid_at).toLocaleDateString(
                            "pt-BR"
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
