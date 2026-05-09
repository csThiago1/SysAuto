"use client";

/**
 * Contas a Receber — Lista de títulos com resumo e ações de recebimento.
 * Sprint 14
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { PlusCircle, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useReceivableDocuments, useRecordReceipt, useCancelReceivable } from "@/hooks/useFinanceiro";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import {
  SummaryCard,
  FinanceiroStatusBadge,
  RecordPaymentDialog,
  CancelDialog,
  FinanceiroTableSkeleton,
} from "@/components/financeiro";
import type {
  ReceivableDocumentListItem,
  ReceivableStatus,
  ReceivableOrigin,
} from "@paddock/types";
import {
  RECEIVABLE_STATUS_LABELS,
  RECEIVABLE_STATUS_COLOR,
  RECEIVABLE_ORIGIN_LABELS,
} from "@paddock/types";
import { formatDate } from "@paddock/utils";

// ── Formatting helpers ────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatBRL(value: string): string {
  return brl.format(Number(value));
}

function isOverdue(dueDate: string, status: ReceivableStatus): boolean {
  if (status === "received" || status === "cancelled") return false;
  return new Date(dueDate + "T00:00:00") < new Date(new Date().toDateString());
}

function isDueToday(dueDate: string): boolean {
  return dueDate === new Date().toISOString().split("T")[0];
}

function isThisMonth(date: string): boolean {
  const d = new Date(date + "T00:00:00");
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ── Filter types ──────────────────────────────────────────────────────────────

type FilterStatus = ReceivableStatus | "";
type FilterOrigin = ReceivableOrigin | "";

const STATUS_OPTIONS: [ReceivableStatus, string][] = Object.entries(
  RECEIVABLE_STATUS_LABELS
) as [ReceivableStatus, string][];

const ORIGIN_OPTIONS: [ReceivableOrigin, string][] = Object.entries(
  RECEIVABLE_ORIGIN_LABELS
) as [ReceivableOrigin, string][];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContasReceberPage(): React.ReactElement {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<FilterStatus>("");
  const [origin, setOrigin] = React.useState<FilterOrigin>("");
  const [dueDateGte, setDueDateGte] = React.useState("");
  const [dueDateLte, setDueDateLte] = React.useState("");

  const debouncedSearch = useDebounce(search, 300);

  const filters: Record<string, string> = {};
  if (debouncedSearch) filters.search = debouncedSearch;
  if (status) filters.status = status;
  if (origin) filters.origin = origin;
  if (dueDateGte) filters.due_date__gte = dueDateGte;
  if (dueDateLte) filters.due_date__lte = dueDateLte;

  const { data, isLoading } = useReceivableDocuments(filters);
  const recordReceipt = useRecordReceipt();
  const cancelReceivable = useCancelReceivable();

  const [receivingDoc, setReceivingDoc] =
    React.useState<ReceivableDocumentListItem | null>(null);
  const [cancellingDoc, setCancellingDoc] =
    React.useState<ReceivableDocumentListItem | null>(null);

  const documents = data?.results ?? [];

  // ── Summary computations ──────────────────────────────────────────────────
  const { data: allData, isLoading: isAllLoading } = useReceivableDocuments({});
  const allDocs = allData?.results ?? [];

  const totalOpen = allDocs
    .filter((d) => d.status === "open" || d.status === "partial")
    .reduce((acc, d) => acc + Number(d.amount_remaining), 0);

  const totalOverdue = allDocs
    .filter((d) => isOverdue(d.due_date, d.status))
    .reduce((acc, d) => acc + Number(d.amount_remaining), 0);

  const receivedThisMonth = allDocs
    .filter((d) => d.status === "received" && isThisMonth(d.due_date))
    .reduce((acc, d) => acc + Number(d.amount_received), 0);

  const dueToday = allDocs
    .filter(
      (d) =>
        isDueToday(d.due_date) &&
        (d.status === "open" || d.status === "partial")
    )
    .reduce((acc, d) => acc + Number(d.amount_remaining), 0);

  const canCancel = (s: ReceivableStatus): boolean =>
    s === "open" || s === "partial" || s === "overdue";

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Contas a Receber
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data?.count ?? "—"} título
              {(data?.count ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href={"/financeiro/contas-receber/novo" as Route}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/90 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Novo Título
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total a Receber"
            value={formatBRL(String(totalOpen))}
            iconBg="bg-muted/50"
            icon={<TrendingUp className="h-5 w-5 text-foreground/70" />}
            isLoading={isAllLoading}
          />
          <SummaryCard
            label="Total Vencido"
            value={formatBRL(String(totalOverdue))}
            iconBg="bg-error-500/10"
            icon={<AlertCircle className="h-5 w-5 text-error-400" />}
            isLoading={isAllLoading}
          />
          <SummaryCard
            label="Recebido no Mês"
            value={formatBRL(String(receivedThisMonth))}
            iconBg="bg-success-500/10"
            icon={<CheckCircle2 className="h-5 w-5 text-success-400" />}
            isLoading={isAllLoading}
          />
          <SummaryCard
            label="A Vencer Hoje"
            value={formatBRL(String(dueToday))}
            iconBg="bg-amber-100"
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            isLoading={isAllLoading}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar cliente ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-60"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FilterStatus)}
            className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value as FilterOrigin)}
            className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todas as origens</option>
            {ORIGIN_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Venc. de</span>
            <Input
              type="date"
              value={dueDateGte}
              onChange={(e) => setDueDateGte(e.target.value)}
              className="w-36"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={dueDateLte}
              onChange={(e) => setDueDateLte(e.target.value)}
              className="w-36"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md bg-muted/50 shadow-card overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Cliente</span>
            <span>Descrição</span>
            <span>Origem</span>
            <span>Vencimento</span>
            <span className="text-right">Valor</span>
            <span className="text-right">Recebido</span>
            <span className="text-right">Restante</span>
            <span>Status</span>
            <span>Ações</span>
          </div>

          {isLoading ? (
            <FinanceiroTableSkeleton />
          ) : documents.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhum título encontrado.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5 items-center text-sm hover:bg-muted/30 transition-colors"
                >
                  <span className="font-medium text-foreground truncate">
                    {doc.customer_name}
                  </span>
                  <span className="text-foreground/60 truncate">
                    {doc.description}
                    {doc.document_number && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        #{doc.document_number}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {RECEIVABLE_ORIGIN_LABELS[doc.origin]}
                  </span>
                  <span
                    className={
                      isOverdue(doc.due_date, doc.status)
                        ? "text-error-400 font-medium"
                        : "text-foreground/60"
                    }
                  >
                    {formatDate(doc.due_date)}
                  </span>
                  <span className="text-right font-mono text-foreground">
                    {formatBRL(doc.amount)}
                  </span>
                  <span className="text-right font-mono text-success-400">
                    {formatBRL(doc.amount_received)}
                  </span>
                  <span className="text-right font-mono text-foreground font-semibold">
                    {formatBRL(doc.amount_remaining)}
                  </span>
                  <div>
                    <FinanceiroStatusBadge
                      status={doc.status}
                      labels={RECEIVABLE_STATUS_LABELS}
                      colors={RECEIVABLE_STATUS_COLOR}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {(doc.status === "open" ||
                      doc.status === "partial" ||
                      doc.status === "overdue") && (
                      <button
                        type="button"
                        onClick={() => setReceivingDoc(doc)}
                        className="rounded-md bg-success-500/10 border border-success-500/20 px-2.5 py-1 text-xs font-medium text-success-400 hover:bg-success-500/20 transition-colors"
                      >
                        Receber
                      </button>
                    )}
                    {canCancel(doc.status) && (
                      <button
                        type="button"
                        onClick={() => setCancellingDoc(doc)}
                        className="rounded-md bg-error-500/10 border border-error-500/20 px-2.5 py-1 text-xs font-medium text-error-400 hover:bg-error-500/20 transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <RecordPaymentDialog
        document={receivingDoc}
        open={receivingDoc !== null}
        onOpenChange={(open) => {
          if (!open) setReceivingDoc(null);
        }}
        onSubmit={(data) => {
          recordReceipt.mutate(
            {
              documentId: data.documentId,
              receipt_date: data.payment_date,
              amount: data.amount,
              payment_method: data.payment_method,
              bank_account: data.bank_account,
              notes: data.notes,
            },
            {
              onSuccess: () => {
                setReceivingDoc(null);
              },
            }
          );
        }}
        isPending={recordReceipt.isPending}
        isError={recordReceipt.isError}
        errorMessage={recordReceipt.error?.message}
        title="Registrar Recebimento"
        submitLabel="Registrar Recebimento"
        amountLabel="Valor a receber *"
      />
      <CancelDialog
        entityName={cancellingDoc?.customer_name ?? ""}
        amount={cancellingDoc?.amount ?? "0"}
        open={cancellingDoc !== null}
        onOpenChange={(open) => {
          if (!open) setCancellingDoc(null);
        }}
        onSubmit={(reason) => {
          if (!cancellingDoc) return;
          cancelReceivable.mutate(
            { id: cancellingDoc.id, reason },
            { onSuccess: () => setCancellingDoc(null) }
          );
        }}
        isPending={cancelReceivable.isPending}
        isError={cancelReceivable.isError}
        errorMessage={cancelReceivable.error?.message}
      />
    </ErrorBoundary>
  );
}
