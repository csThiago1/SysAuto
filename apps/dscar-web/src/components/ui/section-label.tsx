import { cn } from "@/lib/utils"

/** Eyebrow de seção — barato em altura, organiza sem card em volta. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground",
        "after:h-px after:flex-1 after:bg-border",
        className,
      )}
    >
      {children}
    </p>
  )
}
