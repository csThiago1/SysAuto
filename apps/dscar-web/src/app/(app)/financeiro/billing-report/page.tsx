"use client";

/**
 * Relatorio de Faturamento — S6-T4
 * Agrupamento por cliente, origem ou mes com totais.
 */

import React, { useMemo, useState } from "react";
import { ReceiptText } from "lucide-react";
import { useFaturamento } from "@/hooks/useAccounting";
import { SummaryCard } from "@/components/financeiro";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@paddock/utils";

// ── Period helpers ────────────────────────────────────────────────────────────

type Preset = "month" | "quarter" | "year";

function getDateRange(preset: Preset): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (preset === "quarter") {
    const qStart = Math.floor(m / 3) * 3;
    const start = new Date(y, qStart, 1);
    const end = new Date(y, qStart + 3, 0);
    return { start: fmt(start), end: fmt(end) };
  }
  if (preset === "year") {
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start: fmt(start), end: fmt(end) };
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0] ?? "";
}

const PRESET_LABELS: Record<Preset, string> = {
  month: "Mes",
  quarter: "Trimestre",
  year: "Ano",
};

const GROUP_OPTIONS = [
  { value: "customer", label: "Cliente" },
  { value: "origin", label: "Origem" },
  { value: "month", label: "Mes" },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FaturamentoPage(): React.ReactElement {
  const [preset, setPreset] = useState<Preset>("month");
  const [groupBy, setGroupBy] = useState("customer");
  const range = useMemo(() => getDateRange(preset), [preset]);

  const { data, isLoading } = useFaturamento(range.start, range.end, groupBy);

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatorio de Faturamento</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {range.start} a {range.end}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  preset === p
                    ? "bg-primary text-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/50 text-foreground"
            >
              {GROUP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Agrupar: {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SummaryCard
            label="Total Faturado"
            value={formatCurrency(data?.totals.total)}
            icon={<ReceiptText className="h-5 w-5 text-primary" />}
            iconBg="bg-primary/10"
            isLoading={isLoading}
          />
          <SummaryCard
            label="Total Recebido"
            value={formatCurrency(data?.totals.received)}
            icon={<ReceiptText className="h-5 w-5 text-success-400" />}
            iconBg="bg-success-400/10"
            isLoading={isLoading}
          />
        </div>

        {/* Table */}
        <div className="rounded-md bg-muted/50 shadow-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Detalhamento</h2>
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
                    {Object.keys(data.items[0] ?? {}).map((key) => (
                      <th key={key} className="py-2 pr-4 font-medium capitalize">
                        {key.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      {Object.values(item).map((val, ci) => (
                        <td key={ci} className="py-2 pr-4 text-foreground">
                          {typeof val === "string" && /^\d+\.\d{2}$/.test(val)
                            ? formatCurrency(val)
                            : String(val ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2 pr-4 text-foreground">Total</td>
                    <td className="py-2 pr-4 text-foreground font-mono" colSpan={Object.keys(data.items[0] ?? {}).length - 1}>
                      {formatCurrency(data.totals.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum registro para o periodo.</p>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
