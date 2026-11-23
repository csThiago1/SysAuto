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
import { NativeSelect } from "@/components/ui/native-select"
import { Button } from "@/components/ui/button"

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
            <h1 className="page-title">
              Colaboradores
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data?.count ?? "—"} colaborador
              {(data?.count ?? 0) !== 1 ? "es" : ""}
            </p>
          </div>
          <Button asChild>
            <Link
              href={"/rh/colaboradores/novo" as Route}
            >
            + Admitir
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por nome ou matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <NativeSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as FilterStatus)}
            wrapperClassName="w-auto" className="w-auto"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="on_leave">Afastados</option>
            <option value="vacation">Férias</option>
            <option value="terminated">Desligados</option>
          </NativeSelect>
          <NativeSelect
            value={department}
            onChange={(e) => setDepartment(e.target.value as FilterDepartment)}
            wrapperClassName="w-auto" className="w-auto"
          >
            <option value="">Todos os setores</option>
            {(
              Object.entries(DEPARTMENT_LABELS) as [HRDepartment, string][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
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
