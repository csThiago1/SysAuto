"use client"

import { useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { Plus, Pencil, Power, Search, Shield, ExternalLink } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
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
import { PermissionGate } from "@/components/PermissionGate"
import { usePermission } from "@/hooks/usePermission"
import {
  useInsurers,
  useInsurerUploadLogo,
  useSetInsurerActive,
  type InsurerListItem,
} from "@/hooks/useInsurers"
import { InsurerDialog } from "./_components/InsurerDialog"

export default function SeguradorasPage() {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<InsurerListItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const isAdmin = usePermission("ADMIN")
  const { data, isLoading, isError } = useInsurers(search, { includeInactive: isAdmin })
  const setActive = useSetInsurerActive()
  const uploadLogo = useInsurerUploadLogo()

  const insurers: InsurerListItem[] = data?.results ?? []

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(insurer: InsurerListItem) {
    setEditing(insurer)
    setDialogOpen(true)
  }

  async function handleToggleActive(insurer: InsurerListItem): Promise<void> {
    const name = insurer.trade_name || insurer.name
    if (insurer.is_active && !confirm(`Desativar "${name}"? Ela some das listas de seleção.`)) return
    setTogglingId(insurer.id)
    try {
      await setActive.mutateAsync({ id: insurer.id, is_active: !insurer.is_active })
      toast.success(insurer.is_active ? "Seguradora desativada." : "Seguradora reativada.")
    } catch {
      toast.error("Erro ao alterar a seguradora.")
    } finally {
      setTogglingId(null)
    }
  }

  async function handleLogoUpload(insurer: InsurerListItem, e: React.ChangeEvent<HTMLInputElement>) {
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
    <div className="flex flex-col gap-4 md:gap-6 px-0 py-3 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Seguradoras</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seguradoras cadastradas no sistema — compartilhadas entre todas as unidades.
          </p>
        </div>
        <PermissionGate role="ADMIN">
          <Button onClick={handleNew} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5">
            <Plus className="h-4 w-4" />
            Nova Seguradora
          </Button>
        </PermissionGate>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar seguradora..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted/50 h-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={6} rows={6} />
      ) : isError ? (
        <EmptyState
          icon={<Shield className="h-8 w-8" />}
          title="Erro ao carregar seguradoras."
          description="Tente novamente em instantes."
        />
      ) : insurers.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-8 w-8" />}
          title={search ? "Nenhuma seguradora encontrada." : "Nenhuma seguradora cadastrada."}
          action={!search && (
            <PermissionGate role="ADMIN">
              <Button variant="outline" size="sm" onClick={handleNew}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nova Seguradora
              </Button>
            </PermissionGate>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
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
                <TableRow key={ins.id} className={ins.is_active ? undefined : "opacity-60"}>
                  {/* Logo cell — ADMIN clica para trocar */}
                  <TableCell className="py-2">
                    <PermissionGate role="ADMIN" fallback={<InsurerLogoBox insurer={ins} />}>
                      <label className="cursor-pointer group relative" title="Clique para trocar o logo">
                        <InsurerLogoBox insurer={ins} />
                        <input
                          type="file"
                          accept=".png,.svg,image/png,image/svg+xml"
                          className="hidden"
                          onChange={(e) => handleLogoUpload(ins, e)}
                        />
                      </label>
                    </PermissionGate>
                  </TableCell>

                  <TableCell className="py-2">
                    <div className="font-medium text-foreground/90">
                      {ins.trade_name || ins.name}
                      {!ins.is_active && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                          Inativa
                        </span>
                      )}
                    </div>
                    {ins.trade_name && (
                      <div className="text-xs text-muted-foreground">{ins.name}</div>
                    )}
                  </TableCell>

                  <TableCell className="py-2 font-mono text-foreground/60">{ins.abbreviation || "—"}</TableCell>

                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded-full border border-border shrink-0"
                        style={{ backgroundColor: ins.brand_color || "#6b7280" }}
                      />
                      <span className="font-mono text-xs text-muted-foreground">{ins.brand_color || "—"}</span>
                    </div>
                  </TableCell>

                  <TableCell className="py-2 font-mono text-xs text-foreground/60">{ins.cnpj}</TableCell>

                  <TableCell className="py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        asChild
                        title="Perfil Operacional"
                      >
                        <Link href={`/cadastros/seguradoras/${ins.id}` as Route}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <PermissionGate role="ADMIN">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleEdit(ins)}
                          title="Editar"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={ins.is_active ? "h-7 w-7 text-error-400 hover:text-error-300" : "h-7 w-7"}
                          disabled={togglingId === ins.id}
                          onClick={() => handleToggleActive(ins)}
                          title={ins.is_active ? "Desativar" : "Reativar"}
                          aria-label={ins.is_active ? "Desativar" : "Reativar"}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PermissionGate role="ADMIN">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Clique no logo da seguradora para trocar a imagem rapidamente (PNG ou SVG).
        </p>
      </PermissionGate>

      <InsurerDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  )
}

function InsurerLogoBox({ insurer }: { insurer: InsurerListItem }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 overflow-hidden shadow-sm group-hover:ring-2 group-hover:ring-ring/30 transition">
      {insurer.logo_url ? (
        <img
          src={insurer.logo_url}
          alt={insurer.trade_name || insurer.name}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-foreground text-xs font-bold"
          style={{ backgroundColor: insurer.brand_color || "#6b7280" }}
        >
          {insurer.abbreviation || insurer.name.charAt(0)}
        </div>
      )}
    </div>
  )
}
