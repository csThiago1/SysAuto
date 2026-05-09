"use client";

import React, { useState } from "react";
import { BarChart3, FileText, Package, TrendingUp } from "lucide-react";
import { SummaryCard } from "@/components/financeiro";
import { useResumoFiscal } from "@/hooks/useFiscal";
import { formatCurrency } from "@paddock/utils";

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR];

export default function ResumoFiscalPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const { data, isLoading } = useResumoFiscal(year, month);

  const nfseTotal = data ? formatCurrency(parseFloat(data.nfse.total)) : "—";
  const nfeTotal = data ? formatCurrency(parseFloat(data.nfe.total)) : "—";
  const iss = data ? formatCurrency(parseFloat(data.impostos.iss)) : "—";
  const icms = data ? formatCurrency(parseFloat(data.impostos.icms)) : "—";
  const pis = data ? formatCurrency(parseFloat(data.impostos.pis)) : "—";
  const cofins = data ? formatCurrency(parseFloat(data.impostos.cofins)) : "—";

  const selectClass =
    "rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Resumo Fiscal Mensal</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Consolidado de documentos fiscais emitidos no período
            </p>
          </div>
        </div>

        {/* Period selectors */}
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={selectClass}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={selectClass}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards — NFS-e e NF-e */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SummaryCard
          label={`NFS-e Emitidas${data ? ` (${data.nfse.count})` : ""}`}
          value={nfseTotal}
          icon={<FileText className="h-5 w-5 text-white" />}
          iconBg="bg-info-500"
          isLoading={isLoading}
        />
        <SummaryCard
          label={`NF-e Emitidas${data ? ` (${data.nfe.count})` : ""}`}
          value={nfeTotal}
          icon={<Package className="h-5 w-5 text-white" />}
          iconBg="bg-success-600"
          isLoading={isLoading}
        />
      </div>

      {/* Tax summary */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Impostos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            label="ISS"
            value={iss}
            icon={<TrendingUp className="h-5 w-5 text-white" />}
            iconBg="bg-warning-500"
            isLoading={isLoading}
          />
          <SummaryCard
            label="ICMS"
            value={icms}
            icon={<TrendingUp className="h-5 w-5 text-white" />}
            iconBg="bg-warning-500"
            isLoading={isLoading}
          />
          <SummaryCard
            label="PIS"
            value={pis}
            icon={<TrendingUp className="h-5 w-5 text-white" />}
            iconBg="bg-warning-500"
            isLoading={isLoading}
          />
          <SummaryCard
            label="COFINS"
            value={cofins}
            icon={<TrendingUp className="h-5 w-5 text-white" />}
            iconBg="bg-warning-500"
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Footer totals */}
      <div className="rounded-xl bg-muted/30 border border-white/[0.07] p-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Total emitidas</span>
          {isLoading ? (
            <span className="text-sm text-muted-foreground animate-pulse">—</span>
          ) : (
            <span className="text-2xl font-bold text-foreground">
              {data?.total_emitidas ?? 0}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Total canceladas</span>
          {isLoading ? (
            <span className="text-sm text-muted-foreground animate-pulse">—</span>
          ) : (
            <span className="text-2xl font-bold text-error-600">
              {data?.total_canceladas ?? 0}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
