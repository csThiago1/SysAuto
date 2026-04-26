"use client";

/**
 * JournalEntryTable — Tabela de lançamentos contábeis com badges de status.
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ReceiptText } from "lucide-react";
import type { JournalEntryListItem } from "@paddock/types";
import { ORIGIN_LABELS } from "@paddock/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Currency formatter ────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatBRL(value: string): string {
  const n = parseFloat(value);
  return isNaN(n) ? value : brl.format(n);
}

// ── Status badge ──────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  isApproved: boolean;
  isReversed: boolean;
}

function StatusBadge({ isApproved, isReversed }: StatusBadgeProps): React.ReactElement {
  if (isReversed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-error-500/10 text-error-400 border border-error-500/20">
        Estornado
      </span>
    );
  }
  if (isApproved) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-success-500/10 text-success-400 border border-success-500/20">
        <span>&#10003;</span> Aprovado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-warning-500/10 text-warning-400 border border-warning-500/20">
      Pendente
    </span>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

interface JournalEntryTableProps {
  entries: JournalEntryListItem[];
}

export function JournalEntryTable({ entries }: JournalEntryTableProps): React.ReactElement {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/40">
        <ReceiptText className="h-10 w-10" />
        <p className="text-sm font-medium">Nenhum lançamento encontrado</p>
        <p className="text-xs">Ajuste os filtros ou crie um novo lançamento.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            <th className="text-left px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">
              Número
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">
              Data
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">
              Descrição
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">
              Origem
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">
              Débito
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">
              Crédito
            </th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className={cn(
                "hover:bg-white/[0.03] transition-colors cursor-pointer",
                entry.is_reversed && "opacity-60"
              )}
            >
              <td className="px-4 py-3">
                <Link
                  href={`/financeiro/lancamentos/${entry.id}` as Route}
                  className="font-mono text-xs text-primary-600 hover:text-primary-800 font-semibold"
                >
                  {entry.number}
                </Link>
              </td>
              <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                {new Date(`${entry.competence_date}T12:00:00`).toLocaleDateString("pt-BR")}
              </td>
              <td className="px-4 py-3 text-white max-w-xs truncate">
                <Link
                  href={`/financeiro/lancamentos/${entry.id}` as Route}
                  className="hover:text-primary-600 transition-colors"
                >
                  {entry.description}
                </Link>
              </td>
              <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                {ORIGIN_LABELS[entry.origin] ?? entry.origin}
              </td>
              <td className="px-4 py-3 text-right font-mono text-white/70 whitespace-nowrap">
                {formatBRL(entry.total_debit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-white/70 whitespace-nowrap">
                {formatBRL(entry.total_credit)}
              </td>
              <td className="px-4 py-3 text-center">
                <StatusBadge
                  isApproved={entry.is_approved}
                  isReversed={entry.is_reversed}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function JournalEntryTableSkeleton(): React.ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {["Número", "Data", "Descrição", "Origem", "Débito", "Crédito", "Status"].map(
              (col) => (
                <th
                  key={col}
                  className="text-left px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wide"
                >
                  {col}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-24 ml-auto" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-24 ml-auto" /></td>
              <td className="px-4 py-3"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
