"use client"

import { useState, useCallback, type KeyboardEvent } from "react"
import { Tags, Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type {
  TipoPeca,
  CategoriaProduto,
  CategoriaInsumo,
} from "@paddock/types"
import {
  useTiposPeca,
  useTipoPecaCreate,
  useTipoPecaUpdate,
  useTipoPecaDelete,
  useCategoriasProduto,
  useCategoriaProdutoCreate,
  useCategoriaProdutoUpdate,
  useCategoriaProdutoDelete,
  useCategoriasInsumo,
  useCategoriaInsumoCreate,
  useCategoriaInsumoUpdate,
  useCategoriaInsumoDelete,
} from "@/hooks/useInventoryProduct"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

// ─── Input class tokens ─────────────────────────────────────────────────────


// ─── TipoPeca Tab ────────────────────────────────────────────────────────────

function TiposPecaTab() {
  const { data: items = [], isLoading } = useTiposPeca()
  const createMut = useTipoPecaCreate()
  const updateMut = useTipoPecaUpdate()
  const deleteMut = useTipoPecaDelete()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ codigo: "", nome: "", ordem: 0 })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ codigo: "", nome: "", ordem: 0 })

  async function handleCreate() {
    if (!form.nome.trim() || !form.codigo.trim()) {
      toast.error("Preencha nome e código.")
      return
    }
    try {
      await createMut.mutateAsync({
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        ordem: form.ordem,
      })
      toast.success("Tipo de peça criado.")
      setForm({ codigo: "", nome: "", ordem: 0 })
      setShowForm(false)
    } catch {
      toast.error("Erro ao criar tipo de peça.")
    }
  }

  function startEdit(item: TipoPeca) {
    setEditingId(item.id)
    setEditForm({ codigo: item.codigo, nome: item.nome, ordem: item.ordem })
  }

  async function saveEdit() {
    if (!editingId) return
    try {
      await updateMut.mutateAsync({
        id: editingId,
        data: {
          codigo: editForm.codigo.trim(),
          nome: editForm.nome.trim(),
          ordem: editForm.ordem,
        },
      })
      toast.success("Tipo atualizado.")
      setEditingId(null)
    } catch {
      toast.error("Erro ao atualizar.")
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id)
      toast.success("Tipo removido.")
    } catch {
      toast.error("Erro ao remover.")
    }
  }

  function handleEditKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") saveEdit()
    if (e.key === "Escape") setEditingId(null)
  }

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          Novo Tipo
        </Button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">
                CÓDIGO
              </label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="EX: PRC"
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">
                NOME
              </label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Procura"
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">
                ORDEM
              </label>
              <Input
                type="number"
                value={form.ordem}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ordem: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Criando..." : "Criar"}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhum tipo de peça cadastrado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="py-2.5">
                  CÓDIGO
                </TableHead>
                <TableHead className="py-2.5">
                  NOME
                </TableHead>
                <TableHead className="py-2.5">
                  ORDEM
                </TableHead>
                <TableHead className="py-2.5 text-right">
                  AÇÕES
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) =>
                editingId === item.id ? (
                  <TableRow
                    key={item.id}
                    className="border-white/5 bg-muted/30"
                  >
                    <TableCell className="py-2">
                      <Input
                        value={editForm.codigo}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, codigo: e.target.value }))
                        }
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        value={editForm.nome}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, nome: e.target.value }))
                        }
                        onKeyDown={handleEditKeyDown}
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        type="number"
                        value={editForm.ordem}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            ordem: Number(e.target.value),
                          }))
                        }
                        onKeyDown={handleEditKeyDown}
                      />
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={updateMut.isPending}
                          className="p-1.5 rounded text-success-400 hover:bg-success-500/10 transition-colors"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground/60 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow
                    key={item.id}
                    className="border-white/5"
                  >
                    <TableCell className="py-2.5 font-mono text-sm text-foreground/70">
                      {item.codigo}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-foreground">
                      {item.nome}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-foreground/60">
                      {item.ordem}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground/60 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded text-muted-foreground hover:text-error-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Generic Categoria Tab (reused for Produto and Insumo) ───────────────────

