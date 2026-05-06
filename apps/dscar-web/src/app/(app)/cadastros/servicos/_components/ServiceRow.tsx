"use client"

import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useServiceCatalogDelete } from "@/hooks/useServiceCatalog"
import type { ServiceCatalogDetail } from "@paddock/types"

interface Props {
  item: ServiceCatalogDetail
  onEdit: (item: ServiceCatalogDetail) => void
}

export function ServiceRow({ item, onEdit }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const deleteMutation = useServiceCatalogDelete()

  const price = Number(item.suggested_price).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(item.id)
      toast.success(`"${item.name}" removido.`)
    } catch {
      toast.error("Erro ao remover serviço.")
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/30 transition-colors">
        {/* Nome + descrição */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground/90 truncate">{item.name}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
          )}
        </div>

        {/* Preço */}
        <span className="text-sm font-mono text-foreground/70 tabular-nums shrink-0">
          {price}
        </span>

        {/* Ações — visíveis no hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground/90"
            onClick={() => onEdit(item)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-error-400"
            onClick={() => setConfirmOpen(true)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remover serviço"
        description={`Tem certeza que deseja remover "${item.name}" do catálogo?`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
