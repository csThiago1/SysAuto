"use client";

/**
 * Contas a Receber — Lista de títulos com resumo e ações de recebimento.
 * Sprint 14
 */

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { NativeSelect } from "@/components/ui/native-select";
import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { PlusCircle, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useReceivableDocuments, useReceivableSummary, useRecordReceipt, useRecordReceiptsBatch, useCancelReceivable } from "@/hooks/useFinanceiro";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  SummaryCard,
  FinanceiroStatusBadge,
  RecordPaymentDialog,
  ReceiveBatchDialog,
  CancelDialog,
  FinanceiroTableSkeleton,
} from "@/components/financeiro";
import { type Selection, hasBalance, headerState, reconcile, toggle, toggleAll, total } from "./_lib/selection";
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

// Limite de títulos por chamada da baixa em lote (contrato da API).
const BATCH_MAX = 200;

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
  const isManager = usePermission("MANAGER");
  const recordReceipt = useRecordReceipt();
  const cancelReceivable = useCancelReceivable();

  const [receivingDoc, setReceivingDoc] =
    React.useState<ReceivableDocumentListItem | null>(null);
  const [cancellingDoc, setCancellingDoc] =
    React.useState<ReceivableDocumentListItem | null>(null);
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);

  const documents = data?.results ?? [];

  // ── Seleção para baixa em lote: por id, sobrevive à troca de busca e filtro ──
  const receiveBatch = useRecordReceiptsBatch();
  const [selection, setSelection] = React.useState<Selection>({});
  const [batchOpen, setBatchOpen] = React.useState(false);

  // carga anterior e o filtro dela: sumir da lista sem trocar de filtro é baixa ou cancelamento
  const lastLoad = React.useRef<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const filterKey = JSON.stringify(filters);
  React.useEffect(() => {
    if (!data) return;
    const ids = data.results.map((d) => d.id);
    const previous = lastLoad.current;
    const gone = previous.key === filterKey ? previous.ids.filter((id) => !ids.includes(id)) : [];
    lastLoad.current = { key: filterKey, ids };
    setSelection((current) => reconcile(current, data.results, gone));
  }, [data, filterKey]);

  const selectedCount = Object.keys(selection).length;
  const selectionSummary = `${selectedCount} título${selectedCount !== 1 ? "s" : ""} · ${brl.format(total(selection))}`;
  const selectionBarVisible = isManager && selectedCount > 0;

  // ── Summary computations ──────────────────────────────────────────────────
  const { data: summary, isLoading: isAllLoading } = useReceivableSummary();

  const canCancel = (s: ReceivableStatus): boolean =>
    s === "open" || s === "partial" || s === "overdue";

  return (
    <ErrorBoundary>
      {/* folga embaixo enquanto a barra de seleção existe: ela não cobre a última linha */}
      <div className={cn("space-y-5", selectionBarVisible && "pb-44 md:pb-20")}>
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
          <div
            className={cn(
              // celular: o cabeçalho aparece só para o gerente, e só com o "selecionar todos"
              isManager ? "flex max-md:[&>span]:hidden" : "hidden",
              "md:grid grid-cols-[2fr_3fr_1fr_1fr_1fr_1fr_1fr_2rem] gap-3 px-5 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            )}
          >
            {isManager ? (
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-3">
                  {/* área de toque de 44px sem aumentar a linha */}
                  <span className="-m-2.5 flex h-11 w-11 items-center justify-center md:-my-3.5">
                    <Checkbox
                      checked={headerState(selection, documents)}
                      onCheckedChange={() => setSelection((current) => toggleAll(current, documents))}
                      disabled={!documents.some(hasBalance)}
                      aria-label="Selecionar todos os títulos com saldo da lista"
                    />
                  </span>
                  <span className="md:hidden">Selecionar todos</span>
                </label>
                <span className="max-md:hidden">Cliente</span>
              </div>
            ) : (
              <span>Cliente</span>
            )}
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
                  className="grid grid-cols-1 md:grid-cols-[2fr_3fr_1fr_1fr_1fr_1fr_1fr_2rem] gap-3 px-5 py-3.5 items-center text-sm hover:bg-muted/30 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {isManager &&
                      (hasBalance(doc) ? (
                        <label className="-mx-2.5 -my-3 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                          <Checkbox
                            checked={doc.id in selection}
                            onCheckedChange={() => setSelection((current) => toggle(current, doc))}
                            aria-label={`Selecionar título de ${doc.customer_name}`}
                          />
                        </label>
                      ) : (
                        <span className="w-6 shrink-0" />
                      ))}
                    <Link
                      href={`/financeiro/contas-receber/${doc.id}` as Route}
                      className="font-medium text-foreground truncate hover:underline"
                    >
                      {doc.customer_name}
                    </Link>
                  </div>
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
                    {/* Receber e Cancelar valem para os mesmos status e só para gerente: sem item, sem gatilho */}
                    {isManager && canCancel(doc.status) && (
                      <>
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
                              <button
                                type="button"
                                onClick={() => { setReceivingDoc(doc); setOpenMenu(null); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-foreground/70 hover:bg-muted/50 transition-colors"
                              >
                                Receber
                              </button>
                              <button
                                type="button"
                                onClick={() => { setCancellingDoc(doc); setOpenMenu(null); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-error-400/80 hover:bg-muted/50 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Barra de seleção: fixa, acima da barra de abas no celular e ao lado da navegação no desktop.
          No celular para 76px antes da borda direita: é onde fica o botão flutuante de Nova OS. */}
      {selectionBarVisible && (
        <div
          role="region"
          aria-label="Títulos selecionados"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-2 right-[76px] z-30 md:bottom-6 md:left-60 md:right-0 md:px-6"
        >
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
            <p className="min-w-0 flex-1 font-mono text-sm font-semibold tabular-nums text-foreground">
              {selectionSummary}
              {selectedCount > BATCH_MAX && (
                <span className="block font-sans text-xs font-normal text-warning-400">
                  Máximo de {BATCH_MAX} títulos por baixa.
                </span>
              )}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelection({})}>
              Limpar
            </Button>
            <Button
              type="button"
              className="max-md:w-full"
              disabled={selectedCount > BATCH_MAX}
              onClick={() => setBatchOpen(true)}
            >
              Receber selecionados
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ReceiveBatchDialog
        count={selectedCount}
        summary={selectionSummary}
        open={batchOpen}
        onOpenChange={(open) => {
          // com a baixa em andamento o diálogo não fecha: o resultado tem que aparecer
          if (receiveBatch.isPending) return;
          setBatchOpen(open);
          if (!open) receiveBatch.reset();
        }}
        onSubmit={(data) => {
          receiveBatch.mutate(
            { document_ids: Object.keys(selection), ...data },
            {
              onSuccess: (result) => {
                // o servidor baixa pelo saldo de agora, que pode não ser o que estava na tela
                if (Number(result.total) !== total(selection)) {
                  toast.warning(
                    `O saldo mudou desde a seleção: foram baixados ${brl.format(Number(result.total))}, e não ${brl.format(total(selection))}.`
                  );
                }
                setBatchOpen(false);
                setSelection({});
              },
            }
          );
        }}
        isPending={receiveBatch.isPending}
        isError={receiveBatch.isError}
        errorMessage={receiveBatch.error?.message}
      />
      <RecordPaymentDialog
        document={receivingDoc}
        open={receivingDoc !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReceivingDoc(null);
            recordReceipt.reset();
          }
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
        noun="recebimento"
      />
      <CancelDialog
        entityName={cancellingDoc?.customer_name ?? ""}
        amount={cancellingDoc?.amount ?? "0"}
        open={cancellingDoc !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingDoc(null);
            cancelReceivable.reset();
          }
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
