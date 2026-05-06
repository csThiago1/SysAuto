"use client"

import { useState } from "react"
import { FileText, ShieldCheck, CheckCircle, Receipt, ChevronDown } from "lucide-react"
import type { ServiceOrder, PDFDocumentType } from "@paddock/types"
import { useDocumentHistory } from "@/hooks/useDocuments"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { DocumentPreviewDrawer } from "./DocumentPreviewDrawer"

const DOC_ITEMS: {
  type: PDFDocumentType
  label: string
  icon: typeof FileText
  tooltip: (o: ServiceOrder) => string | null
  enabled: (o: ServiceOrder) => boolean
}[] = [
  {
    type: "os_report",
    label: "Ordem de Serviço",
    icon: FileText,
    tooltip: () => null,
    enabled: () => true,
  },
  {
    type: "warranty",
    label: "Termo de Garantia",
    icon: ShieldCheck,
    tooltip: (o) =>
      !["ready", "delivered"].includes(o.status)
        ? "Disponível quando OS estiver pronta ou entregue"
        : null,
    enabled: (o) => ["ready", "delivered"].includes(o.status),
  },
  {
    type: "settlement",
    label: "Termo de Quitação",
    icon: CheckCircle,
    tooltip: (o) =>
      !o.invoice_issued ? "Disponível após faturamento da OS" : null,
    enabled: (o) => !!o.invoice_issued,
  },
  {
    type: "receipt",
    label: "Recibo de Pagamento",
    icon: Receipt,
    tooltip: () => null,
    enabled: (o) => !!o.invoice_issued,
  },
]

interface DocumentsDropdownProps {
  order: ServiceOrder
}

export function DocumentsDropdown({ order }: DocumentsDropdownProps) {
  const [selectedType, setSelectedType] = useState<PDFDocumentType | null>(null)
  const { data: history } = useDocumentHistory(order.id)
  const docCount = history?.length ?? 0

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-muted/30 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Documentos
            {docCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600/20 px-1.5 text-xs font-mono text-primary-400">
                {docCount}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Gerar Documento</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {DOC_ITEMS.map((item) => {
            const disabled = !item.enabled(order)
            const tip = item.tooltip(order)
            const Icon = item.icon
            return (
              <DropdownMenuItem
                key={item.type}
                disabled={disabled}
                onClick={() => setSelectedType(item.type)}
                title={tip ?? undefined}
              >
                <Icon className="h-4 w-4 mr-2 shrink-0" />
                <span>{item.label}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedType && (
        <DocumentPreviewDrawer
          order={order}
          documentType={selectedType}
          onClose={() => setSelectedType(null)}
        />
      )}
    </>
  )
}
