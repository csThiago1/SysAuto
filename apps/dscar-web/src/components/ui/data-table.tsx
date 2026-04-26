import { cn } from "@/lib/utils"

interface DataTableProps {
  children: React.ReactNode
  emptyMessage?: string
  isEmpty?: boolean
  className?: string
}

export function DataTable({
  children,
  emptyMessage = "Nenhum registro encontrado",
  isEmpty = false,
  className,
}: DataTableProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-white/10 bg-white/5 overflow-hidden",
        className
      )}
    >
      {isEmpty ? (
        <div className="flex items-center justify-center py-12 text-sm text-white/30">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  )
}
