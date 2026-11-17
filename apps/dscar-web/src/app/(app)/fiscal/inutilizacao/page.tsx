"use client"

/**
 * Inutilizacao de Numeracao NF-e — ADMIN+
 * S3-T3
 *
 * Formulario para inutilizar faixas de numeracao NF-e
 * e tabela com historico de inutilizacoes realizadas.
 */

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Ban, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useInutilizacao, useInutilizacoes } from "@/hooks/useFiscal"
import { usePermission } from "@/hooks/usePermission"

export default function InutilizacaoPage() {
  const isAdmin = usePermission("ADMIN")

  const [serie, setSerie] = useState(1)
  const [numeroInicial, setNumeroInicial] = useState<number | "">("")
  const [numeroFinal, setNumeroFinal] = useState<number | "">("")
  const [justificativa, setJustificativa] = useState("")

  const inutilizacao = useInutilizacao()
  const { data: historico = [], isLoading: loadingHistorico } = useInutilizacoes()

  if (!isAdmin) {
    return (
      <div className="px-0 py-3 md:p-6">
        <p className="text-sm text-muted-foreground">
          Acesso restrito a administradores.
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!numeroInicial || !numeroFinal) {
      toast.error("Informe o numero inicial e final.")
      return
    }
    if (numeroFinal < numeroInicial) {
      toast.error("Numero final deve ser maior ou igual ao inicial.")
      return
    }
    if (justificativa.trim().length < 15) {
      toast.error("Justificativa deve ter ao menos 15 caracteres.")
      return
    }

    try {
      await inutilizacao.mutateAsync({
        serie,
        numero_inicial: numeroInicial,
        numero_final: numeroFinal,
        justificativa: justificativa.trim(),
      })
      toast.success("Numeracao inutilizada com sucesso.")
      setNumeroInicial("")
      setNumeroFinal("")
      setJustificativa("")
    } catch {
      toast.error("Erro ao inutilizar numeracao. Tente novamente.")
    }
  }

  return (
    <div className="px-0 py-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Ban className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Inutilizacao de Numeracao NF-e
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inutilize faixas de numeracao que nao serao utilizadas
          </p>
        </div>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="rounded-md bg-muted/30 border border-white/[0.07] p-6 space-y-4 max-w-xl"
      >
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Serie
            </label>
            <Input
              type="number"
              min={1}
              value={serie}
              onChange={(e) => setSerie(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Numero Inicial
            </label>
            <Input
              type="number"
              min={1}
              value={numeroInicial}
              onChange={(e) =>
                setNumeroInicial(e.target.value ? Number(e.target.value) : "")
              }
              placeholder="Ex: 10"
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Numero Final
            </label>
            <Input
              type="number"
              min={1}
              value={numeroFinal}
              onChange={(e) =>
                setNumeroFinal(e.target.value ? Number(e.target.value) : "")
              }
              placeholder="Ex: 15"
              className="w-full"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Justificativa{" "}
            <span className="text-muted-foreground/60">(min. 15 caracteres)</span>
          </label>
          <textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={3}
            placeholder="Descreva o motivo da inutilizacao..."
            className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground resize-none"
          />
          <p className="text-xs text-muted-foreground/60">
            {justificativa.trim().length}/15 caracteres
          </p>
        </div>

        <Button
          type="submit"
          disabled={inutilizacao.isPending}
          className="w-full"
        >
          {inutilizacao.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Inutilizando...
            </>
          ) : (
            "Inutilizar"
          )}
        </Button>
      </form>

      {/* Historico */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Historico de Inutilizacoes
        </h2>

        <div className="rounded-md bg-muted/30 border border-white/[0.07] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {["Serie", "Faixa", "Justificativa", "Data"].map((h) => (
                  <TableHead
                    key={h}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistorico ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-12 text-center text-xs text-muted-foreground"
                  >
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : historico.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-12 text-center text-xs text-muted-foreground"
                  >
                    Nenhuma inutilizacao encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                historico.map((item) => {
                  const payload = item.payload as Record<string, unknown>
                  const dateFmt = new Date(item.created_at).toLocaleDateString(
                    "pt-BR",
                    {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )
                  return (
                    <TableRow
                      key={item.id}
                    >
                      <TableCell className="text-xs font-mono text-foreground/70">
                        {String(payload.serie ?? "—")}
                      </TableCell>
                      <TableCell className="text-xs text-foreground/70">
                        {String(payload.numero_inicial ?? "?")} -{" "}
                        {String(payload.numero_final ?? "?")}
                      </TableCell>
                      <TableCell className="text-xs text-foreground/70 max-w-[300px] truncate">
                        {String(payload.justificativa ?? "—")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {dateFmt}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {historico.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {historico.length} registro(s)
          </p>
        )}
      </div>
    </div>
  )
}
