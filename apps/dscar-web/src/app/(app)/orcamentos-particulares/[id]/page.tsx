"use client"

import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useBudget } from "@/hooks/useBudgets"
import { BudgetHeader }   from "./_components/BudgetHeader"
import { ItemsTable }     from "./_components/ItemsTable"
import { VersionHistory } from "./_components/VersionHistory"

export default function BudgetDetailPage() {
  const { id }                               = useParams<{ id: string }>()
  const { data: budget, isLoading, isError } = useBudget(id)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-14 w-full rounded-xl bg-muted/50" />
        <Skeleton className="h-8 w-64 rounded-lg bg-muted/50" />
        <Skeleton className="h-48 w-full rounded-xl bg-muted/50" />
      </div>
    )
  }

  if (isError || !budget) {
    return (
      <div className="p-6 text-error-400 text-sm">
        Orçamento não encontrado.
      </div>
    )
  }

  const version = budget.active_version

  return (
    <div className="p-6 space-y-6">
      <BudgetHeader budget={budget} />

      <Tabs defaultValue="itens">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger
            value="itens"
            className="data-[state=active]:bg-muted text-foreground/60 data-[state=active]:text-foreground"
          >
            Itens
          </TabsTrigger>
          <TabsTrigger
            value="versoes"
            className="data-[state=active]:bg-muted text-foreground/60 data-[state=active]:text-foreground"
          >
            Versões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="mt-4">
          {version ? (
            <ItemsTable budgetId={budget.id} version={version} />
          ) : (
            <p className="text-muted-foreground text-sm">Nenhuma versão ativa.</p>
          )}
        </TabsContent>

        <TabsContent value="versoes" className="mt-4">
          <VersionHistory budgetId={budget.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
