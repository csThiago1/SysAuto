"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Search, Shield } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useInsurers, useInsurerDelete, useInsurerUploadLogo } from "@/hooks/useInsurers"
import { InsurerDialog } from "./_components/InsurerDialog"
import type { Insurer } from "@paddock/types"

export default function SeguradorasPage() {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Insurer | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading } = useInsurers(search)
  const deleteMutation = useInsurerDelete()
  const uploadLogo = useInsurerUploadLogo()

  const insurers: Insurer[] = data?.results ?? []

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(insurer: Insurer) {
    setEditing(insurer)
    setDialogOpen(true)
  }

  async function handleDelete(insurer: Insurer): Promise<void> {
    if (!confirm(`Remover "${insurer.trade_name || insurer.name}"?`)) return
    setDeletingId(insurer.id)
    try {
      await deleteMutation.mutateAsync(insurer.id)
      toast.success("Seguradora removida.")
    } catch {
      toast.error("Erro ao remover seguradora.")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleLogoUpload(insurer: Insurer, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split(".").pop()?.toLowerCase()
    const validTypes = ["image/png", "image/svg+xml"]
    if (!validTypes.includes(file.type) && ext !== "svg" && ext !== "png") {
      toast.error("Formato inválido. Use PNG ou SVG.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2 MB.")
      return
    }
    try {
      await uploadLogo.mutateAsync({ id: insurer.id, file })
      toast.success("Logo atualizado.")
    } catch {
      toast.error("Erro ao enviar logo.")
    }
    e.target.value = ""
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Seguradoras</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Seguradoras cadastradas no sistema — compartilhadas entre todas as unidades.
          </p>
        </div>
        <Button onClick={handleNew} className="bg-primary-600 hover:bg-primary-700 text-white gap-1.5">
          <Plus className="h-4 w-4" />
          Nova Seguradora
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
        <Input
          placeholder="Buscar seguradora..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white h-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={6} rows={6} />
      ) : insurers.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-400">
          {search ? "Nenhuma seguradora encontrada." : "Nenhuma seguradora cadastrada."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <Table>
            <TableHeader className="bg-neutral-50">
              <TableRow>
                <TableHead className="w-16">Logo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-20">Abrev.</TableHead>
                <TableHead className="w-28">Cor</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insurers.map((ins) => (
                <TableRow key={ins.id}>
                  {/* Logo cell — click to upload */}
                  <TableCell className="py-2">
                    <label className="cursor-pointer group relative" title="Clique para trocar o logo">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm group-hover:ring-2 group-hover:ring-primary-600/30 transition">
                        {ins.logo_url ? (
                          <img
                            src={ins.logo_url}
                            alt={ins.trade_name || ins.name}
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: ins.brand_color || "#6b7280" }}
                          >
                            {ins.abbreviation || ins.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        accept=".png,.svg,image/png,image/svg+xml"
                        className="hidden"
                        onChange={(e) => handleLogoUpload(ins, e)}
                      />
                    </label>
                  </TableCell>

                  <TableCell className="py-2">
                    <div className="font-medium text-neutral-800">{ins.trade_name || ins.name}</div>
                    {ins.trade_name && (
                      <div className="text-xs text-neutral-400">{ins.name}</div>
                    )}
                  </TableCell>

                  <TableCell className="py-2 font-mono text-neutral-600">{ins.abbreviation || "—"}</TableCell>

                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded-full border border-neutral-200 shrink-0"
                        style={{ backgroundColor: ins.brand_color || "#6b7280" }}
                      />
                      <span className="font-mono text-xs text-neutral-500">{ins.brand_color || "—"}</span>
                    </div>
                  </TableCell>

                  <TableCell className="py-2 font-mono text-xs text-neutral-600">{ins.cnpj}</TableCell>

                  <TableCell className="py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleEdit(ins)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        disabled={deletingId === ins.id}
                        onClick={() => handleDelete(ins)}
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

      <p className="text-xs text-neutral-400 flex items-center gap-1">
        <Shield className="h-3 w-3" />
        Clique no logo da seguradora para trocar a imagem rapidamente (PNG ou SVG).
      </p>

      <InsurerDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  )
}
