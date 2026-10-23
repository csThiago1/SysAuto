"use client";

/**
 * Histórico de um veículo por placa — URL direta e compartilhável.
 *
 * Entrada alternativa ao caminho cliente → veículos: aqui se entra pela placa
 * e se vê todos os donos e todas as OS daquele carro.
 */

import React, { use } from "react";
import Link from "next/link";
import { ArrowLeft, Car } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui";
import { HistoricoAtendimentos } from "@/components/historico/HistoricoAtendimentos";

interface VeiculoDetailPageProps {
  params: Promise<{ placa: string }>;
}

export default function VeiculoDetailPage({
  params,
}: VeiculoDetailPageProps): React.ReactElement {
  return (
    <ErrorBoundary>
      <VeiculoDetailContent params={params} />
    </ErrorBoundary>
  );
}

function VeiculoDetailContent({ params }: VeiculoDetailPageProps): React.ReactElement {
  const { placa } = use(params);
  const plate = decodeURIComponent(placa).toUpperCase().replace(/[^A-Z0-9]/g, "");

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-y-2">
        <Button variant="ghost" size="icon" title="Voltar" asChild>
          <Link href="/os">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="ml-2 flex min-w-0 items-center gap-2">
          <Car className="h-5 w-5 shrink-0 text-muted-foreground" />
          <h1 className="truncate font-mono text-xl font-bold tracking-wider">{plate}</h1>
        </div>
      </div>

      <HistoricoAtendimentos plate={plate} />
    </div>
  );
}
