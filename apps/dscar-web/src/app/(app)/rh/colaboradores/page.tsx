"use client";

/**
 * Colaboradores — Lista paginada com filtros por status e setor.
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useEmployees } from "@/hooks";
import { useDebounce } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { EmployeeTable, EmployeeTableSkeleton } from "./_components/EmployeeTable";
import type { EmployeeStatus, HRDepartment } from "@paddock/types";
import { DEPARTMENT_LABELS } from "@paddock/types";

type FilterStatus = EmployeeStatus | "";
type FilterDepartment = HRDepartment | "";

export default function ColaboradoresPage(): React.ReactElement {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<FilterStatus>("active");
  const [department, setDepartment] = React.useState<FilterDepartment>("");

  const debouncedSearch = useDebounce(search, 300);

  const filters: Record<string, string> = {};
  if (status) filters.status = status;
  if (department) filters.department = department;
  if (debouncedSearch) filters.search = debouncedSearch;

  const { data, isLoading } = useEmployees(filters);

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Colaboradores
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data?.count ?? "—"} colaborador
              {(data?.count ?? 0) !== 1 ? "es" : ""}
            </p>
          </div>
          <Link
            href={"/rh/colaboradores/novo" as Route}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-primary-700 transition-colors"
          >
            + Admitir
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por nome ou matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FilterStatus)}
            className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="on_leave">Afastados</option>
            <option value="vacation">Férias</option>
            <option value="terminated">Desligados</option>
          </select>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value as FilterDepartment)}
            className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos os setores</option>
            {(
              Object.entries(DEPARTMENT_LABELS) as [HRDepartment, string][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-md bg-muted/50 shadow-card overflow-hidden">
          {isLoading ? (
            <EmployeeTableSkeleton />
          ) : (
            <EmployeeTable employees={data?.results ?? []} />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
