"use client"

import { TableRow, TableCell } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { formatCurrency } from "@paddock/utils"
import type { ServiceItem } from "../../../_utils/service-grouping"

export interface ServiceSubRowProps {
  item: ServiceItem & { _svcType?: string }
  isBlocked: boolean
  editingId: string | null
  editQty: string
  editPrice: string
  setEditQty: (v: string) => void
  setEditPrice: (v: string) => void
  startEdit: (item: ServiceItem) => void
  saveEdit: (id: string) => Promise<void>
  cancelEdit: () => void
  handleDelete: (id: string, desc: string) => void
}

export function ServiceSubRow({
  item,
  isBlocked,
  editingId,
  editQty,
  editPrice,
  setEditQty,
  setEditPrice,
  startEdit,
  saveEdit,
  cancelEdit,
  handleDelete,
}: ServiceSubRowProps) {
  const isEditing = editingId === item.id

  return (
    <TableRow>
      <TableCell className="py-2 pl-10 pr-3 text-foreground/60">{item._svcType}</TableCell>
      <TableCell className="py-2 px-3 text-right text-foreground/90 font-mono">
        {isEditing ? (
          <Input
            type="number"
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            className="h-7 w-16 px-1 text-center"
            min="0.01"
            step="0.01"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveEdit(item.id)
              if (e.key === "Escape") cancelEdit()
            }}
          />
        ) : (
          <span
            className={!isBlocked ? "cursor-pointer hover:text-primary" : ""}
            onClick={!isBlocked ? () => startEdit(item) : undefined}
          >
            {item.quantity}h
          </span>
        )}
      </TableCell>
      <TableCell className="py-2 px-3 text-right text-muted-foreground font-mono">
        {isEditing ? (
          <Input
            type="number"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            className="h-7 w-20 px-1 text-center"
            min="0"
            step="0.01"
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveEdit(item.id)
              if (e.key === "Escape") cancelEdit()
            }}
          />
        ) : (
          <span
            className={!isBlocked ? "cursor-pointer hover:text-primary tabular-nums" : "tabular-nums"}
            onClick={!isBlocked ? () => startEdit(item) : undefined}
          >
            {formatCurrency(Number(item.unit_price))}/h
          </span>
        )}
      </TableCell>
      <TableCell className="py-2 px-4 text-right font-mono font-semibold text-foreground/90">
        {formatCurrency(item.total)}
      </TableCell>
      {!isBlocked && (
        <TableCell className="py-2 px-3 text-center w-16">
          {isEditing ? (
            <div className="flex items-center gap-1 justify-center">
              <button
                type="button"
                onClick={() => void saveEdit(item.id)}
                className="text-success-400 hover:text-success-300"
                title="Salvar"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="text-muted-foreground hover:text-foreground/60"
                title="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 justify-center">
              <button
                type="button"
                onClick={() => startEdit(item)}
                className="text-muted-foreground hover:text-foreground/60"
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(item.id, item.description)}
                className="text-muted-foreground hover:text-error-400"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </TableCell>
      )}
    </TableRow>
  )
}
