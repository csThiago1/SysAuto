"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Search, Landmark } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { useBanks, useDeleteBank, type Bank } from "@/hooks/useBanks"
import { BankDialog } from "./_components/BankDialog"

export default function BancosPage() {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Bank | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data, isLoading } = useBanks(search)
  const deleteMutation = useDeleteBank()
  const banks = data ?? []

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(bank: Bank) {
    setEditing(bank)
    setDialogOpen(true)
  }

  async function handleDelete(bank: Bank): Promise<void> {
    if (!confirm(`Remover "${bank.name}"?`)) return
    setDeletingId(bank.id)
    try {
      await deleteMutation.mutateAsync(bank.id)
      toast.success("Banco removido.")
    } catch {
      toast.error("Erro ao remover banco.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6 px-0 py-3 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bancos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de bancos (FEBRABAN) — usado nos dados bancários de fornecedores.
          </p>
        </div>
        <Button onClick={handleNew} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Banco
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por código ou nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted/50 h-9"
        />
      </div>

      {isLoading ? (
        <TableSkeleton columns={4} rows={6} />
      ) : banks.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-8 w-8" />}
          title={search ? "Nenhum banco encontrado." : "Nenhum banco cadastrado."}
          action={!search && (
            <Button variant="outline" size="sm" onClick={handleNew}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Banco
            </Button>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-16">Logo</TableHead>
                <TableHead className="w-20">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((bank) => (
                <TableRow key={bank.id}>
                  <TableCell className="py-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/50 overflow-hidden">
                      {bank.logo_url ? (
                        <img src={bank.logo_url} alt={bank.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground">{bank.code}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 font-mono text-foreground/70">{bank.code}</TableCell>
                  <TableCell className="py-2 font-medium text-foreground/90">{bank.name}</TableCell>
                  <TableCell className="py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(bank)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-error-400 hover:text-error-300"
                        disabled={deletingId === bank.id}
                        onClick={() => handleDelete(bank)}
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

      <BankDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  )
}
