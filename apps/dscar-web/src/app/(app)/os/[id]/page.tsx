"use client";

import React, { use } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useServiceOrder, useTransitionStatus } from "@/hooks/useServiceOrders";
import { SERVICE_ORDER_STATUS_CONFIG, KANBAN_COLUMNS_ORDER } from "@/lib/design-tokens";
import type { ServiceOrderStatus } from "@paddock/types";
import { cn } from "@/lib/utils";

interface OSDetailPageProps {
  params: Promise<{ id: string }>;
}

function getNextStatus(current: ServiceOrderStatus): ServiceOrderStatus | null {
  const idx = KANBAN_COLUMNS_ORDER.indexOf(current);
  if (idx === -1 || idx >= KANBAN_COLUMNS_ORDER.length - 1) return null;
  return KANBAN_COLUMNS_ORDER[idx + 1] ?? null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function OSDetailPage({ params }: OSDetailPageProps): React.ReactElement {
  const { id } = use(params);
  const { data: os, isLoading, isError } = useServiceOrder(id);
  const { mutate: transition, isPending, error: transitionError } = useTransitionStatus(id);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !os) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
        <p className="text-lg font-medium">OS não encontrada</p>
        <Button variant="ghost" className="mt-4" asChild>
          <Link href="/os">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar para a lista
          </Link>
        </Button>
      </div>
    );
  }

  const currentStatus = os.status as ServiceOrderStatus;
  const statusCfg = SERVICE_ORDER_STATUS_CONFIG[currentStatus];
  const nextStatus = getNextStatus(currentStatus);
  const nextStatusCfg = nextStatus
    ? SERVICE_ORDER_STATUS_CONFIG[nextStatus]
    : null;

  const currentStatusIdx = KANBAN_COLUMNS_ORDER.indexOf(currentStatus);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/os">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-neutral-900">
                OS #{os.number}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  statusCfg?.badge ?? "bg-neutral-100 text-neutral-500"
                )}
              >
                {statusCfg?.label ?? os.status}
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-0.5">
              Aberta em {formatDate(os.opened_at)}
            </p>
          </div>
        </div>

        {/* Advance status button */}
        {nextStatus && nextStatusCfg && (
          <Button
            onClick={() => transition(nextStatus)}
            disabled={isPending}
            className="gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Avançar para: {nextStatusCfg.label}
          </Button>
        )}

        {!nextStatus && currentStatus !== "cancelled" && (
          <span className="text-sm text-success-600 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            OS Finalizada
          </span>
        )}
      </div>

      {transitionError && (
        <div className="rounded-md bg-error-50 border border-error-200 px-4 py-3 text-sm text-error-700">
          Erro ao avançar status. Tente novamente.
        </div>
      )}

      {/* Status Stepper */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progresso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {KANBAN_COLUMNS_ORDER.map((s, idx) => {
              const cfg = SERVICE_ORDER_STATUS_CONFIG[s];
              const isDone = idx < currentStatusIdx;
              const isCurrent = idx === currentStatusIdx;
              return (
                <React.Fragment key={s}>
                  <div
                    className={cn(
                      "flex flex-col items-center gap-1 min-w-0",
                      "transition-opacity",
                      !isDone && !isCurrent && "opacity-40"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0",
                        isDone
                          ? "bg-success-500 border-success-500"
                          : isCurrent
                          ? "bg-primary-600 border-primary-600"
                          : "bg-white border-neutral-300"
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      ) : isCurrent ? (
                        <Circle className="h-2.5 w-2.5 fill-white text-white" />
                      ) : (
                        <Circle className="h-2.5 w-2.5 text-neutral-300" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-2xs text-center leading-tight max-w-[48px]",
                        isCurrent
                          ? "text-primary-700 font-semibold"
                          : "text-neutral-500"
                      )}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  {idx < KANBAN_COLUMNS_ORDER.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1 min-w-4 shrink-0 transition-colors",
                        idx < currentStatusIdx
                          ? "bg-success-400"
                          : "bg-neutral-200"
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Vehicle + Customer Info */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Veículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-2xs font-medium text-neutral-400 uppercase tracking-wide">
                Placa
              </p>
              <p className="font-plate text-plate text-secondary-950 mt-0.5">
                {os.plate}
              </p>
            </div>
            <div>
              <p className="text-2xs font-medium text-neutral-400 uppercase tracking-wide">
                Veículo
              </p>
              <p className="text-sm text-neutral-900 mt-0.5">
                {os.make} {os.model}
                {os.year ? ` · ${os.year}` : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-2xs font-medium text-neutral-400 uppercase tracking-wide">
                Nome
              </p>
              <p className="text-sm text-neutral-900 mt-0.5">
                {os.customer_name}
              </p>
              {os.customer_id && (
                <Link
                  href={`/clientes/${os.customer_id}`}
                  className="text-xs text-primary-600 hover:text-primary-700 hover:underline mt-1 inline-block"
                >
                  Ver cliente →
                </Link>
              )}
            </div>
            {os.estimated_delivery && (
              <div>
                <p className="text-2xs font-medium text-neutral-400 uppercase tracking-wide">
                  Entrega Prevista
                </p>
                <p className="text-sm text-neutral-900 mt-0.5">
                  {formatDate(os.estimated_delivery)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Total da OS</p>
            <p className="text-2xl font-bold text-neutral-900">
              {formatCurrency(os.total)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
