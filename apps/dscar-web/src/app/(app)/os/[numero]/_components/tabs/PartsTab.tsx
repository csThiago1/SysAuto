"use client"

import { useState } from "react"
import { Loader2, MoreVertical, Package, Warehouse, ShoppingCart, Shield } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ScrollFade } from "@/components/ui/scroll-fade"

import {
  useOSParts,
  useDeletePart,
  useAddPartEstoque,
  useAddPartCompra,
  useAddPartSeguradora,
} from "@/app/(app)/os/[numero]/_hooks/useOSItems"
import { usePermission } from "@/hooks/usePermission"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TipoQualidadeBadge } from "@/components/purchasing/TipoQualidadeBadge"
import { OrigemBadge } from "@/components/purchasing/OrigemBadge"
import { StatusPecaBadge } from "@/components/purchasing/StatusPecaBadge"
import { MargemBadge } from "@/components/inventory/MargemBadge"
import type { PartCatalogReference, TipoQualidade } from "@paddock/types"
import { useServiceOrder } from "../../_hooks/useServiceOrder"
import { EstoqueBuscaModal } from "@/components/purchasing/EstoqueBuscaModal"
import { CompraFormModal } from "@/components/purchasing/CompraFormModal"
import { SeguradoraFormModal } from "@/components/purchasing/SeguradoraFormModal"
import { formatCurrency } from "@paddock/utils"
import { PartsSummary, calcPartsTotals } from "./PartsTab/PartsSummary"

// ─── Props ──────────────────────────────────────────────────────────────────────

