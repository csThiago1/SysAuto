"use client"

/**
 * FiscalValidationPanel — preflight fiscal do faturamento.
 *
 * Mostra os problemas que fariam a NF ser rejeitada ANTES de emitir,
 * com correção inline de NCM e link direto pro cadastro do cliente.
 */

import { useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useUpdatePart } from "../_hooks/useOSItems"
import type { BillingValidation, BillingValidationIssue } from "../_hooks/useBilling"

const PERSON_ISSUE_CODES = new Set([
  "customer_no_document",
  "customer_no_address",
  "customer_no_ibge",
])

interface FiscalValidationPanelProps {
  orderId: string
  validation: BillingValidation | undefined
  isLoading: boolean
}

export function FiscalValidationPanel({
  orderId,
  validation,
  isLoading,
}: FiscalValidationPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Validando dados fiscais...
      </div>
    )
  }
  if (!validation) return null

  if (validation.ready) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-success-500/10 border border-success-500/20 px-3 py-2">
        <CheckCircle2 className="h-4 w-4 text-success-400 shrink-0" />
        <p className="text-xs text-success-400">
          Dados fiscais validados — pronto para emitir.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="label-mono text-muted-foreground mb-2">VALIDAÇÃO FISCAL</p>
      <div className="space-y-2">
        {validation.issues.map((issue) => (
          <IssueCard key={issue.code} issue={issue} orderId={orderId} />
        ))}
      </div>
    </div>
  )
}

function IssueCard({ issue, orderId }: { issue: BillingValidationIssue; orderId: string }) {
  const isError = issue.severity === "error"
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 space-y-2 ${
        isError
          ? "bg-error-500/10 border-error-500/20"
          : "bg-warning-500/10 border-warning-500/20"
      }`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={`h-4 w-4 mt-0.5 shrink-0 ${isError ? "text-error-400" : "text-warning-400"}`}
        />
        <p className={`text-xs ${isError ? "text-error-400" : "text-warning-400"}`}>
          {issue.message}
        </p>
      </div>

      {PERSON_ISSUE_CODES.has(issue.code) && issue.person_id != null && (
        <Link
          href={`/cadastros/${issue.person_id}` as Route}
          target="_blank"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-6"
        >
          Corrigir cadastro do cliente
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}

      {issue.code === "part_missing_ncm" && issue.parts && (
        <div className="ml-6 space-y-1.5">
          {issue.parts.map((part) => (
            <NcmInlineFix key={part.part_id} orderId={orderId} part={part} />
          ))}
        </div>
      )}
    </div>
  )
}

function NcmInlineFix({
  orderId,
  part,
}: {
  orderId: string
  part: { part_id: string; description: string; ncm: string }
}) {
  const [ncm, setNcm] = useState(part.ncm)
  const qc = useQueryClient()
  const updatePart = useUpdatePart(orderId)
  const valid = /^\d{8}$/.test(ncm)

  function handleSave() {
    updatePart.mutate(
      { id: part.part_id, data: { ncm } },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: ["billing-validation", orderId] })
        },
        onError: () => {
          toast.error("Erro ao salvar NCM. Tente novamente.")
        },
      },
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-foreground/70 truncate flex-1 min-w-0">
        {part.description}
      </span>
      <input
        value={ncm}
        onChange={(e) => setNcm(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="NCM (8 dígitos)"
        className="h-7 w-32 rounded border border-border bg-muted/30 text-xs text-foreground/80 px-2 font-mono focus:outline-none focus:border-primary"
        aria-label={`NCM de ${part.description}`}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        disabled={!valid || updatePart.isPending}
        onClick={handleSave}
      >
        {updatePart.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
      </Button>
    </div>
  )
}
