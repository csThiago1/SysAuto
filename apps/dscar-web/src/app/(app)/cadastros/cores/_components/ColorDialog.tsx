"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateVehicleColor, useUpdateVehicleColor, type VehicleColor } from "@/hooks/useVehicleColors"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: VehicleColor | null
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function ColorDialog({ open, onOpenChange, editing }: Props) {
  const create = useCreateVehicleColor()
  const update = useUpdateVehicleColor()
  const [name, setName] = useState("")
  const [hexCode, setHexCode] = useState("#000000")

  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? "")
    setHexCode(editing?.hex_code ?? "#000000")
  }, [open, editing])

  const isPending = create.isPending || update.isPending
  const canSubmit = name.trim().length >= 2 && HEX_RE.test(hexCode)

  async function handleSubmit() {
    const payload = { name: name.trim(), hex_code: hexCode }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: payload })
        toast.success("Cor atualizada.")
      } else {
        await create.mutateAsync(payload)
        toast.success("Cor cadastrada.")
      }
      onOpenChange(false)
    } catch {
      toast.error("Erro ao salvar cor.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Cor" : "Nova Cor"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="color-name">Nome *</Label>
            <Input
              id="color-name"
              placeholder="Ex: Prata"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="color-hex">Código hex *</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={HEX_RE.test(hexCode) ? hexCode : "#000000"}
                onChange={(e) => setHexCode(e.target.value)}
                className="h-9 w-12 shrink-0 cursor-pointer rounded border border-input bg-background p-0.5"
                aria-label="Selecionar cor"
              />
              <Input
                id="color-hex"
                placeholder="#C0C0C0"
                value={hexCode}
                onChange={(e) => setHexCode(e.target.value)}
                className="flex-1 font-mono"
                maxLength={7}
              />
            </div>
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
