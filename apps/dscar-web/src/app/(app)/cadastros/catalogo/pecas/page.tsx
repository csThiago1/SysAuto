"use client"

import { useState } from "react"
import { Search, Plus, Package } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usePecasCanonicas, useCreatePecaCanonica } from "@/hooks/usePricingCatalog"
import type { PecaCanonica } from "@paddock/types"
import type { PecaCanonicoPayload } from "@/hooks/usePricingCatalog"

const TIPO_PECA_LABELS: Record<PecaCanonica["tipo_peca"], string> = {
  genuina: "Genuína",
  original: "Original",
  paralela: "Paralela",
  usada: "Usada",
  recondicionada: "Recondicionada",
}

const TIPO_PECA_COLORS: Record<PecaCanonica["tipo_peca"], string> = {
  genuina: "bg-emerald-100 text-emerald-700 border-emerald-200",
  original: "bg-blue-100 text-blue-700 border-blue-200",
  paralela: "bg-amber-100 text-amber-700 border-amber-200",
  usada: "bg-white/5 text-white/60 border-white/10",
  recondicionada: "bg-purple-100 text-purple-700 border-purple-200",
}

const EMPTY_FORM: PecaCanonicoPayload = {
  codigo: "",
  nome: "",
  tipo_peca: "original",
}

export default function PecasCanonicoPage() {
  const [search, setSearch] = useState("")
  const { data: pecas = [], isLoading } = usePecasCanonicas(search || undefined)
  const { mutateAsync: criar, isPending } = useCreatePecaCanonica()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState<PecaCanonicoPayload>(EMPTY_FORM)

  const set = (field: keyof PecaCanonicoPayload, value: string) =>
    setForm((p) => ({ ...p, [field]: value }))

  async function handleSave() {
    if (!form.codigo || !form.nome) {
      toast.error("Preencha código e nome da peça.")
      return
    }
    try {
      await criar({ ...form, is_active: true })
      toast.success("Peça cadastrada com sucesso.")
      setSheetOpen(false)
      setForm(EMPTY_FORM)
    } catch {
      toast.error("Erro ao cadastrar peça. Verifique se o código já existe.")
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Peças Canônicas</h1>
          <p className="mt-1 text-sm text-white/50">
            Catálogo de peças automotivas — base do Motor de Orçamentos.
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Peça
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
        <Input
          placeholder="Buscar peça..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/5 h-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={4} rows={8} />
      ) : pecas.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <Package className="mx-auto h-8 w-8 text-white/30" />
          <p className="text-sm text-white/40">
            {search ? "Nenhuma peça encontrada." : "Nenhuma peça cadastrada."}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Cadastrar primeira peça
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow>
                <TableHead className="w-52">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-36">Tipo</TableHead>
                <TableHead className="w-20">Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pecas.map((p: PecaCanonica) => (
                <TableRow key={p.id}>
                  <TableCell className="py-2 font-mono text-xs text-white/60">
                    {p.codigo}
                  </TableCell>
                  <TableCell className="py-2 font-medium text-white/90">{p.nome}</TableCell>
                  <TableCell className="py-2">
                    <Badge className={`text-xs ${TIPO_PECA_COLORS[p.tipo_peca]}`}>
                      {TIPO_PECA_LABELS[p.tipo_peca]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <span className={`text-xs ${p.is_active ? "text-emerald-600" : "text-white/40"}`}>
                      {p.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-white/40">{pecas.length} peça{pecas.length !== 1 ? "s" : ""} carregada{pecas.length !== 1 ? "s" : ""}.</p>

      {/* Sheet de criação */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[400px]">
          <SheetHeader>
            <SheetTitle>Nova Peça Canônica</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Código *</Label>
              <Input
                placeholder="Ex: PARACHOQUE-DIANTEIRO"
                value={form.codigo}
                onChange={(e) => set("codigo", e.target.value.toUpperCase())}
              />
              <p className="text-xs text-white/40">Use letras maiúsculas e hifens. Imutável após criação.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input
                placeholder="Ex: Parachoque Dianteiro"
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo de Peça</Label>
              <select
                value={form.tipo_peca}
                onChange={(e) => set("tipo_peca", e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {Object.entries(TIPO_PECA_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
