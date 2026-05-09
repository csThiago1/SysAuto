"use client"

/**
 * Inutilizacao de Numeracao NF-e — ADMIN+
 * S3-T3
 *
 * Formulario para inutilizar faixas de numeracao NF-e
 * e tabela com historico de inutilizacoes realizadas.
 */

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
      <div className="p-6">
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
    <div className="p-6 space-y-6">
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
        className="rounded-xl bg-muted/30 border border-white/[0.07] p-6 space-y-4 max-w-xl"
      >
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Serie
            </label>
            <input
              type="number"
              min={1}
              value={serie}
              onChange={(e) => setSerie(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Numero Inicial
            </label>
            <input
              type="number"
              min={1}
              value={numeroInicial}
              onChange={(e) =>
                setNumeroInicial(e.target.value ? Number(e.target.value) : "")
              }
              placeholder="Ex: 10"
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Numero Final
            </label>
            <input
              type="number"
              min={1}
              value={numeroFinal}
              onChange={(e) =>
                setNumeroFinal(e.target.value ? Number(e.target.value) : "")
              }
              placeholder="Ex: 15"
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
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

        <div className="rounded-xl bg-muted/30 border border-white/[0.07] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Serie", "Faixa", "Justificativa", "Data"].map((h) => (
                  <th
                    key={h}
                    className="py-2.5 px-4 text-xs font-semibold text-muted-foreground text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingHistorico ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-12 text-center text-xs text-muted-foreground"
                  >
                    Carregando...
                  </td>
                </tr>
              ) : historico.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-12 text-center text-xs text-muted-foreground"
                  >
                    Nenhuma inutilizacao encontrada.
                  </td>
                </tr>
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
                    <tr
                      key={item.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-xs font-mono text-foreground/70">
                        {String(payload.serie ?? "—")}
                      </td>
                      <td className="py-3 px-4 text-xs text-foreground/70">
                        {String(payload.numero_inicial ?? "?")} -{" "}
                        {String(payload.numero_final ?? "?")}
                      </td>
                      <td className="py-3 px-4 text-xs text-foreground/70 max-w-[300px] truncate">
                        {String(payload.justificativa ?? "—")}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {dateFmt}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
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
