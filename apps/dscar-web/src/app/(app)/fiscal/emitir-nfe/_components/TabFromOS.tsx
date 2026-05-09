"use client"

import { useState } from "react"
import { toast } from "sonner"
import { FileText, Loader2, Search, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEmitNfe } from "@/hooks/useFiscal"
import { useServiceOrders } from "@/hooks/useServiceOrders"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { FiscalDocument, ServiceOrder } from "@paddock/types"

// ─── Constantes ───────────────────────────────────────────────────────────────

const FORMA_PAGAMENTO_OPTIONS = [
  { value: "01", label: "01 — Dinheiro" },
  { value: "03", label: "03 — Cartão de Crédito" },
  { value: "04", label: "04 — Cartão de Débito" },
  { value: "99", label: "99 — Outros" },
]

// ─── Error helper ─────────────────────────────────────────────────────────────

function extractApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.fieldErrors) {
      const msgs = Object.entries(err.fieldErrors)
        .map(([field, errors]) => `${field}: ${errors.join(", ")}`)
        .join(" | ")
      return msgs
    }
    return err.message
  }
  return "Erro ao emitir NF-e. Tente novamente."
}

// ─── OS Search helper ─────────────────────────────────────────────────────────

function OsSearch({ onSelect }: { onSelect: (os: ServiceOrder) => void }) {
  const [query, setQuery] = useState("")
  const { data, isFetching } = useServiceOrders(
    query.trim().length >= 2 ? { search: query.trim() } : {},
    1,
    10
  )
  const results = data?.results ?? []

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Número da OS, placa ou cliente..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {query.trim().length >= 2 && results.length > 0 && (
        <div className="rounded-lg border border-border bg-card divide-y divide-white/[0.06] max-h-52 overflow-y-auto">
          {results.map((os) => (
            <button
              key={os.id}
              type="button"
              onClick={() => { onSelect(os); setQuery("") }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <div>
                <span className="text-sm font-medium text-foreground">OS #{os.number}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {os.plate} · {os.customer_name}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{os.status}</span>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !isFetching && results.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">Nenhuma OS encontrada.</p>
      )}
    </div>
  )
}

// ─── TabFromOS ────────────────────────────────────────────────────────────────

export function TabFromOS({ onSuccess }: { onSuccess: (doc: FiscalDocument) => void }) {
  const emitMutation = useEmitNfe()
  const [selectedOs, setSelectedOs] = useState<ServiceOrder | null>(null)
  const [formaPagamento, setFormaPagamento] = useState("01")

  async function handleEmit() {
    if (!selectedOs) return
    try {
      const doc = await emitMutation.mutateAsync({
        service_order_id: selectedOs.id,
        forma_pagamento: formaPagamento as "01" | "03" | "04" | "99",
      })
      onSuccess(doc)
      toast.success("NF-e enviada para processamento.")
    } catch (err) {
      toast.error(extractApiError(err))
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-muted/30 border border-border p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Buscar Ordem de Serviço
        </h2>

        {selectedOs ? (
          <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">OS #{selectedOs.number}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedOs.plate} · {selectedOs.customer_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success-400" />
              <button
                type="button"
                onClick={() => setSelectedOs(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <OsSearch onSelect={setSelectedOs} />
        )}

        {selectedOs && (
          <div>
            <Label className="text-xs text-foreground/60">Forma de Pagamento</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {FORMA_PAGAMENTO_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setFormaPagamento(o.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs border transition-colors",
                    formaPagamento === o.value
                      ? "border-primary bg-primary/10 text-primary/80"
                      : "border-border bg-muted/30 text-muted-foreground hover:text-foreground/70"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-warning-950/30 border border-warning-700/20 p-4 text-xs text-warning-300/70 space-y-1">
        <p className="font-semibold text-warning-300">Requisitos</p>
        <ul className="list-disc list-inside space-y-0.5 text-warning-300/60">
          <li>A OS precisa ter ao menos uma peça ativa</li>
          <li>Todas as peças devem ter NCM de 8 dígitos preenchido no catálogo</li>
          <li>O cliente precisa ter CPF/CNPJ e endereço primário cadastrado</li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleEmit}
          disabled={!selectedOs || emitMutation.isPending}
          className="bg-primary hover:bg-primary/90 text-foreground"
        >
          {emitMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Emitindo...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-1.5" />
              Emitir NF-e da OS
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
