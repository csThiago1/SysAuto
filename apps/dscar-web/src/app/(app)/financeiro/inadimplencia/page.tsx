"use client";

/**
 * Relatorio de Inadimplencia — S6-T4
 * Lista clientes com titulos vencidos e totais em aberto.
 */

import React from "react";
import { AlertTriangle } from "lucide-react";
import { useInadimplencia } from "@/hooks/useAccounting";
import { SummaryCard } from "@/components/financeiro";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@paddock/utils";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InadimplenciaPage(): React.ReactElement {
  const { data, isLoading } = useInadimplencia();

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Relatorio de Inadimplencia
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Clientes com titulos vencidos em aberto
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SummaryCard
            label="Total em Aberto"
            value={formatCurrency(data?.totals.total_remaining)}
            icon={<AlertTriangle className="h-5 w-5 text-warning-400" />}
            iconBg="bg-warning-400/10"
            isLoading={isLoading}
          />
          <SummaryCard
            label="Titulos Vencidos"
            value={String(data?.totals.count ?? 0)}
            icon={<AlertTriangle className="h-5 w-5 text-error-400" />}
            iconBg="bg-error-400/10"
            isLoading={isLoading}
          />
        </div>

        {/* Table */}
        <div className="rounded-md bg-muted/50 shadow-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Clientes Inadimplentes
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : data?.items && data.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Cliente</th>
                    <th className="py-2 pr-4 font-medium text-right">Valor Total</th>
                    <th className="py-2 pr-4 font-medium text-right">Titulos</th>
                    <th className="py-2 font-medium text-right">Valor Restante</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.customer_id} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-foreground font-medium">
                        {item.customer_name}
                      </td>
                      <td className="py-2 pr-4 text-right text-muted-foreground font-mono">
                        {formatCurrency(item.total_amount)}
                      </td>
                      <td className="py-2 pr-4 text-right text-muted-foreground font-mono">
                        {item.count}
                      </td>
                      <td className="py-2 text-right font-mono font-semibold text-error-400">
                        {formatCurrency(item.total_remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2 pr-4 text-foreground">Total</td>
                    <td className="py-2 pr-4" />
                    <td className="py-2 pr-4 text-right text-foreground font-mono">
                      {data.totals.count}
                    </td>
                    <td className="py-2 text-right font-mono text-error-400">
                      {formatCurrency(data.totals.total_remaining)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum cliente inadimplente encontrado.
            </p>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
