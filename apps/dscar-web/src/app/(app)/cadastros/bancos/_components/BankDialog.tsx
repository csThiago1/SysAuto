"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateBank, useUpdateBank, type Bank } from "@/hooks/useBanks"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Bank | null
}

export function BankDialog({ open, onOpenChange, editing }: Props) {
  const create = useCreateBank()
  const update = useUpdateBank()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [logoUrl, setLogoUrl] = useState("")

  useEffect(() => {
    if (!open) return
    setCode(editing?.code ?? "")
    setName(editing?.name ?? "")
    setLogoUrl(editing?.logo_url ?? "")
  }, [open, editing])

  const isPending = create.isPending || update.isPending
  const canSubmit = code.trim().length === 3 && name.trim().length >= 2

  async function handleSubmit() {
    const payload = { code: code.trim(), name: name.trim(), logo_url: logoUrl.trim() }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: payload })
        toast.success("Banco atualizado.")
      } else {
        await create.mutateAsync(payload)
        toast.success("Banco cadastrado.")
      }
      onOpenChange(false)
    } catch {
      toast.error("Erro ao salvar banco.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Banco" : "Novo Banco"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="bank-code">Código FEBRABAN *</Label>
            <Input
              id="bank-code"
              maxLength={3}
              placeholder="Ex: 341"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </div>
          <div>
            <Label htmlFor="bank-name">Nome *</Label>
            <Input
              id="bank-name"
              placeholder="Ex: Itaú Unibanco"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="bank-logo">URL do logo</Label>
            <Input
              id="bank-logo"
              placeholder="https://..."
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={!canSubmit || isPending} onClick={handleSubmit}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
