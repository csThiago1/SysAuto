"use client"

import { useState } from "react"
import { Loader2, MoreVertical, Package, Warehouse, ShoppingCart, Shield } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import {
  useOSParts,
  useDeleteOSPart,
  useAddPartEstoque,
  useAddPartCompra,
  useAddPartSeguradora,
} from "@/hooks/useServiceOrders"
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
import { EstoqueBuscaModal } from "@/components/purchasing/EstoqueBuscaModal"
import { CompraFormModal } from "@/components/purchasing/CompraFormModal"
import { SeguradoraFormModal } from "@/components/purchasing/SeguradoraFormModal"
import { formatCurrency } from "@paddock/utils"
import { PartsSummary, calcPartsTotals } from "./PartsTab"

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

  const { data: parts, isLoading } = useOSParts(orderId)
  const deletePart = useDeleteOSPart(orderId)
  const addPartEstoque = useAddPartEstoque(orderId)
  const addPartCompra = useAddPartCompra(orderId)
  const addPartSeguradora = useAddPartSeguradora(orderId)

  // ─── Derived data ───────────────────────────────────────────────────────────

  const partsList = parts ?? []
  const filteredParts = sourceFilter === "all" ? partsList : partsList.filter((p) => p.source_type === sourceFilter)

  const { custoTotal, valorCobrado, margemPct, pendingCount } = calcPartsTotals(partsList)

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function handleEstoqueSelect(data: {
    unidade_fisica_id: string
    tipo_qualidade: string
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
    tipo_qualidade: string
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
    tipo_qualidade: string
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
      {/* Origin buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEstoqueOpen(true)}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors bg-success-500/10 border-success-500/20 text-success-400 hover:bg-success-500/20"
        >
          <Warehouse className="h-4 w-4" />
          Do Estoque
        </button>
        <button
          type="button"
          onClick={() => setCompraOpen(true)}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors bg-info-500/10 border-info-500/20 text-info-400 hover:bg-info-500/20"
        >
          <ShoppingCart className="h-4 w-4" />
          Comprar
        </button>
        <button
          type="button"
          onClick={() => setSeguradoraOpen(true)}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
        >
          <Shield className="h-4 w-4" />
          Seguradora Fornece
        </button>
      </div>

      {/* Section divider */}
      <div className="section-divider">
        PECAS DA OS ({partsList.length})
        {pendingCount > 0 && (
          <span className="ml-2 text-warning-400">
            {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
          </span>
        )}
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
                      ? "bg-info-500/15 text-info-500"
                      : f.color === "warning"
                      ? "bg-warning-500/15 text-warning-500"
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
        <div className="bg-muted/50 border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          Nenhuma peca adicionada. Use os botoes acima para adicionar.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="label-mono text-muted-foreground">Peca</TableHead>
                <TableHead className="label-mono text-muted-foreground">Tipo</TableHead>
                <TableHead className="label-mono text-muted-foreground">Origem</TableHead>
                <TableHead className="label-mono text-muted-foreground">Status</TableHead>
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
                const bruto = parseFloat(part.unit_price) * parseFloat(part.quantity)
                const desconto = parseFloat(part.discount)
                const cobrado = bruto - desconto
                const custoReal = part.custo_real ? parseFloat(part.custo_real) : null
                const hasMargem = custoReal !== null && cobrado > 0

                return (
                  <TableRow
                    key={part.id}
                    className="border-b border-white/5 hover:bg-muted/30"
                  >
                    {/* Peca name + SKU */}
                    <TableCell>
                      <div>
                        <span className="text-foreground font-medium text-sm">
                          {part.description}
                        </span>
                        {part.part_number && (
                          <span className="block text-xs text-muted-foreground font-mono mt-0.5">
                            {part.part_number}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Tipo qualidade */}
                    <TableCell>
                      <TipoQualidadeBadge tipo={part.tipo_qualidade} />
                    </TableCell>

                    {/* Origem */}
                    <TableCell>
                      <OrigemBadge origem={part.origem} />
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <StatusPecaBadge status={part.status_peca} />
                    </TableCell>

                    {/* Pagador */}
                    <TableCell className="px-3 py-2.5 text-center">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px]",
                          part.source_type === "import"
                            ? "bg-info-500/10 text-info-500"
                            : part.source_type === "complement"
                            ? "bg-warning-500/10 text-warning-500"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {part.source_type_display ||
                          (part.source_type === "import"
                            ? "Seguradora"
                            : part.source_type === "complement"
                            ? "Particular"
                            : "Manual")}
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

                    {/* Líquido */}
                    <TableCell className="text-right font-mono text-sm text-foreground font-semibold">
                      {formatCurrency(cobrado - parseFloat(part.discount))}
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
                          <span className="text-muted-foreground">\u2014</span>
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
        </div>
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
      />
      <CompraFormModal
        open={compraOpen}
        onClose={() => setCompraOpen(false)}
        onSubmit={handleCompraSubmit}
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
