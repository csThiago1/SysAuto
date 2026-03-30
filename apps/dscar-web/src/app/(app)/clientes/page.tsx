"use client";

import React, { useState } from "react";
import { Search, Users } from "lucide-react";
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
import Link from "next/link";
import { useCustomers } from "@/hooks/useCustomers";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function ClientesPage(): React.ReactElement {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  const { data, isLoading, isError } = useCustomers(debouncedSearch);
  const hasSearched = debouncedSearch.length >= 2;

  return (
    <ErrorBoundary>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Clientes</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Consulte e localize clientes cadastrados
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
        <Input
          placeholder="Buscar por nome, CPF ou telefone..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      {/* Table / States */}
      {!hasSearched && (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <Users className="h-12 w-12 mb-3 opacity-40" />
          <p className="font-medium text-neutral-500">
            Digite pelo menos 2 caracteres para buscar
          </p>
          <p className="text-sm mt-1">Nome, CPF ou telefone do cliente</p>
        </div>
      )}

      {hasSearched && (
        <div className="rounded-md border border-neutral-200 bg-white shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {isError && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center py-10 text-error-600"
                  >
                    Erro ao buscar clientes.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                !isError &&
                data?.results?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                        <Users className="h-8 w-8 mb-2 opacity-50" />
                        <p className="font-medium">
                          Nenhum cliente encontrado para &quot;{debouncedSearch}&quot;
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

              {!isLoading &&
                !isError &&
                data?.results?.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-neutral-50"
                  >
                    <TableCell className="font-medium text-neutral-900">
                      <Link
                        href={`/clientes/${customer.id}`}
                        className="block w-full h-full"
                      >
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-neutral-600 font-mono text-sm">
                      <Link
                        href={`/clientes/${customer.id}`}
                        className="block w-full h-full"
                      >
                        {customer.document_masked}
                      </Link>
                    </TableCell>
                    <TableCell className="text-neutral-600">
                      <Link
                        href={`/clientes/${customer.id}`}
                        className="block w-full h-full"
                      >
                        {customer.phone_masked}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          {data && data.count > 0 && (
            <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50">
              <p className="text-xs text-neutral-500">
                {data.count} cliente{data.count !== 1 ? "s" : ""} encontrado
                {data.count !== 1 ? "s" : ""}
                {data.count > data.results.length &&
                  ` · mostrando ${data.results.length}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
