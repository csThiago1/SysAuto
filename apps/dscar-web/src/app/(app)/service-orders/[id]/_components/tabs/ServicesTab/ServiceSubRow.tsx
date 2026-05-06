"use client"

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
    <tr className="border-t border-white/5">
      <td className="py-2 pl-10 pr-3 text-foreground/60">{item._svcType}</td>
      <td className="py-2 px-3 text-right text-foreground/90 font-mono">
        {isEditing ? (
          <input
            type="number"
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            className="w-16 border border-border rounded px-1 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
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
      </td>
      <td className="py-2 px-3 text-right text-muted-foreground font-mono">
        {isEditing ? (
          <input
            type="number"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            className="w-20 border border-border rounded px-1 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
            min="0"
            step="0.01"
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
            {formatCurrency(Number(item.unit_price))}/h
          </span>
        )}
      </td>
      <td className="py-2 px-4 text-right font-mono font-semibold text-foreground/90">
        {formatCurrency(item.total)}
      </td>
      {!isBlocked && (
        <td className="py-2 px-3 text-center w-16">
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
        </td>
      )}
    </tr>
  )
}
