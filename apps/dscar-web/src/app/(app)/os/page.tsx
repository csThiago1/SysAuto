"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, ClipboardX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useServiceOrders, useDashboardStats } from "@/hooks/useServiceOrders";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  SERVICE_ORDER_STATUS_CONFIG,
  KANBAN_COLUMNS_ORDER,
} from "@/lib/design-tokens";
import type { ServiceOrderStatus } from "@paddock/types";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parseStatusParam(param: string | null): ServiceOrderStatus[] {
  if (!param) return [];
  return param
    .split(",")
    .filter((s): s is ServiceOrderStatus =>
      s in SERVICE_ORDER_STATUS_CONFIG
    );
}

// ─── Page (wraps inner with Suspense — required by useSearchParams) ───────────

export default function OSListPage(): React.ReactElement {
  return (
    <React.Suspense fallback={<OSListSkeleton />}>
      <OSListInner />
    </React.Suspense>
  );
}

function OSListSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}

function OSListInner(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Inicializa estado a partir da URL
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") ?? ""
  );
  const [selectedStatuses, setSelectedStatuses] = useState<ServiceOrderStatus[]>(
    parseStatusParam(searchParams.get("status"))
  );
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));

  const debouncedSearch = useDebounce(searchInput, 300);

  // Sincroniza estado → URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (selectedStatuses.length > 0)
      params.set("status", selectedStatuses.join(","));
    if (page > 1) params.set("page", String(page));
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    router.replace((`/os${qs}`) as Parameters<typeof router.replace>[0]);
  }, [debouncedSearch, selectedStatuses, page, router]);

  // Monta filtros para o hook
  const filters: Record<string, string> = {
    ordering: "-opened_at",
  };
  if (debouncedSearch) filters.search = debouncedSearch;
  if (selectedStatuses.length > 0)
    filters.status = selectedStatuses.join(",");
  if (page > 1) filters.page = String(page);

  const { data, isLoading, isError } = useServiceOrders(filters);
  const { data: stats } = useDashboardStats();

  // Verifica se há filtros ativos (excluindo ordenação e paginação)
  const hasActiveFilters = debouncedSearch !== "" || selectedStatuses.length > 0;

  // Toggle de um status no grupo de botões
  const handleStatusToggle = useCallback((status: ServiceOrderStatus) => {
    setSelectedStatuses((prev) => {
      const next = prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status];
      return next;
    });
    setPage(1);
  }, []);

  // Limpa todos os filtros de status
  const handleClearStatuses = useCallback(() => {
    setSelectedStatuses([]);
    setPage(1);
  }, []);

  // Limpa todos os filtros ativos
  const handleClearAllFilters = useCallback(() => {
    setSearchInput("");
    setSelectedStatuses([]);
    setPage(1);
  }, []);

  return (
    <ErrorBoundary>
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">
            Ordens de Serviço
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Gerencie e acompanhe todas as OS
          </p>
        </div>
        <Button asChild>
          <Link href="/os/nova">
            <Plus className="h-4 w-4" />
            Nova OS
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="OS em Aberto"
          value={stats?.total_open ?? null}
          isLoading={!stats}
          accent="primary"
        />
        <StatCard
          label="Entregas Hoje"
          value={stats?.today_deliveries ?? null}
          isLoading={!stats}
          accent="success"
        />
        <StatCard
          label="Total (Página)"
          value={data?.count ?? null}
          isLoading={isLoading}
          accent="neutral"
        />
        <StatCard
          label="Em Reparo"
          value={stats?.by_status?.["repair"] ?? null}
          isLoading={!stats}
          accent="warning"
        />
      </div>

      {/* Barra de filtros */}
      <div className="space-y-3">
        {/* Linha 1: busca + limpar filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
            <Input
              placeholder="Placa ou cliente..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllFilters}
              className="text-neutral-500 hover:text-neutral-700 gap-1.5 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Linha 2: botões de status */}
        <div className="flex flex-wrap gap-2">
          {/* Botão "Todos" */}
          <button
            type="button"
            onClick={handleClearStatuses}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
              selectedStatuses.length === 0
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50"
            )}
          >
            Todos
          </button>

          {/* Um botão por status na ordem do kanban */}
          {KANBAN_COLUMNS_ORDER.map((status) => {
            const cfg = SERVICE_ORDER_STATUS_CONFIG[status];
            const isActive = selectedStatuses.includes(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusToggle(status)}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border transition-all",
                  isActive
                    ? cn(cfg.badge, "ring-2 ring-offset-1 ring-current opacity-100")
                    : cn(cfg.badge, "opacity-60 hover:opacity-100")
                )}
              >
                <span
                  className={cn("mr-1.5 h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)}
                />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-neutral-200 bg-white shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50">
              <TableHead>Nº OS</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            )}

            {isError && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-12 text-error-600"
                >
                  Erro ao carregar ordens de serviço.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.results?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                    <ClipboardX className="h-10 w-10 mb-3 opacity-50" />
                    <p className="font-medium">Nenhuma OS encontrada</p>
                    <p className="text-xs mt-1">
                      Tente ajustar os filtros ou crie uma nova OS
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              data?.results?.map((os) => {
                const statusCfg =
                  SERVICE_ORDER_STATUS_CONFIG[os.status as ServiceOrderStatus];
                return (
                  <TableRow key={os.id}>
                    <TableCell className="font-mono font-semibold text-neutral-900">
                      #{os.number}
                    </TableCell>
                    <TableCell>
                      <span className="font-plate text-plate text-secondary-950">
                        {os.plate}
                      </span>
                    </TableCell>
                    <TableCell className="text-neutral-700">
                      {os.make} {os.model}
                      {os.year ? ` (${os.year})` : ""}
                    </TableCell>
                    <TableCell className="text-neutral-700">
                      {os.customer_name}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          statusCfg?.badge ?? "bg-neutral-100 text-neutral-500"
                        )}
                      >
                        {statusCfg?.label ?? os.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-neutral-500 text-xs">
                      {formatDate(os.opened_at)}
                    </TableCell>
                    <TableCell className="text-neutral-700 font-medium">
                      {formatCurrency(os.total)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/os/${os.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* Rodapé: contador + paginação */}
      {data && data.count > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {data.count}{" "}
            {data.count === 1 ? "ordem de serviço" : "ordens de serviço"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.previous === null}
            >
              &larr; Anterior
            </Button>
            <span className="text-sm text-neutral-600 px-2">
              Página {page} de {Math.max(1, Math.ceil(data.count / 25))}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={data.next === null}
            >
              Pr&oacute;xima &rarr;
            </Button>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | null;
  isLoading: boolean;
  accent: "primary" | "success" | "warning" | "neutral";
}

const accentClasses: Record<StatCardProps["accent"], string> = {
  primary: "text-primary-600",
  success: "text-success-600",
  warning: "text-warning-600",
  neutral: "text-neutral-700",
};

function StatCard({
  label,
  value,
  isLoading,
  accent,
}: StatCardProps): React.ReactElement {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-card">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
        {label}
      </p>
      {isLoading ? (
        <Skeleton className="h-8 w-16 mt-2" />
      ) : (
        <p className={cn("text-3xl font-bold mt-2", accentClasses[accent])}>
          {value ?? "—"}
        </p>
      )}
    </div>
  );
}