interface PartsTabProps {
  orderId: string
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function PartsTab({ orderId }: PartsTabProps) {
  const [estoqueOpen, setEstoqueOpen] = useState(false)
  const [compraOpen, setCompraOpen] = useState(false)
  const [seguradoraOpen, setSeguradoraOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string>("all")

  const isManager = usePermission("MANAGER")

  const { data: osData } = useServiceOrder(orderId)

  const [compraModalPrefill, setCompraModalPrefill] = useState<{
    description?: string
    partNumber?: string
    catalogRef?: PartCatalogReference
  } | undefined>()

  function handleCatalogSelect(ref: PartCatalogReference) {
    setEstoqueOpen(false)
    setCompraModalPrefill({
      description: ref.description,
      partNumber: ref.manufacturer_code,
      catalogRef: ref,
    })
    setCompraOpen(true)
  }

  const { data: parts, isLoading } = useOSParts(orderId)
  const deletePart = useDeletePart(orderId)
  const addPartEstoque = useAddPartEstoque(orderId)
  const addPartCompra = useAddPartCompra(orderId)
  const addPartSeguradora = useAddPartSeguradora(orderId)

  // ─── Derived data ───────────────────────────────────────────────────────────

  const partsList = parts ?? []
  const filteredParts = sourceFilter === "all" ? partsList : partsList.filter((p) => p.source_type === sourceFilter)

  // Valores derivados de uma peca — a tabela (md+) e os cards (mobile) leem daqui,
  // pra nao duplicar a aritmetica em dois lugares.
  function derivePart(part: (typeof filteredParts)[number]) {
    const bruto = parseFloat(part.unit_price) * parseFloat(part.quantity)
    const desconto = parseFloat(part.discount)
    const cobrado = bruto - desconto
    const custoReal = part.custo_real ? parseFloat(part.custo_real) : null
    return { desconto, cobrado, custoReal, hasMargem: custoReal !== null && cobrado > 0 }
  }

  function pagadorLabel(part: (typeof filteredParts)[number]): string {
    return (
      part.source_type_display ||
      (part.source_type === "import"
        ? "Seguradora"
        : part.source_type === "complement"
        ? "Particular"
        : "Manual")
    )
  }

  const { custoTotal, valorCobrado, margemPct, pendingCount } = calcPartsTotals(partsList)

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function handleEstoqueSelect(data: {
    unidade_fisica_id: string
    tipo_qualidade: TipoQualidade
    unit_price: string
    description: string
  }) {
    try {
      await addPartEstoque.mutateAsync(data)
      toast.success("Peca adicionada do estoque.")
      setEstoqueOpen(false)
    } catch {
      toast.error("Erro ao adicionar peca do estoque.")
    }
  }

  async function handleCompraSubmit(data: {
    description: string
    part_number: string
    tipo_qualidade: TipoQualidade
    unit_price: string
    quantity: string
    observacoes: string
  }) {
    try {
      await addPartCompra.mutateAsync(data)
      toast.success("Peca adicionada para compra.")
      setCompraOpen(false)
    } catch {
      toast.error("Erro ao adicionar peca para compra.")
    }
  }

  async function handleSeguradoraSubmit(data: {
    description: string
    tipo_qualidade: TipoQualidade
    unit_price: string
    quantity: string
  }) {
    try {
      await addPartSeguradora.mutateAsync(data)
      toast.success("Peca da seguradora adicionada.")
      setSeguradoraOpen(false)
    } catch {
      toast.error("Erro ao adicionar peca da seguradora.")
    }
  }

  async function handleDelete(partId: string) {
    try {
      await deletePart.mutateAsync(partId)
      toast.success("Peca removida.")
    } catch {
      toast.error("Erro ao remover peca.")
    }
  }

  // ─── Empty state ────────────────────────────────────────────────────────────

  if (!orderId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Package className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Salve a OS antes de adicionar pecas.</p>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="py-6 space-y-5">
      {/* Header: título + ação única de adicionar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Mobile: eyebrow ocupa a linha toda e a acao desce — a 390px o
            "N pendentes" passava por baixo do botao. */}
        <div className="section-divider w-full min-w-0 sm:w-auto sm:flex-1">
          <span className="whitespace-nowrap">
            PEÇAS DA OS ({partsList.length})
            {pendingCount > 0 && (
              <span className="ml-2 text-warning-400">
                {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </span>
            )}
          </span>
        </div>
        <AddPartMenu
          onEstoque={() => setEstoqueOpen(true)}
          onCompra={() => setCompraOpen(true)}
          onSeguradora={() => setSeguradoraOpen(true)}
        />
      </div>

      {/* Filter chips */}
      {partsList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "Todas", count: partsList.length, color: "" },
            { id: "import", label: "Seguradora", count: partsList.filter((p) => p.source_type === "import").length, color: "info" },
            { id: "complement", label: "Particular", count: partsList.filter((p) => p.source_type === "complement").length, color: "warning" },
            { id: "manual", label: "Manual", count: partsList.filter((p) => p.source_type === "manual").length, color: "" },
          ]
            .filter((f) => f.id === "all" || f.count > 0)
            .map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSourceFilter(f.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  sourceFilter === f.id
                    ? f.color === "info"
                      ? "bg-info-500/15 text-info-400"
                      : f.color === "warning"
                      ? "bg-warning-500/15 text-warning-400"
                      : "bg-white/15 text-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {f.label} ({f.count})
              </button>
            ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground h-5 w-5" />
        </div>
      ) : partsList.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <Package className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhuma peça nesta OS ainda.</p>
          <AddPartMenu
            primary
            onEstoque={() => setEstoqueOpen(true)}
            onCompra={() => setCompraOpen(true)}
            onSeguradora={() => setSeguradoraOpen(true)}
          />
        </div>
      ) : (
        <>
        {/* md+: tabela densa. Mobile: cards — 8 colunas a 390px sao ilegiveis no patio. */}
        <ScrollFade className="hidden rounded-md border border-border bg-muted/50 md:block">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="label-mono text-muted-foreground">Peca</TableHead>
                <TableHead className="label-mono text-muted-foreground text-center">Pagador</TableHead>
                <TableHead className="label-mono text-muted-foreground text-right">Qtd</TableHead>
                <TableHead className="label-mono text-muted-foreground text-right">Unit.</TableHead>
                <TableHead className="label-mono text-muted-foreground text-right">Desconto</TableHead>
                <TableHead className="label-mono text-muted-foreground text-right">Líquido</TableHead>
                {isManager && (
                  <TableHead className="label-mono text-muted-foreground text-right">Custo</TableHead>
                )}
                {isManager && (
                  <TableHead className="label-mono text-muted-foreground text-right">Margem</TableHead>
                )}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParts.map((part) => {
                const { cobrado, custoReal, hasMargem } = derivePart(part)

                return (
                  <TableRow
                    key={part.id}
                    className="border-b border-white/5 hover:bg-muted/30"
                  >
                    {/* Peca: nome + SKU + badges condensados */}
                    <TableCell>
                      <div className="space-y-1">
                        <span className="text-foreground font-medium text-sm">
                          {part.description}
                          {part.part_number && (
                            <span className="ml-2 text-xs text-muted-foreground font-mono font-normal">
                              {part.part_number}
                            </span>
                          )}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {part.tipo_qualidade && <TipoQualidadeBadge tipo={part.tipo_qualidade} />}
                          <OrigemBadge origem={part.origem} />
                          <StatusPecaBadge status={part.status_peca} />
                        </div>
                      </div>
                    </TableCell>

                    {/* Pagador */}
                    <TableCell className="px-3 py-2.5 text-center">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px]",
                          part.source_type === "import"
                            ? "bg-info-500/10 text-info-400"
                            : part.source_type === "complement"
                            ? "bg-warning-500/10 text-warning-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {pagadorLabel(part)}
                      </span>
                    </TableCell>

                    {/* Qtd */}
                    <TableCell className="text-right font-mono text-sm text-foreground/60">
                      {part.quantity}
                    </TableCell>

                    {/* Unit. */}
                    <TableCell className="text-right font-mono text-sm text-foreground/60">
                      {formatCurrency(parseFloat(part.unit_price))}
                    </TableCell>

                    {/* Desconto */}
                    <TableCell className="text-right font-mono text-sm text-foreground/60">
                      {parseFloat(part.discount) > 0
                        ? formatCurrency(parseFloat(part.discount))
                        : "\u2014"}
                    </TableCell>

                    {/* Líquido (cobrado já é bruto − desconto) */}
                    <TableCell className="text-right font-mono text-sm text-foreground font-semibold">
                      {formatCurrency(cobrado)}
                    </TableCell>

                    {/* Custo (MANAGER+) */}
                    {isManager && (
                      <TableCell className="text-right font-mono text-sm text-foreground/60">
                        {custoReal !== null ? formatCurrency(custoReal) : "\u2014"}
                      </TableCell>
                    )}

                    {/* Margem (MANAGER+) */}
                    {isManager && (
                      <TableCell className="text-right">
                        {hasMargem ? (
                          <MargemBadge custo={custoReal!} cobrado={cobrado} />
                        ) : (
                          <span className="text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                    )}

                    {/* Actions */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-error-400 focus:text-error-400"
                            onClick={() => setConfirmDeleteId(part.id)}
                          >
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollFade>

        <ul className="space-y-2 md:hidden">
          {filteredParts.map((part) => {
            const { desconto, cobrado, custoReal, hasMargem } = derivePart(part)

            return (
              <li
                key={part.id}
                className="rounded-[11px] bg-card px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{part.description}</p>
                    {part.part_number && (
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {part.part_number}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Ações da peça ${part.description}`}
                        className="-mr-1 shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-error-400 focus:text-error-400"
                        onClick={() => setConfirmDeleteId(part.id)}
                      >
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {part.tipo_qualidade && <TipoQualidadeBadge tipo={part.tipo_qualidade} />}
                  <OrigemBadge origem={part.origem} />
                  <StatusPecaBadge status={part.status_peca} />
                  {/* Pagador so informa quando ha um: "Manual" nao e pagador, e
                      repetiria o que OrigemBadge/StatusPecaBadge ja dizem. */}
                  {part.source_type !== "manual" && (
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px]",
                        part.source_type === "import"
                          ? "bg-info-500/10 text-info-400"
                          : "bg-warning-500/10 text-warning-400"
                      )}
                    >
                      {pagadorLabel(part)}
                    </span>
                  )}
                </div>

                {/* Rodape em grade de colunas fixas — justify-between faria os
                    valores flutuarem conforme o comprimento do vizinho. */}
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_96px] items-baseline gap-2 border-t border-border pt-2">
                  <span className="truncate font-mono text-xs tabular-nums text-muted-foreground">
                    {part.quantity} × {formatCurrency(parseFloat(part.unit_price))}
                    {desconto > 0 && ` − ${formatCurrency(desconto)}`}
                  </span>
                  <span className="text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(cobrado)}
                  </span>
                </div>

                {isManager && (
                  <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2">
                    <span className="label-mono">Custo</span>
                    <span className="flex items-center justify-end gap-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {custoReal !== null ? formatCurrency(custoReal) : "—"}
                      {hasMargem && <MargemBadge custo={custoReal!} cobrado={cobrado} />}
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        </>
      )}

      {/* Summary cards */}
      {partsList.length > 0 && (
        <PartsSummary
          custoTotal={custoTotal}
          valorCobrado={valorCobrado}
          margemPct={margemPct}
          pendingCount={pendingCount}
          isManager={isManager}
        />
      )}

      {/* Modals */}
      <EstoqueBuscaModal
        open={estoqueOpen}
        onClose={() => setEstoqueOpen(false)}
        osId={orderId}
        onSelect={handleEstoqueSelect}
        vehicleMakeName={osData?.make}
        vehicleModelName={osData?.model}
        vehicleLabel={osData ? `${osData.make} ${osData.model} ${osData.year ?? ""}`.trim() : undefined}
        onCatalogSelect={handleCatalogSelect}
      />
      <CompraFormModal
        open={compraOpen}
        onClose={() => {
          setCompraOpen(false)
          setCompraModalPrefill(undefined)
        }}
        onSubmit={handleCompraSubmit}
        vehicleMakeName={osData?.make}
        vehicleModelName={osData?.model}
        prefill={compraModalPrefill}
      />
      <SeguradoraFormModal
        open={seguradoraOpen}
        onClose={() => setSeguradoraOpen(false)}
        onSubmit={handleSeguradoraSubmit}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
        title="Remover peca"
        description="Tem certeza que deseja remover esta peca da OS? Se veio do estoque, a unidade sera liberada automaticamente."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
      />
    </div>
  )
}

/* ─── Menu único de adicionar peça (3 origens) ─────────────────────────── */

function AddPartMenu({
  primary = false,
  onEstoque,
  onCompra,
  onSeguradora,
}: {
  primary?: boolean
  onEstoque: () => void
  onCompra: () => void
  onSeguradora: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="add-part-menu-btn"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            primary
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-border bg-muted/30 text-foreground/80 hover:bg-muted/60",
          )}
        >
          <Package className="h-4 w-4" />
          Adicionar peça
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem data-testid="part-estoque-btn" onClick={onEstoque}>
          <Warehouse className="mr-2 h-4 w-4 text-success-400" />
          Do estoque
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="part-compra-btn" onClick={onCompra}>
          <ShoppingCart className="mr-2 h-4 w-4 text-info-400" />
          Comprar
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="part-seguradora-btn" onClick={onSeguradora}>
          <Shield className="mr-2 h-4 w-4 text-purple-400" />
          Seguradora fornece
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
