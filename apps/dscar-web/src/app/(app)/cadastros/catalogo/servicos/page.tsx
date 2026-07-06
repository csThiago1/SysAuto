"use client"

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Pencil, Plus, Power, Search, Wrench } from "lucide-react"
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
  useServicosCanonico,
  useCategoriasServico,
  useCreateServicoCanonico,
  useUpdateServicoCanonico,
  catalogKeys,
} from "@/hooks/usePricingCatalog"
import { apiFetch } from "@/lib/api"
import type { ServicoCanonico } from "@paddock/types"

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const servicoSchema = z.object({
  codigo: z.string().min(1, "Codigo obrigatorio"),
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  categoria: z.string().min(1, "Selecione uma categoria"),
  unidade: z.enum(["un", "h", "m2"]),
  descricao: z.string().optional(),
  aplica_multiplicador_tamanho: z.boolean(),
  is_active: z.boolean(),
})

type ServicoFormData = z.infer<typeof servicoSchema>

// ─── Component ───────────────────────────────────────────────────────────────

export default function ServicosCanonicoPage() {
  // State
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ServicoCanonico | null>(null)
  const [deactivating, setDeactivating] = useState<ServicoCanonico | null>(null)

  // Queries & mutations
  const queryClient = useQueryClient()
  const { data: servicos = [], isLoading } = useServicosCanonico(search || undefined)
  const { data: categorias = [] } = useCategoriasServico()
  const createMutation = useCreateServicoCanonico()
  const updateMutation = useUpdateServicoCanonico()

  // Form
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ServicoFormData>({ resolver: zodResolver(servicoSchema) })

  // Reset form when sheet opens/closes or editing changes
  useEffect(() => {
    if (sheetOpen) {
      reset(
        editing
          ? {
              codigo: editing.codigo,
              nome: editing.nome,
              categoria: editing.categoria,
              unidade: editing.unidade as "un" | "h" | "m2",
              descricao: editing.descricao ?? "",
              aplica_multiplicador_tamanho: editing.aplica_multiplicador_tamanho,
              is_active: editing.is_active,
            }
          : {
              codigo: "",
              nome: "",
              categoria: "",
              unidade: "un",
              descricao: "",
              aplica_multiplicador_tamanho: false,
              is_active: true,
            }
      )
    }
  }, [sheetOpen, editing, reset])

  // Filter: category + show/hide inactive
  const filtered = servicos.filter((s: ServicoCanonico) => {
    if (!showInactive && !s.is_active) return false
    if (categoryFilter && s.categoria !== categoryFilter) return false
    return true
  })

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(servico: ServicoCanonico) {
    setEditing(servico)
    setSheetOpen(true)
  }

  async function onSubmit(data: ServicoFormData) {
    try {
      if (editing) {
        const { codigo: _codigo, ...updateData } = data
        await updateMutation.mutateAsync({ id: editing.id, data: updateData })
        toast.success("Servico atualizado.")
      } else {
        await createMutation.mutateAsync(data)
        toast.success("Servico criado.")
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
      await apiFetch(`/api/proxy/pricing/catalog/servicos/${deactivating.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      })
      queryClient.invalidateQueries({ queryKey: catalogKeys.servicos() })
      toast.success(newActive ? "Servico reativado." : "Servico desativado.")
    } catch {
      toast.error("Erro ao alterar status. Tente novamente.")
    } finally {
      setDeactivating(null)
    }
  }

  // ─── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Servicos Canonicos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalogo de servicos na forma canonica — base do Motor de Orcamentos.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Servico
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar servico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48 bg-muted/50 h-9">
            <SelectValue placeholder="Todas categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          icon={<Wrench className="h-8 w-8" />}
          title={search ? "Nenhum servico encontrado." : "Nenhum servico cadastrado."}
          action={!search && (
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Servico
            </Button>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-36">Codigo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-32">Categoria</TableHead>
                <TableHead className="w-24">Unidade</TableHead>
                <TableHead className="w-36">Mult. Tamanho</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s: ServicoCanonico) => (
                <TableRow key={s.id} className={!s.is_active ? "opacity-50" : undefined}>
                  <TableCell className="py-2 font-mono text-xs text-foreground/60">
                    {s.codigo}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="font-medium text-foreground/90">{s.nome}</div>
                    {s.descricao && (
                      <div className="text-xs text-muted-foreground truncate max-w-xs">
                        {s.descricao}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-foreground/60">
                    {s.categoria_nome ?? "—"}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-foreground/60">{s.unidade}</TableCell>
                  <TableCell className="py-2">
                    {s.aplica_multiplicador_tamanho ? (
                      <Badge className="bg-error-500/10 text-error-400 border-error-500/20 text-xs">
                        Aplica
                      </Badge>
                    ) : (
                      <Badge className="bg-muted/50 text-muted-foreground border-border text-xs">
                        Nao aplica
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {s.is_active ? (
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
                        onClick={() => openEdit(s)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeactivating(s)}
                        title={s.is_active ? "Desativar" : "Reativar"}
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
        <Wrench className="h-3 w-3" />
        {filtered.length} servicos carregados.
      </p>

      {/* ─── Sheet Form ───────────────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editing ? "Editar Servico" : "Novo Servico"}</SheetTitle>
            <SheetDescription>
              {editing ? "Altere os dados e salve." : "Preencha para adicionar ao catalogo."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {/* Codigo */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Codigo *</Label>
              <Input
                placeholder="Ex: SERV-PINT-01"
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
                placeholder="Ex: Pintura de capo"
                {...register("nome")} aria-invalid={!!errors.nome}
              />
              {errors.nome && (
                <p className="text-xs text-error-400">{errors.nome.message}</p>
              )}
            </div>

            {/* Categoria */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Categoria *</Label>
              <Controller
                name="categoria"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoria && (
                <p className="text-xs text-error-400">{errors.categoria.message}</p>
              )}
            </div>

            {/* Unidade */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">Unidade</Label>
              <Controller
                name="unidade"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">un (unidade)</SelectItem>
                      <SelectItem value="h">h (hora)</SelectItem>
                      <SelectItem value="m2">m2 (metro quadrado)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Descricao */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground/70">
                Descricao <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Detalhes do servico..."
                {...register("descricao")} aria-invalid={!!errors.descricao}
              />
            </div>

            {/* Aplica multiplicador tamanho */}
            <div className="flex items-center gap-2">
              <Controller
                name="aplica_multiplicador_tamanho"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="aplica_mult"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="aplica_mult" className="text-sm cursor-pointer">
                Aplica multiplicador de tamanho
              </Label>
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

      {/* ─── AlertDialog for Deactivate/Reactivate ────────────────────────── */}
      <AlertDialog open={!!deactivating} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivating?.is_active ? "Desativar servico?" : "Reativar servico?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.is_active
                ? `O servico "${deactivating?.nome}" sera desativado e nao aparecera mais em novos orcamentos.`
                : `O servico "${deactivating?.nome}" sera reativado e voltara a aparecer em novos orcamentos.`}
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
