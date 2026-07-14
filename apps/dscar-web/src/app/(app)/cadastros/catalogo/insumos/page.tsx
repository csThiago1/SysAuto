"use client"

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Pencil, Plus, Power, Search, FlaskConical } from "lucide-react"
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
  useInsumosMaterial,
  useMateriaisCanonico,
  useCreateInsumoMaterial,
  useUpdateInsumoMaterial,
  catalogKeys,
} from "@/hooks/usePricingCatalog"
import { apiFetch } from "@/lib/api"
import type { InsumoMaterial } from "@paddock/types"

// ─── Zod Schema ─────────────────────────────────────────────────────────────

const insumoSchema = z.object({
  material_canonico: z.string().min(1, "Selecione um material"),
  sku_interno: z.string().min(1, "SKU obrigatorio"),
  descricao: z.string().min(2, "Descricao deve ter ao menos 2 caracteres"),
  marca: z.string().optional(),
  gtin: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{13,14}$/.test(v), "GTIN deve ter 13 ou 14 digitos"),
  unidade_compra: z.enum(["un", "kg", "l", "m", "pc"]),
  fator_conversao: z.string().min(1, "Fator obrigatorio"),
  is_active: z.boolean(),
})

type InsumoFormData = z.infer<typeof insumoSchema>

// ─── Component ──────────────────────────────────────────────────────────────

