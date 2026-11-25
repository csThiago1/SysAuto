"use client";

/**
 * Contas a Receber — Lista de títulos com resumo e ações de recebimento.
 * Sprint 14
 */

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { PlusCircle, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useReceivableDocuments, useReceivableSummary, useRecordReceipt, useCancelReceivable } from "@/hooks/useFinanceiro";
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
import { DateField } from "@/components/ui/date-field"

// ── Formatting helpers ────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatBRL(value: string): string {
  return brl.format(Number(value));
}

function isOverdue(dueDate: string, status: ReceivableStatus): boolean {
  if (status === "received" || status === "cancelled") return false;
  return new Date(dueDate + "T00:00:00") < new Date(new Date().toDateString());
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
  if (dueDateGte) filters.due_date_gte = dueDateGte;
  if (dueDateLte) filters.due_date_lte = dueDateLte;

  const { data, isLoading, isError } = useReceivableDocuments(filters);
  const recordReceipt = useRecordReceipt();
  const cancelReceivable = useCancelReceivable();

  const [receivingDoc, setReceivingDoc] =
    React.useState<ReceivableDocumentListItem | null>(null);
  const [cancellingDoc, setCancellingDoc] =
    React.useState<ReceivableDocumentListItem | null>(null);
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);

  const documents = data?.results ?? [];

  // ── Summary computations ──────────────────────────────────────────────────
  const { data: summary, isLoading: isAllLoading } = useReceivableSummary();

  const canCancel = (s: ReceivableStatus): boolean =>
    s === "open" || s === "partial" || s === "overdue";

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">
              Contas a Receber
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data?.count ?? "—"} título
              {(data?.count ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <Button asChild>
            <Link href={"/financeiro/contas-receber/novo" as Route}>
              <PlusCircle className="h-4 w-4" />
              Novo Título
            </Link>
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total a Receber"
            value={summary ? formatBRL(summary.total_open) : "—"}
            iconBg="bg-muted/50"
            icon={<TrendingUp className="h-5 w-5 text-foreground/70" />}
            isLoading={isAllLoading}
          />
          <SummaryCard
            label="Total Vencido"
            value={summary ? formatBRL(summary.total_overdue) : "—"}
            iconBg="bg-error-500/10"
            icon={<AlertCircle className="h-5 w-5 text-error-400" />}
            isLoading={isAllLoading}
          />
          <SummaryCard
            label="Recebido no Mês"
            value={summary ? formatBRL(summary.settled_this_month) : "—"}
            iconBg="bg-success-500/10"
            icon={<CheckCircle2 className="h-5 w-5 text-success-400" />}
            isLoading={isAllLoading}
          />
          <SummaryCard
            label="A Vencer Hoje"
            value={summary ? formatBRL(summary.due_today) : "—"}
            iconBg="bg-warning-500/10"
            icon={<Clock className="h-5 w-5 text-warning-400" />}
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
          <NativeSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as FilterStatus)}
            className="w-auto"
            wrapperClassName="w-auto"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={origin}
            onChange={(e) => setOrigin(e.target.value as FilterOrigin)}
            className="w-auto"
            wrapperClassName="w-auto"
          >
            <option value="">Todas as origens</option>
            {ORIGIN_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Venc. de</span>
            <DateField value={dueDateGte} onChange={setDueDateGte} />
            <span className="text-xs text-muted-foreground">até</span>
            <DateField value={dueDateLte} onChange={setDueDateLte} />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md bg-muted/50 shadow-card overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[2fr_3fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Cliente</span>
            <span>Descrição</span>
            <span>Vencimento</span>
            <span className="text-right">Valor</span>
            <span className="text-right">Recebido</span>
            <span className="text-right">Restante</span>
            <span>Status</span>
            <span></span>
          </div>

          {isLoading ? (
            <FinanceiroTableSkeleton />
          ) : isError ? (
            <div className="py-16 text-center text-sm text-error-400">
              Erro ao carregar os títulos. Tente recarregar a página.
            </div>
          ) : documents.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhum título encontrado.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_3fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5 items-center text-sm hover:bg-muted/30 transition-colors"
                >
                  <Link
                    href={`/financeiro/contas-receber/${doc.id}` as Route}
                    className="font-medium text-foreground truncate hover:underline"
                  >
                    {doc.customer_name}
                  </Link>
                  <span className="text-foreground/60 truncate">
                    {doc.description}
                    {doc.document_number && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        #{doc.document_number}
                      </span>
                    )}
                    <span className="ml-1.5 text-xs text-muted-foreground/60">
                      {RECEIVABLE_ORIGIN_LABELS[doc.origin]}
                    </span>
                  </span>
                  <span
                    className={
                      isOverdue(doc.due_date, doc.status)
                        ? "text-xs text-error-400 font-medium"
                        : "text-xs text-foreground/60"
                    }
                  >
                    {formatDate(doc.due_date)}
                  </span>
                  <span className="text-right font-mono text-xs text-foreground">
                    {formatBRL(doc.amount)}
                  </span>
                  <span className="text-right font-mono text-xs text-success-400">
                    {formatBRL(doc.amount_received)}
                  </span>
                  <span className="text-right font-mono text-xs text-foreground font-semibold">
                    {formatBRL(doc.amount_remaining)}
                  </span>
                  <div>
                    <FinanceiroStatusBadge
                      status={doc.status}
                      labels={RECEIVABLE_STATUS_LABELS}
                      colors={RECEIVABLE_STATUS_COLOR}
                    />
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenu(openMenu === doc.id ? null : doc.id)}
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      &middot;&middot;&middot;
                    </button>
                    {openMenu === doc.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                        <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg bg-popover border border-border shadow-lg py-1">
                          {(doc.status === "open" || doc.status === "partial" || doc.status === "overdue") && (
                            <button
                              type="button"
                              onClick={() => { setReceivingDoc(doc); setOpenMenu(null); }}
                              className="w-full text-left px-3 py-1.5 text-xs text-foreground/70 hover:bg-muted/50 transition-colors"
                            >
                              Receber
                            </button>
                          )}
                          {canCancel(doc.status) && (
                            <button
                              type="button"
                              onClick={() => { setCancellingDoc(doc); setOpenMenu(null); }}
                              className="w-full text-left px-3 py-1.5 text-xs text-error-400/80 hover:bg-muted/50 transition-colors"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </>
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
