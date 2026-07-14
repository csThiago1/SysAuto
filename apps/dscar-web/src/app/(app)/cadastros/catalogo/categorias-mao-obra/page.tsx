"use client"

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Pencil, Plus, Power, HardHat } from "lucide-react"
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
  useCategoriasMaoObra,
  useCreateCategoriaMaoObra,
  useUpdateCategoriaMaoObra,
  catalogKeys,
} from "@/hooks/usePricingCatalog"
import { apiFetch } from "@/lib/api"
import type { CategoriaMaoObra } from "@paddock/types"

// ─── Zod Schema ─────────────────────────────────────────────────────────────

const categoriaSchema = z.object({
  codigo: z.string().min(1, "Codigo obrigatorio"),
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  ordem: z.coerce.number().int().min(0, "Ordem deve ser >= 0"),
  is_active: z.boolean(),
})

type CategoriaFormData = z.infer<typeof categoriaSchema>

// ─── Component ──────────────────────────────────────────────────────────────

export default function CategoriasMaoObraPage() {
  // State
  const [showInactive, setShowInactive] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CategoriaMaoObra | null>(null)
  const [deactivating, setDeactivating] = useState<CategoriaMaoObra | null>(null)

  // Queries & mutations
  const queryClient = useQueryClient()
  const { data: categorias = [], isLoading } = useCategoriasMaoObra()
  const createMutation = useCreateCategoriaMaoObra()
  const updateMutation = useUpdateCategoriaMaoObra()

  // Form
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CategoriaFormData>({ resolver: zodResolver(categoriaSchema) })

  // Reset form when sheet opens/closes or editing changes
  useEffect(() => {
    if (sheetOpen) {
      reset(
        editing
          ? {
              codigo: editing.codigo,
              nome: editing.nome,
              ordem: editing.ordem,
              is_active: editing.is_active,
            }
          : {
              codigo: "",
              nome: "",
              ordem: 0,
              is_active: true,
            }
      )
    }
  }, [sheetOpen, editing, reset])

  // Filter: show/hide inactive
  const filtered = showInactive
    ? categorias
    : categorias.filter((c: CategoriaMaoObra) => c.is_active)

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(categoria: CategoriaMaoObra) {
    setEditing(categoria)
    setSheetOpen(true)
  }

  async function onSubmit(data: CategoriaFormData) {
    try {
      if (editing) {
        const { codigo: _codigo, ...updateData } = data
        await updateMutation.mutateAsync({ id: editing.id, data: updateData })
        toast.success("Categoria atualizada.")
      } else {
        await createMutation.mutateAsync(data)
        toast.success("Categoria criada.")
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
      await apiFetch(`/api/proxy/pricing/catalog/categorias-mao-obra/${deactivating.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      })
      queryClient.invalidateQueries({ queryKey: catalogKeys.categoriasMaoObra })
      toast.success(newActive ? "Categoria reativada." : "Categoria desativada.")
    } catch {
      toast.error("Erro ao alterar status. Tente novamente.")
    } finally {
      setDeactivating(null)
    }
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 md:gap-6 px-0 py-3 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorias de Mao de Obra</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Classificacao de mao de obra para o catalogo tecnico do Motor de Orcamentos.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
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
        <TableSkeleton columns={5} rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<HardHat className="h-8 w-8" />}
          title="Nenhuma categoria de mao de obra cadastrada."
          action={
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova Categoria
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-24">Ordem</TableHead>
                <TableHead className="w-40">Codigo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: CategoriaMaoObra) => (
                <TableRow key={c.id} className={!c.is_active ? "opacity-50" : undefined}>
                  <TableCell className="py-2 text-sm text-muted-foreground text-center">
                    {c.ordem}
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs text-foreground/60">
                    {c.codigo}
                  </TableCell>
                  <TableCell className="py-2 font-medium text-foreground/90">{c.nome}</TableCell>
                  <TableCell className="py-2">
                    {c.is_active ? (
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
                        onClick={() => openEdit(c)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeactivating(c)}
                        title={c.is_active ? "Desativar" : "Reativar"}
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
        <HardHat className="h-3 w-3" />
        {filtered.length} categorias carregadas.
      </p>

      {/* ─── Sheet Form ──────────────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</SheetTitle>
            <SheetDescription>
              {editing ? "Altere os dados e salve." : "Preencha para adicionar ao catalogo."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {/* Codigo */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Codigo *</Label>
              <Input
                placeholder="Ex: MO-FUNILARIA"
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
                placeholder="Ex: Funilaria"
                {...register("nome")} aria-invalid={!!errors.nome}
              />
              {errors.nome && (
                <p className="text-xs text-error-400">{errors.nome.message}</p>
              )}
            </div>

            {/* Ordem */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Ordem</Label>
              <Input
                type="number"
                placeholder="0"
                min={0}
                {...register("ordem")} aria-invalid={!!errors.ordem}
              />
              {errors.ordem && (
                <p className="text-xs text-error-400">{errors.ordem.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Define a ordem de exibicao na lista. Menor valor aparece primeiro.
              </p>
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
              {deactivating?.is_active ? "Desativar categoria?" : "Reativar categoria?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.is_active
                ? `A categoria "${deactivating?.nome}" sera desativada e nao aparecera mais em novos orcamentos.`
                : `A categoria "${deactivating?.nome}" sera reativada e voltara a aparecer em novos orcamentos.`}
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
