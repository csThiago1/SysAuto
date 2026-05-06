"use client";

/**
 * Folha de Pagamento — Detalhe do mês.
 * Tabela: colaborador × base × bônus × vales × descontos × líquido.
 * Botão "Fechar Folha" (ADMIN+) com confirmação — torna imutável.
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, Lock, AlertTriangle } from "lucide-react";
import { usePayslips, useClosePayslip } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui";
import type { Payslip } from "@paddock/types";

const fmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function PayslipRow({ payslip }: { payslip: Payslip }): React.ReactElement {
  const close = useClosePayslip();

  return (
    <tr className="border-b border-white/5 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-sm text-foreground font-medium">
        {payslip.employee_name}
      </td>
      <td className="px-4 py-3 text-sm text-foreground/70 text-right tabular-nums">
        {fmt.format(parseFloat(payslip.base_salary))}
      </td>
      <td className="px-4 py-3 text-sm text-foreground/70 text-right tabular-nums">
        {fmt.format(parseFloat(payslip.total_bonuses))}
      </td>
      <td className="px-4 py-3 text-sm text-foreground/70 text-right tabular-nums">
        {fmt.format(parseFloat(payslip.total_allowances))}
      </td>
      <td className="px-4 py-3 text-sm text-error-400 text-right tabular-nums">
        -{fmt.format(parseFloat(payslip.total_deductions))}
      </td>
      <td className="px-4 py-3 text-sm font-bold text-foreground text-right tabular-nums">
        {fmt.format(parseFloat(payslip.net_pay))}
      </td>
      <td className="px-4 py-3 text-right">
        {payslip.is_closed ? (
          <span className="inline-flex items-center gap-1 text-xs text-success-400 font-medium">
            <Lock className="h-3 w-3" />
            Fechado
          </span>
        ) : (
          <button
            onClick={() => close.mutate(payslip.id)}
            disabled={close.isPending}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
          >
            Fechar
          </button>
        )}
      </td>
    </tr>
  );
}

export default function FolhaMonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}): React.ReactElement {
  const { month } = React.use(params);

  const { data, isLoading } = usePayslips({ reference_month: month });
  const payslips = data?.results ?? [];
  const closeAll = useClosePayslip();

  const [confirmClose, setConfirmClose] = React.useState(false);

  const allClosed = payslips.length > 0 && payslips.every((p) => p.is_closed);
  const closedCount = payslips.filter((p) => p.is_closed).length;

  const totals = React.useMemo(() => {
    return payslips.reduce(
      (acc, p) => ({
        base: acc.base + parseFloat(p.base_salary),
        bonuses: acc.bonuses + parseFloat(p.total_bonuses),
        allowances: acc.allowances + parseFloat(p.total_allowances),
        deductions: acc.deductions + parseFloat(p.total_deductions),
        net: acc.net + parseFloat(p.net_pay),
      }),
      { base: 0, bonuses: 0, allowances: 0, deductions: 0, net: 0 }
    );
  }, [payslips]);

  const monthDisplay = new Date(month + "T12:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const handleCloseAll = (): void => {
    const open = payslips.filter((p) => !p.is_closed);
    open.forEach((p) => closeAll.mutate(p.id));
    setConfirmClose(false);
  };

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={"/rh/folha" as Route}
            className="flex items-center gap-1 hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
            Folha de Pagamento
          </Link>
          <span>/</span>
          <span className="text-foreground capitalize">{monthDisplay}</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground capitalize">
              {monthDisplay}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {closedCount}/{payslips.length} contracheques fechados
            </p>
          </div>

          {!allClosed && payslips.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmClose ? (
                <>
                  <span className="flex items-center gap-1 text-sm text-warning-400">
                    <AlertTriangle className="h-4 w-4" />
                    Fechar folha é irreversível.
                  </span>
                  <button
                    onClick={() => setConfirmClose(false)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCloseAll}
                    disabled={closeAll.isPending}
                    className="rounded-md bg-error-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-red-700 disabled:opacity-50"
                  >
                    {closeAll.isPending ? "Fechando..." : "Confirmar fechamento"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmClose(true)}
                  className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm text-foreground/70 hover:bg-muted/30"
                >
                  <Lock className="h-4 w-4" />
                  Fechar Folha
                </button>
              )}
            </div>
          )}

          {allClosed && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-success-400">
              <Lock className="h-4 w-4" />
              Folha fechada
            </span>
          )}
        </div>

        {/* Summary cards */}
        {!isLoading && payslips.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Salário base", value: totals.base, color: "text-foreground" },
              { label: "Bônus", value: totals.bonuses, color: "text-success-400" },
              { label: "Vales", value: totals.allowances, color: "text-info-400" },
              { label: "Descontos", value: totals.deductions, color: "text-error-400" },
              { label: "Total líquido", value: totals.net, color: "text-primary/80" },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-md bg-muted/50 shadow-card p-3"
              >
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`text-sm font-bold mt-0.5 tabular-nums ${c.color}`}>
                  {fmt.format(c.value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="rounded-md bg-muted/50 shadow-card overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : payslips.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum contracheque para este mês.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Colaborador
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Salário base
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Bônus
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Vales
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Descontos
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Líquido
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <PayslipRow key={p.id} payslip={p} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="px-4 py-2.5 text-xs font-semibold text-foreground/70">
                      Total ({payslips.length})
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-foreground text-right tabular-nums">
                      {fmt.format(totals.base)}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-foreground text-right tabular-nums">
                      {fmt.format(totals.bonuses)}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-foreground text-right tabular-nums">
                      {fmt.format(totals.allowances)}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-error-400 text-right tabular-nums">
                      -{fmt.format(totals.deductions)}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-bold text-primary/90 text-right tabular-nums">
                      {fmt.format(totals.net)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
