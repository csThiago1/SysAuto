"use client"

import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useServiceCatalogDelete } from "@/hooks/useServiceCatalog"
import type { ServiceCatalogDetail } from "@paddock/types"

interface Props {
  items: ServiceCatalogDetail[]
  onEdit: (item: ServiceCatalogDetail) => void
}

export function ServiceCatalogTable({ items, onEdit }: Props) {
  const deleteMutation = useServiceCatalogDelete()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover "${name}" do catálogo?`)) return
    setDeletingId(id)
    try {
      await deleteMutation.mutateAsync(id)
      toast.success("Serviço removido do catálogo.")
    } catch {
      toast.error("Erro ao remover serviço.")
    } finally {
      setDeletingId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-neutral-400">
        Nenhum serviço no catálogo. Clique em "Novo Serviço" para adicionar.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <Table>
        <TableHeader className="bg-neutral-50">
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Preço Sugerido</TableHead>
            <TableHead className="w-20 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-neutral-800">{item.name}</TableCell>
              <TableCell className="text-neutral-500">{item.category_display}</TableCell>
              <TableCell className="text-right font-mono text-neutral-700">
                {Number(item.suggested_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item.id, item.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
