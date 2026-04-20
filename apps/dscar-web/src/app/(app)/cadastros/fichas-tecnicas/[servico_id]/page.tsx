"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { z } from "zod"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  ArrowLeft,
  Plus,
  Trash2,
  ClipboardList,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { useFichas, useNovaVersao } from "@/hooks/useFichaTecnica"
import { useCategoriaMaoObra } from "@/hooks/useFichaTecnicaHelpers"
import { useMateriaisCanonico } from "@/hooks/usePricingCatalog"
import type {
  FichaTecnicaMaoObraItem,
  FichaTecnicaInsumoItem,
  NovaVersaoPayload,
} from "@paddock/types"

// ─── Zod schema ───────────────────────────────────────────────────────────────

const novaVersaoSchema = z.object({
  motivo: z.string().min(10, "Mínimo 10 caracteres").max(300),
  tipo_pintura_id: z.string().nullable().optional(),
  maos_obra: z
    .array(
      z.object({
        categoria: z.string().min(1, "Selecione uma categoria"),
        horas: z.string().min(1, "Informe as horas"),
        afetada_por_tamanho: z.boolean(),
        observacao: z.string().default(""),
      })
    )
    .min(1, "Adicione pelo menos 1 mão de obra"),
  insumos: z.array(
    z.object({
      material_canonico: z.string().min(1, "Selecione um material"),
      quantidade: z.string().min(1, "Informe a quantidade"),
      unidade: z.string().min(1, "Informe a unidade"),
      afetado_por_tamanho: z.boolean(),
      observacao: z.string().default(""),
    })
  ),
})

