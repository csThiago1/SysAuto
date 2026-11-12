"use client"

import type { ReactElement } from "react"
import { CheckCircle2, Package } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

import { useBelongings, useReturnBelonging } from "../_hooks/useEntryChecklist"

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

/** Pertences do cliente. "Devolvido" vale mesmo com o checklist travado (é a entrega). */
export function BelongingsTab({ osId }: { osId: string }): ReactElement {
  const belongings = useBelongings(osId)
  const giveBack = useReturnBelonging(osId)

  if (belongings.isLoading) {
    return (
      <div className="space-y-1.5">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-14 rounded-[11px]" />
        ))}
      </div>
    )
  }
  if (belongings.isError) {
    return (
      <div className="space-y-2 py-6 text-center">
        <p className="text-sm text-muted-foreground">Não deu para carregar os pertences.</p>
        <Button variant="outline" size="sm" onClick={() => void belongings.refetch()}>
          Tentar de novo
        </Button>
      </div>
    )
  }
  const list = belongings.data ?? []
  if (list.length === 0) {
    return <EmptyState icon={<Package className="h-5 w-5" />} title="Nenhum pertence registrado" className="py-10" />
  }
  return (
    <ul className="space-y-1.5">
      {list.map((b) => (
        <li key={b.id} className="flex items-center gap-3 rounded-[11px] bg-card px-3 py-2">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {b.photo?.url && <img src={b.photo.url} alt="" className="h-full w-full object-cover" loading="lazy" />}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm">{b.description}</span>
          {b.returned_at ? (
            <span className="flex items-center gap-1 text-xs text-success-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Devolvido {dateFmt.format(new Date(b.returned_at))}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={giveBack.isPending}
              onClick={() =>
                giveBack.mutate(b.id, { onError: () => toast.error("Não deu para marcar como devolvido.") })
              }
            >
              Devolvido
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
