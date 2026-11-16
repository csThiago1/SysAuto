"use client"

/**
 * Emissão de NF-e de Produto — ADMIN+
 * Ciclo 07A
 *
 * Duas abas:
 *  - A partir de uma OS: service_order_id + forma_pagamento
 *  - Manual: destinatário + itens (com NCM obrigatório) + forma_pagamento + manual_reason
 */

import { useState } from "react"
import { Package, ClipboardList } from "lucide-react"
import { withRoleGuard } from "@/lib/withRoleGuard"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { FiscalDocument } from "@/hooks/useFiscal"
import { TabFromOS } from "./_components/TabFromOS"
import { TabManual } from "./_components/TabManual"
import { SuccessCard } from "./_components/SuccessCard"

type Tab = "os" | "manual"

function EmitirNfePageInner() {
  const [tab, setTab] = useState<Tab>("os")
  const [emitted, setEmitted] = useState<FiscalDocument | null>(null)

  if (emitted) {
    return <SuccessCard doc={emitted} onReset={() => setEmitted(null)} />
  }

  return (
    <div className="px-0 py-3 md:p-6 max-w-2xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Emissão de NF-e de Produto</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nota fiscal de mercadoria — válida para qualquer estado — requer ADMIN
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v === "manual" ? "manual" : "os")}>
        <TabsList className="flex w-full">
          <TabsTrigger value="os" className="flex-1 justify-center gap-2">
            <ClipboardList className="h-4 w-4" />
            A partir de uma OS
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex-1 justify-center gap-2">
            <Package className="h-4 w-4" />
            Manual (sem OS)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="os" className="mt-6">
          <TabFromOS onSuccess={setEmitted} />
        </TabsContent>
        <TabsContent value="manual" className="mt-6">
          <TabManual onSuccess={setEmitted} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default withRoleGuard(EmitirNfePageInner, "ADMIN", "/dashboard")
