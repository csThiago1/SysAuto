"use client";

/**
 * Detalhe de Título a Pagar — histórico de pagamentos e ações.
 * Sprint 14
 */

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, FileText, User, Calendar, DollarSign } from "lucide-react";
import {
  usePayableDocument,
  useRecordPayment,
  useCancelPayable,
  usePermission,
} from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PayableStatus, PaymentMethod } from "@paddock/types";
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PayableStatus }): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PAYABLE_STATUS_COLOR[status]}`}
    >
      {PAYABLE_STATUS_LABELS[status]}
    </span>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────────

interface ValueCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  highlight?: boolean;
}

function ValueCard({
  label,
  value,
  icon,
  iconBg,
  highlight = false,
}: ValueCardProps): React.ReactElement {
  return (
    <div className="rounded-md bg-white/5 shadow-card p-4 flex items-start gap-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-md shrink-0 ${iconBg}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/50 font-medium">{label}</p>
        <p
          className={`text-lg font-bold mt-0.5 ${
            highlight ? "text-primary-700" : "text-white"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Page skeleton ──────────────────────────────────────────────────────────────

function PageSkeleton(): React.ReactElement {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-64" />
      <div className="rounded-md bg-white/5 shadow-card p-5 space-y-3">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-md" />
    </div>
  );
}

// ── Record Payment Dialog ─────────────────────────────────────────────────────

