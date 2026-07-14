"use client"

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Pencil, Plus, Power, Search, Boxes } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  useMateriaisCanonico,
  useCreateMaterialCanonico,
  useUpdateMaterialCanonico,
  catalogKeys,
} from "@/hooks/usePricingCatalog"
import { apiFetch } from "@/lib/api"
import type { MaterialCanonico } from "@paddock/types"

// ─── Labels & Colors ────────────────────────────────────────────────────────

const TIPO_MATERIAL_LABELS: Record<MaterialCanonico["tipo"], string> = {
  consumivel: "Consumivel",
  ferramenta: "Ferramenta",
}

const TIPO_MATERIAL_COLORS: Record<MaterialCanonico["tipo"], string> = {
  consumivel: "bg-info-500/10 text-info-400 border-info-500/20",
  ferramenta: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

// ─── Zod Schema ─────────────────────────────────────────────────────────────

const materialSchema = z.object({
  codigo: z.string().min(1, "Codigo obrigatorio"),
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  unidade_base: z.enum(["un", "kg", "l", "m", "m2", "pc"]),
  tipo: z.enum(["consumivel", "ferramenta"]),
  is_active: z.boolean(),
})

type MaterialFormData = z.infer<typeof materialSchema>

// ─── Component ──────────────────────────────────────────────────────────────

export default function MateriaisCanonicoPage() {
  // State
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialCanonico | null>(null)
  const [deactivating, setDeactivating] = useState<MaterialCanonico | null>(null)

  // Queries & mutations
  const queryClient = useQueryClient()
  const { data: materiais = [], isLoading } = useMateriaisCanonico(search || undefined)
  const createMutation = useCreateMaterialCanonico()
  const updateMutation = useUpdateMaterialCanonico()

  // Form
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MaterialFormData>({ resolver: zodResolver(materialSchema) })

  // Reset form when sheet opens/closes or editing changes
  useEffect(() => {
    if (sheetOpen) {
      reset(
        editing
          ? {
              codigo: editing.codigo,
              nome: editing.nome,
              unidade_base: editing.unidade_base as "un" | "kg" | "l" | "m" | "m2" | "pc",
              tipo: editing.tipo,
              is_active: editing.is_active,
            }
          : {
              codigo: "",
              nome: "",
              unidade_base: "un",
              tipo: "consumivel",
              is_active: true,
            }
      )
    }
  }, [sheetOpen, editing, reset])

  // Filter: show/hide inactive
  const filtered = showInactive
    ? materiais
    : materiais.filter((m: MaterialCanonico) => m.is_active)

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(material: MaterialCanonico) {
    setEditing(material)
    setSheetOpen(true)
  }

  async function onSubmit(data: MaterialFormData) {
    try {
      if (editing) {
        const { codigo: _codigo, unidade_base: _unidade, ...updateData } = data
        await updateMutation.mutateAsync({ id: editing.id, data: updateData })
        toast.success("Material atualizado.")
      } else {
        await createMutation.mutateAsync(data)
        toast.success("Material criado.")
      }
      setSheetOpen(false)
    } catch {
      toast.error("Erro ao salvar. Tente novamente.")
    }
  }

  async function handleToggleActive() {
    if (!deactivating) return
    const newActive = !deactivating.is_active
    try {
      await apiFetch(`/api/proxy/pricing/catalog/materiais/${deactivating.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      })
      queryClient.invalidateQueries({ queryKey: catalogKeys.materiais() })
      toast.success(newActive ? "Material reativado." : "Material desativado.")
    } catch {
      toast.error("Erro ao alterar status. Tente novamente.")
    } finally {
      setDeactivating(null)
    }
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-3 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Materiais Canonicos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalogo de materiais e insumos na forma canonica — base do Motor de Orcamentos.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Material
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar material..."
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
        <EmptyState
          icon={<Boxes className="h-8 w-8" />}
          title={search ? "Nenhum material encontrado." : "Nenhum material cadastrado."}
          action={!search && (
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Material
            </Button>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-48">Codigo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-28">Unid. Base</TableHead>
                <TableHead className="w-32">Tipo</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m: MaterialCanonico) => (
                <TableRow key={m.id} className={!m.is_active ? "opacity-50" : undefined}>
                  <TableCell className="py-2 font-mono text-xs text-foreground/60">
                    {m.codigo}
                  </TableCell>
                  <TableCell className="py-2 font-medium text-foreground/90">{m.nome}</TableCell>
                  <TableCell className="py-2 text-sm text-foreground/60">{m.unidade_base}</TableCell>
                  <TableCell className="py-2">
                    <Badge className={`text-xs ${TIPO_MATERIAL_COLORS[m.tipo]}`}>
                      {TIPO_MATERIAL_LABELS[m.tipo]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    {m.is_active ? (
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
                        onClick={() => openEdit(m)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeactivating(m)}
                        title={m.is_active ? "Desativar" : "Reativar"}
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
        <Boxes className="h-3 w-3" />
        {filtered.length} materiais carregados.
      </p>

      {/* ─── Sheet Form ──────────────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editing ? "Editar Material" : "Novo Material"}</SheetTitle>
            <SheetDescription>
              {editing ? "Altere os dados e salve." : "Preencha para adicionar ao catalogo."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {/* Codigo */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Codigo *</Label>
              <Input
                placeholder="Ex: MAT-LIXA-01"
                disabled={!!editing}
                {...register("codigo")} aria-invalid={!!errors.codigo}
              />
              {errors.codigo && (
                <p className="text-xs text-error-400">{errors.codigo.message}</p>
              )}
            </div>

            {/* Nome */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Nome *</Label>
              <Input
                placeholder="Ex: Lixa d'agua 400"
                {...register("nome")} aria-invalid={!!errors.nome}
              />
              {errors.nome && (
                <p className="text-xs text-error-400">{errors.nome.message}</p>
              )}
            </div>

            {/* Unidade Base */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Unidade Base *</Label>
              <Controller
                name="unidade_base"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger disabled={!!editing}>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">un (unidade)</SelectItem>
                      <SelectItem value="kg">kg (quilograma)</SelectItem>
                      <SelectItem value="l">l (litro)</SelectItem>
                      <SelectItem value="m">m (metro)</SelectItem>
                      <SelectItem value="m2">m2 (metro quadrado)</SelectItem>
                      <SelectItem value="pc">pc (peca)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Tipo */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Tipo *</Label>
              <Controller
                name="tipo"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consumivel">Consumivel</SelectItem>
                      <SelectItem value="ferramenta">Ferramenta</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* is_active (only on edit) */}
            {editing && (
              <div className="flex items-center gap-2">
                <Controller
                  name="is_active"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="is_active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="is_active" className="text-sm cursor-pointer">
                  Ativo
                </Label>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                {editing ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ─── AlertDialog for Deactivate/Reactivate ───────────────────────────── */}
      <AlertDialog open={!!deactivating} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivating?.is_active ? "Desativar material?" : "Reativar material?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.is_active
                ? `O material "${deactivating?.nome}" sera desativado e nao aparecera mais em novos orcamentos.`
                : `O material "${deactivating?.nome}" sera reativado e voltara a aparecer em novos orcamentos.`}
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
