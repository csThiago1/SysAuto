"use client"

import { useState } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"
import { useQueryClient } from "@tanstack/react-query"
import type { BudgetVersion } from "@paddock/types"

interface Props {
  budgetId: number
  version: BudgetVersion
}

export function PaymentTermsCard({ budgetId, version }: Props) {
  const qc = useQueryClient()
  const isDraft = version.status === "draft"
  const [saving, setSaving] = useState(false)

  const [validityDays, setValidityDays] = useState(version.validity_days ?? 30)
  const [paymentTerms, setPaymentTerms] = useState(version.payment_terms ?? "")
  const [paymentMethods, setPaymentMethods] = useState(version.payment_methods ?? "")
  const [estimatedDays, setEstimatedDays] = useState(version.estimated_days ?? "")

  async function handleSave() {
    setSaving(true)
    try {
      await apiFetch(`/api/proxy/budgets/${budgetId}/versions/${version.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validity_days: validityDays || null,
          payment_terms: paymentTerms,
          payment_methods: paymentMethods,
          estimated_days: estimatedDays || null,
        }),
      })
      void qc.invalidateQueries({ queryKey: ["budgets", budgetId] })
      toast.success("Condições salvas.")
    } catch {
      toast.error("Erro ao salvar condições.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4 max-w-lg">
      <h3 className="text-sm font-semibold text-foreground">Condições Comerciais</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Validade (dias)</Label>
          <Input
            type="number"
            value={validityDays}
            onChange={(e) => setValidityDays(parseInt(e.target.value) || 0)}
            disabled={!isDraft}
            placeholder="30"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Prazo execução (dias úteis)</Label>
          <Input
            type="number"
            value={estimatedDays}
            onChange={(e) => setEstimatedDays(parseInt(e.target.value) || "")}
            disabled={!isDraft}
            placeholder="Ex: 15"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Formas de pagamento</Label>
        <Input
          value={paymentMethods}
          onChange={(e) => setPaymentMethods(e.target.value)}
          disabled={!isDraft}
          placeholder="PIX, Cartão, Boleto, Cheque"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Condições de pagamento</Label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          disabled={!isDraft}
          placeholder="Ex: 50% na aprovação + 50% na entrega"
        />
      </div>

      {isDraft && (
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="gap-1.5"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar Condições
        </Button>
      )}

      {!isDraft && (
        <p className="text-xs text-muted-foreground">
          Condições são editáveis apenas em rascunho.
        </p>
      )}
    </div>
  )
}
