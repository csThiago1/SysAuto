"use client"

import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@paddock/utils"
import {
  groupServicesByPart,
  parseServiceDescription,
  type ServiceItem,
} from "../../../_utils/service-grouping"
import { ServiceSubRow } from "./ServiceSubRow"

export interface ServiceGroupedViewProps {
  items: ServiceItem[]
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

export function ServiceGroupedView({
  items,
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
}: ServiceGroupedViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const { groups, flatItems } = useMemo(() => groupServicesByPart(items), [items])

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const subRowProps = {
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
  }

  return (
    <div className="space-y-2">
      {/* Accordion groups (imported items with multiple operations) */}
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.partName)
        return (
          <div key={group.partName} className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(group.partName)}
              className="flex w-full items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-info-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold text-foreground">{group.partName}</span>
                <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                  {group.items.length} operações
                </span>
              </div>
              <span className="text-sm font-bold font-mono text-foreground">
                {formatCurrency(group.total)}
              </span>
            </button>

            {isExpanded && (
              <table className="w-full text-sm">
                <tbody>
                  {group.items.map((item) => (
                    <ServiceSubRow key={item.id} item={item} {...subRowProps} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {/* Flat items: manual, complement, single-operation imported */}
      {flatItems.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {flatItems.map((item) => {
                const { svcType, partName } = parseServiceDescription(item.description)
                return (
                  <tr key={item.id} className="border-t border-white/5 first:border-t-0">
                    <td className="py-2.5 px-4 text-foreground/90 font-medium">{partName}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{svcType || "Serviço"}</td>
                    <td className="py-2.5 px-3 text-right text-foreground/60 font-mono">{item.quantity}h</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground font-mono">
                      {formatCurrency(Number(item.unit_price))}/h
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-foreground/90">
                      {formatCurrency(item.total)}
                    </td>
                    {!isBlocked && (
                      <td className="py-2.5 px-3 text-center w-16">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="text-muted-foreground hover:text-foreground/60 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.description)}
                            className="text-muted-foreground hover:text-error-400 transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
