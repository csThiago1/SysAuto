"use client";

/**
 * Lançamentos Contábeis — Lista paginada com filtros.
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { PlusCircle } from "lucide-react";
import { useJournalEntries } from "@/hooks";
import { useDebounce } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import {
  JournalEntryTable,
  JournalEntryTableSkeleton,
} from "./_components/JournalEntryTable";
import type { JournalEntryOrigin } from "@paddock/types";
import { ORIGIN_LABELS } from "@paddock/types";

type FilterOrigin = JournalEntryOrigin | "";
type FilterApproved = "true" | "false" | "";

const ORIGINS = Object.entries(ORIGIN_LABELS) as [JournalEntryOrigin, string][];

export default function LancamentosPage(): React.ReactElement {
  const [search, setSearch] = React.useState("");
  const [origin, setOrigin] = React.useState<FilterOrigin>("");
  const [isApproved, setIsApproved] = React.useState<FilterApproved>("");
  const [dateStart, setDateStart] = React.useState("");
  const [dateEnd, setDateEnd] = React.useState("");

  const debouncedSearch = useDebounce(search, 300);

  const filters: Record<string, string> = {};
  if (debouncedSearch) filters.search = debouncedSearch;
  if (origin) filters.origin = origin;
  if (isApproved !== "") filters.is_approved = isApproved;
  if (dateStart) filters.competence_date__gte = dateStart;
  if (dateEnd) filters.competence_date__lte = dateEnd;

  const { data, isLoading } = useJournalEntries(filters);

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Lançamentos Contábeis
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data?.count ?? "—"} lançamento{(data?.count ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href={"/financeiro/lancamentos/novo" as Route}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-primary-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Novo Lançamento
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar lançamentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value as FilterOrigin)}
            className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todas as origens</option>
            {ORIGINS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={isApproved}
            onChange={(e) => setIsApproved(e.target.value as FilterApproved)}
            className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos os status</option>
            <option value="true">Aprovados</option>
            <option value="false">Pendentes</option>
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">De</span>
            <Input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-36"
            />
            <span className="text-xs text-muted-foreground">Até</span>
            <Input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-36"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md bg-muted/50 shadow-card overflow-hidden">
          {isLoading ? (
            <JournalEntryTableSkeleton />
          ) : (
            <JournalEntryTable entries={data?.results ?? []} />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