export default function InsumosPage() {
  // State
  const [showInactive, setShowInactive] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<InsumoMaterial | null>(null)
  const [deactivating, setDeactivating] = useState<InsumoMaterial | null>(null)

  // Queries & mutations
  const queryClient = useQueryClient()
  const { data: insumos = [], isLoading } = useInsumosMaterial()
  const { data: materiais = [] } = useMateriaisCanonico()
  const createMutation = useCreateInsumoMaterial()
  const updateMutation = useUpdateInsumoMaterial()

  // Form
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<InsumoFormData>({ resolver: zodResolver(insumoSchema) })

  // Reset form when sheet opens/closes or editing changes
  useEffect(() => {
    if (sheetOpen) {
      reset(
        editing
          ? {
              material_canonico: editing.material_canonico,
              sku_interno: editing.sku_interno,
              descricao: editing.descricao,
              marca: editing.marca || "",
              gtin: editing.gtin || "",
              unidade_compra: editing.unidade_compra as "un" | "kg" | "l" | "m" | "pc",
              fator_conversao: editing.fator_conversao,
              is_active: editing.is_active,
            }
          : {
              material_canonico: "",
              sku_interno: "",
              descricao: "",
              marca: "",
              gtin: "",
              unidade_compra: "un",
              fator_conversao: "1",
              is_active: true,
            }
      )
    }
  }, [sheetOpen, editing, reset])

  // Filter: show/hide inactive
  const filtered = showInactive
    ? insumos
    : insumos.filter((i: InsumoMaterial) => i.is_active)

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(insumo: InsumoMaterial) {
    setEditing(insumo)
    setSheetOpen(true)
  }

  async function onSubmit(data: InsumoFormData) {
    try {
      if (editing) {
        const { material_canonico: _mat, sku_interno: _sku, ...updateData } = data
        await updateMutation.mutateAsync({ id: editing.id, data: updateData })
        toast.success("Insumo atualizado.")
      } else {
        await createMutation.mutateAsync(data)
        toast.success("Insumo criado.")
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
      await apiFetch(`/api/proxy/pricing/catalog/insumos/${deactivating.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      })
      queryClient.invalidateQueries({ queryKey: catalogKeys.insumos() })
      toast.success(newActive ? "Insumo reativado." : "Insumo desativado.")
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
          <h1 className="text-2xl font-bold text-foreground">Insumos / Materiais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SKUs especificos de materiais canonicos — marcas, GTINs e fatores de conversao.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Insumo
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
        <TableSkeleton columns={7} rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-8 w-8" />}
          title="Nenhum insumo cadastrado."
          action={
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Insumo
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-40">SKU Interno</TableHead>
                <TableHead>Descricao</TableHead>
                <TableHead className="w-32">Marca</TableHead>
                <TableHead className="w-36">GTIN/EAN</TableHead>
                <TableHead className="w-32">Fator Conv.</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i: InsumoMaterial) => (
                <TableRow key={i.id} className={!i.is_active ? "opacity-50" : undefined}>
                  <TableCell className="py-2 font-mono text-xs text-foreground/60">
                    {i.sku_interno}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="font-medium text-foreground/90">{i.descricao}</div>
                    {i.material_canonico_nome && (
                      <div className="text-xs text-muted-foreground">{i.material_canonico_nome}</div>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-foreground/60">{i.marca || "—"}</TableCell>
                  <TableCell className="py-2 font-mono text-xs text-foreground/60">
                    {i.gtin || "—"}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-foreground/60">
                    {i.fator_conversao} {i.unidade_compra}
                  </TableCell>
                  <TableCell className="py-2">
                    {i.is_active ? (
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
                        onClick={() => openEdit(i)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeactivating(i)}
                        title={i.is_active ? "Desativar" : "Reativar"}
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
        <FlaskConical className="h-3 w-3" />
        {filtered.length} insumos carregados.
      </p>

      {/* ─── Sheet Form ──────────────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editing ? "Editar Insumo" : "Novo Insumo"}</SheetTitle>
            <SheetDescription>
              {editing ? "Altere os dados e salve." : "Preencha para adicionar ao catalogo."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {/* Material Canonico */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Material Canonico *</Label>
              <Controller
                name="material_canonico"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger disabled={!!editing}>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materiais.map((mat) => (
                        <SelectItem key={mat.id} value={mat.id}>
                          {mat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.material_canonico && (
                <p className="text-xs text-error-400">{errors.material_canonico.message}</p>
              )}
            </div>

            {/* SKU Interno */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">SKU Interno *</Label>
              <Input
                placeholder="Ex: INS-LIXA-400-3M"
                disabled={!!editing}
                {...register("sku_interno")} aria-invalid={!!errors.sku_interno}
              />
              {errors.sku_interno && (
                <p className="text-xs text-error-400">{errors.sku_interno.message}</p>
              )}
            </div>

            {/* Descricao */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Descricao *</Label>
              <Input
                placeholder="Ex: Lixa d'agua 400 3M"
                {...register("descricao")} aria-invalid={!!errors.descricao}
              />
              {errors.descricao && (
                <p className="text-xs text-error-400">{errors.descricao.message}</p>
              )}
            </div>

            {/* Marca */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">
                Marca <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="Ex: 3M"
                {...register("marca")} aria-invalid={!!errors.marca}
              />
            </div>

            {/* GTIN */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">
                GTIN/EAN <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="Ex: 7891040109715"
                className="font-mono"
                maxLength={14}
                {...register("gtin")} aria-invalid={!!errors.gtin}
              />
              {errors.gtin && (
                <p className="text-xs text-error-400">{errors.gtin.message}</p>
              )}
              <p className="text-xs text-muted-foreground">13 ou 14 digitos numericos.</p>
            </div>

            {/* Unidade Compra */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Unidade de Compra</Label>
              <Controller
                name="unidade_compra"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">un (unidade)</SelectItem>
                      <SelectItem value="kg">kg (quilograma)</SelectItem>
                      <SelectItem value="l">l (litro)</SelectItem>
                      <SelectItem value="m">m (metro)</SelectItem>
                      <SelectItem value="pc">pc (peca)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Fator Conversao */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Fator de Conversao *</Label>
              <Input
                placeholder="Ex: 1"
                {...register("fator_conversao")} aria-invalid={!!errors.fator_conversao}
              />
              {errors.fator_conversao && (
                <p className="text-xs text-error-400">{errors.fator_conversao.message}</p>
              )}
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
              {deactivating?.is_active ? "Desativar insumo?" : "Reativar insumo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.is_active
                ? `O insumo "${deactivating?.descricao}" sera desativado e nao aparecera mais em novos orcamentos.`
                : `O insumo "${deactivating?.descricao}" sera reativado e voltara a aparecer em novos orcamentos.`}
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
