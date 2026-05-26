"use client"

import { useState } from "react"
import { Search, Plus, Package, Pencil, Power } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  usePecasCanonicas,
  useCreatePecaCanonica,
  useUpdatePecaCanonica,
  catalogKeys,
} from "@/hooks/usePricingCatalog"
import { apiFetch } from "@/lib/api"
import type { PecaCanonica } from "@paddock/types"
import type { PecaCanonicoPayload } from "@/hooks/usePricingCatalog"

const TIPO_PECA_LABELS: Record<PecaCanonica["tipo_peca"], string> = {
  genuina: "Genuina",
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
  const [showInactive, setShowInactive] = useState(false)
  const { data: pecas = [], isLoading } = usePecasCanonicas(search || undefined)
  const { mutateAsync: criar, isPending: isCriando } = useCreatePecaCanonica()
  const { mutateAsync: atualizar, isPending: isAtualizando } = useUpdatePecaCanonica()

  const queryClient = useQueryClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PecaCanonica | null>(null)
  const [form, setForm] = useState<PecaCanonicoPayload>(EMPTY_FORM)
  const [deactivating, setDeactivating] = useState<PecaCanonica | null>(null)

  const isPending = isCriando || isAtualizando

  // Filter: show/hide inactive
  const filtered = showInactive
    ? pecas
    : pecas.filter((p: PecaCanonica) => p.is_active)

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
      toast.error("Preencha o nome da peca.")
      return
    }
    if (!editTarget && !form.codigo) {
      toast.error("Preencha o codigo da peca.")
      return
    }

    // Normalise NCM: remove dots
    const ncm = (form.ncm ?? "").replace(/\./g, "")
    if (ncm && ncm.length !== 8) {
      toast.error("NCM deve ter exatamente 8 digitos numericos (ex: 87089990).")
      return
    }
    const payload = { ...form, ncm }

    try {
      if (editTarget) {
        await atualizar({ ...payload, id: editTarget.id })
        toast.success("Peca atualizada com sucesso.")
      } else {
        await criar({ ...payload, is_active: true })
        toast.success("Peca cadastrada com sucesso.")
      }
      setSheetOpen(false)
      setEditTarget(null)
      setForm(EMPTY_FORM)
    } catch {
      toast.error(
        editTarget
          ? "Erro ao atualizar peca."
          : "Erro ao cadastrar peca. Verifique se o codigo ja existe."
      )
    }
  }

  async function handleToggleActive() {
    if (!deactivating) return
    const newActive = !deactivating.is_active
    try {
      await apiFetch(`/api/proxy/pricing/catalog/pecas/${deactivating.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      })
      queryClient.invalidateQueries({ queryKey: catalogKeys.pecas() })
      toast.success(newActive ? "Peca reativada." : "Peca desativada.")
    } catch {
      toast.error("Erro ao alterar status. Tente novamente.")
    } finally {
      setDeactivating(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pecas Canonicas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalogo de pecas automotivas — base do Motor de Orcamentos. NCM obrigatorio para emissao de NF-e.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nova Peca
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar peca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 h-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={showInactive}
            onCheckedChange={(v) => setShowInactive(v === true)}
          />
          Mostrar inativos
        </label>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={6} rows={8} />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search ? "Nenhuma peca encontrada." : "Nenhuma peca cadastrada."}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Cadastrar primeira peca
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-48">Codigo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead className="w-28 font-mono">NCM</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: PecaCanonica) => (
                <TableRow key={p.id} className={!p.is_active ? "opacity-50" : undefined}>
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
                      <span className="text-xs text-warning-400">sem NCM</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {p.is_active ? (
                      <Badge className="bg-success-500/10 text-success-500 border-success-500/20 text-xs">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge className="bg-muted/50 text-muted-foreground border-border text-xs">
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(p)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeactivating(p)}
                        title={p.is_active ? "Desativar" : "Reativar"}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Package className="h-3 w-3" />
        {filtered.length} peca{filtered.length !== 1 ? "s" : ""} carregada{filtered.length !== 1 ? "s" : ""}.
        {pecas.filter((p: PecaCanonica) => !p.ncm).length > 0 && (
          <span className="ml-2 text-warning-400">
            {pecas.filter((p: PecaCanonica) => !p.ncm).length} sem NCM — NCM obrigatorio para NF-e.
          </span>
        )}
      </p>

      {/* Sheet criar/editar */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[420px]">
          <SheetHeader>
            <SheetTitle>{editTarget ? "Editar Peca Canonica" : "Nova Peca Canonica"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Codigo {!editTarget && <span className="text-error-400">*</span>}
              </Label>
              <Input
                placeholder="Ex: PARACHOQUE-DIANTEIRO"
                value={form.codigo}
                disabled={Boolean(editTarget)}
                onChange={(e) => set("codigo", e.target.value.toUpperCase())}
              />
              {!editTarget && (
                <p className="text-xs text-muted-foreground">Use letras maiusculas e hifens. Imutavel apos criacao.</p>
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
              <Label className="text-xs font-medium">Tipo de Peca</Label>
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
                8 digitos numericos. Obrigatorio para emissao de NF-e de produto.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isPending}>
                {isPending ? "Salvando..." : editTarget ? "Salvar alteracoes" : "Criar peca"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* AlertDialog for Deactivate/Reactivate */}
      <AlertDialog open={!!deactivating} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivating?.is_active ? "Desativar peca?" : "Reativar peca?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.is_active
                ? `A peca "${deactivating?.nome}" sera desativada e nao aparecera mais em novos orcamentos.`
                : `A peca "${deactivating?.nome}" sera reativada e voltara a aparecer em novos orcamentos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive}>
              {deactivating?.is_active ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
