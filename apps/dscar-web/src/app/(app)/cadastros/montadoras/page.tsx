"use client"

import { useState } from "react"
import { Car, Search } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { useFipeMakes, type VehicleMake } from "@/hooks/useVehicleFipe"
import { MakeLogoDialog } from "./_components/MakeLogoDialog"

export default function MontadorasPage() {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleMake | null>(null)
  const { data, isLoading } = useFipeMakes()

  const makes = (data ?? []).filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase())
  )

  function handleLogoClick(make: VehicleMake) {
    setEditing(make)
    setDialogOpen(true)
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

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar montadora..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted/50 h-9"
        />
      </div>

      {isLoading ? (
        <TableSkeleton columns={2} rows={8} />
      ) : makes.length === 0 ? (
        <EmptyState
          icon={<Car className="h-8 w-8" />}
          title={search ? "Nenhuma montadora encontrada." : "Nenhuma montadora sincronizada ainda."}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-16">Logo</TableHead>
                <TableHead>Nome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {makes.map((make) => (
                <TableRow key={make.id}>
                  <TableCell className="py-2">
                    <button
                      type="button"
                      title="Clique para editar o logo"
                      onClick={() => handleLogoClick(make)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/50 overflow-hidden hover:ring-2 hover:ring-ring/30 transition"
                    >
                      {make.logo_url ? (
                        <img src={make.logo_url} alt={make.nome} className="h-full w-full object-contain p-1" />
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {make.nome.charAt(0)}
                        </span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="py-2 font-medium text-foreground/90">{make.nome}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MakeLogoDialog open={dialogOpen} onOpenChange={setDialogOpen} make={editing} />
    </div>
  )
}
