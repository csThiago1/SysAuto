"use client";

/**
 * Meus Contracheques — Self-service do colaborador.
 * Lista apenas os contracheques do usuário autenticado.
 * Acesso: SELF (qualquer colaborador).
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight, Lock, FileText, Download, ReceiptText } from "lucide-react";
import { useMyEmployee, useEmployeePayslips } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui";

const fmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function ContrachequesSelfPage(): React.ReactElement {
  const { data: myEmployee, isLoading: loadingEmployee, error: employeeError } =
    useMyEmployee();

  const { data, isLoading: loadingPayslips } = useEmployeePayslips(
    myEmployee?.id ?? ""
  );

  const payslips = data?.results ?? [];

  const isLoading = loadingEmployee || (Boolean(myEmployee) && loadingPayslips);

  return (
    <ErrorBoundary>
      <div className="space-y-5 max-w-2xl mx-auto">
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
          <span className="text-foreground">Meus contracheques</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Meus Contracheques
          </h1>
          {myEmployee && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {myEmployee.user.name} · {myEmployee.position_display}
            </p>
          )}
        </div>

        {/* No employee profile */}
        {!loadingEmployee && employeeError && (
          <div className="rounded-md bg-muted/50 shadow-card p-8 text-center">
            <p className="text-sm text-error-400">
              Seu usuário não possui perfil de colaborador. Peça ao administrador
              para criar.
            </p>
          </div>
        )}

        {/* Payslip list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-md" />
            ))}
          </div>
        ) : !employeeError && payslips.length === 0 ? (
          <div className="rounded-md bg-muted/50 shadow-card p-10 text-center text-sm text-muted-foreground">
            Nenhum contracheque disponível.
          </div>
        ) : (
          <div className="space-y-3">
            {payslips.map((payslip) => (
              <div
                key={payslip.id}
                className="rounded-md bg-muted/50 shadow-card p-card-padding"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Month + icon */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/50 shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {new Date(
                          payslip.reference_month + "T12:00"
                        ).toLocaleDateString("pt-BR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {payslip.worked_days} dias trabalhados
                        {payslip.is_closed && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-success-400">
                            <Lock className="h-3 w-3" />
                            Fechado
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Amounts + download */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        {fmt.format(parseFloat(payslip.net_pay))}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Bruto {fmt.format(parseFloat(payslip.gross_pay))}
                      </p>
                    </div>

                    {payslip.pdf_file_key ? (
                      <a
                        href={`/api/proxy/hr/payslips/${payslip.id}/pdf/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground/70 hover:bg-muted/30"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        PDF indisponível
                      </span>
                    )}
                  </div>
                </div>

                {/* Breakdown */}
                <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
                  {[
                    { label: "Salário base", value: payslip.base_salary, color: "" },
                    { label: "Bônus", value: payslip.total_bonuses, color: "text-success-400" },
                    { label: "Vales", value: payslip.total_allowances, color: "text-info-400" },
                    { label: "Descontos", value: payslip.total_deductions, color: "text-error-400" },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className={`text-xs font-medium tabular-nums ${item.color || "text-foreground/70"}`}>
                        {fmt.format(parseFloat(item.value))}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Lancamento contabil vinculado */}
                {payslip.journal_entry_id && (
                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50">
                        <ReceiptText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Lancamento Contabil</p>
                        <p className="text-xs text-muted-foreground">Gerado automaticamente ao fechar a folha</p>
                      </div>
                    </div>
                    <Link
                      href={`/financeiro/lancamentos/${payslip.journal_entry_id}` as Route}
                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      Ver lancamento
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
