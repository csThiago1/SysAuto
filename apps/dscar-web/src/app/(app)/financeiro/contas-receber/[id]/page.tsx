"use client";

/**
 * Detalhe de Titulo a Receber — historico de recebimentos e acoes.
 * Sprint 14 — refatorado S2-T3 para usar componentes compartilhados.
 */

import React from "react";
import { useParams } from "next/navigation";
import { FileText, User, Calendar, DollarSign } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  useReceivableDocument,
  useRecordReceipt,
  useCancelReceivable,
} from "@/hooks/useFinanceiro";
import { usePermission } from "@/hooks/usePermission";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RecordPaymentDialog,
  CancelDialog,
  FinanceiroStatusBadge,
} from "@/components/financeiro";
import type { PaymentMethod } from "@paddock/types";
import {
  RECEIVABLE_STATUS_LABELS,
  RECEIVABLE_STATUS_COLOR,
  RECEIVABLE_ORIGIN_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@paddock/types";
import { formatDate, formatDateTime } from "@paddock/utils";

// ── Formatting helpers ────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatBRL(value: string): string {
  return brl.format(Number(value));
}

// ── Summary card ──────────────────────────────────────────────────────────────

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
    <div className="rounded-md bg-muted/50 shadow-card p-4 flex items-start gap-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-md shrink-0 ${iconBg}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p
          className={`text-lg font-bold mt-0.5 ${
            highlight ? "text-success-400" : "text-foreground"
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
      <div className="rounded-md bg-muted/50 shadow-card p-5 space-y-3">
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContaReceberDetailPage(): React.ReactElement {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: doc, isLoading, isError, error } = useReceivableDocument(id);
  const isManager = usePermission("MANAGER");
  const recordReceipt = useRecordReceipt();
  const cancelReceivable = useCancelReceivable();

  const [receiptDialogOpen, setReceiptDialogOpen] = React.useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);

  const canReceive =
    doc !== undefined &&
    doc.status !== "received" &&
    doc.status !== "cancelled";

  const canCancel =
    doc !== undefined &&
    (doc.status === "open" || doc.status === "partial" || doc.status === "overdue");

  if (isLoading) return <PageSkeleton />;

  if (isError || doc === undefined) {
    return (
      <div className="rounded-md bg-error-500/10 border border-error-500/20 px-5 py-4 text-sm text-error-400">
        {error?.message ?? "Nao foi possivel carregar o titulo."}
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
        <Breadcrumb
          items={[
            { label: "Financeiro", href: "/financeiro" },
            { label: "Contas a Receber", href: "/financeiro/contas-receber" },
            { label: `Titulo #${doc.document_number || id}` },
          ]}
        />

        {/* Header card */}
        <div className="rounded-md bg-muted/50 shadow-card p-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground truncate">
                  {doc.description}
                </h1>
                <FinanceiroStatusBadge
                  status={doc.status}
                  labels={RECEIVABLE_STATUS_LABELS}
                  colors={RECEIVABLE_STATUS_COLOR}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {doc.document_number && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {doc.document_number}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {doc.customer_name}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Vence em {formatDate(doc.due_date)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {RECEIVABLE_ORIGIN_LABELS[doc.origin]}
                </span>
              </div>
              {doc.notes && (
                <p className="text-xs text-muted-foreground pt-1">{doc.notes}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {canReceive && (
                <button
                  type="button"
                  onClick={() => setReceiptDialogOpen(true)}
                  className="rounded-md bg-success-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-success-700 transition-colors"
                >
                  Registrar Recebimento
                </button>
              )}
              {canCancel && isManager && (
                <button
                  type="button"
                  onClick={() => setCancelDialogOpen(true)}
                  className="rounded-md border border-error-500/20 bg-error-500/10 px-4 py-2 text-sm font-medium text-error-400 hover:bg-error-500/20 transition-colors"
                >
                  Cancelar Titulo
                </button>
              )}
            </div>
          </div>

          {doc.cancelled_at && (
            <div className="mt-3 rounded-md bg-muted/30 border border-border px-4 py-2.5 text-xs text-foreground/60">
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
            iconBg="bg-muted/50"
            icon={<DollarSign className="h-4 w-4 text-foreground/70" />}
          />
          <ValueCard
            label="Valor Recebido"
            value={formatBRL(doc.amount_received)}
            iconBg="bg-success-500/10"
            icon={<DollarSign className="h-4 w-4 text-success-400" />}
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
            iconBg="bg-muted/50"
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          />
        </div>

        {/* Receipt history */}
        <div className="rounded-md bg-muted/50 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              Historico de Recebimentos
            </h2>
          </div>

          {doc.receipts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum recebimento registrado ainda.
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_1.5fr_2fr] gap-4 px-5 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Data</span>
                <span className="text-right">Valor</span>
                <span>Forma</span>
                <span>Observacoes</span>
              </div>
              <div className="divide-y divide-white/5">
                {doc.receipts.map((receipt) => {
                  const methodLabel =
                    paymentMethods.find(
                      ([v]) => v === receipt.payment_method
                    )?.[1] ?? receipt.payment_method;
                  return (
                    <div
                      key={receipt.id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.5fr_2fr] gap-4 px-5 py-3.5 items-center text-sm"
                    >
                      <span className="text-foreground/70">
                        {formatDate(receipt.receipt_date)}
                      </span>
                      <span className="text-right font-mono font-semibold text-foreground">
                        {formatBRL(receipt.amount)}
                      </span>
                      <span className="text-foreground/60">{methodLabel}</span>
                      <span className="text-muted-foreground truncate">
                        {receipt.notes || "—"}
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
      {canReceive && (
        <RecordPaymentDialog
          document={{
            id: doc.id,
            amount_remaining: doc.amount_remaining,
            customer_name: doc.customer_name,
            description: doc.description,
          }}
          open={receiptDialogOpen}
          onOpenChange={setReceiptDialogOpen}
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
              { onSuccess: () => setReceiptDialogOpen(false) }
            );
          }}
          isPending={recordReceipt.isPending}
          isError={recordReceipt.isError}
          errorMessage={recordReceipt.error?.message}
          title="Registrar Recebimento"
          submitLabel="Registrar Recebimento"
          amountLabel="Valor a receber *"
        />
      )}
      {canCancel && isManager && (
        <CancelDialog
          entityName={doc.customer_name}
          amount={doc.amount}
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          onSubmit={(reason) => {
            cancelReceivable.mutate(
              { id: doc.id, reason },
              { onSuccess: () => setCancelDialogOpen(false) }
            );
          }}
          isPending={cancelReceivable.isPending}
          isError={cancelReceivable.isError}
          errorMessage={cancelReceivable.error?.message}
        />
      )}
    </ErrorBoundary>
  );
}
