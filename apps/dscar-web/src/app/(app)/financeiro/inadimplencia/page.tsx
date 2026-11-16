"use client";

/**
 * Relatorio de Inadimplencia — S6-T4
 * Lista clientes com titulos vencidos e totais em aberto.
 */

import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from "@/components/ui/table";
import React from "react";
import { AlertTriangle } from "lucide-react";
import { useInadimplencia } from "@/hooks/useAccounting";
import { SummaryCard } from "@/components/financeiro";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollFade } from "@/components/ui/scroll-fade";
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
            <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {data.items.map((item) => (
                <div key={item.customer_id} className="rounded-lg border border-border bg-background/40 p-4 space-y-2">
                  <span className="text-sm font-medium text-foreground truncate block">
                    {item.customer_name}
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Valor Total</p>
                      <p className="font-mono text-foreground">{formatCurrency(item.total_amount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Títulos</p>
                      <p className="font-mono text-foreground">{item.count}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Restante</p>
                      <p className="font-mono font-semibold text-error-400">{formatCurrency(item.total_remaining)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <ScrollFade className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Titulos</TableHead>
                    <TableHead className="text-right">Valor Restante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.customer_id}>
                      <TableCell className="text-foreground font-medium">
                        {item.customer_name}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {formatCurrency(item.total_amount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {item.count}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-error-400">
                        {formatCurrency(item.total_remaining)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell className="text-foreground">Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right text-foreground font-mono">
                      {data.totals.count}
                    </TableCell>
                    <TableCell className="text-right font-mono text-error-400">
                      {formatCurrency(data.totals.total_remaining)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </ScrollFade>
            </>
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
