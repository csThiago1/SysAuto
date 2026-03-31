"use client";

import React, { use } from "react";
import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomer } from "@/hooks/useCustomer";
import { useClientOrders } from "@/hooks/useClientOrders";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SERVICE_ORDER_STATUS_CONFIG } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import type { ServiceOrderStatus } from "@paddock/types";

interface ClienteDetailPageProps {
  params: Promise<{ id: string }>;
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

function ClienteDetailSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6 max-w-3xl">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function ClienteDetailPage({
  params,
}: ClienteDetailPageProps): React.ReactElement {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<ClienteDetailSkeleton />}>
        <ClienteDetailContent params={params} />
      </React.Suspense>
    </ErrorBoundary>
  );
}

function ClienteDetailContent({
  params,
}: ClienteDetailPageProps): React.ReactElement {
  const { id } = use(params);

  const { data: customer, isLoading: loadingCustomer, isError: errorCustomer } =
    useCustomer(id);

  const { data: osData, isLoading: loadingOS } = useClientOrders(id);

  if (loadingCustomer) {
    return <ClienteDetailSkeleton />;
  }

  if (errorCustomer || !customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
        <User className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Cliente não encontrado</p>
        <Button variant="ghost" className="mt-4" asChild>
          <Link href="/clientes">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar para clientes
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Breadcrumb items={[
        { label: "Clientes", href: "/clientes" },
        { label: customer?.name ?? "..." },
      ]} />

      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clientes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-neutral-900 truncate">
            {customer.name}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="inline-flex items-center rounded-full bg-neutral-100 border border-neutral-200 px-2.5 py-0.5 text-xs font-mono text-neutral-700">
              {customer.document_masked}
            </span>
            <span className="inline-flex items-center rounded-full bg-neutral-100 border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-700">
              {customer.phone_masked}
            </span>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações do Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
                Nome
              </p>
              <p className="text-sm text-neutral-900 mt-0.5">{customer.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
                Documento
              </p>
              <p className="text-sm font-mono text-neutral-900 mt-0.5">
                {customer.document_masked}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
                Telefone
              </p>
              <p className="text-sm text-neutral-900 mt-0.5">
                {customer.phone_masked}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OS Table */}
      <div>
        <h3 className="text-base font-semibold text-neutral-900 mb-3">
          Ordens de Serviço
        </h3>
        <div className="rounded-md border border-neutral-200 bg-white shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead>Nº OS</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Abertura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingOS && (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {!loadingOS && osData?.results?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                      <p className="font-medium">
                        Nenhuma OS encontrada para este cliente
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!loadingOS &&
                osData?.results?.map((os) => {
                  const statusCfg =
                    SERVICE_ORDER_STATUS_CONFIG[os.status as ServiceOrderStatus];
                  return (
                    <TableRow
                      key={os.id}
                      className="cursor-pointer hover:bg-neutral-50"
                    >
                      <TableCell className="font-medium text-neutral-900">
                        <Link
                          href={`/os/${os.id}`}
                          className="block w-full h-full"
                        >
                          #{os.number}
                        </Link>
                      </TableCell>
                      <TableCell className="font-plate text-secondary-950">
                        <Link href={`/os/${os.id}`} className="block w-full h-full">
                          {os.plate}
                        </Link>
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        <Link href={`/os/${os.id}`} className="block w-full h-full">
                          {os.make} {os.model}
                          {os.year ? ` · ${os.year}` : ""}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/os/${os.id}`} className="block w-full h-full">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              statusCfg?.badge ??
                                "bg-neutral-100 text-neutral-500"
                            )}
                          >
                            {statusCfg?.label ?? os.status}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-neutral-600 text-sm">
                        <Link href={`/os/${os.id}`} className="block w-full h-full">
                          {formatDate(os.opened_at)}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
