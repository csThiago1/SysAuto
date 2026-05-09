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
import { cn } from "@/lib/utils"
import type { FiscalDocument } from "@paddock/types"
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
    <div className="p-6 max-w-2xl space-y-6">
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

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/30 border border-border p-1">
        <button
          type="button"
          onClick={() => setTab("os")}
          className={cn(
            "flex items-center gap-2 flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            tab === "os"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground/70"
          )}
        >
          <ClipboardList className="h-4 w-4" />
          A partir de uma OS
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={cn(
            "flex items-center gap-2 flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            tab === "manual"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground/70"
          )}
        >
          <Package className="h-4 w-4" />
          Manual (sem OS)
        </button>
      </div>

      {/* Tab content */}
      {tab === "os" ? (
        <TabFromOS onSuccess={setEmitted} />
      ) : (
        <TabManual onSuccess={setEmitted} />
      )}
    </div>
  )
}

export default withRoleGuard(EmitirNfePageInner, "ADMIN", "/dashboard")
