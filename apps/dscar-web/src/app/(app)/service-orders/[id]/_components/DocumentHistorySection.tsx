"use client"

import { useState } from "react"
import {
  FileText,
  ShieldCheck,
  CheckCircle,
  Receipt,
  Download,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { ServiceOrder, PDFDocumentType, DocumentGeneration } from "@paddock/types"
import { useDocumentHistory } from "@/hooks/useDocuments"
import { Button } from "@/components/ui/button"

const TYPE_ICONS: Record<PDFDocumentType, typeof FileText> = {
  os_report: FileText,
  warranty: ShieldCheck,
  settlement: CheckCircle,
  receipt: Receipt,
}

interface Props {
  order: ServiceOrder
}

export function DocumentHistorySection({ order }: Props) {
  const { data: history, isLoading } = useDocumentHistory(order.id)
  const [expandedType, setExpandedType] = useState<PDFDocumentType | null>(null)

  if (isLoading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden animate-pulse">
        <div className="h-32" />
      </div>
    )
  }

  const docs = history ?? []

  const grouped = docs.reduce<Record<string, DocumentGeneration[]>>(
    (acc, doc) => {
      const key = doc.document_type
      if (!acc[key]) acc[key] = []
      acc[key].push(doc)
      return acc
    },
    {},
  )

  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => b.version - a.version)
  }

  function handleDownload(docId: string) {
    window.open(`/api/proxy/documents/${docId}/download/`, "_blank")
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 bg-white/[0.03]">
        <FileText className="h-4 w-4 text-white/50" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Documentos Gerados
        </h2>
        {docs.length > 0 && (
          <span className="ml-auto text-xs font-mono text-white/30">
            {docs.length} documento{docs.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="p-5">
        {docs.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-4">
            Nenhum documento gerado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([type, versions]) => {
              const latest = versions[0]
              const Icon = TYPE_ICONS[type as PDFDocumentType] ?? FileText
              const isExpanded = expandedType === type
              const hasOlderVersions = versions.length > 1

              return (
                <div
                  key={type}
                  className="bg-white/[0.03] border border-white/5 rounded-lg overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Icon className="h-4 w-4 text-primary-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {latest.document_type_display}
                        </span>
                        <span className="text-xs font-mono bg-primary-600/20 text-primary-400 px-1.5 py-0.5 rounded">
                          v{latest.version}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">
                        Gerado por {latest.generated_by_name} ·{" "}
                        {format(new Date(latest.generated_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(latest.id)}
                        className="h-7 px-2 text-xs text-white/50 hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        PDF
                      </Button>
                      {hasOlderVersions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedType(isExpanded ? null : (type as PDFDocumentType))
                          }
                          className="h-7 px-2 text-xs text-white/30 hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {versions.length - 1} anterior{versions.length - 1 !== 1 ? "es" : ""}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && hasOlderVersions && (
                    <div className="border-t border-white/5 bg-white/[0.02]">
                      {versions.slice(1).map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 px-4 py-2 border-b border-white/5 last:border-0"
                        >
                          <span className="text-xs font-mono text-white/30 w-8">
                            v{doc.version}
                          </span>
                          <span className="text-xs text-white/40 flex-1">
                            {format(new Date(doc.generated_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}{" "}
                            — {doc.generated_by_name}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc.id)}
                            className="h-6 px-1.5 text-xs text-white/30 hover:text-white"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/api/proxy/documents/${doc.id}/snapshot/`,
                                "_blank",
                              )
                            }
                            className="h-6 px-1.5 text-xs text-white/30 hover:text-white"
                            title="Ver snapshot (auditoria)"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
