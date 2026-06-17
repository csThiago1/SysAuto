"use client"

import { useState } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { useInsurers } from "@/hooks/useInsurers"
import type { ResolverProps } from "./index"

async function patchOrder(id: string, data: Record<string, unknown>): Promise<void> {
  await apiFetch(`/api/proxy/service-orders/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export function InsurerResolver({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [q, setQ] = useState("")
  const [saving, setSaving] = useState(false)
  const { data, isFetching } = useInsurers(q.length >= 2 ? q : "")

  async function handleSelect(insurerId: string): Promise<void> {
    setSaving(true)
    try {
      await patchOrder(order.id, { insurer: insurerId })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao vincular seguradora")
    } finally {
      setSaving(false)
    }
  }

  const results = data?.results ?? []
  const showResults = q.length >= 2 && !isFetching

  return (
    <div className="mt-2 space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          className="w-full rounded-md border bg-background pl-7 pr-2 py-1.5 text-sm"
          placeholder="Buscar seguradora por nome..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {showResults && results.length > 0 && (
        <ul className="rounded-md border divide-y max-h-40 overflow-y-auto">
          {results.map((ins) => (
            <li key={ins.id}>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                disabled={saving}
                onClick={() => void handleSelect(ins.id)}
              >
                <span className="font-medium">{ins.display_name}</span>
                {ins.cnpj && (
                  <span className="ml-2 text-xs text-muted-foreground">{ins.cnpj}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showResults && results.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma seguradora encontrada.</p>
      )}
    </div>
  )
}
