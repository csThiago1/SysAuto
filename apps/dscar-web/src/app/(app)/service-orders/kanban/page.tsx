"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckSquare, LayoutList, Plus, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

export default function KanbanPage(): React.ReactElement {
  const [showDelivered, setShowDelivered] = useState(false);

  // Sem entregues: exclui delivered/cancelled do backend — reduz payload ~70%
  // Com entregues: busca tudo (toggle explícito do usuário)
  const { data, isLoading, isError, error } = useServiceOrders(
    showDelivered
      ? { is_active: "true", page_size: "200", ordering: "-opened_at" }
      : { is_active: "true", exclude_closed: "true", page_size: "150", ordering: "-opened_at" }
  );

  const orders = data?.results ?? [];

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">
            Kanban — Ordens de Serviço
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Arraste os cards para mover entre etapas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle: mostrar entregues */}
          <button
            type="button"
            onClick={() => setShowDelivered((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              showDelivered
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {showDelivered
              ? <CheckSquare className="h-4 w-4" />
              : <Square className="h-4 w-4" />
            }
            Entregues
          </button>

          <Button variant="outline" asChild>
            <Link href="/service-orders">
              <LayoutList className="h-4 w-4" />
              Ver Lista
            </Link>
          </Button>
          <Button asChild>
            <Link href="/service-orders/new">
              <Plus className="h-4 w-4" />
              Nova OS
            </Link>
          </Button>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Erro ao carregar OS:{" "}
            {error instanceof Error ? error.message : "Tente novamente"}
          </span>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        <KanbanBoard orders={orders} isLoading={isLoading} showHidden={showDelivered} />
      </div>
    </div>
    </ErrorBoundary>
  );
}