interface CategoriaTabProps<T extends CategoriaProduto | CategoriaInsumo> {
  items: T[]
  isLoading: boolean
  entityLabel: string
  emptyLabel: string
  onCreate: (data: {
    codigo: string
    nome: string
    margem_padrao_pct: string
    ordem: number
  }) => Promise<void>
  createPending: boolean
  onUpdate: (
    id: string,
    data: {
      codigo: string
      nome: string
      margem_padrao_pct: string
      ordem: number
    }
  ) => Promise<void>
  updatePending: boolean
  onDelete: (id: string) => Promise<void>
}

function CategoriaTab<T extends CategoriaProduto | CategoriaInsumo>({
  items,
  isLoading,
  entityLabel,
  emptyLabel,
  onCreate,
  createPending,
  onUpdate,
  updatePending,
  onDelete,
}: CategoriaTabProps<T>) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    margem_padrao_pct: "0",
    ordem: 0,
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    codigo: "",
    nome: "",
    margem_padrao_pct: "0",
    ordem: 0,
  })

  async function handleCreate() {
    if (!form.nome.trim() || !form.codigo.trim()) {
      toast.error("Preencha nome e código.")
      return
    }
    try {
      await onCreate({
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        margem_padrao_pct: form.margem_padrao_pct,
        ordem: form.ordem,
      })
      toast.success(`${entityLabel} criada.`)
      setForm({ codigo: "", nome: "", margem_padrao_pct: "0", ordem: 0 })
      setShowForm(false)
    } catch {
      toast.error(`Erro ao criar ${entityLabel.toLowerCase()}.`)
    }
  }

  function startEdit(item: T) {
    setEditingId(item.id)
    setEditForm({
      codigo: item.codigo,
      nome: item.nome,
      margem_padrao_pct: item.margem_padrao_pct,
      ordem: item.ordem,
    })
  }

  async function saveEdit() {
    if (!editingId) return
    try {
      await onUpdate(editingId, {
        codigo: editForm.codigo.trim(),
        nome: editForm.nome.trim(),
        margem_padrao_pct: editForm.margem_padrao_pct,
        ordem: editForm.ordem,
      })
      toast.success(`${entityLabel} atualizada.`)
      setEditingId(null)
    } catch {
      toast.error("Erro ao atualizar.")
    }
  }

  async function handleDelete(id: string) {
    try {
      await onDelete(id)
      toast.success(`${entityLabel} removida.`)
    } catch {
      toast.error("Erro ao remover.")
    }
  }

  function handleEditKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") saveEdit()
    if (e.key === "Escape") setEditingId(null)
  }

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          Nova {entityLabel}
        </Button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">
                CÓDIGO
              </label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="EX: MOT"
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">
                NOME
              </label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Motor"
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">
                MARGEM %
              </label>
              <Input
                type="number"
                step="0.01"
                value={form.margem_padrao_pct}
                onChange={(e) =>
                  setForm((f) => ({ ...f, margem_padrao_pct: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">
                ORDEM
              </label>
              <Input
                type="number"
                value={form.ordem}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ordem: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createPending}
            >
              {createPending ? "Criando..." : "Criar"}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          {emptyLabel}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="py-2.5">
                  CÓDIGO
                </TableHead>
                <TableHead className="py-2.5">
                  NOME
                </TableHead>
                <TableHead className="py-2.5">
                  MARGEM %
                </TableHead>
                <TableHead className="py-2.5">
                  ORDEM
                </TableHead>
                <TableHead className="py-2.5 text-right">
                  AÇÕES
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) =>
                editingId === item.id ? (
                  <TableRow
                    key={item.id}
                    className="border-white/5 bg-muted/30"
                  >
                    <TableCell className="py-2">
                      <Input
                        value={editForm.codigo}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            codigo: e.target.value,
                          }))
                        }
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        value={editForm.nome}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, nome: e.target.value }))
                        }
                        onKeyDown={handleEditKeyDown}
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.margem_padrao_pct}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            margem_padrao_pct: e.target.value,
                          }))
                        }
                        onKeyDown={handleEditKeyDown}
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        type="number"
                        value={editForm.ordem}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            ordem: Number(e.target.value),
                          }))
                        }
                        onKeyDown={handleEditKeyDown}
                      />
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={updatePending}
                          className="p-1.5 rounded text-success-400 hover:bg-success-500/10 transition-colors"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground/60 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow
                    key={item.id}
                    className="border-white/5"
                  >
                    <TableCell className="py-2.5 font-mono text-sm text-foreground/70">
                      {item.codigo}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-foreground">
                      {item.nome}
                    </TableCell>
                    <TableCell className="py-2.5 font-mono text-sm text-foreground/70">
                      {item.margem_padrao_pct}%
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-foreground/60">
                      {item.ordem}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground/60 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded text-muted-foreground hover:text-error-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Wrapper tabs for CategoriaProduto and CategoriaInsumo ───────────────────

