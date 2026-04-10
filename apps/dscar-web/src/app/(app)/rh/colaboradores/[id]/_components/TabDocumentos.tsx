"use client";

/**
 * TabDocumentos — Lista de documentos com soft-delete.
 * Upload de novos documentos é um fluxo futuro (Sprint 8).
 */

import React from "react";
import { FileText, Trash2 } from "lucide-react";
import type { Employee } from "@paddock/types";
import { useEmployeeDocuments } from "@/hooks";
import { Skeleton } from "@/components/ui";

interface TabDocumentosProps {
  employee: Employee;
}

export function TabDocumentos({
  employee,
}: TabDocumentosProps): React.ReactElement {
  const { data, isLoading } = useEmployeeDocuments(employee.id);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  const documents = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-900">
          Documentos ({documents.length})
        </h3>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors">
          + Enviar documento
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-md bg-white shadow-card p-8 flex flex-col items-center justify-center text-neutral-500">
          <FileText className="h-8 w-8 mb-2 text-neutral-300" />
          <p className="text-sm">Nenhum documento enviado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-md bg-white shadow-card p-4"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-neutral-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {doc.document_type_display}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {doc.file_name}
                    {doc.expiry_date && (
                      <span className="ml-2 text-warning-600">
                        Validade:{" "}
                        {new Date(doc.expiry_date).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                title="Remover documento (soft delete)"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
