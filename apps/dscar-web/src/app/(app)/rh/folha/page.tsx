"use client";

/**
 * Folha de Pagamento — Lista de meses com resumo financeiro.
 * Gerar contracheque do mês (ADMIN+).
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { FileText, Lock } from "lucide-react";
import { usePayslips, useGeneratePayslip, useEmployees } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui";

export default function FolhaPage(): React.ReactElement {
  const { data, isLoading } = usePayslips();
  const generate = useGeneratePayslip();
  const { data: employeesData } = useEmployees({ status: "active" });
  const employees = employeesData?.results ?? [];

  const [showGenerate, setShowGenerate] = React.useState(false);
  const [genForm, setGenForm] = React.useState({
    employee: "",
    reference_month: new Date().toISOString().slice(0, 7) + "-01",
  });

  const payslips = data?.results ?? [];

  // Group payslips by reference_month for display
  const grouped = React.useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        total: number;
        gross: number;
        net: number;
        closed: number;
      }
    >();
    for (const p of payslips) {
      const key = p.reference_month;
      const prev = map.get(key) ?? {
        month: key,
        total: 0,
        gross: 0,
        net: 0,
        closed: 0,
      };
      map.set(key, {
        month: key,
        total: prev.total + 1,
        gross: prev.gross + parseFloat(p.gross_pay),
        net: prev.net + parseFloat(p.net_pay),
        closed: prev.closed + (p.is_closed ? 1 : 0),
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      b.month.localeCompare(a.month)
    );
  }, [payslips]);

  const handleGenerate = (e: React.FormEvent): void => {
    e.preventDefault();
    generate.mutate(genForm, { onSuccess: () => setShowGenerate(false) });
  };

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Folha de Pagamento
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Contracheques e fechamentos mensais
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={"/rh/folha/contracheque" as Route}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground/70 hover:bg-muted/30"
            >
              Meus contracheques
            </Link>
            <button
              onClick={() => setShowGenerate((p) => !p)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/90"
            >
              Gerar contracheque
            </button>
          </div>
        </div>

        {/* Generate form */}
        {showGenerate && (
          <form
            onSubmit={handleGenerate}
            className="rounded-md bg-muted/50 shadow-card p-card-padding space-y-4"
          >
            <h3 className="text-sm font-semibold text-foreground">
              Gerar / atualizar contracheque
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Colaborador *
                </label>
                <select
                  required
                  value={genForm.employee}
                  onChange={(e) =>
                    setGenForm((p) => ({ ...p, employee: e.target.value }))
                  }
                  className="rounded border border-border px-2 py-1.5 text-sm"
                >
                  <option value="">Selecione...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Mês de referência *
                </label>
                <input
                  type="month"
                  required
                  className="rounded border border-border px-2 py-1.5 text-sm"
                  value={genForm.reference_month.slice(0, 7)}
                  onChange={(e) =>
                    setGenForm((p) => ({
                      ...p,
                      reference_month: e.target.value + "-01",
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGenerate(false)}
                className="text-xs text-muted-foreground hover:underline"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={generate.isPending}
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
              >
                {generate.isPending ? "Gerando..." : "Gerar"}
              </button>
            </div>
          </form>
        )}

        {/* Grouped by month */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-md bg-muted/50 shadow-card p-10 text-center text-sm text-muted-foreground">
            Nenhum contracheque gerado. Use "Gerar contracheque" acima.
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((g) => (
              <Link
                key={g.month}
                href={`/rh/folha/${g.month}` as Route}
                className="block rounded-md bg-muted/50 shadow-card p-card-padding hover:shadow-card-hover transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/50">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {new Date(g.month + "T12:00").toLocaleDateString(
                          "pt-BR",
                          { month: "long", year: "numeric" }
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {g.total} contracheque{g.total !== 1 ? "s" : ""}
                        {g.closed === g.total && g.total > 0 ? (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-success-400">
                            <Lock className="h-3 w-3" /> Fechados
                          </span>
                        ) : (
                          <span className="ml-2 text-warning-400">
                            {g.closed}/{g.total} fechados
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      Líquido:{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(g.net)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bruto:{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(g.gross)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
