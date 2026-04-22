"use client";

/**
 * Contas a Pagar — Lista de títulos com resumo e ações de pagamento.
 * Sprint 14
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { PlusCircle, TrendingDown, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { usePayableDocuments, useRecordPayment, useCancelPayable } from "@/hooks";
import { useDebounce } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type {
  PayableDocumentListItem,
  PayableStatus,
  PayableOrigin,
  PaymentMethod,
} from "@paddock/types";
import {
  PAYABLE_STATUS_LABELS,
  PAYABLE_STATUS_COLOR,
  PAYABLE_ORIGIN_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@paddock/types";

// ── Formatting helpers ────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatBRL(value: string): string {
  return brl.format(Number(value));
}

function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
}

function isOverdue(dueDate: string, status: PayableStatus): boolean {
  if (status === "paid" || status === "cancelled") return false;
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

// ── Status badge ──────────────────────────────────────────────────────────────

function PayableStatusBadge({ status }: { status: PayableStatus }): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PAYABLE_STATUS_COLOR[status]}`}
    >
      {PAYABLE_STATUS_LABELS[status]}
    </span>
  );
}

// ── Summary cards ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  isLoading: boolean;
}

function SummaryCard({
  label,
  value,
  icon,
  iconBg,
  isLoading,
}: SummaryCardProps): React.ReactElement {
  return (
    <div className="rounded-md bg-white/5 shadow-card p-4 flex items-start gap-3">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-md shrink-0 ${iconBg}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/50 font-medium">{label}</p>
        {isLoading ? (
          <Skeleton className="h-6 w-20 mt-0.5" />
        ) : (
          <p className="text-xl font-bold text-white mt-0.5">{value}</p>
        )}
      </div>
    </div>
  );
}

// ── Record Payment Dialog ─────────────────────────────────────────────────────

interface RecordPaymentDialogProps {
  document: PayableDocumentListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RecordPaymentDialog({
  document,
  open,
  onOpenChange,
}: RecordPaymentDialogProps): React.ReactElement {
  const todayStr = new Date().toISOString().split("T")[0] ?? "";
  const recordPayment = useRecordPayment();

  const [amount, setAmount] = React.useState("");
  const [paymentDate, setPaymentDate] = React.useState(todayStr);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("pix");
  const [bankAccount, setBankAccount] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (document) {
      setAmount(document.amount_remaining);
      setPaymentDate(todayStr);
      setPaymentMethod("pix");
      setBankAccount("");
      setNotes("");
    }
  }, [document, todayStr]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!document) return;
    recordPayment.mutate(
      {
        documentId: document.id,
        payment_date: paymentDate,
        amount,
        payment_method: paymentMethod,
        bank_account: bankAccount || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const paymentMethods = Object.entries(PAYMENT_METHOD_LABELS) as [
    PaymentMethod,
    string,
  ][];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        {document && (
          <p className="text-sm text-white/50 -mt-2">
            {document.supplier_name} — {document.description}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-white/70">
              Valor a pagar *
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-white/70">
              Data do pagamento *
            </Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-white/70">
              Forma de pagamento *
            </Label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              {paymentMethods.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-white/70">
              Conta bancária
            </Label>
            <Input
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="Ex: Bradesco C/C 1234-5"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-white/70">
              Observações
            </Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Opcional..."
            />
          </div>

          {recordPayment.isError && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
              {recordPayment.error?.message || "Erro ao registrar pagamento."}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm text-white/50 hover:underline px-3 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={recordPayment.isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {recordPayment.isPending ? "Salvando..." : "Registrar Pagamento"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Cancel Dialog ─────────────────────────────────────────────────────────────

interface CancelDialogProps {
  document: PayableDocumentListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CancelDialog({
  document,
  open,
  onOpenChange,
}: CancelDialogProps): React.ReactElement {
  const cancelPayable = useCancelPayable();
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!document) return;
    cancelPayable.mutate(
      { id: document.id, reason },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancelar Título</DialogTitle>
        </DialogHeader>
        {document && (
          <p className="text-sm text-white/50 -mt-2">
            {document.supplier_name} — {formatBRL(document.amount)}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-white/70">
              Motivo do cancelamento *
            </Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Informe o motivo..."
            />
          </div>

          {cancelPayable.isError && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
              {cancelPayable.error?.message || "Erro ao cancelar título."}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm text-white/50 hover:underline px-3 py-2"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={cancelPayable.isPending || !reason.trim()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {cancelPayable.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Table skeleton ────────────────────────────────────────────────────────────

function TableSkeleton(): React.ReactElement {
  return (
    <div className="divide-y divide-neutral-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Filter types ──────────────────────────────────────────────────────────────

type FilterStatus = PayableStatus | "";
type FilterOrigin = PayableOrigin | "";

const STATUS_OPTIONS: [PayableStatus, string][] = Object.entries(
  PAYABLE_STATUS_LABELS
) as [PayableStatus, string][];

const ORIGIN_OPTIONS: [PayableOrigin, string][] = Object.entries(
  PAYABLE_ORIGIN_LABELS
) as [PayableOrigin, string][];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContasPagarPage(): React.ReactElement {
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

  const { data, isLoading } = usePayableDocuments(filters);

  const [payingDoc, setPayingDoc] =
    React.useState<PayableDocumentListItem | null>(null);
  const [cancellingDoc, setCancellingDoc] =
    React.useState<PayableDocumentListItem | null>(null);

  const documents = data?.results ?? [];

  // ── Summary computations ──────────────────────────────────────────────────
  // Use the unfiltered list for the summary (re-fetch without filters)
  const { data: allData, isLoading: isAllLoading } = usePayableDocuments({});
  const allDocs = allData?.results ?? [];

  const totalOpen = allDocs
    .filter((d) => d.status === "open" || d.status === "partial")
    .reduce((acc, d) => acc + Number(d.amount_remaining), 0);

  const totalOverdue = allDocs
    .filter((d) => isOverdue(d.due_date, d.status))
    .reduce((acc, d) => acc + Number(d.amount_remaining), 0);

  const paidThisMonth = allDocs
    .filter((d) => d.status === "paid" && isThisMonth(d.due_date))
    .reduce((acc, d) => acc + Number(d.amount_paid), 0);

  const dueToday = allDocs
    .filter(
      (d) =>
        isDueToday(d.due_date) &&
        (d.status === "open" || d.status === "partial")
    )
    .reduce((acc, d) => acc + Number(d.amount_remaining), 0);

  const canCancel = (s: PayableStatus): boolean =>
    s === "open" || s === "partial" || s === "overdue";

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Contas a Pagar
            </h1>
            <p className="mt-0.5 text-sm text-white/50">
              {data?.count ?? "—"} título
              {(data?.count ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href={"/financeiro/contas-pagar/novo" as Route}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Novo Título
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total em Aberto"
            value={formatBRL(String(totalOpen))}
            iconBg="bg-blue-100"
            icon={<TrendingDown className="h-5 w-5 text-blue-600" />}
            isLoading={isAllLoading}
          />
          <SummaryCard
            label="Total Vencido"
            value={formatBRL(String(totalOverdue))}
            iconBg="bg-red-100"
            icon={<AlertCircle className="h-5 w-5 text-red-600" />}
            isLoading={isAllLoading}
          />
          <SummaryCard
            label="Pago no Mês"
            value={formatBRL(String(paidThisMonth))}
            iconBg="bg-success-100"
            icon={<CheckCircle2 className="h-5 w-5 text-success-600" />}
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
            placeholder="Buscar fornecedor ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-60"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FilterStatus)}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todas as origens</option>
            {ORIGIN_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">Venc. de</span>
            <Input
              type="date"
              value={dueDateGte}
              onChange={(e) => setDueDateGte(e.target.value)}
              className="w-36"
            />
            <span className="text-xs text-white/50">até</span>
            <Input
              type="date"
              value={dueDateLte}
              onChange={(e) => setDueDateLte(e.target.value)}
              className="w-36"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md bg-white/5 shadow-card overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-2.5 bg-white/[0.03] border-b border-neutral-100 text-xs font-semibold text-white/50 uppercase tracking-wide">
            <span>Fornecedor</span>
            <span>Descrição</span>
            <span>Vencimento</span>
            <span className="text-right">Valor</span>
            <span className="text-right">Pago</span>
            <span className="text-right">Restante</span>
            <span>Status</span>
            <span>Ações</span>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : documents.length === 0 ? (
            <div className="py-16 text-center text-sm text-white/40">
              Nenhum título encontrado.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5 items-center text-sm hover:bg-white/[0.03] transition-colors"
                >
                  <span className="font-medium text-white truncate">
                    {doc.supplier_name}
                  </span>
                  <span className="text-white/60 truncate">
                    {doc.description}
                    {doc.document_number && (
                      <span className="ml-1 text-xs text-white/40">
                        #{doc.document_number}
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      isOverdue(doc.due_date, doc.status)
                        ? "text-red-600 font-medium"
                        : "text-white/60"
                    }
                  >
                    {formatDate(doc.due_date)}
                  </span>
                  <span className="text-right font-mono text-white">
                    {formatBRL(doc.amount)}
                  </span>
                  <span className="text-right font-mono text-success-700">
                    {formatBRL(doc.amount_paid)}
                  </span>
                  <span className="text-right font-mono text-white font-semibold">
                    {formatBRL(doc.amount_remaining)}
                  </span>
                  <div>
                    <PayableStatusBadge status={doc.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    {(doc.status === "open" ||
                      doc.status === "partial" ||
                      doc.status === "overdue") && (
                      <button
                        type="button"
                        onClick={() => setPayingDoc(doc)}
                        className="rounded-md bg-primary-50 border border-primary-200 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
                      >
                        Pagar
                      </button>
                    )}
                    {canCancel(doc.status) && (
                      <button
                        type="button"
                        onClick={() => setCancellingDoc(doc)}
                        className="rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
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
        document={payingDoc}
        open={payingDoc !== null}
        onOpenChange={(open) => {
          if (!open) setPayingDoc(null);
        }}
      />
      <CancelDialog
        document={cancellingDoc}
        open={cancellingDoc !== null}
        onOpenChange={(open) => {
          if (!open) setCancellingDoc(null);
        }}
      />
    </ErrorBoundary>
  );
}
