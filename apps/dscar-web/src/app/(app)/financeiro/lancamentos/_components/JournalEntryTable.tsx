"use client";

/**
 * JournalEntryTable — Tabela de lançamentos contábeis com badges de status.
 */

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
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
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <ReceiptText className="h-10 w-10" />
        <p className="text-sm font-medium">Nenhum lançamento encontrado</p>
        <p className="text-xs">Ajuste os filtros ou crie um novo lançamento.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>
              Número
            </TableHead>
            <TableHead>
              Data
            </TableHead>
            <TableHead>
              Descrição
            </TableHead>
            <TableHead>
              Origem
            </TableHead>
            <TableHead className="text-right">
              Débito
            </TableHead>
            <TableHead className="text-right">
              Crédito
            </TableHead>
            <TableHead className="text-center">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow
              key={entry.id}
              className={cn(
                "cursor-pointer",
                entry.is_reversed && "opacity-60"
              )}
            >
              <TableCell>
                <Link
                  href={`/financeiro/lancamentos/${entry.id}` as Route}
                  className="font-mono text-xs text-primary hover:text-primary/80 font-semibold"
                >
                  {entry.number}
                </Link>
              </TableCell>
              <TableCell className="text-foreground/60 whitespace-nowrap">
                {new Date(`${entry.competence_date}T12:00:00`).toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell className="text-foreground max-w-xs truncate">
                <Link
                  href={`/financeiro/lancamentos/${entry.id}` as Route}
                  className="hover:text-primary transition-colors"
                >
                  {entry.description}
                </Link>
              </TableCell>
              <TableCell className="text-foreground/60 whitespace-nowrap">
                {ORIGIN_LABELS[entry.origin] ?? entry.origin}
              </TableCell>
              <TableCell className="text-right font-mono text-foreground/70 whitespace-nowrap">
                {formatBRL(entry.total_debit)}
              </TableCell>
              <TableCell className="text-right font-mono text-foreground/70 whitespace-nowrap">
                {formatBRL(entry.total_credit)}
              </TableCell>
              <TableCell className="text-center">
                <StatusBadge
                  isApproved={entry.is_approved}
                  isReversed={entry.is_reversed}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function JournalEntryTableSkeleton(): React.ReactElement {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            {["Número", "Data", "Descrição", "Origem", "Débito", "Crédito", "Status"].map(
              (col) => (
                <TableHead
                  key={col}
                >
                  {col}
                </TableHead>
              )
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-48" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20 mx-auto rounded-full" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
