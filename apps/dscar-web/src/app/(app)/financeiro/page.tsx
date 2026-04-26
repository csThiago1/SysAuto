"use client";

/**
 * Financeiro Dashboard — Visão geral do módulo financeiro.
 * Período fiscal atual, lançamentos do dia, acesso rápido.
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ReceiptText,
  BookOpen,
  TrendingDown,
  TrendingUp,
  Calendar,
  ArrowRight,
  PlusCircle,
} from "lucide-react";
import { useJournalEntries, useCurrentFiscalPeriod, usePayableDocuments, useReceivableDocuments } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/app/(app)/dashboard/_components/StatCard";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FinanceiroDashboardPage(): React.ReactElement {
  const today = new Date().toISOString().split("T")[0] ?? "";

  const { data: todayEntries, isLoading: loadingToday } = useJournalEntries({
    competence_date__gte: today,
    competence_date__lte: today,
    page_size: "1",
  });

  const { data: period, isLoading: loadingPeriod } = useCurrentFiscalPeriod();

  const { data: overduePayable, isLoading: loadingPayable } =
    usePayableDocuments({ status: "overdue" });
  const { data: overdueReceivable, isLoading: loadingReceivable } =
    useReceivableDocuments({ status: "overdue" });

  const isLoading = loadingToday || loadingPeriod || loadingPayable || loadingReceivable;

  const periodLabel = period
    ? new Date(`${period.start_date}T12:00:00`).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Financeiro</h1>
            <p className="mt-0.5 text-sm text-white/50">
              Gestão contábil, lançamentos e plano de contas
            </p>
          </div>
          <Link
            href={"/financeiro/lancamentos/novo" as Route}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Novo Lançamento
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCard.Skeleton key={i} />)
          ) : (
            <>
              <StatCard
                label="Lançamentos hoje"
                value={todayEntries?.count ?? 0}
                icon={<ReceiptText className="h-5 w-5 text-primary-600" />}
              />
              <StatCard
                label="Período atual"
                value={periodLabel}
                icon={<Calendar className="h-5 w-5 text-blue-600" />}
                badge={
                  period?.is_closed ? (
                    <Badge variant="destructive">Fechado</Badge>
                  ) : (
                    <Badge variant="success">Aberto</Badge>
                  )
                }
              />
              <StatCard
                label="Contas a Pagar Vencidas"
                value={overduePayable?.count ?? 0}
                icon={<TrendingDown className="h-5 w-5 text-orange-600" />}
                badge={
                  (overduePayable?.count ?? 0) > 0 ? (
                    <Badge variant="destructive">
                      {overduePayable?.count} vencido
                      {(overduePayable?.count ?? 0) !== 1 ? "s" : ""}
                    </Badge>
                  ) : undefined
                }
              />
              <StatCard
                label="Contas a Receber Vencidas"
                value={overdueReceivable?.count ?? 0}
                icon={<TrendingUp className="h-5 w-5 text-success-600" />}
                badge={
                  (overdueReceivable?.count ?? 0) > 0 ? (
                    <Badge variant="destructive">
                      {overdueReceivable?.count} vencido
                      {(overdueReceivable?.count ?? 0) !== 1 ? "s" : ""}
                    </Badge>
                  ) : undefined
                }
              />
            </>
          )}
        </div>

        {/* Bottom sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Período atual */}
          <div className="rounded-md bg-white/5 shadow-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Exercício Fiscal
            </h2>
            {loadingPeriod ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-40" />
              </div>
            ) : period ? (
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-white/50">Exercício</dt>
                  <dd className="font-medium text-white">
                    {period.fiscal_year.year}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-white/50">Período</dt>
                  <dd className="font-medium text-white">
                    {String(period.number).padStart(2, "0")} —{" "}
                    {new Date(`${period.start_date}T12:00:00`).toLocaleDateString("pt-BR")} a{" "}
                    {new Date(`${period.end_date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-white/50">Status</dt>
                  <dd>
                    {period.is_closed ? (
                      <Badge variant="destructive">Encerrado</Badge>
                    ) : (
                      <Badge variant="success">Aberto para lançamentos</Badge>
                    )}
                  </dd>
                </div>
                {period.is_adjustment && (
                  <div className="flex items-center justify-between">
                    <dt className="text-white/50">Tipo</dt>
                    <dd>
                      <Badge variant="warning">Período de Ajuste</Badge>
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-white/40">
                Nenhum período fiscal ativo encontrado.
              </p>
            )}
          </div>

          {/* Acesso rápido */}
          <div className="rounded-md bg-white/5 shadow-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Acesso Rápido
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href as Route}
                  className="flex items-center gap-3 rounded-md border border-neutral-100 p-3 hover:border-primary-200 hover:bg-primary-50 transition-colors group"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${link.iconBg}`}
                  >
                    <link.Icon className={`h-4 w-4 ${link.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/90 group-hover:text-primary-700 truncate">
                      {link.label}
                    </p>
                    <p className="text-xs text-white/40 truncate">{link.description}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-primary-500 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// ── Quick links data ───────────────────────────────────────────────────────────

const QUICK_LINKS = [
  {
    href: "/financeiro/lancamentos/novo",
    label: "Novo Lançamento",
    description: "Criar lançamento manual",
    Icon: PlusCircle,
    iconBg: "bg-primary-100",
    iconColor: "text-primary-600",
  },
  {
    href: "/financeiro/plano-contas",
    label: "Plano de Contas",
    description: "Estrutura contábil",
    Icon: BookOpen,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    href: "/financeiro/contas-pagar",
    label: "Contas a Pagar",
    description: "Títulos e pagamentos",
    Icon: TrendingDown,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    href: "/financeiro/contas-receber",
    label: "Contas a Receber",
    description: "Recebimentos e cobranças",
    Icon: TrendingUp,
    iconBg: "bg-success-100",
    iconColor: "text-success-600",
  },
];
