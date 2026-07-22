"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Search, Palette } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { useVehicleColorsList, useDeleteVehicleColor, type VehicleColor } from "@/hooks/useVehicleColors"
import { ColorDialog } from "./_components/ColorDialog"

export default function CoresPage() {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleColor | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data, isLoading } = useVehicleColorsList(search)
  const deleteMutation = useDeleteVehicleColor()
  const colors = data ?? []

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(color: VehicleColor) {
    setEditing(color)
    setDialogOpen(true)
  }

  async function handleDelete(color: VehicleColor): Promise<void> {
    if (!confirm(`Remover "${color.name}"?`)) return
    setDeletingId(color.id)
    try {
      await deleteMutation.mutateAsync(color.id)
      toast.success("Cor removida.")
    } catch {
      toast.error("Erro ao remover cor.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6 px-0 py-3 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cores de Veículo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de cores usado na vistoria e no cadastro de veículos.
          </p>
        </div>
        <Button onClick={handleNew} className="bg-primary hover:bg-primary/90 text-foreground gap-1.5">
          <Plus className="h-4 w-4" />
          Nova Cor
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar cor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted/50 h-9"
        />
      </div>

      {isLoading ? (
        <TableSkeleton columns={3} rows={6} />
      ) : colors.length === 0 ? (
        <EmptyState
          icon={<Palette className="h-8 w-8" />}
          title={search ? "Nenhuma cor encontrada." : "Nenhuma cor cadastrada."}
          action={!search && (
            <Button variant="outline" size="sm" onClick={handleNew}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova Cor
            </Button>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-28">Hex</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colors.map((color) => (
                <TableRow key={color.id}>
                  <TableCell className="py-2">
                    <div
                      className="h-6 w-6 rounded-full border border-border shrink-0"
                      style={{ backgroundColor: color.hex_code }}
                    />
                  </TableCell>
                  <TableCell className="py-2 font-medium text-foreground/90">{color.name}</TableCell>
                  <TableCell className="py-2 font-mono text-xs text-muted-foreground">{color.hex_code}</TableCell>
                  <TableCell className="py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(color)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-error-400 hover:text-error-300"
                        disabled={deletingId === color.id}
                        onClick={() => handleDelete(color)}
                        title="Remover"
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
      )}

      <ColorDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  )
}
