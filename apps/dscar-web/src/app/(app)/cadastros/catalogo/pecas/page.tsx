"use client"

import { useState } from "react"
import { Search, Plus, Package, Pencil } from "lucide-react"
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
import {
  usePecasCanonicas,
  useCreatePecaCanonica,
  useUpdatePecaCanonica,
} from "@/hooks/usePricingCatalog"
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
  genuina: "bg-success-500/10 text-success-400 border-success-500/20",
  original: "bg-info-500/10 text-info-400 border-info-500/20",
  paralela: "bg-warning-500/10 text-warning-400 border-warning-500/20",
  usada: "bg-muted/50 text-foreground/60 border-border",
  recondicionada: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

const EMPTY_FORM: PecaCanonicoPayload = {
  codigo: "",
  nome: "",
  tipo_peca: "original",
  ncm: "",
}

export default function PecasCanonicoPage() {
  const [search, setSearch] = useState("")
  const { data: pecas = [], isLoading } = usePecasCanonicas(search || undefined)
  const { mutateAsync: criar, isPending: isCriando } = useCreatePecaCanonica()
  const { mutateAsync: atualizar, isPending: isAtualizando } = useUpdatePecaCanonica()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PecaCanonica | null>(null)
  const [form, setForm] = useState<PecaCanonicoPayload>(EMPTY_FORM)

  const isPending = isCriando || isAtualizando

  const set = (field: keyof PecaCanonicoPayload, value: string) =>
    setForm((p) => ({ ...p, [field]: value }))

  function openCreate() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setSheetOpen(true)
  }

  function openEdit(peca: PecaCanonica) {
    setEditTarget(peca)
    setForm({
      codigo: peca.codigo,
      nome: peca.nome,
      tipo_peca: peca.tipo_peca,
      ncm: peca.ncm ?? "",
    })
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!form.nome) {
      toast.error("Preencha o nome da peça.")
      return
    }
    if (!editTarget && !form.codigo) {
      toast.error("Preencha o código da peça.")
      return
    }

    // Normalise NCM: remove dots
    const ncm = (form.ncm ?? "").replace(/\./g, "")
    if (ncm && ncm.length !== 8) {
      toast.error("NCM deve ter exatamente 8 dígitos numéricos (ex: 87089990).")
      return
    }
    const payload = { ...form, ncm }

    try {
      if (editTarget) {
        await atualizar({ ...payload, id: editTarget.id })
        toast.success("Peça atualizada com sucesso.")
      } else {
        await criar({ ...payload, is_active: true })
        toast.success("Peça cadastrada com sucesso.")
      }
      setSheetOpen(false)
      setEditTarget(null)
      setForm(EMPTY_FORM)
    } catch {
      toast.error(
        editTarget
          ? "Erro ao atualizar peça."
          : "Erro ao cadastrar peça. Verifique se o código já existe."
      )
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Peças Canônicas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de peças automotivas — base do Motor de Orçamentos. NCM obrigatório para emissão de NF-e.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Peça
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar peça..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted/50 h-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={5} rows={8} />
      ) : pecas.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search ? "Nenhuma peça encontrada." : "Nenhuma peça cadastrada."}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Cadastrar primeira peça
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-48">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead className="w-28 font-mono">NCM</TableHead>
                <TableHead className="w-16">Ativo</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pecas.map((p: PecaCanonica) => (
                <TableRow key={p.id}>
                  <TableCell className="py-2 font-mono text-xs text-foreground/60">
                    {p.codigo}
                  </TableCell>
                  <TableCell className="py-2 font-medium text-foreground/90">{p.nome}</TableCell>
                  <TableCell className="py-2">
                    <Badge className={`text-xs ${TIPO_PECA_COLORS[p.tipo_peca]}`}>
                      {TIPO_PECA_LABELS[p.tipo_peca]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    {p.ncm ? (
                      <span className="font-mono text-xs text-foreground/70">{p.ncm}</span>
                    ) : (
                      <span className="text-xs text-amber-500/70">sem NCM</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <span className={`text-xs ${p.is_active ? "text-success-400" : "text-muted-foreground"}`}>
                      {p.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="py-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground/70 transition-colors"
                      title="Editar peça"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {pecas.length} peça{pecas.length !== 1 ? "s" : ""} carregada{pecas.length !== 1 ? "s" : ""}.
        {pecas.filter((p: PecaCanonica) => !p.ncm).length > 0 && (
          <span className="ml-2 text-amber-500/70">
            {pecas.filter((p: PecaCanonica) => !p.ncm).length} sem NCM — NCM obrigatório para NF-e.
          </span>
        )}
      </p>

      {/* Sheet criar/editar */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[420px]">
          <SheetHeader>
            <SheetTitle>{editTarget ? "Editar Peça Canônica" : "Nova Peça Canônica"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Código {!editTarget && <span className="text-error-400">*</span>}
              </Label>
              <Input
                placeholder="Ex: PARACHOQUE-DIANTEIRO"
                value={form.codigo}
                disabled={Boolean(editTarget)}
                onChange={(e) => set("codigo", e.target.value.toUpperCase())}
              />
              {!editTarget && (
                <p className="text-xs text-muted-foreground">Use letras maiúsculas e hifens. Imutável após criação.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome <span className="text-error-400">*</span></Label>
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
                className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.entries(TIPO_PECA_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">NCM</Label>
              <Input
                placeholder="Ex: 87089990"
                maxLength={10}
                className="font-mono"
                value={form.ncm ?? ""}
                onChange={(e) => set("ncm", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                8 dígitos numéricos. Obrigatório para emissão de NF-e de produto.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isPending}>
                {isPending ? "Salvando..." : editTarget ? "Salvar alterações" : "Criar peça"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
