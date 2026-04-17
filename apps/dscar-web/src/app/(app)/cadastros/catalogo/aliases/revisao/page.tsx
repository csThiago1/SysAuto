"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useAliasesServicoRevisao,
  useApproveAlias,
  useRejectAlias,
} from "@/hooks/usePricingCatalog"
import type { AliasServico } from "@paddock/types"

export default function AliasesRevisaoPage() {
  const { data: aliases = [], isLoading } = useAliasesServicoRevisao()
  const approveMutation = useApproveAlias()
  const rejectMutation = useRejectAlias()
  const [processingId, setProcessingId] = useState<string | null>(null)

  async function handleApprove(alias: AliasServico): Promise<void> {
    setProcessingId(alias.id)
    try {
      await approveMutation.mutateAsync(alias.id)
      toast.success(`Alias "${alias.texto}" aprovado.`)
    } catch {
      toast.error("Erro ao aprovar alias.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(alias: AliasServico): Promise<void> {
    setProcessingId(alias.id)
    try {
      await rejectMutation.mutateAsync(alias.id)
      toast.success(`Alias "${alias.texto}" rejeitado.`)
    } catch {
      toast.error("Erro ao rejeitar alias.")
    } finally {
      setProcessingId(null)
    }
  }

  function getConfiancaBadge(confianca: number | null): string {
    if (confianca === null) return "text-neutral-500"
    if (confianca >= 0.9) return "text-emerald-700"
    if (confianca >= 0.75) return "text-amber-700"
    return "text-red-600"
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Aliases — Fila de Revisão</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Aliases gerados automaticamente com confiança média que precisam de revisão humana.
        </p>
      </div>

      {/* Contador */}
      {!isLoading && (
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            {aliases.length} pendentes
          </Badge>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={5} rows={8} />
      ) : aliases.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-400">
          Nenhum alias pendente de revisão. Tudo em ordem!
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <Table>
            <TableHeader className="bg-neutral-50">
              <TableRow>
                <TableHead>Texto Original</TableHead>
                <TableHead>Texto Normalizado</TableHead>
                <TableHead className="w-24 text-center">Confiança</TableHead>
                <TableHead className="w-20 text-center">Ocorr.</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aliases.map((alias: AliasServico) => (
                <TableRow key={alias.id}>
                  <TableCell className="py-2 font-medium text-neutral-800">
                    {alias.texto}
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs text-neutral-500">
                    {alias.texto_normalizado}
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    {alias.confianca !== null ? (
                      <span className={`text-sm font-medium ${getConfiancaBadge(alias.confianca)}`}>
                        {(alias.confianca * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-neutral-400 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-center text-sm text-neutral-600">
                    {alias.ocorrencias}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                        disabled={processingId === alias.id}
                        onClick={() => handleApprove(alias)}
                        title="Aprovar mapeamento"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        disabled={processingId === alias.id}
                        onClick={() => handleReject(alias)}
                        title="Rejeitar mapeamento"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        Aprovar: confirma o mapeamento e promove para confiança alta.
        Rejeitar: desativa o alias (soft-delete).
      </p>
    </div>
  )
}