interface RecordPaymentDialogProps {
  documentId: string;
  amountRemaining: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RecordPaymentDialog({
  documentId,
  amountRemaining,
  open,
  onOpenChange,
}: RecordPaymentDialogProps): React.ReactElement {
  const todayStr = new Date().toISOString().split("T")[0] ?? "";
  const recordPayment = useRecordPayment();

  const [amount, setAmount] = React.useState(amountRemaining);
  const [paymentDate, setPaymentDate] = React.useState(todayStr);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("pix");
  const [bankAccount, setBankAccount] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setAmount(amountRemaining);
      setPaymentDate(todayStr);
      setPaymentMethod("pix");
      setBankAccount("");
      setNotes("");
    }
  }, [open, amountRemaining, todayStr]);

  const maxAmount = parseFloat(amountRemaining);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    recordPayment.mutate(
      {
        documentId,
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
        <p className="text-sm text-white/50 -mt-2">
          Saldo restante: <strong>{formatBRL(amountRemaining)}</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-white/70">
              Valor a pagar *
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={maxAmount}
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
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CancelDialog({
  documentId,
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
    cancelPayable.mutate(
      { id: documentId, reason },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancelar Título</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-white/50 -mt-2">
          Esta ação não pode ser desfeita.
        </p>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContaPagarDetailPage(): React.ReactElement {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: doc, isLoading, isError, error } = usePayableDocument(id);
  const isManager = usePermission("MANAGER");

  const [payDialogOpen, setPayDialogOpen] = React.useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);

  const canPay =
    doc !== undefined &&
    doc.status !== "paid" &&
    doc.status !== "cancelled";

  const canCancel =
    doc !== undefined &&
    (doc.status === "open" || doc.status === "partial" || doc.status === "overdue");

  if (isLoading) return <PageSkeleton />;

  if (isError || doc === undefined) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
        {error?.message ?? "Não foi possível carregar o título."}
      </div>
    );
  }

  const paymentMethods = Object.entries(PAYMENT_METHOD_LABELS) as [
    PaymentMethod,
    string,
  ][];

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Link
            href={"/financeiro" as Route}
            className="hover:text-primary-600 transition-colors"
          >
            Financeiro
          </Link>
          <span>/</span>
          <Link
            href={"/financeiro/contas-pagar" as Route}
            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Contas a Pagar
          </Link>
          <span>/</span>
          <span className="text-white truncate max-w-xs">
            {doc.document_number || doc.description}
          </span>
        </div>

        {/* Header card */}
        <div className="rounded-md bg-white/5 shadow-card p-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white truncate">
                  {doc.description}
                </h1>
                <StatusBadge status={doc.status} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/50">
                {doc.document_number && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {doc.document_number}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {doc.supplier_name}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Vence em {formatDate(doc.due_date)}
                </span>
                <span className="text-xs text-white/40">
                  {PAYABLE_ORIGIN_LABELS[doc.origin]}
                </span>
              </div>
              {doc.notes && (
                <p className="text-xs text-white/40 pt-1">{doc.notes}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {canPay && (
                <button
                  type="button"
                  onClick={() => setPayDialogOpen(true)}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
                >
                  Registrar Pagamento
                </button>
              )}
              {canCancel && isManager && (
                <button
                  type="button"
                  onClick={() => setCancelDialogOpen(true)}
                  className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                >
                  Cancelar Título
                </button>
              )}
            </div>
          </div>

          {doc.cancelled_at && (
            <div className="mt-3 rounded-md bg-white/[0.03] border border-white/10 px-4 py-2.5 text-xs text-white/60">
              <span className="font-medium">Cancelado em</span>{" "}
              {formatDateTime(doc.cancelled_at)}
              {doc.cancel_reason && (
                <> — <span className="italic">{doc.cancel_reason}</span></>
              )}
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ValueCard
            label="Valor Original"
            value={formatBRL(doc.amount)}
            iconBg="bg-blue-100"
            icon={<DollarSign className="h-4 w-4 text-blue-600" />}
          />
          <ValueCard
            label="Valor Pago"
            value={formatBRL(doc.amount_paid)}
            iconBg="bg-success-100"
            icon={<DollarSign className="h-4 w-4 text-success-600" />}
          />
          <ValueCard
            label="Saldo Restante"
            value={formatBRL(doc.amount_remaining)}
            iconBg="bg-amber-100"
            icon={<DollarSign className="h-4 w-4 text-amber-600" />}
            highlight={parseFloat(doc.amount_remaining) > 0}
          />
          <ValueCard
            label="Vencimento"
            value={formatDate(doc.due_date)}
            iconBg="bg-white/5"
            icon={<Calendar className="h-4 w-4 text-white/50" />}
          />
        </div>

        {/* Payment history */}
        <div className="rounded-md bg-white/5 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-white">
              Histórico de Pagamentos
            </h2>
          </div>

          {doc.payments.length === 0 ? (
            <div className="py-12 text-center text-sm text-white/40">
              Nenhum pagamento registrado ainda.
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_1.5fr_2fr] gap-4 px-5 py-2.5 bg-white/[0.03] border-b border-neutral-100 text-xs font-semibold text-white/50 uppercase tracking-wide">
                <span>Data</span>
                <span className="text-right">Valor</span>
                <span>Forma</span>
                <span>Observações</span>
              </div>
              <div className="divide-y divide-neutral-100">
                {doc.payments.map((payment) => {
                  const methodLabel =
                    paymentMethods.find(([v]) => v === payment.payment_method)?.[1] ??
                    payment.payment_method;
                  return (
                    <div
                      key={payment.id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.5fr_2fr] gap-4 px-5 py-3.5 items-center text-sm"
                    >
                      <span className="text-white/70">
                        {formatDate(payment.payment_date)}
                      </span>
                      <span className="text-right font-mono font-semibold text-white">
                        {formatBRL(payment.amount)}
                      </span>
                      <span className="text-white/60">{methodLabel}</span>
                      <span className="text-white/40 truncate">
                        {payment.notes || "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {canPay && (
        <RecordPaymentDialog
          documentId={doc.id}
          amountRemaining={doc.amount_remaining}
          open={payDialogOpen}
          onOpenChange={setPayDialogOpen}
        />
      )}
      {canCancel && isManager && (
        <CancelDialog
          documentId={doc.id}
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
        />
      )}
    </ErrorBoundary>
  );
}