type NovaVersaoForm = z.infer<typeof novaVersaoSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function FichaTecnicaDetalhe() {
  const params = useParams<{ servico_id: string }>()
  const router = useRouter()
  const servicoId = params.servico_id
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tipoPinturaFiltro, setTipoPinturaFiltro] = useState<string>("__generica__")

  const { data: fichas = [], isLoading } = useFichas(servicoId)
  const { categoriasMaoObra } = useCategoriaMaoObra()
  const { data: materiais = [] } = useMateriaisCanonico()

  // Ficha ativa atual conforme filtro de tipo pintura
  const fichaAtiva = fichas.find((f) => {
    if (tipoPinturaFiltro === "__generica__") return f.tipo_pintura === null
    return f.tipo_pintura === tipoPinturaFiltro
  })

  // Opções de variação por tipo pintura (fichas ativas com tipos distintos)
  const variacoes = fichas.filter((f) => f.tipo_pintura !== null)

  const novaVersaoMutation = useNovaVersao(fichaAtiva?.id ?? "")

  const form = useForm<NovaVersaoForm>({
    resolver: zodResolver(novaVersaoSchema),
    defaultValues: {
      motivo: "",
      tipo_pintura_id: fichaAtiva?.tipo_pintura ?? null,
      maos_obra: [],
      insumos: [],
    },
  })

  const {
    fields: camposMO,
    append: appendMO,
    remove: removeMO,
  } = useFieldArray({ control: form.control, name: "maos_obra" })

  const {
    fields: camposIns,
    append: appendIns,
    remove: removeIns,
  } = useFieldArray({ control: form.control, name: "insumos" })

  function openDialog() {
    // Pré-preenche com dados da ficha atual
    form.reset({
      motivo: "",
      tipo_pintura_id: fichaAtiva?.tipo_pintura ?? null,
      maos_obra: fichaAtiva?.maos_obra?.map((mo) => ({
        categoria: mo.categoria,
        horas: mo.horas,
        afetada_por_tamanho: mo.afetada_por_tamanho,
        observacao: mo.observacao,
      })) ?? [],
      insumos: fichaAtiva?.insumos?.map((ins) => ({
        material_canonico: ins.material_canonico,
        quantidade: ins.quantidade,
        unidade: ins.unidade,
        afetado_por_tamanho: ins.afetado_por_tamanho,
        observacao: ins.observacao,
      })) ?? [],
    })
    setDialogOpen(true)
  }

  async function handleSalvarNovaVersao(values: NovaVersaoForm) {
    const payload: NovaVersaoPayload = {
      motivo: values.motivo,
      tipo_pintura_id: values.tipo_pintura_id ?? null,
      maos_obra: values.maos_obra.map((mo) => ({
        categoria: mo.categoria,
        horas: mo.horas,
        afetada_por_tamanho: mo.afetada_por_tamanho,
        observacao: mo.observacao,
      })),
      insumos: values.insumos.map((ins) => ({
        material_canonico: ins.material_canonico,
        quantidade: ins.quantidade,
        unidade: ins.unidade,
        afetado_por_tamanho: ins.afetado_por_tamanho,
        observacao: ins.observacao,
      })),
    }

    try {
      await novaVersaoMutation.mutateAsync(payload)
      toast.success("Nova versão criada com sucesso.")
      setDialogOpen(false)
    } catch {
      toast.error("Erro ao criar nova versão. Verifique os dados e tente novamente.")
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <TableSkeleton columns={4} rows={6} />
      </div>
    )
  }

  if (fichas.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <div className="py-12 text-center text-sm text-neutral-400">
          Nenhuma ficha técnica encontrada para este serviço.
        </div>
      </div>
    )
  }

  const primeiraFicha = fichas[0]
  const servicoNome = primeiraFicha.servico_nome
  const servicoCodigo = primeiraFicha.servico_codigo

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Fichas Técnicas
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{servicoNome}</h1>
            <p className="mt-1 text-xs font-mono text-neutral-400">{servicoCodigo}</p>
          </div>
          {fichaAtiva && (
            <Button onClick={openDialog} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Salvar como nova versão (v{fichaAtiva.versao + 1})
            </Button>
          )}
        </div>
      </div>

      {/* Seletor de variação por tipo de pintura */}
      {variacoes.length > 0 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm text-neutral-600 shrink-0">Variação por tipo de pintura:</Label>
          <Select
            value={tipoPinturaFiltro}
            onValueChange={setTipoPinturaFiltro}
          >
            <SelectTrigger className="w-56 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__generica__">Genérica (sem variação)</SelectItem>
              {variacoes.map((f) => (
                <SelectItem key={f.tipo_pintura!} value={f.tipo_pintura!}>
                  {f.tipo_pintura_nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Ficha ativa */}
      {fichaAtiva ? (
        <>
          {/* Meta da versão ativa */}
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono">
              v{fichaAtiva.versao}
            </Badge>
            <span>
              criada em {formatDate(fichaAtiva.criada_em)}
              {fichaAtiva.criada_por_email && ` por ${fichaAtiva.criada_por_email}`}
            </span>
            {fichaAtiva.motivo_nova_versao && (
              <span className="text-neutral-400 italic truncate max-w-xs">
                — {fichaAtiva.motivo_nova_versao}
              </span>
            )}
          </div>

          {/* Mão de obra */}
          <section>
            <h2 className="text-sm font-semibold text-neutral-700 mb-2">Mão de Obra</h2>
            {!fichaAtiva.maos_obra || fichaAtiva.maos_obra.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhuma mão de obra cadastrada.</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
                <Table>
                  <TableHeader className="bg-neutral-50">
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="w-28 text-right">Horas</TableHead>
                      <TableHead className="w-44 text-center">Afetada por Tamanho</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fichaAtiva.maos_obra.map((mo: FichaTecnicaMaoObraItem) => (
                      <TableRow key={mo.id}>
                        <TableCell className="py-2">
                          <div className="font-medium text-neutral-800">{mo.categoria_nome}</div>
                          <div className="text-xs text-neutral-400 font-mono">{mo.categoria_codigo}</div>
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-neutral-700">
                          {mo.horas}h
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          {mo.afetada_por_tamanho ? (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              Sim
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-neutral-400">
                              Não
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-neutral-500">
                          {mo.observacao || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* Insumos */}
          <section>
            <h2 className="text-sm font-semibold text-neutral-700 mb-2">Insumos</h2>
            {!fichaAtiva.insumos || fichaAtiva.insumos.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhum insumo cadastrado.</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
                <Table>
                  <TableHeader className="bg-neutral-50">
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="w-28 text-right">Qtde</TableHead>
                      <TableHead className="w-20">Unidade</TableHead>
                      <TableHead className="w-44 text-center">Afetado por Tamanho</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fichaAtiva.insumos.map((ins: FichaTecnicaInsumoItem) => (
                      <TableRow key={ins.id}>
                        <TableCell className="py-2">
                          <div className="font-medium text-neutral-800">{ins.material_nome}</div>
                          <div className="text-xs text-neutral-400 font-mono">{ins.material_codigo}</div>
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-neutral-700">
                          {ins.quantidade}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-neutral-600">{ins.unidade}</TableCell>
                        <TableCell className="py-2 text-center">
                          {ins.afetado_por_tamanho ? (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              Sim
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-neutral-400">
                              Não
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-neutral-400 py-6">
          Nenhuma ficha ativa para a variação selecionada.
        </p>
      )}

      {/* Histórico de versões */}
      {fichas.length > 1 && (
        <section>
          <h2 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
            <ChevronDown className="h-4 w-4 text-neutral-400" />
            Histórico de versões ({fichas.length})
          </h2>
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <Table>
              <TableHeader className="bg-neutral-50">
                <TableRow>
                  <TableHead className="w-20">Versão</TableHead>
                  <TableHead className="w-40">Tipo Pintura</TableHead>
                  <TableHead className="w-44">Criada em</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-20 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fichas
                  .slice()
                  .sort((a, b) => b.versao - a.versao)
                  .map((f) => (
                    <TableRow key={f.id} className={f.is_active ? "" : "opacity-50"}>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          v{f.versao}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-neutral-600">
                        {f.tipo_pintura_nome ?? "Genérica"}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-neutral-500">
                        {formatDateTime(f.criada_em)}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-neutral-600 truncate max-w-xs">
                        {f.motivo_nova_versao || "—"}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {f.is_active ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-neutral-400">
                            Inativa
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Dialog: Nova Versão */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Nova Versão — v{(fichaAtiva?.versao ?? 0) + 1}
            </DialogTitle>
          </DialogHeader>

          {/* Usando div em vez de form para evitar form aninhado (CLAUDE.md) */}
          <div className="flex flex-col gap-5 py-2">
            {/* Motivo */}
            <div className="space-y-1.5">
              <Label htmlFor="motivo" className="text-sm font-medium">
                Motivo da nova versão <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo desta revisão (mín. 10 caracteres)..."
                className="resize-none"
                rows={2}
                {...form.register("motivo")}
              />
              {form.formState.errors.motivo && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.motivo.message}
                </p>
              )}
            </div>

            {/* Mão de Obra */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Mão de Obra</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendMO({
                      categoria: "",
                      horas: "",
                      afetada_por_tamanho: true,
                      observacao: "",
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>
              {form.formState.errors.maos_obra &&
                !Array.isArray(form.formState.errors.maos_obra) && (
                  <p className="text-xs text-red-500">
                    {(form.formState.errors.maos_obra as { message?: string }).message}
                  </p>
                )}
              {camposMO.length === 0 ? (
                <p className="text-sm text-neutral-400">Nenhuma mão de obra adicionada.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {camposMO.map((field, idx) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_100px_auto_auto] gap-2 items-center"
                    >
                      <Select
                        value={form.watch(`maos_obra.${idx}.categoria`)}
                        onValueChange={(v) => form.setValue(`maos_obra.${idx}.categoria`, v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Categoria MO" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriasMaoObra.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Horas"
                        className="h-9"
                        {...form.register(`maos_obra.${idx}.horas`)}
                      />
                      <label className="flex items-center gap-1.5 text-xs text-neutral-500 whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={form.watch(`maos_obra.${idx}.afetada_por_tamanho`)}
                          onChange={(e) =>
                            form.setValue(
                              `maos_obra.${idx}.afetada_por_tamanho`,
                              e.target.checked
                            )
                          }
                        />
                        Por tamanho
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-neutral-400 hover:text-red-500"
                        onClick={() => removeMO(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Insumos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Insumos</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendIns({
                      material_canonico: "",
                      quantidade: "",
                      unidade: "",
                      afetado_por_tamanho: true,
                      observacao: "",
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>
              {camposIns.length === 0 ? (
                <p className="text-sm text-neutral-400">Nenhum insumo adicionado.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {camposIns.map((field, idx) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_80px_80px_auto_auto] gap-2 items-center"
                    >
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={form.watch(`insumos.${idx}.material_canonico`)}
                        onChange={(e) => {
                          form.setValue(`insumos.${idx}.material_canonico`, e.target.value)
                          const mat = materiais.find((m) => m.id === e.target.value)
                          if (mat) form.setValue(`insumos.${idx}.unidade`, mat.unidade_base)
                        }}
                      >
                        <option value="">Selecione o material</option>
                        {materiais.map((m) => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                      <Input
                        placeholder="Qtde"
                        className="h-9"
                        {...form.register(`insumos.${idx}.quantidade`)}
                      />
                      <Input
                        placeholder="Unid."
                        className="h-9"
                        {...form.register(`insumos.${idx}.unidade`)}
                      />
                      <label className="flex items-center gap-1.5 text-xs text-neutral-500 whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={form.watch(`insumos.${idx}.afetado_por_tamanho`)}
                          onChange={(e) =>
                            form.setValue(
                              `insumos.${idx}.afetado_por_tamanho`,
                              e.target.checked
                            )
                          }
                        />
                        Por tamanho
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-neutral-400 hover:text-red-500"
                        onClick={() => removeIns(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={novaVersaoMutation.isPending}
              onClick={() => form.handleSubmit(handleSalvarNovaVersao)()}
            >
              {novaVersaoMutation.isPending ? "Salvando..." : "Criar nova versão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
