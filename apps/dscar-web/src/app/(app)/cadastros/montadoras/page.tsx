"use client"

import { useState } from "react"
import { Car, Search } from "lucide-react"
import { toast } from "sonner"
import { PermissionGate } from "@/components/PermissionGate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { MakeLogo } from "@/components/vehicle/MakeLogo"
import {
  VEHICLE_TIPOS, type CatalogOption, type VehicleTipo,
} from "@/components/vehicle/catalog.schema"
import {
  useCatalogOptions, useMakesAdmin, useSetMakeActive, type MakeAdmin,
} from "@/hooks/useCatalog"
import { useDebounce } from "@/hooks/useDebounce"
import { usePermission } from "@/hooks/usePermission"
import { cn } from "@/lib/utils"
import { MakeLogoDialog } from "./_components/MakeLogoDialog"

export default function MontadorasPage() {
  const [tipo, setTipo] = useState<VehicleTipo>("carro")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<MakeAdmin | null>(null)
  const debounced = useDebounce(search.trim(), 300)
  const isAdmin = usePermission("ADMIN")
  // só uma das duas busca: o ADMIN vê também as desativadas; o resto, só as ativas
  const admin = useMakesAdmin(isAdmin ? tipo : null, debounced)
  const options = useCatalogOptions("makes", { tipo: isAdmin ? undefined : tipo }, debounced)
  const query = isAdmin ? admin : options
  const rows: { make: CatalogOption; adminMake: MakeAdmin | null }[] = isAdmin
    ? (admin.data?.pages.flatMap((p) => p.results) ?? []).map((m) => ({ make: m, adminMake: m }))
    : (options.data?.pages.flatMap((p) => p.results) ?? []).map((m) => ({ make: m, adminMake: null }))
  const setActive = useSetMakeActive()

  async function toggleActive(make: MakeAdmin) {
    try {
      await setActive.mutateAsync({ id: make.id, is_active: !make.is_active })
      toast.success(make.is_active ? "Montadora desativada." : "Montadora reativada.")
    } catch {
      toast.error("Erro ao atualizar a montadora.")
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6 px-0 py-3 md:p-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Montadoras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Marcas de veículo sincronizadas da FIPE. Nome e código não são editáveis
          aqui — clique no logo para colar a URL da imagem.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Tipo de veículo" className="inline-flex rounded-md border border-border p-0.5">
          {VEHICLE_TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={tipo === t.value}
              onClick={() => setTipo(t.value)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium",
                tipo === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar montadora..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 h-9"
          />
        </div>
      </div>

      {query.isLoading ? (
        <TableSkeleton columns={2} rows={8} />
      ) : query.isError ? (
        <EmptyState
          icon={<Car className="h-8 w-8" />}
          title="Não foi possível carregar as montadoras."
          action={
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Car className="h-8 w-8" />}
          title={debounced ? "Nenhuma montadora encontrada." : "Nenhuma montadora sincronizada ainda."}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-16">Logo</TableHead>
                <TableHead>Nome</TableHead>
                {isAdmin && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ make, adminMake }) => (
                <TableRow key={make.id}>
                  <TableCell className="py-2">
                    <PermissionGate role="ADMIN" fallback={<MakeLogo make={make} />}>
                      <button
                        type="button"
                        title="Clique para editar o logo"
                        onClick={() => setEditing(adminMake)}
                        className="rounded hover:ring-2 hover:ring-ring/30 transition"
                      >
                        <MakeLogo make={make} />
                      </button>
                    </PermissionGate>
                  </TableCell>
                  <TableCell className="py-2 font-medium text-foreground/90">
                    {make.label}
                    {adminMake && !adminMake.is_active && (
                      <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
                        Inativa
                      </Badge>
                    )}
                  </TableCell>
                  {adminMake && (
                    <TableCell className="py-2 text-right">
                      <PermissionGate role="ADMIN">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={setActive.isPending}
                          onClick={() => toggleActive(adminMake)}
                        >
                          {adminMake.is_active ? "Desativar" : "Reativar"}
                        </Button>
                      </PermissionGate>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {query.hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="self-center"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
        </Button>
      )}

      <PermissionGate role="ADMIN">
        <MakeLogoDialog
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          make={editing}
        />
      </PermissionGate>
    </div>
  )
}
