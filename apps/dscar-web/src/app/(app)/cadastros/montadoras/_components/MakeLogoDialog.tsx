"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUpdateMakeLogo, type VehicleMake } from "@/hooks/useVehicleFipe"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  make: VehicleMake | null
}

export function MakeLogoDialog({ open, onOpenChange, make }: Props) {
  const updateLogo = useUpdateMakeLogo()
  const [logoUrl, setLogoUrl] = useState("")

  useEffect(() => {
    if (!open) return
    setLogoUrl(make?.logo_url ?? "")
  }, [open, make])

  async function handleSubmit() {
    if (!make) return
    try {
      await updateLogo.mutateAsync({ id: make.id, logo_url: logoUrl.trim() })
      toast.success("Logo atualizado.")
      onOpenChange(false)
    } catch {
      toast.error("Erro ao atualizar logo.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Logo — {make?.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {logoUrl && (
            <div className="flex h-16 items-center justify-center rounded-md border border-border bg-muted/50">
              <img src={logoUrl} alt="" className="max-h-14 max-w-[80%] object-contain" />
            </div>
          )}
          <div>
            <Label htmlFor="make-logo-url">URL do logo</Label>
            <Input
              id="make-logo-url"
              placeholder="https://..."
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={updateLogo.isPending} onClick={handleSubmit}>
            {updateLogo.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
