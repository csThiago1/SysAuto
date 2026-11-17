"use client"

import Link from "next/link"
import type { Route } from "next"
import type { ServiceOrder } from "@paddock/types"
import { formatPlate } from "@paddock/utils"
import { useServiceOrders } from "@/hooks/useServiceOrders"
import { usePlacar } from "@/components/dock/Placar"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/ui/status-badge"
import { cn } from "@/lib/utils"

/** Dias de atraso: >0 atrasada, 0 sai hoje, <0 folga, null sem previsão. */
export function atraso(previsao: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!previsao) return null
  const [y, m, d] = previsao.slice(0, 10).split("-").map(Number)
  const alvo = Date.UTC(y, m - 1, d)
  const ref = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((ref - alvo) / 86_400_000)
}

/** Mais atrasada primeiro, depois as de hoje, depois a menor folga; sem previsão no fim. */
export function ordenarPorUrgencia<T extends Pick<ServiceOrder, "estimated_delivery_date" | "days_in_shop">>(
  ordens: T[],
  hoje: Date = new Date()
): T[] {
  return [...ordens].sort((a, b) => {
    const da = atraso(a.estimated_delivery_date, hoje)
    const db = atraso(b.estimated_delivery_date, hoje)
    if (da === null && db === null) return (b.days_in_shop ?? 0) - (a.days_in_shop ?? 0)
    if (da === null) return 1
    if (db === null) return -1
    return db - da
  })
}

function Prazo({ dias }: { dias: number | null }) {
  if (dias === null) return <span className="text-muted-foreground">—</span>
  if (dias === 0) return <span className="text-warning-400">hoje</span>
  return (
    <span className={dias > 0 ? "text-primary" : "text-success-400"}>
      {dias > 0 ? `+${dias}d` : `−${-dias}d`}
    </span>
  )
}

function Numero({ valor, rotulo, alerta }: { valor: string; rotulo: string; alerta?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cn("font-plate text-[32px] font-bold leading-none tabular-nums", alerta && "text-primary")}>
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{rotulo}</p>
    </div>
  )
}

/** Quantos carros a torre mostra; o resto fica na lista de OS. */
const TOPO = 10

/** Os carros mais urgentes do pátio, como a torre de tempos da F1. */
export function TorreDeTempos() {
  // O servidor ordena pela previsão (atrasadas primeiro, sem previsão no fim): os 10
  // primeiros são os mais urgentes. Antes vinham 200 OS completas a cada abertura.
  const { data, isLoading, isError } = useServiceOrders(
    { is_active: "true", exclude_closed: "true", ordering: "estimated_delivery_date" },
    1,
    TOPO
  )
  // Mesmas queries do placar da barra lateral: os números saem do cache, sem request a mais
  const { patio, atrasadas, hoje } = usePlacar()

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }
  if (isError) {
    return <p className="text-sm text-error-400">Não deu para carregar o pátio. Recarregue a página.</p>
  }

  const ordens = ordenarPorUrgencia(data?.results ?? [])
  const dias = ordens.map((o) => atraso(o.estimated_delivery_date))
  const total = data?.count ?? ordens.length

  return (
    <section aria-label="Pátio" className="space-y-4">
      <div className="flex flex-wrap gap-x-10 gap-y-3">
        <Numero valor={String(patio ?? total)} rotulo="no pátio" />
        <Numero valor={atrasadas === undefined ? "–" : String(atrasadas)} rotulo="atrasadas" alerta={(atrasadas ?? 0) > 0} />
        <Numero valor={hoje === undefined ? "–" : String(hoje)} rotulo="saem hoje" />
      </div>

      {ordens.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-foreground">Pátio vazio.</p>
          <Link href="/recepcao" className="mt-1 inline-block text-sm text-primary hover:underline">
            Abrir uma OS
          </Link>
        </div>
      ) : (
        <ol className="overflow-hidden rounded-md border border-border bg-card">
          {ordens.map((os, i) => {
            const d = dias[i]
            const carro = [os.make, os.model].filter(Boolean).join(" ") || "Veículo a confirmar"
            const quem = os.insurer_detail?.trade_name || os.insurer_detail?.name || os.customer_name || "particular"
            return (
              <li key={os.id} className="border-b border-border last:border-b-0">
                <Link
                  href={`/os/${os.number}` as Route}
                  className="grid grid-cols-[28px_minmax(0,1fr)_52px] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 md:grid-cols-[28px_96px_minmax(0,1fr)_150px_60px]"
                >
                  <span
                    className={cn(
                      "py-0.5 text-center font-plate text-[15px] font-bold leading-none [clip-path:polygon(4px_0,100%_0,calc(100%-4px)_100%,0_100%)]",
                      d !== null && d > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 md:contents">
                    <span className="block font-plate text-[17px] font-bold leading-tight tracking-wide">
                      {formatPlate(os.plate)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground md:text-[13px] md:text-foreground/80">
                      <span className="md:hidden">{os.status_display} · </span>
                      {carro} · {quem}
                    </span>
                    <span className="hidden md:block">
                      <StatusBadge status={os.status} size="sm" className="max-w-full truncate" />
                    </span>
                  </span>
                  <span className="text-right font-plate text-[17px] font-bold tabular-nums">
                    <Prazo dias={d} />
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
      {total > ordens.length && (
        <Link href="/os" className="inline-block text-sm text-primary hover:underline">
          Ver as {total} OS do pátio
        </Link>
      )}
    </section>
  )
}
