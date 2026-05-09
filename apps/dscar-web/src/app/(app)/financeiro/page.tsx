"use client";

/**
 * Financeiro Dashboard — S6-T4 redesign com useFinancialDashboard.
 * KPIs, fluxo de caixa, aging e acesso rapido.
 */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  TrendingDown, TrendingUp, Wallet, FileWarning, ArrowRight,
  PlusCircle, BookOpen, ReceiptText, FileText, AlertTriangle,
} from "lucide-react";
import { useFinancialDashboard } from "@/hooks/useAccounting";
import { SummaryCard } from "@/components/financeiro";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@paddock/utils";

type Preset = "month" | "quarter" | "year";
const PRESETS: Record<Preset, string> = { month: "Mes", quarter: "Trimestre", year: "Ano" };

function dateRange(p: Preset): { start: string; end: string } {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().split("T")[0] ?? "";
  if (p === "quarter") {
    const q = Math.floor(m / 3) * 3;
    return { start: fmt(new Date(y, q, 1)), end: fmt(new Date(y, q + 3, 0)) };
  }
  if (p === "year") return { start: `${y}-01-01`, end: `${y}-12-31` };
  return { start: fmt(new Date(y, m, 1)), end: fmt(new Date(y, m + 1, 0)) };
}

export default function FinanceiroDashboardPage(): React.ReactElement {
  const [preset, setPreset] = useState<Preset>("month");
  const range = useMemo(() => dateRange(preset), [preset]);
  const { data, isLoading } = useFinancialDashboard(range.start, range.end);

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header + period selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Dashboard financeiro — {range.start} a {range.end}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(Object.keys(PRESETS) as Preset[]).map((p) => (
              <button key={p} type="button" onClick={() => setPreset(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  preset === p ? "bg-primary text-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                }`}>{PRESETS[p]}</button>
            ))}
          </div>
        </div>

        {/* 4 KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Receita" value={formatCurrency(data?.receita_mes)}
            icon={<TrendingUp className="h-5 w-5 text-success-400" />} iconBg="bg-success-400/10" isLoading={isLoading} />
          <SummaryCard label="Despesa" value={formatCurrency(data?.despesa_mes)}
            icon={<TrendingDown className="h-5 w-5 text-error-400" />} iconBg="bg-error-400/10" isLoading={isLoading} />
          <SummaryCard label="Saldo" value={formatCurrency(data?.saldo)}
            icon={<Wallet className="h-5 w-5 text-primary" />} iconBg="bg-primary/10" isLoading={isLoading} />
          <SummaryCard label="NFs Pendentes" value={String(data?.notas_pendentes ?? 0)}
            icon={<FileWarning className="h-5 w-5 text-warning-400" />} iconBg="bg-warning-400/10" isLoading={isLoading} />
        </div>

        {/* Vencidos + Notas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "A Receber Vencidos", count: data?.ar_vencidos.count, total: data?.ar_vencidos.total, badge: "warning" as const },
            { label: "A Pagar Vencidos", count: data?.ap_vencidos.count, total: data?.ap_vencidos.total, badge: "destructive" as const },
            { label: "Notas Emitidas", count: data?.notas_emitidas.total_count, total: data?.notas_emitidas.total_value, badge: "default" as const },
            { label: "Notas Recebidas", count: data?.notas_recebidas.count, total: data?.notas_recebidas.total, badge: "default" as const },
          ].map((c) => (
            <div key={c.label} className="rounded-md bg-muted/50 shadow-card p-4">
              <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
              {isLoading ? <Skeleton className="h-6 w-20 mt-1" /> : (
                <>
                  <p className="text-lg font-bold text-foreground mt-1 font-mono">{formatCurrency(c.total)}</p>
                  {(c.count ?? 0) > 0 && (
                    <Badge variant={c.badge} className="mt-1">{c.count} titulo{(c.count ?? 0) !== 1 ? "s" : ""}</Badge>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Cash flow 4 weeks */}
        <div className="rounded-md bg-muted/50 shadow-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Fluxo de Caixa — 4 Semanas</h2>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : data?.fluxo_caixa_30d?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Semana</th>
                  <th className="py-2 pr-4 font-medium">Periodo</th>
                  <th className="py-2 pr-4 font-medium text-right">Entradas</th>
                  <th className="py-2 pr-4 font-medium text-right">Saidas</th>
                  <th className="py-2 font-medium text-right">Saldo</th>
                </tr></thead>
                <tbody>{data.fluxo_caixa_30d.map((r) => (
                  <tr key={r.semana} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium text-foreground">S{r.semana}</td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{r.inicio} a {r.fim}</td>
                    <td className="py-2 pr-4 text-right text-success-400 font-mono">{formatCurrency(r.entradas)}</td>
                    <td className="py-2 pr-4 text-right text-error-400 font-mono">{formatCurrency(r.saidas)}</td>
                    <td className="py-2 text-right font-mono font-semibold text-foreground">{formatCurrency(r.saldo)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted-foreground">Sem dados para o periodo.</p>}
        </div>

        {/* Aging AR + AP */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {([
            { title: "Aging — Contas a Receber", rows: data?.aging_ar ?? [] },
            { title: "Aging — Contas a Pagar", rows: data?.aging_ap ?? [] },
          ] as const).map((sec) => (
            <div key={sec.title} className="rounded-md bg-muted/50 shadow-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">{sec.title}</h2>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
              ) : sec.rows.length > 0 ? (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Faixa</th>
                    <th className="py-2 pr-4 font-medium text-right">Qtd</th>
                    <th className="py-2 font-medium text-right">Total</th>
                  </tr></thead>
                  <tbody>{sec.rows.map((r) => (
                    <tr key={r.faixa} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-foreground">{r.faixa}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground font-mono">{r.count}</td>
                      <td className="py-2 text-right font-mono font-semibold text-foreground">{formatCurrency(r.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="text-sm text-muted-foreground">Nenhum registro.</p>}
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="rounded-md bg-muted/50 shadow-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Acesso Rapido</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {QUICK_LINKS.map((l) => (
              <Link key={l.href} href={l.href as Route}
                className="flex items-center gap-3 rounded-md border border-border p-3 hover:border-primary/30 hover:bg-primary/5 transition-colors group">
                <div className={`flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${l.bg}`}>
                  <l.Icon className={`h-4 w-4 ${l.color}`} />
                </div>
                <p className="flex-1 min-w-0 text-xs font-semibold text-foreground/90 group-hover:text-primary/80 truncate">{l.label}</p>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

const QUICK_LINKS = [
  { href: "/financeiro/lancamentos/novo", label: "Novo Lancamento", Icon: PlusCircle, bg: "bg-primary/10", color: "text-primary" },
  { href: "/financeiro/plano-contas", label: "Plano de Contas", Icon: BookOpen, bg: "bg-muted/50", color: "text-foreground/70" },
  { href: "/financeiro/contas-pagar", label: "Contas a Pagar", Icon: TrendingDown, bg: "bg-muted/50", color: "text-foreground/70" },
  { href: "/financeiro/contas-receber", label: "Contas a Receber", Icon: TrendingUp, bg: "bg-muted/50", color: "text-success-400" },
  { href: "/financeiro/billing-report", label: "Faturamento", Icon: ReceiptText, bg: "bg-muted/50", color: "text-foreground/70" },
  { href: "/financeiro/inadimplencia", label: "Inadimplencia", Icon: AlertTriangle, bg: "bg-warning-400/10", color: "text-warning-400" },
  { href: "/financeiro/dre", label: "DRE", Icon: FileText, bg: "bg-muted/50", color: "text-foreground/70" },
  { href: "/financeiro/lancamentos", label: "Lancamentos", Icon: ReceiptText, bg: "bg-muted/50", color: "text-foreground/70" },
];
