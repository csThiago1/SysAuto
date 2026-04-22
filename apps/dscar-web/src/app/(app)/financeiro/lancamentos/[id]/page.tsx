"use client";

/**
 * Detalhe do Lançamento Contábil — visualizacao, aprovacao e estorno.
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, CheckCircle, RotateCcw } from "lucide-react";
import { useParams } from "next/navigation";
import { useJournalEntry, useApproveJournalEntry, useReverseJournalEntry } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ORIGIN_LABELS } from "@paddock/types";

// ── Currency formatter ────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatBRL(value: string): string {
  const n = parseFloat(value);
  return isNaN(n) ? value : brl.format(n);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LancamentoDetailPage(): React.ReactElement {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: entry, isLoading } = useJournalEntry(id);
  const approve = useApproveJournalEntry();
  const reverse = useReverseJournalEntry();

  const [reverseOpen, setReverseOpen] = React.useState(false);
  const [reverseReason, setReverseReason] = React.useState("");
  const [reverseError, setReverseError] = React.useState("");

  const handleApprove = (): void => {
    approve.mutate(id);
  };

  const handleReverse = (): void => {
    if (!reverseReason.trim()) {
      setReverseError("Motivo do estorno obrigatorio.");
      return;
    }
    reverse.mutate(
      { id, description: reverseReason.trim() },
      {
        onSuccess: () => {
          setReverseOpen(false);
          setReverseReason("");
          setReverseError("");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-3xl">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="rounded-md bg-white/5 shadow-card p-8 text-center text-white/50">
        <p className="text-sm">Lançamento não encontrado.</p>
        <Link
          href={"/financeiro/lancamentos" as Route}
          className="text-primary-600 text-sm hover:underline mt-2 inline-block"
        >
          Voltar para lançamentos
        </Link>
      </div>
    );
  }

  const totalDebit = parseFloat(entry.total_debit);
  const totalCredit = parseFloat(entry.total_credit);

  return (
    <ErrorBoundary>
      <div className="space-y-5 max-w-3xl">
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
            href={"/financeiro/lancamentos" as Route}
            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Lançamentos
          </Link>
          <span>/</span>
          <span className="font-mono text-white">{entry.number}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white font-mono">
                {entry.number}
              </h1>
              {entry.is_reversed && (
                <Badge variant="destructive">Estornado</Badge>
              )}
              {!entry.is_reversed && entry.is_approved && (
                <Badge variant="success">Aprovado</Badge>
              )}
              {!entry.is_reversed && !entry.is_approved && (
                <Badge variant="warning">Pendente</Badge>
              )}
              {entry.is_balanced ? (
                <Badge variant="success">Balanceado</Badge>
              ) : (
                <Badge variant="destructive">Desbalanceado</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-white/60">{entry.description}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!entry.is_approved && !entry.is_reversed && (
              <button
                onClick={handleApprove}
                disabled={approve.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-success-600 px-3 py-2 text-sm font-medium text-white hover:bg-success-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                {approve.isPending ? "Aprovando..." : "Aprovar"}
              </button>
            )}
            {entry.is_approved && !entry.is_reversed && (
              <button
                onClick={() => setReverseOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Estornar
              </button>
            )}
          </div>
        </div>

        {/* Info section */}
        <div className="rounded-md bg-white/5 shadow-card p-5">
          <h2 className="text-sm font-semibold text-white border-b border-neutral-100 pb-2 mb-4">
            Informacoes
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-white/50">Data de Competencia</dt>
              <dd className="font-medium text-white mt-0.5">
                {new Date(`${entry.competence_date}T12:00:00`).toLocaleDateString("pt-BR")}
              </dd>
            </div>
            {entry.document_date && (
              <div>
                <dt className="text-white/50">Data do Documento</dt>
                <dd className="font-medium text-white mt-0.5">
                  {new Date(`${entry.document_date}T12:00:00`).toLocaleDateString("pt-BR")}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-white/50">Origem</dt>
              <dd className="font-medium text-white mt-0.5">
                {ORIGIN_LABELS[entry.origin] ?? entry.origin}
              </dd>
            </div>
            <div>
              <dt className="text-white/50">Periodo Fiscal</dt>
              <dd className="font-medium text-white mt-0.5">
                {entry.fiscal_period_label}
              </dd>
            </div>
            <div>
              <dt className="text-white/50">Criado em</dt>
              <dd className="font-medium text-white mt-0.5">
                {new Date(entry.created_at).toLocaleString("pt-BR")}
              </dd>
            </div>
          </dl>
        </div>

        {/* Lines table */}
        <div className="rounded-md bg-white/5 shadow-card overflow-hidden">
          <div className="p-5 pb-3">
            <h2 className="text-sm font-semibold text-white">
              Partidas ({entry.lines.length} linha{entry.lines.length !== 1 ? "s" : ""})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-neutral-100 bg-white/[0.03]">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/50 uppercase tracking-wide">
                    Conta
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/50 uppercase tracking-wide">
                    Centro de Custo
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-white/50 uppercase tracking-wide">
                    Debito
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-white/50 uppercase tracking-wide">
                    Credito
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-white/50 uppercase tracking-wide">
                    Descricao
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {entry.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-neutral-50/50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-white/50">
                        {line.account.code}
                      </span>{" "}
                      <span className="text-white">{line.account.name}</span>
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {line.cost_center
                        ? `${line.cost_center.code} — ${line.cost_center.name}`
                        : <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white/70">
                      {parseFloat(line.debit_amount) > 0
                        ? formatBRL(line.debit_amount)
                        : <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white/70">
                      {parseFloat(line.credit_amount) > 0
                        ? formatBRL(line.credit_amount)
                        : <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-white/60 max-w-xs truncate">
                      {line.description || <span className="text-white/30">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/10 bg-white/[0.03]">
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-white/70">
                    Totais
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                    {brl.format(totalDebit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                    {brl.format(totalCredit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entry.is_balanced ? (
                      <Badge variant="success">Balanceado</Badge>
                    ) : (
                      <Badge variant="destructive">Desbalanceado</Badge>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Reverse dialog */}
      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estornar Lançamento</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-white/60">
              Esta ação ira criar um lançamento de estorno automaticamente. O lançamento original
              sera marcado como estornado e sera imutavel.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-white/70">
                Motivo do estorno *
              </Label>
              <Input
                value={reverseReason}
                onChange={(e) => {
                  setReverseReason(e.target.value);
                  setReverseError("");
                }}
                placeholder="Descreva o motivo do estorno..."
                autoFocus
              />
              {reverseError && (
                <p className="text-xs text-red-600">{reverseError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setReverseOpen(false);
                setReverseReason("");
                setReverseError("");
              }}
              className="text-sm text-white/50 hover:underline px-3 py-2"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleReverse}
              disabled={reverse.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {reverse.isPending ? "Estornando..." : "Confirmar Estorno"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}
