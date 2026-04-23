"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useBudgetItems, useDeleteBudgetItem } from "@/hooks/useBudgets"
import { ItemSheet } from "./ItemSheet"
import type { BudgetVersion, BudgetVersionItem } from "@paddock/types"

const ITEM_TYPE_LABELS: Record<string, string> = {
  PART:             "Peça",
  SERVICE:          "Serviço",
  EXTERNAL_SERVICE: "Serv. Externo",
  FEE:              "Taxa",
  DISCOUNT:         "Desconto",
}

const fmt = (v: string | number) =>
  parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

interface Props {
  budgetId: number
  version: BudgetVersion
}

export function ItemsTable({ budgetId, version }: Props) {
  const isDraft = version.status === "draft"

  const { data: items = [], isLoading } = useBudgetItems(budgetId, version.id)
  const { mutateAsync: deleteItem }     = useDeleteBudgetItem(budgetId, version.id)

  const [sheetOpen,    setSheetOpen]    = useState(false)
  const [editingItem,  setEditingItem]  = useState<BudgetVersionItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  function openNew() {
    setEditingItem(null)
    setSheetOpen(true)
  }

  function openEdit(item: BudgetVersionItem) {
    if (!isDraft) return
    setEditingItem(item)
    setSheetOpen(true)
  }

  async function handleDelete() {
    if (deleteTarget === null) return
    try {
      await deleteItem(deleteTarget)
      toast.success("Item removido.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover item.")
    }
    setDeleteTarget(null)
  }

  const laborTotal = items.reduce(
    (acc, item) =>
      acc + item.operations.reduce((s, op) => s + parseFloat(op.labor_cost), 0),
    0
  )

  if (isLoading) return <TableSkeleton columns={6} rows={3} />

  return (
    <div className="space-y-3">
      {/* Tabela */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-white/50">Descrição</TableHead>
              <TableHead className="text-white/50">Tipo</TableHead>
              <TableHead className="text-white/50 text-right">Qtd</TableHead>
              <TableHead className="text-white/50 text-right">Preço Unit.</TableHead>
              <TableHead className="text-white/50 text-right">Desconto</TableHead>
              <TableHead className="text-white/50 text-right">Total Líq.</TableHead>
              {isDraft && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isDraft ? 7 : 6}
                  className="text-center text-white/30 py-10 text-sm"
                >
                  {isDraft
                    ? 'Nenhum item adicionado. Clique em "Adicionar Item" para começar.'
                    : "Versão sem itens."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className={`border-white/5 ${isDraft ? "hover:bg-white/5 cursor-pointer" : ""}`}
                  onClick={() => openEdit(item)}
                >
                  <TableCell className="text-white/90 text-sm max-w-xs truncate">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-white/50 text-xs">
                    {ITEM_TYPE_LABELS[item.item_type] ?? item.item_type}
                  </TableCell>
                  <TableCell className="text-right text-white/70 text-sm">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right text-white/70 text-sm">
                    {fmt(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right text-white/50 text-sm">
                    {parseFloat(item.discount_pct) > 0 ? `${item.discount_pct}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-white font-medium text-sm">
                    {fmt(item.net_price)}
                  </TableCell>
                  {isDraft && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button
                        className="text-white/20 hover:text-error-400 transition-colors"
                        onClick={() => setDeleteTarget(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totais */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 w-72 space-y-1.5 text-sm">
            <div className="flex justify-between text-white/50">
              <span>Peças</span>
              <span>{fmt(version.parts_total)}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Mão de Obra</span>
              <span>
                {fmt(version.labor_total !== "0.00" ? version.labor_total : laborTotal)}
              </span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Descontos</span>
              <span className="text-error-400">- {fmt(version.discount_total)}</span>
            </div>
            <div className="border-t border-white/10 pt-1.5 flex justify-between text-white font-semibold">
              <span>Total Líquido</span>
              <span>{fmt(version.net_total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Ações */}
      {isDraft && (
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={openNew}
            className="gap-2 border-white/20 text-white/70 hover:text-white hover:border-white/40"
          >
            <Plus className="h-4 w-4" />
            Adicionar Item
          </Button>
        </div>
      )}

      {!isDraft && (
        <p className="text-xs text-white/30 italic">
          Versão {version.status === "sent" ? "enviada" : version.status} — somente leitura.
        </p>
      )}

      {/* Sheet */}
      <ItemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        budgetId={budgetId}
        versionId={version.id}
        item={editingItem}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="Remover item?"
        description="O item será removido permanentemente desta versão."
        onConfirm={handleDelete}
        confirmLabel="Remover"
        variant="destructive"
      />
    </div>
  )
}
