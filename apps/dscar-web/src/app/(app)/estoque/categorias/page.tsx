"use client"

import { useState, useCallback, type KeyboardEvent } from "react"
import { Tags, Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { toast } from "sonner"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  TipoPeca,
  CategoriaProduto,
  CategoriaInsumo,
} from "@paddock/types"
import {
  useTiposPeca,
  useTipoPecaCreate,
  useCategoriasProduto,
  useCategoriaProdutoCreate,
  useCategoriasInsumo,
  useCategoriaInsumoCreate,
  productKeys,
} from "@/hooks/useInventoryProduct"
import { apiFetch } from "@/lib/api"

const INV = "/api/proxy/inventory"

// ─── Input class tokens ─────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"

// ─── Tab type ────────────────────────────────────────────────────────────────

type Tab = "tipos" | "cat_produto" | "cat_insumo"

// ─── TipoPeca Tab ────────────────────────────────────────────────────────────

function TiposPecaTab() {
  const { data: items = [], isLoading } = useTiposPeca()
  const createMut = useTipoPecaCreate()
  const qc = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ codigo: "", nome: "", ordem: 0 })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ codigo: "", nome: "", ordem: 0 })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TipoPeca> }) =>
      apiFetch<TipoPeca>(`${INV}/tipos-peca/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.tiposPeca() }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${INV}/tipos-peca/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.tiposPeca() }),
  })

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
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Tipo
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                CÓDIGO
              </label>
              <input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="EX: PRC"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                NOME
              </label>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Procura"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                ORDEM
              </label>
              <input
                type="number"
                value={form.ordem}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ordem: Number(e.target.value) }))
                }
                className={INPUT_CLS}
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
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMut.isPending}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createMut.isPending ? "Criando..." : "Criar"}
            </button>
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left">
                  CÓDIGO
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left">
                  NOME
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left">
                  ORDEM
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-right">
                  AÇÕES
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) =>
                editingId === item.id ? (
                  <tr
                    key={item.id}
                    className="border-b border-white/5 bg-muted/30"
                  >
                    <td className="px-4 py-2">
                      <input
                        value={editForm.codigo}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, codigo: e.target.value }))
                        }
                        onKeyDown={handleEditKeyDown}
                        className={INPUT_CLS}
                        autoFocus
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.nome}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, nome: e.target.value }))
                        }
                        onKeyDown={handleEditKeyDown}
                        className={INPUT_CLS}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editForm.ordem}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            ordem: Number(e.target.value),
                          }))
                        }
                        onKeyDown={handleEditKeyDown}
                        className={INPUT_CLS}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
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
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={item.id}
                    className="border-b border-white/5 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-sm text-foreground/70">
                      {item.codigo}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-foreground">
                      {item.nome}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-foreground/60">
                      {item.ordem}
                    </td>
                    <td className="px-4 py-2.5 text-right">
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
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
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
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova {entityLabel}
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                CÓDIGO
              </label>
              <input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="EX: MOT"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                NOME
              </label>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Motor"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                MARGEM %
              </label>
              <input
                type="number"
                step="0.01"
                value={form.margem_padrao_pct}
                onChange={(e) =>
                  setForm((f) => ({ ...f, margem_padrao_pct: e.target.value }))
                }
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                ORDEM
              </label>
              <input
                type="number"
                value={form.ordem}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ordem: Number(e.target.value) }))
                }
                className={INPUT_CLS}
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
            <button
              type="button"
              onClick={handleCreate}
              disabled={createPending}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createPending ? "Criando..." : "Criar"}
            </button>
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left">
                  CÓDIGO
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left">
                  NOME
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left">
                  MARGEM %
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left">
                  ORDEM
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-right">
                  AÇÕES
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) =>
                editingId === item.id ? (
                  <tr
                    key={item.id}
                    className="border-b border-white/5 bg-muted/30"
                  >
                    <td className="px-4 py-2">
                      <input
                        value={editForm.codigo}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            codigo: e.target.value,
                          }))
                        }
                        onKeyDown={handleEditKeyDown}
                        className={INPUT_CLS}
                        autoFocus
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.nome}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, nome: e.target.value }))
                        }
                        onKeyDown={handleEditKeyDown}
                        className={INPUT_CLS}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
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
                        className={INPUT_CLS}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editForm.ordem}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            ordem: Number(e.target.value),
                          }))
                        }
                        onKeyDown={handleEditKeyDown}
                        className={INPUT_CLS}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
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
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={item.id}
                    className="border-b border-white/5 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-sm text-foreground/70">
                      {item.codigo}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-foreground">
                      {item.nome}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-foreground/70">
                      {item.margem_padrao_pct}%
                    </td>
                    <td className="px-4 py-2.5 text-sm text-foreground/60">
                      {item.ordem}
                    </td>
                    <td className="px-4 py-2.5 text-right">
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
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Wrapper tabs for CategoriaProduto and CategoriaInsumo ───────────────────

function CategoriaProdutoTab() {
  const { data: items = [], isLoading } = useCategoriasProduto()
  const createMut = useCategoriaProdutoCreate()
  const qc = useQueryClient()

  const updateMut = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<CategoriaProduto>
    }) =>
      apiFetch<CategoriaProduto>(`${INV}/categorias-produto/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.categoriasProduto() }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${INV}/categorias-produto/${id}/`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.categoriasProduto() }),
  })

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
  const qc = useQueryClient()

  const updateMut = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<CategoriaInsumo>
    }) =>
      apiFetch<CategoriaInsumo>(`${INV}/categorias-insumo/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.categoriasInsumo() }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${INV}/categorias-insumo/${id}/`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.categoriasInsumo() }),
  })

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
  const [activeTab, setActiveTab] = useState<Tab>("tipos")

  return (
    <div className="p-6 space-y-6">
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

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border">
        <button
          type="button"
          className={`px-4 py-2.5 text-sm transition-colors ${
            activeTab === "tipos"
              ? "text-foreground border-b-2 border-primary font-medium"
              : "text-muted-foreground hover:text-foreground/60"
          }`}
          onClick={() => setActiveTab("tipos")}
        >
          Tipos de Peça
        </button>
        <button
          type="button"
          className={`px-4 py-2.5 text-sm transition-colors ${
            activeTab === "cat_produto"
              ? "text-foreground border-b-2 border-primary font-medium"
              : "text-muted-foreground hover:text-foreground/60"
          }`}
          onClick={() => setActiveTab("cat_produto")}
        >
          Categorias de Produto
        </button>
        <button
          type="button"
          className={`px-4 py-2.5 text-sm transition-colors ${
            activeTab === "cat_insumo"
              ? "text-foreground border-b-2 border-primary font-medium"
              : "text-muted-foreground hover:text-foreground/60"
          }`}
          onClick={() => setActiveTab("cat_insumo")}
        >
          Categorias de Insumo
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "tipos" && <TiposPecaTab />}
      {activeTab === "cat_produto" && <CategoriaProdutoTab />}
      {activeTab === "cat_insumo" && <CategoriaInsumoTab />}
    </div>
  )
}
