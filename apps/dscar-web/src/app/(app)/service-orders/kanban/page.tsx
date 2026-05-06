"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle, LayoutList, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";
import { NewOSDrawer } from "../_components/NewOSDrawer";

export default function KanbanPage(): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showDelivered, setShowDelivered] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  // Sem entregues/canceladas: exclui delivered/cancelled do backend — reduz payload ~70%
  // Com entregues ou canceladas: busca tudo (toggle explícito do usuário)
  const fetchAll = showDelivered || showCancelled;
  const { data, isLoading, isError, error } = useServiceOrders(
    fetchAll
      ? { is_active: "true", page_size: "200", ordering: "-opened_at" }
      : { is_active: "true", exclude_closed: "true", page_size: "150", ordering: "-opened_at" }
  );

  const orders = data?.results ?? [];

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-full gap-4">
      <NewOSDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <PageHeader
          title="Kanban"
          description={`${orders.length} ordem${orders.length !== 1 ? "s" : ""} ativa${orders.length !== 1 ? "s" : ""}`}
        />
        <div className="flex items-center gap-2">
          {/* Toggle: mostrar entregues */}
          <button
            type="button"
            onClick={() => setShowDelivered((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              showDelivered
                ? "bg-success-500/10 border-success-500/30 text-success-400"
                : "bg-muted/30 border-border text-foreground/60 hover:bg-muted/50"
            )}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {showDelivered ? "Ocultar Entregues" : "Mostrar Entregues"}
          </button>
          {/* Toggle: mostrar canceladas */}
          <button
            type="button"
            onClick={() => setShowCancelled((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              showCancelled
                ? "bg-error-500/10 border-error-500/30 text-error-400"
                : "bg-muted/30 border-border text-foreground/60 hover:bg-muted/50"
            )}
          >
            <XCircle className="h-3.5 w-3.5" />
            {showCancelled ? "Ocultar Canceladas" : "Mostrar Canceladas"}
          </button>

          <Button variant="outline" asChild>
            <Link href="/service-orders">
              <LayoutList className="h-4 w-4" />
              Ver Lista
            </Link>
          </Button>
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova OS
          </Button>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-error-500/30 bg-error-500/10 px-4 py-3 text-sm text-error-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Erro ao carregar OS:{" "}
            {error instanceof Error ? error.message : "Tente novamente"}
          </span>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        <KanbanBoard orders={orders} isLoading={isLoading} showDelivered={showDelivered} showCancelled={showCancelled} />
      </div>
    </div>
    </ErrorBoundary>
  );
}