function CategoriaProdutoTab() {
  const { data: items = [], isLoading } = useCategoriasProduto()
  const createMut = useCategoriaProdutoCreate()
  const updateMut = useCategoriaProdutoUpdate()
  const deleteMut = useCategoriaProdutoDelete()

  const handleCreate = useCallback(
    async (data: {
      codigo: string
      nome: string
      margem_padrao_pct: string
      ordem: number
    }) => {
      await createMut.mutateAsync(data)
    },
    [createMut]
  )

  const handleUpdate = useCallback(
    async (
      id: string,
      data: {
        codigo: string
        nome: string
        margem_padrao_pct: string
        ordem: number
      }
    ) => {
      await updateMut.mutateAsync({ id, data })
    },
    [updateMut]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMut.mutateAsync(id)
    },
    [deleteMut]
  )

  return (
    <CategoriaTab
      items={items}
      isLoading={isLoading}
      entityLabel="Categoria"
      emptyLabel="Nenhuma categoria de produto cadastrada."
      onCreate={handleCreate}
      createPending={createMut.isPending}
      onUpdate={handleUpdate}
      updatePending={updateMut.isPending}
      onDelete={handleDelete}
    />
  )
}

function CategoriaInsumoTab() {
  const { data: items = [], isLoading } = useCategoriasInsumo()
  const createMut = useCategoriaInsumoCreate()
  const updateMut = useCategoriaInsumoUpdate()
  const deleteMut = useCategoriaInsumoDelete()

  const handleCreate = useCallback(
    async (data: {
      codigo: string
      nome: string
      margem_padrao_pct: string
      ordem: number
    }) => {
      await createMut.mutateAsync(data)
    },
    [createMut]
  )

  const handleUpdate = useCallback(
    async (
      id: string,
      data: {
        codigo: string
        nome: string
        margem_padrao_pct: string
        ordem: number
      }
    ) => {
      await updateMut.mutateAsync({ id, data })
    },
    [updateMut]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMut.mutateAsync(id)
    },
    [deleteMut]
  )

  return (
    <CategoriaTab
      items={items}
      isLoading={isLoading}
      entityLabel="Categoria"
      emptyLabel="Nenhuma categoria de insumo cadastrada."
      onCreate={handleCreate}
      createPending={createMut.isPending}
      onUpdate={handleUpdate}
      updatePending={updateMut.isPending}
      onDelete={handleDelete}
    />
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CategoriasPage() {
  return (
    <div className="px-0 py-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Tags className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Categorias e Tipos
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tipos de peça, categorias de produto e categorias de insumo
          </p>
        </div>
      </div>

      <Tabs variant="underline" defaultValue="tipos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tipos">Tipos de Peça</TabsTrigger>
          <TabsTrigger value="cat_produto">Categorias de Produto</TabsTrigger>
          <TabsTrigger value="cat_insumo">Categorias de Insumo</TabsTrigger>
        </TabsList>

        <TabsContent value="tipos" className="mt-0"><TiposPecaTab /></TabsContent>
        <TabsContent value="cat_produto" className="mt-0"><CategoriaProdutoTab /></TabsContent>
        <TabsContent value="cat_insumo" className="mt-0"><CategoriaInsumoTab /></TabsContent>
      </Tabs>
    </div>
  )
}
