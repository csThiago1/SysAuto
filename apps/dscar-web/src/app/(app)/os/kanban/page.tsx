"use client";

import React from "react";
import Link from "next/link";
import { LayoutList, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export default function KanbanPage(): React.ReactElement {
  // Fetch all active OS without status filter — group on the client
  const { data, isLoading, isError, error } = useServiceOrders({
    is_active: "true",
    page_size: "200",
    ordering: "-opened_at",
  });

  const orders = data?.results ?? [];

  return (
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
        <Button variant="outline" asChild>
          <Link href="/os">
            <LayoutList className="h-4 w-4" />
            Ver Lista
          </Link>
        </Button>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Erro ao carregar OS:{" "}
            {error instanceof Error ? error.message : "Tente novamente"}
          </span>
        </div>
      )}

      {/* Board — takes remaining height */}
      <div className="flex-1 min-h-0">
        <KanbanBoard orders={orders} isLoading={isLoading} />
      </div>
    </div>
  );
}
