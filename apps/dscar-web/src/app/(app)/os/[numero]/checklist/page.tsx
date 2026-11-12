"use client"

import { use, type ReactElement } from "react"
import Link from "next/link"
import type { Route } from "next"
import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"

import { ChecklistViewer } from "./_components/ChecklistViewer"

// Só o que a conferência usa da OS
const OSHeaderSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  plate: z.string().nullable(),
  customer_name: z.string().nullable(),
})

export default function ChecklistPage({ params }: { params: Promise<{ numero: string }> }): ReactElement {
  const { numero } = use(params)
  const os = useQuery({
    queryKey: ["checklist-os", numero],
    queryFn: async () => OSHeaderSchema.parse(await apiFetch<unknown>(`/api/proxy/service-orders/${numero}/`)),
  })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Checklist de entrada"
        description={os.data ? `${os.data.plate ?? "Sem placa"} · OS ${os.data.number}` : `OS ${numero}`}
        backHref={`/os/${numero}`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/os/${numero}/vistoria` as Route}>Vistoria de saída</Link>
          </Button>
        }
      />
      {os.isLoading ? (
        <Skeleton className="h-[60vh] rounded-xl" />
      ) : os.isError || !os.data ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">Não deu para carregar a OS {numero}.</p>
          <Button variant="outline" onClick={() => void os.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <ChecklistViewer osId={os.data.id} customerName={os.data.customer_name || "Cliente"} />
      )}
    </div>
  )
}
